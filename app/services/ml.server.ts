import { unauthenticated } from "~/shopify.server";
import prismaClient from "~/db.server";

const prisma: any = prismaClient as any;

export type BundleProduct = {
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
  status: "active" | "inactive";
  source: "ml" | "rules" | "manual";
};

const getPid = (gid?: string) => (gid || "").replace("gid://shopify/Product/", "");
const getVid = (gid?: string) => (gid || "").replace("gid://shopify/ProductVariant/", "");

export async function generateBundlesFromOrders(params: {
  shop: string;
  productId: string;
  limit: number;
  excludeProductId?: string;
  defaultDiscountPct: number;
  bundleTitle?: string;
}): Promise<GeneratedBundle[]> {
  const { shop, productId, limit, defaultDiscountPct, bundleTitle = "Frequently Bought Together" } = params;

  const manualBundles = await getManualBundlesSafely({ shop, productId, limit, defaultDiscountPct });
  if (manualBundles.length) return manualBundles;

  const shopifyBundles = await shopifyRecommendationsFallback({ shop, productId, limit, defaultDiscountPct, bundleTitle });
  if (shopifyBundles.length) return shopifyBundles;

  return await contentBasedFallback({ shop, productId, limit, defaultDiscountPct, bundleTitle });
}

async function getManualBundlesSafely(params: { shop: string; productId: string; limit: number; defaultDiscountPct: number }): Promise<GeneratedBundle[]> {
  try {
    return await getManualBundles(params);
  } catch (e) {
    console.warn("[MANUAL] Skipping manual bundles due to error:", e);
    return [];
  }
}

async function getManualBundles(params: { shop: string; productId: string; limit: number; defaultDiscountPct: number }): Promise<GeneratedBundle[]> {
  const { shop, productId, limit, defaultDiscountPct } = params;
  if (!prisma?.bundle?.findMany) return [];

  const bundles = await prisma.bundle.findMany({
    where: { shop, isActive: true, products: { some: { productId } } },
    include: { products: true },
    take: limit,
  });
  if (!bundles?.length) return [];

  const { admin } = await unauthenticated.admin(shop);
  const generated: GeneratedBundle[] = [];

  for (const b of bundles) {
    const ids = (b.products || []).map((p: any) => `gid://shopify/Product/${p.productId}`);
    if (!ids.length) continue;

    const resp = await admin.graphql(
      `#graphql\nquery prod($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id title variants(first:1){edges{node{id price}}} } } }`,
      { variables: { ids } }
    );
    if (!resp.ok) continue;
    const data: any = await resp.json();
    const nodes: any[] = data?.data?.nodes || [];

    const items: BundleProduct[] = [];
    let regular_total = 0;
    for (const n of nodes) {
      const pid = getPid(n?.id);
      if (!pid) continue;
      const v = n.variants?.edges?.[0]?.node;
      const price = parseFloat(v?.price || "0") || 0;
      const vid = getVid(v?.id);
      items.push({ id: pid, variant_id: vid, title: n.title || "Product", price });
      regular_total += price;
    }
    if (items.length < 2) continue;

    const discountPercent = (b as any).discountPercent ?? defaultDiscountPct;
    const bundle_price = Math.max(0, regular_total * (1 - Number(discountPercent) / 100));
    const savings_amount = Math.max(0, regular_total - bundle_price);

    generated.push({
      id: `MANUAL_${b.id}`,
      name: (b as any).name || "Bundle",
      products: items,
      regular_total,
      bundle_price,
      savings_amount,
      discount_percent: Number(discountPercent) || 0,
      status: "active",
      source: "manual",
    });
  }

  return generated;
}

async function shopifyRecommendationsFallback(params: { shop: string; productId: string; limit: number; defaultDiscountPct: number; bundleTitle?: string }): Promise<GeneratedBundle[]> {
  const { shop, productId, limit, defaultDiscountPct, bundleTitle } = params;
  try {
    const { admin } = await unauthenticated.admin(shop);
    const anchorGid = `gid://shopify/Product/${productId}`;

    const anchorResp = await admin.graphql(
      `#graphql\nquery($id: ID!) { product(id: $id) { id title variants(first:1){edges{node{id price}}} } }`,
      { variables: { id: anchorGid } }
    );
    if (!anchorResp.ok) return [];
    const anchorData: any = await anchorResp.json();
    const anchor = anchorData?.data?.product;
    if (!anchor?.id) return [];
    const av = anchor.variants?.edges?.[0]?.node;
    const anchorPrice = parseFloat(av?.price || "0") || 0;
    const anchorVid = getVid(av?.id);

    const recResp = await admin.graphql(
      `#graphql\nquery($id: ID!) { productRecommendations(productId: $id) { id title variants(first:1){edges{node{id price}}} } }`,
      { variables: { id: anchorGid } }
    );
    if (!recResp.ok) return [];
    const recData: any = await recResp.json();
    const recs: any[] = recData?.data?.productRecommendations || [];

    const bundles: GeneratedBundle[] = [];
    for (const rec of recs.slice(0, Math.max(3, limit))) {
      const pid = getPid(rec.id);
      if (!pid) continue;
      const v = rec.variants?.edges?.[0]?.node;
      const price = parseFloat(v?.price || "0") || 0;
      const vid = getVid(v?.id);
      const regular_total = anchorPrice + price;
      const bundle_price = Math.max(0, regular_total * (1 - defaultDiscountPct / 100));
      const savings_amount = Math.max(0, regular_total - bundle_price);
      bundles.push({
        id: `SHOPIFY_${productId}_${pid}`,
        name: bundleTitle || "Complete your setup",
        products: [
          { id: productId, variant_id: anchorVid, title: anchor.title || "Product", price: anchorPrice },
          { id: pid, variant_id: vid, title: rec.title || "Recommended", price },
        ],
        regular_total,
        bundle_price,
        savings_amount,
        discount_percent: defaultDiscountPct,
        status: "active",
        source: "rules",
      });
    }
    return bundles;
  } catch (e) {
    console.warn("[SHOPIFY RECS] Fallback error:", e);
    return [];
  }
}

