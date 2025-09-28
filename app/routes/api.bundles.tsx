import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withAuth } from "../utils/auth.server";
import { unauthenticated } from "../shopify.server";
import { getBundleInsights } from "~/models/bundleInsights.server";

/**
 * Bundle Management API
 * Handles CRUD operations for manual bundles and ML-discovered bundles
 * Integrates with the ML recommendation system for dynamic bundle generation
 */

// Helper function to get ML-powered bundles from your existing AI system
async function getMLPoweredBundles(currentProductId?: string | null, shop?: string) {
  try {
    console.log('Fetching ML bundles for product:', currentProductId, 'timestamp:', Date.now());
    console.log('Shop parameter:', shop);
    
    // Get all available bundles
    const allBundles = await getBundlesForShop(shop || 'default');
    console.log('Total bundles available:', allBundles.length);
    
    // If we have a specific product ID, filter bundles that contain this product
    if (currentProductId) {
      console.log('Filtering bundles for product ID:', currentProductId);
      const filteredBundles = allBundles.filter(bundle => {
        const hasProduct = bundle.products.some(product => 
          product.id === currentProductId || 
          product.id.toString() === currentProductId
        );
        console.log(`Bundle "${bundle.name}" contains product ${currentProductId}:`, hasProduct);
        return hasProduct;
      });
      
      console.log(`Found ${filteredBundles.length} bundles containing product ${currentProductId}`);
      console.log('Filtered bundles:', filteredBundles.map(b => ({ id: b.id, name: b.name, productCount: b.products.length })));
      return filteredBundles;
    }
    
    // If no specific product, return all active bundles
    const activeBundles = allBundles.filter(bundle => bundle.status === 'active');
    console.log(`Returning ${activeBundles.length} active bundles`);
    return activeBundles;
    
  } catch (error) {
    console.error('ML bundle fetch error:', error);
    return [];
  }
}

// Fallback function for when ML system is unavailable
async function createFallbackBundles(currentProductId?: string | null) {
  console.log('Using fallback bundles for product:', currentProductId);
  
  // Return a basic bundle that could work with any product
  return [
    {
      id: 'fallback_bundle_1',
      name: 'Recommended Combo',
      description: 'Perfect combination for your purchase',
      products: [
        { id: currentProductId || 'sample_product', title: 'Current Product', price: 49.99 },
        { id: 'complementary_item_1', title: 'Complementary Item', price: 29.99 }
      ],
      regular_total: 79.98,
      bundle_price: 71.98,
      discount_percent: 10,
      savings_amount: 7.99,
      discount_code: 'BUNDLE_COMBO_10',
      status: 'active',
      source: 'fallback',
      confidence: 0.75,
      created_at: new Date().toISOString(),
      performance: {
        views: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0
      }
    }
  ];
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id') || url.searchParams.get('productId');
  const collectionId = url.searchParams.get('collection_id') || url.searchParams.get('collectionId');
  const context = url.searchParams.get('context') || 'admin';
  const shop = url.searchParams.get('shop');
  
  console.log('Bundle API request params:', { productId, collectionId, context, shop });
  
  try {
    // Handle frontend requests (no shop param, coming from storefront)
    if (!shop && (productId || collectionId || context !== 'admin')) {
      return await handleStorefrontBundleRequest({ productId, collectionId, context });
    }
    
    // Handle admin requests (with shop param)
    if (!shop) {
      return json({ error: 'Shop parameter required for admin requests' }, { status: 400 });
    }
    
    // Get all bundles for the shop (admin interface)
    const bundles = await getBundlesForShop(shop);
    
    return json({
      success: true,
      bundles,
      stats: {
        total: bundles.length,
        active: bundles.filter(b => b.status === 'active').length,
        ml_discovered: bundles.filter(b => b.source === 'ml').length,
        manual: bundles.filter(b => b.source === 'manual').length
      }
    });
    
  } catch (error) {
    console.error('Bundle fetch error:', error);
    return json({ error: 'Failed to fetch bundles' }, { status: 500 });
  }
};

