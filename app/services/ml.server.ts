import { unauthenticated } from "~/shopify.server";

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

const HALF_LIFE_DAYS = 60;
const LN2_OVER_HL = Math.log(2) / HALF_LIFE_DAYS;

const getPid = (gid?: string) => (gid || '').replace('gid://shopify/Product/', '');
const getVid = (gid?: string) => (gid || '').replace('gid://shopify/ProductVariant/', '');

export async function generateBundlesFromOrders(params: {
  shop: string;
  productId: string; // numeric product id (no gid)
  limit: number;
  defaultDiscountPct: number;
  bundleTitle?: string;
}): Promise<GeneratedBundle[]> {
  const { shop, productId, limit, defaultDiscountPct, bundleTitle } = params;
  const { admin } = await unauthenticated.admin(shop);

  // 1) Fetch recent orders for co-purchase signals
  const ordersResp = await admin.graphql(`
    #graphql
    query getOrders($first: Int!) {
      orders(first: $first, sortKey: CREATED_AT, reverse: true) {
        edges { node {
          id
          createdAt
          lineItems(first: 30) { edges { node {
            product { id title handle }
            variant { id price }
          } } }
        } }
      }
    }
  `, { variables: { first: 200 } });
  if (!ordersResp.ok) return [];
  const ordersData: any = await ordersResp.json();
  const orderEdges: any[] = ordersData?.data?.orders?.edges || [];

  // 2) Build association weights with exponential recency decay
  type Assoc = { wco: number };
  const wAppear: Record<string, number> = {};
  const assoc: Record<string, { with: Record<string, Assoc>; wAppear: number }> = {};
  for (const e of orderEdges) {
    const n = e.node;
    const ageDays = Math.max(0, (Date.now() - new Date(n.createdAt).getTime()) / 86400000);
    const w = Math.exp(-LN2_OVER_HL * ageDays);
    const items: string[] = [];
    for (const ie of (n.lineItems?.edges || [])) {
      const p = ie.node.product; if (!p?.id) continue;
      const pid = getPid(p.id);
      items.push(pid);
    }
    if (items.length < 2) continue;
    const seen = new Set<string>();
    for (const it of items) {
      if (!seen.has(it)) { wAppear[it] = (wAppear[it] || 0) + w; seen.add(it); }
      assoc[it] ||= { with: {}, wAppear: 0 }; assoc[it].wAppear += w;
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      assoc[a] ||= { with: {}, wAppear: 0 }; assoc[b] ||= { with: {}, wAppear: 0 };
      assoc[a].with[b] ||= { wco: 0 }; assoc[a].with[b].wco += w;
      assoc[b].with[a] ||= { wco: 0 }; assoc[b].with[a].wco += w;
    }
  }

  // 3) Score candidates for the anchor product
  const anchors = new Set<string>([productId]);
  const totalW = Object.values(wAppear).reduce((a, b) => a + b, 0) || 1;
  const candidate: Record<string, number> = {};
  const aStats = assoc[productId];
  const wA = aStats?.wAppear || 0;
  if (aStats && wA > 0) {
    for (const [b, ab] of Object.entries(aStats.with)) {
      if (anchors.has(b)) continue;
      const wB = assoc[b]?.wAppear || 0; if (wB <= 0) continue;
      const confidence = ab.wco / Math.max(1e-6, wA);
      const probB = wB / totalW;
      const lift = probB > 0 ? confidence / probB : 0;
      const score = 0.6 * Math.min(1, lift / 2) + 0.4 * Math.min(1, wB / (totalW * 0.05));
      candidate[b] = Math.max(candidate[b] || 0, score);
    }
  }

  const recIds = Object.entries(candidate).sort((a, b) => b[1] - a[1]).slice(0, Math.max(2, limit)).map(([id]) => id);
  if (recIds.length === 0) return [];

  // 4) Fetch product + variant info for anchor and recs
  const allGids = [productId, ...recIds].map(id => `gid://shopify/Product/${id}`);
  const prodResp = await admin.graphql(`
    #graphql
    query prod($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product { id title handle variants(first: 3) { edges { node { id price availableForSale title } } } }
      }
    }
  `, { variables: { ids: allGids } });
  if (!prodResp.ok) return [];
  const prodData: any = await prodResp.json();
  const nodes: any[] = prodData?.data?.nodes || [];
  const byPid: Record<string, any> = {};
  for (const n of nodes) {
    if (!n?.id) continue; const pid = getPid(n.id);
    const firstVar = n.variants?.edges?.[0]?.node;
    const vid = getVid(firstVar?.id);
    const price = parseFloat(firstVar?.price || '0') || 0;
    byPid[pid] = { title: n.title, variantId: vid, price };
  }

  const anchor = byPid[productId];
  if (!anchor) return [];

  // 5) Build bundles: anchor + each top rec
  const bundles: GeneratedBundle[] = [];
  for (const rid of recIds.slice(0, limit)) {
    const rec = byPid[rid]; if (!rec) continue;
    const regular_total = (anchor.price || 0) + (rec.price || 0);
    const bundle_price = Math.max(0, regular_total * (1 - defaultDiscountPct / 100));
    const savings_amount = Math.max(0, regular_total - bundle_price);
    bundles.push({
      id: `AUTO_${productId}_${rid}`,
      name: bundleTitle || 'Complete your setup',
      products: [
        { id: productId, variant_id: anchor.variantId, title: byPid[productId]?.title || 'Product', price: anchor.price },
        { id: rid, variant_id: rec.variantId, title: byPid[rid]?.title || 'Recommended', price: rec.price },
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