async function contentBasedFallback(params: { shop: string; productId: string; limit: number; defaultDiscountPct: number; bundleTitle?: string }): Promise<GeneratedBundle[]> {
  const { shop, productId, limit, defaultDiscountPct, bundleTitle } = params;
  const { admin } = await unauthenticated.admin(shop);

  const anchorGid = `gid://shopify/Product/${productId}`;
  const anchorResp = await admin.graphql(
    `#graphql\nquery($id: ID!) { product(id: $id) { id title vendor productType variants(first: 3) { edges { node { id price } } } } }`,
    { variables: { id: anchorGid } }
  );
  if (!anchorResp.ok) return [];
  const anchorData: any = await anchorResp.json();
  const anchor = anchorData?.data?.product;
  if (!anchor?.id) return [];
  const anchorTitle: string = anchor.title || "";
  const anchorVendor: string = anchor.vendor || "";
  const anchorType: string = anchor.productType || "";
  const anchorVar = anchor.variants?.edges?.[0]?.node;
  const anchorPrice = parseFloat(anchorVar?.price || "0") || 0;
  const anchorVid = getVid(anchorVar?.id);

  const listResp = await admin.graphql(
    `#graphql\nquery { products(first: 75, sortKey: BEST_SELLING) { edges { node { id title vendor productType variants(first: 1) { edges { node { id price } } } } } } }`
  );
  if (!listResp.ok) return [];
  const listData: any = await listResp.json();
  const nodes: any[] = listData?.data?.products?.edges?.map((e: any) => e.node) || [];

  const tokenize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const anchorTokens = new Set(tokenize(anchorTitle));

  const scored: Array<{ pid: string; vid: string; title: string; price: number; score: number }> = [];
  for (const n of nodes) {
    const pid = getPid(n.id);
    if (!pid || pid === productId) continue;
    const title: string = n.title || "";
    const vendor: string = n.vendor || "";
    const ptype: string = n.productType || "";
    const v = n.variants?.edges?.[0]?.node;
    const price = parseFloat(v?.price || "0") || 0;
    const vid = getVid(v?.id);

    const tokens = tokenize(title);
    const setB = new Set(tokens);
    const inter = [...anchorTokens].filter((t) => setB.has(t)).length;
    const union = new Set([...anchorTokens, ...setB]).size || 1;
    const jaccard = inter / union;
    const vendorBoost = vendor && vendor === anchorVendor ? 0.3 : 0;
    const typeBoost = ptype && ptype === anchorType ? 0.2 : 0;
    const priceDelta = Math.abs(price - anchorPrice);
    const priceBoost = anchorPrice > 0 ? Math.max(0, 0.3 - Math.min(0.3, (priceDelta / Math.max(20, anchorPrice * 0.5)) * 0.3)) : 0;
    const baseline = 0.15;
    const score = Math.max(baseline, jaccard + vendorBoost + typeBoost + priceBoost);
    scored.push({ pid, vid, title, price, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const picks = scored.slice(0, Math.max(3, limit));
  if (!picks.length) return [];

  const bundles: GeneratedBundle[] = [];
  for (const rec of picks) {
    const regular_total = anchorPrice + rec.price;
    const bundle_price = Math.max(0, regular_total * (1 - defaultDiscountPct / 100));
    const savings_amount = Math.max(0, regular_total - bundle_price);
    bundles.push({
      id: `CB_${productId}_${rec.pid}`,
      name: bundleTitle || "Complete your setup",
      products: [
        { id: productId, variant_id: anchorVid, title: anchorTitle || "Product", price: anchorPrice },
        { id: rec.pid, variant_id: rec.vid, title: rec.title || "Recommended", price: rec.price },
      ],
      regular_total,
      bundle_price,
      savings_amount,
      discount_percent: defaultDiscountPct,
      status: "active",
      source: "ml",
    });
  }
  return bundles;
}