export const action = withAuth(async ({ request }: ActionFunctionArgs) => {
  try {
    const data = await request.json();
    const { action: actionType, shop, bundle } = data;
    
    switch (actionType) {
      case 'create':
        return await createBundle(shop, bundle, request);
      case 'update':
        return await updateBundle(shop, bundle);
      case 'delete':
        return await deleteBundle(shop, bundle.id);
      case 'toggle_status':
        return await toggleBundleStatus(shop, bundle.id);
      case 'generate_discount_code':
        return await generateBundleDiscountCode(shop, bundle);
      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Bundle management error:', error);
    return json({ error: 'Bundle operation failed' }, { status: 500 });
  }
});

// Storefront bundle request handler (no auth required, uses ML system)
async function handleStorefrontBundleRequest({ productId, collectionId, context }: {
  productId?: string | null;
  collectionId?: string | null;
  context?: string;
}) {
  console.log('Storefront bundle request:', { productId, collectionId, context });
  
  try {
    // Extract shop domain from the request or use current context
    const shop = 'test-lab-101.myshopify.com'; // This should come from request context
    
    // Use ML-powered bundles instead of hardcoded ones
    const mlBundles = await getMLPoweredBundles(productId, shop);
    
    return json({
      success: true,
      bundles: mlBundles,
      context,
      ml_powered: true,
      debug: { productId, collectionId, totalFound: mlBundles.length }
    });
  } catch (error) {
    console.error('Error fetching ML bundles:', error);
    // Fallback to basic bundles if ML system fails
    const fallbackBundles = await createFallbackBundles(productId);
    return json({
      success: true,
      bundles: fallbackBundles,
      context,
      ml_powered: false,
      debug: { 
        productId, 
        collectionId, 
        totalFound: fallbackBundles.length, 
        error: error instanceof Error ? error.message : 'ML system unavailable'
      }
    });
  }
}

// Bundle management functions
async function getBundlesForShop(shop: string) {
  try {
    const { admin } = await unauthenticated.admin(shop);
    const { bundles, totalOrdersConsidered } = await getBundleInsights({
      shop,
      admin,
      minPairOrders: 1,
    });

    if (!bundles.length) {
      return [];
    }

    const productIds = Array.from(
      new Set(bundles.flatMap((bundle) => bundle.productIds))
    );

    const productInfo = await fetchProductDetails(admin, productIds);

    return bundles.map((bundle) => {
      const products = bundle.productIds.map((productId, index) => {
        const product = productInfo.get(productId);
        const title =
          product?.title ?? bundle.productTitles[index] ?? "Bundle Product";
        const price = product?.price ?? fallbackUnitPrice(bundle);
        return {
          id: productId,
          title,
          price,
        };
      });

      const regularTotal = bundle.regularRevenue;
      const bundlePrice = bundle.revenue;
      const savingsAmount = Math.max(0, regularTotal - bundlePrice);
      const confidence =
        totalOrdersConsidered > 0
          ? Math.min(1, bundle.orderCount / totalOrdersConsidered)
          : 0;

      return {
        id: bundle.id,
        name: bundle.name,
        description: bundle.productTitles.join(" + "),
        products,
        regular_total: roundCurrency(regularTotal),
        bundle_price: roundCurrency(bundlePrice),
        discount_percent: Number(bundle.averageDiscountPercent.toFixed(2)),
        savings_amount: roundCurrency(savingsAmount),
        discount_code: null,
        status: bundle.status,
        source: bundle.type,
        confidence,
        created_at: new Date().toISOString(),
        performance: {
          views: bundle.orderCount,
          clicks: bundle.orderCount,
          conversions: bundle.orderCount,
          revenue: roundCurrency(bundle.revenue),
        },
      };
    });
  } catch (error) {
    console.error("Failed to load bundles for shop", shop, error);
    return [];
  }
}

async function fetchProductDetails(
  admin: { graphql: GraphQLFetcher },
  productIds: string[]
) {
  const result = new Map<string, { title: string; price: number }>();

  if (!productIds.length) return result;

  const chunkSize = 20;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);
    try {
      const response = await admin.graphql(
        `#graphql
          query BundleProducts($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on Product {
                id
                title
                variants(first: 1) {
                  edges {
                    node {
                      price
                    }
                  }
                }
              }
            }
          }
        `,
        {
          variables: {
            ids: chunk.map((id) => `gid://shopify/Product/${id}`),
          },
        }
      );

      if (!response.ok) continue;
      const payload = await response.json();
      const nodes: any[] = payload?.data?.nodes ?? [];

      nodes.forEach((node) => {
        if (!node?.id) return;
        const id = String(node.id).replace("gid://shopify/Product/", "");
        const price = Number(
          node?.variants?.edges?.[0]?.node?.price ?? undefined
        );
        result.set(id, {
          title: node?.title ?? "Product",
          price: Number.isFinite(price) ? price : 0,
        });
      });
    } catch (error) {
      console.warn("Failed to fetch product details chunk", error);
    }
  }

  return result;
}

type GraphQLFetcher = (
  query: string,
  options?: { variables?: Record<string, unknown> }
) => Promise<Response>;

