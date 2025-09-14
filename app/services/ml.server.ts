import { unauthenticated } from "~/shopify.server";
// import prisma from "~/db.server"; // TODO: Re-enable when Bundle model access is fixed

type BundleProduct = {
  id: string;
  variant_id: string;
  title: string;
  price: number;
};

export type GeneratedBundle = {
  id: string;
  name: string;
  products: BundleProduct[];
  regular_total: number;
  bundle_price: number;
  savings_amount: number;
  discount_percent: number;
  status: 'active' | 'inactive';
  source: 'ml' | 'rules' | 'manual';
};

// const HALF_LIFE_DAYS = 60; // TODO: Use when implementing decay
// const LN2_OVER_HL = Math.log(2) / HALF_LIFE_DAYS; // TODO: Use when implementing decay

const getPid = (gid?: string) => (gid || '').replace('gid://shopify/Product/', '');
const getVid = (gid?: string) => (gid || '').replace('gid://shopify/ProductVariant/', '');

export async function generateBundlesFromOrders(params: {
  shop: string;
  productId: string;
  limit: number;
  excludeProductId?: string;
  defaultDiscountPct: number;
  bundleTitle?: string;
}): Promise<GeneratedBundle[]> {
  console.log(`[ML] === STARTING generateBundlesFromOrders ===`);
  console.log(`[ML] Parameters:`, params);
  
  try {
    const { shop, productId, limit, defaultDiscountPct, bundleTitle = 'Frequently Bought Together' } = params;
    // excludeProductId not used in current implementation
    console.log(`[ML] Starting bundle generation for product ${productId} in shop ${shop}`);

    console.log(`[ML] Step 1: Attempting content-based fallback (no ML co-purchase implemented)...`);
    const fallbackBundles = await contentBasedFallback({
      shop,
      productId,
      limit,
      defaultDiscountPct,
      bundleTitle
    });
    console.log(`[ML] Content-based fallback returned ${fallbackBundles.length} bundles`);

    if (fallbackBundles.length > 0) {
      console.log(`[ML] SUCCESS: Returning ${fallbackBundles.length} content-based bundles`);
      return fallbackBundles;
    }

    console.log(`[ML] Step 2: Content-based failed, manual bundles temporarily disabled due to Prisma issue...`);
    // TODO: Fix Prisma Bundle model access
    const manualBundles: GeneratedBundle[] = [];
    /*
    const manualBundles = await getManualBundles({
      shop,
      productId,
      limit,
      defaultDiscountPct
    });
    */
    console.log(`[ML] Manual bundles returned ${manualBundles.length} bundles`);

    if (manualBundles.length > 0) {
      console.log(`[ML] SUCCESS: Returning ${manualBundles.length} manual bundles`);
      return manualBundles;
    }

    console.log(`[ML] All methods failed, returning empty array`);
    return [];
  } catch (error) {
    console.error(`[ML] === ERROR IN generateBundlesFromOrders ===`);
    console.error(`[ML] Error:`, error);
    console.error(`[ML] Error message:`, error instanceof Error ? error.message : 'Unknown error');
    console.error(`[ML] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    throw error; // Re-throw to be caught by bundles API
  }
}

async function contentBasedFallback(params: {
  shop: string;
  productId: string;
  limit: number;
  defaultDiscountPct: number;
  bundleTitle?: string;
}): Promise<GeneratedBundle[]> {
  const { shop, productId, limit, defaultDiscountPct, bundleTitle } = params;
  console.log(`[FALLBACK] Starting content-based fallback for product ${productId}, limit: ${limit}`);
  const { admin } = await unauthenticated.admin(shop);

  // Fetch anchor product details
  const anchorGid = `gid://shopify/Product/${productId}`;
  const anchorResp = await admin.graphql(`
    #graphql
    query($id: ID!) {
      product(id: $id) {
        id
        title
        vendor
        productType
        variants(first: 3) { edges { node { id price } } }
      }
    }
  `, { variables: { id: anchorGid } });
  if (!anchorResp.ok) {
    console.log(`[FALLBACK] Failed to fetch anchor product ${productId}`);
    return [];
  }
  const anchorData: any = await anchorResp.json();
  const anchor = anchorData?.data?.product;
  if (!anchor?.id) {
    console.log(`[FALLBACK] Anchor product ${productId} not found`);
    return [];
  }
  console.log(`[FALLBACK] Found anchor product: ${anchor.title}`);
  const anchorTitle: string = anchor.title || '';
  const anchorVendor: string = anchor.vendor || '';
  const anchorType: string = anchor.productType || '';
  const anchorVar = anchor.variants?.edges?.[0]?.node;
  const anchorPrice = parseFloat(anchorVar?.price || '0') || 0;
  const anchorVid = getVid(anchorVar?.id);

  // Fetch a sample of products to compare against
  const listResp = await admin.graphql(`
    #graphql
    query { products(first: 75, sortKey: BEST_SELLING) { edges { node {
      id
      title
      vendor
      productType
      variants(first: 1) { edges { node { id price } } }
    } } } }
  `);
  if (!listResp.ok) {
    console.log(`[FALLBACK] Failed to fetch product list for comparison`);
    return [];
  }
  const listData: any = await listResp.json();
  const nodes: any[] = listData?.data?.products?.edges?.map((e: any) => e.node) || [];
  console.log(`[FALLBACK] Found ${nodes.length} products to compare against`);

  // Tokenize titles for a simple content similarity
  const tokenize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const anchorTokens = new Set(tokenize(anchorTitle));

  const scored: Array<{ pid: string; vid: string; title: string; price: number; score: number }> = [];
  for (const n of nodes) {
    const pid = getPid(n.id);
    if (!pid || pid === productId) continue;
    const title: string = n.title || '';
    const vendor: string = n.vendor || '';
    const ptype: string = n.productType || '';
    const v = n.variants?.edges?.[0]?.node;
    const price = parseFloat(v?.price || '0') || 0;
    const vid = getVid(v?.id);

    // Similarity components: title Jaccard, vendor match, type match, price proximity
    const tokens = tokenize(title);
    const setB = new Set(tokens);
    const inter = [...anchorTokens].filter(t => setB.has(t)).length;
    const union = new Set([...anchorTokens, ...setB]).size || 1;
    const jaccard = inter / union;
    const vendorBoost = vendor && vendor === anchorVendor ? 0.3 : 0;
    const typeBoost = ptype && ptype === anchorType ? 0.2 : 0;
    const priceDelta = Math.abs(price - anchorPrice);
    const priceBoost = anchorPrice > 0 ? Math.max(0, 0.3 - Math.min(0.3, priceDelta / Math.max(20, anchorPrice * 0.5) * 0.3)) : 0;
    
    // Ensure minimum baseline score so we always have candidates
    const baselineScore = 0.15; // Give every product at least 15% relevance for better fallback
    const score = Math.max(baselineScore, jaccard + vendorBoost + typeBoost + priceBoost);
    scored.push({ pid, vid, title, price, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const picks = scored.slice(0, Math.max(3, limit)); // Always try to get at least 3 candidates for better bundles
  console.log(`[FALLBACK] Scored ${scored.length} products, picked top ${picks.length}:`, picks.map(p => ({ title: p.title, score: p.score.toFixed(3) })));
  if (picks.length === 0) {
    console.log(`[FALLBACK] No products available for bundling`);
    return []; // No products in store at all
  }

  const bundles: GeneratedBundle[] = [];
  for (const rec of picks) {
    const regular_total = anchorPrice + rec.price;
    const bundle_price = Math.max(0, regular_total * (1 - defaultDiscountPct / 100));
    const savings_amount = Math.max(0, regular_total - bundle_price);
    bundles.push({
      id: `CB_${productId}_${rec.pid}`,
      name: bundleTitle || 'Complete your setup',
      products: [
        { id: productId, variant_id: anchorVid, title: anchorTitle || 'Product', price: anchorPrice },
        { id: rec.pid, variant_id: rec.vid, title: rec.title || 'Recommended', price: rec.price },
      ],
      regular_total,
      bundle_price,
      savings_amount,
      discount_percent: defaultDiscountPct,
      status: 'active',
      source: 'ml',
    });
  }

  return bundles;
}

// Fetch manual bundles for a product as fallback
// TODO: Fix Prisma Bundle model access issue
/*
async function getManualBundles(params: {
  shop: string;
  productId: string;
  limit: number;
  defaultDiscountPct: number;
}): Promise<GeneratedBundle[]> {
  const { shop, productId, limit, defaultDiscountPct } = params;
  console.log(`[MANUAL] Fetching manual bundles for product ${productId} in shop ${shop}`);
  
  try {
    // Find bundles that include this product
    const manualBundles = await prisma.bundle.findMany({
      where: {
        shop,
        isActive: true,
        products: {
          some: {
            productId
          }
        }
      },
      include: {
        products: true
      },
      take: limit
    });

    if (manualBundles.length === 0) {
      console.log(`[MANUAL] No manual bundles found for product ${productId}`);
      return [];
    }

    console.log(`[MANUAL] Found ${manualBundles.length} manual bundles`);
    
    // Convert to GeneratedBundle format
    const { admin } = await unauthenticated.admin(shop);
    const generatedBundles: GeneratedBundle[] = [];

    for (const bundle of manualBundles) {
      console.log(`[MANUAL] Processing bundle ${bundle.id} with ${bundle.products.length} products`);
      
      // Fetch product details for all products in the bundle
      const productIds = bundle.products.map((p: any) => `gid://shopify/Product/${p.productId}`);
      console.log(`[MANUAL] Fetching product details for IDs:`, productIds);
      
      const prodResp = await admin.graphql(`
        #graphql
        query prod($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product { 
              id 
              title 
              variants(first: 1) { 
                edges { 
                  node { 
                    id 
                    price 
                    availableForSale 
                  } 
                } 
              } 
            }
          }
        }
      `, { variables: { ids: productIds } });

      if (!prodResp.ok) {
        console.log(`[MANUAL] Failed to fetch product details for bundle ${bundle.id}`);
        continue;
      }
      
      const prodData: any = await prodResp.json();
      const nodes: any[] = prodData?.data?.nodes || [];
      console.log(`[MANUAL] Retrieved ${nodes.length} product nodes from GraphQL`);

      const bundleProducts: BundleProduct[] = [];
      let regular_total = 0;

      for (const node of nodes) {
        if (!node?.id) continue;
        const pid = getPid(node.id);
        const firstVar = node.variants?.edges?.[0]?.node;
        const vid = getVid(firstVar?.id);
        const price = parseFloat(firstVar?.price || '0') || 0;
        
        console.log(`[MANUAL] Processing product ${pid}: title="${node.title}", price=${price}`);
        
        bundleProducts.push({
          id: pid,
          variant_id: vid,
          title: node.title || 'Product',
          price: price
        });
        
        regular_total += price;
      }

      console.log(`[MANUAL] Bundle ${bundle.id} has ${bundleProducts.length} products, total: ${regular_total}`);

      if (bundleProducts.length < 2) {
        console.log(`[MANUAL] Skipping bundle ${bundle.id} - insufficient valid products`);
        continue;
      }

      const discountPercent = bundle.discountPercent || defaultDiscountPct;
      const bundle_price = Math.max(0, regular_total * (1 - discountPercent / 100));
      const savings_amount = Math.max(0, regular_total - bundle_price);

      generatedBundles.push({
        id: `MANUAL_${bundle.id}`,
        name: bundle.name,
        products: bundleProducts,
        regular_total,
        bundle_price,
        savings_amount,
        discount_percent: discountPercent,
        status: 'active',
        source: 'manual',
      });
      
      console.log(`[MANUAL] Created bundle: ${bundle.name} (${bundleProducts.length} products, ${discountPercent}% off)`);
    }

    console.log(`[MANUAL] Successfully converted ${generatedBundles.length} manual bundles`);
    return generatedBundles;
  } catch (error) {
    console.error(`[MANUAL] Error fetching manual bundles:`, error);
    return [];
  }
}
*/