function fallbackUnitPrice(bundle: {
  revenue: number;
  totalQuantity?: number;
}) {
  const { revenue, totalQuantity } = bundle;
  if (!totalQuantity || totalQuantity <= 0) {
    return roundCurrency(revenue);
  }
  return roundCurrency(revenue / totalQuantity);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function createBundle(shop: string, bundleData: any, request?: Request) {
  console.log('Creating new bundle for shop:', shop);
  
  // Validate bundle data
  if (!bundleData.name || !bundleData.products || bundleData.products.length < 2) {
    return json({ error: 'Bundle must have a name and at least 2 products' }, { status: 400 });
  }
  
  // Calculate pricing with A/B testing integration
  const regularTotal = bundleData.products.reduce((sum: number, product: any) => 
    sum + parseFloat(product.price), 0);
  let discountPercent = parseFloat(bundleData.discount_percent || '10');
  
  // Check for A/B test variant override
  if (request) {
    try {
      const userId = request.headers.get('X-User-ID') || 'anonymous';
      const abResponse = await fetch(`${new URL(request.url).origin}/api/ab-testing?action=get_variant&experiment_type=bundle_discount&user_id=${userId}`, {
        headers: { 'X-Shopify-Shop-Domain': shop }
      });
      
      if (abResponse.ok) {
        const abData = await abResponse.json();
        if (abData.variant && abData.config && abData.config.discountPercent) {
          const originalDiscount = discountPercent;
          discountPercent = abData.config.discountPercent;
          console.log('🧪 Bundle discount A/B test active:', {
            original: originalDiscount,
            variant: abData.variant,
            newDiscount: discountPercent
          });
          
          // Track A/B test exposure
          fetch(`${new URL(request.url).origin}/api/ab-testing`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Shopify-Shop-Domain': shop 
            },
            body: JSON.stringify({
              action: 'track_event',
              experiment_id: abData.experiment_id,
              user_id: userId,
              event_type: 'bundle_shown',
              properties: { bundle_id: `bundle_${Date.now()}`, discount: discountPercent }
            })
          }).catch(err => console.warn('A/B tracking failed:', err));
        }
      }
    } catch (abError) {
      console.warn('Bundle A/B test check failed:', abError);
    }
  }
  
  const bundlePrice = regularTotal * (1 - discountPercent / 100);
  const savingsAmount = regularTotal - bundlePrice;
  
  // Generate discount code
  const discountCode = `BUNDLE_${bundleData.name.toUpperCase().replace(/\s+/g, '_')}`;
  
  const newBundle = {
    id: `bundle_${Date.now()}`,
    name: bundleData.name,
    description: bundleData.description || '',
    products: bundleData.products,
    regular_total: regularTotal,
    bundle_price: bundlePrice,
    discount_percent: discountPercent,
    savings_amount: savingsAmount,
    discount_code: discountCode,
    status: 'draft',
    source: 'manual',
    confidence: null,
    created_at: new Date().toISOString(),
    performance: {
      views: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0
    }
  };
  
  // In production, save to database
  console.log('Created bundle:', newBundle);
  
  // Create Shopify discount code
  const shopifyDiscountResult = await createShopifyDiscountCode(shop, {
    code: discountCode,
    discount_percent: discountPercent,
    minimum_amount: regularTotal * 0.95, // Require most of bundle items
    product_ids: bundleData.products.map((p: any) => p.id)
  });
  
  return json({
    success: true,
    bundle: newBundle,
    shopify_discount: shopifyDiscountResult
  });
}

async function updateBundle(shop: string, bundleData: any) {
  console.log('Updating bundle for shop:', shop, 'bundle:', bundleData.id);
  
  // In production, update in database
  const updatedBundle = {
    ...bundleData,
    updated_at: new Date().toISOString()
  };
  
  return json({
    success: true,
    bundle: updatedBundle
  });
}

async function deleteBundle(shop: string, bundleId: string) {
  console.log('Deleting bundle for shop:', shop, 'bundle:', bundleId);
  
  // In production, delete from database and Shopify discount
  
  return json({
    success: true,
    deleted_bundle_id: bundleId
  });
}

async function toggleBundleStatus(shop: string, bundleId: string) {
  console.log('Toggling bundle status for shop:', shop, 'bundle:', bundleId);
  
  // In production, update status in database
  const newStatus = 'active'; // Would check current status and toggle
  
  return json({
    success: true,
    bundle_id: bundleId,
    new_status: newStatus
  });
}

async function generateBundleDiscountCode(shop: string, bundleData: any) {
  console.log('Generating discount code for bundle:', bundleData.id);
  
  const discountCode = `BUNDLE_${bundleData.name.toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;
  
  // Create in Shopify
  const shopifyResult = await createShopifyDiscountCode(shop, {
    code: discountCode,
    discount_percent: bundleData.discount_percent,
    minimum_amount: bundleData.regular_total * 0.95,
    product_ids: bundleData.products.map((p: any) => p.id)
  });
  
  return json({
    success: true,
    discount_code: discountCode,
    shopify_result: shopifyResult
  });
}

async function createShopifyDiscountCode(shop: string, discountData: any) {
  // Mock Shopify discount creation - would be real GraphQL/REST API call
  console.log('Creating Shopify discount code:', discountData.code);
  
  // In production, this would create actual Shopify discount codes:
  /*
  const discountInput = {
    basicCodeDiscount: {
      title: discountData.code,
      code: discountData.code,
      startsAt: new Date().toISOString(),
      customerSelection: {
        all: true
      },
      customerGets: {
        value: {
          percentage: discountData.discount_percent / 100
        },
        items: {
          products: {
            productsToAdd: discountData.product_ids
          }
        }
      },
      minimumRequirement: {
        subtotal: {
          greaterThanOrEqualToSubtotal: discountData.minimum_amount
        }
      },
      usageLimit: null
    }
  };
  
  const mutation = `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const response = await admin.graphql(mutation, { variables: { basicCodeDiscount: discountInput } });
  */
  
  return {
    success: true,
    shopify_discount_id: 'gid://shopify/DiscountCodeNode/fake_id',
    code: discountData.code,
    created_at: new Date().toISOString()
  };
}
