import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { getSettings, saveSettings } from "../models/settings.server";
import db from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";

// Lightweight in-memory cache for recommendations (per worker)
// Keyed by shop + product/cart context + limit; TTL ~60s
const RECS_TTL_MS = 60 * 1000;
const recsCache = new Map<string, { ts: number; payload: any }>();
function getRecsCache(key: string) {
  const v = recsCache.get(key);
  if (!v) return undefined;
  if (Date.now() - v.ts > RECS_TTL_MS) { recsCache.delete(key); return undefined; }
  return v.payload;
}
function setRecsCache(key: string, payload: any) {
  recsCache.set(key, { ts: Date.now(), payload });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /apps/proxy/api/recommendations
  // Minimal, conservative AOV-focused recs: decayed confidence/lift + popularity, OOS + price-gap guardrails
  if (path.includes('/api/recommendations')) {
    try {
      const { session } = await authenticate.public.appProxy(request);
      const shop = session?.shop;
      if (!shop) return json({ error: 'Unauthorized' }, { status: 401 });

      // Query params
      const productId = url.searchParams.get('product_id') || undefined; // single anchor
      const cartParam = url.searchParams.get('cart') || '';
      const limit = Math.min(8, Math.max(1, parseInt(url.searchParams.get('limit') || '6', 10)));

      // Optional feature gate: if recommendations disabled in settings, return fast empty
      try {
        const s = await getSettings(shop);
        if (!s.enableRecommendations) {
          return json({ recommendations: [], reason: 'disabled' }, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60', 'X-Recs-Disabled': '1' }
          });
        }
      } catch(_) { /* best-effort settings; continue if unavailable */ }

      // Cache key (shop + anchor + cart + limit)
      const cacheKey = `shop:${shop}|pid:${productId||''}|cart:${cartParam}|limit:${limit}`;
      const cached = getRecsCache(cacheKey);
      if (cached) {
        return json(cached, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=30', // allow short client cache
            'X-Recs-Cache': 'HIT'
          },
        });
      }

      // Very conservative defaults (no settings or DB changes)
      const HALF_LIFE_DAYS = 60; // slightly faster than analytics page (more responsive to trends)
      const PRICE_GAP_LO = 0.5;  // hide if < 50% of anchor median
      const PRICE_GAP_HI = 2.0;  // hide if > 2x anchor median

      // Anchor set
      const anchors = new Set<string>();
      if (productId) anchors.add(productId);
      if (cartParam) {
        for (const id of cartParam.split(',').map(s => s.trim()).filter(Boolean)) anchors.add(id);
      }
      if (anchors.size === 0) {
        return json({ recommendations: [], reason: 'no_context' }, { headers: { 'Access-Control-Allow-Origin': '*'} });
      }

      // Admin API client for this shop
      const { admin } = await unauthenticated.admin(shop);

      // Fetch recent orders (bounded) to compute decayed associations/popularity
      const ordersResp = await admin.graphql(`
        #graphql
        query getOrders($first: Int!) {
          orders(first: $first, sortKey: CREATED_AT, reverse: true) {
            edges { node {
              id
              createdAt
              lineItems(first: 30) { edges { node {
                product { id title handle images(first: 1) { edges { node { url } } } vendor }
                variant { id price }
              } } }
            } }
          }
        }
      `, { variables: { first: 200 } });
      // Soft-fail on Admin HTTP errors
      if (!ordersResp.ok) {
        console.warn('Admin orders HTTP error:', ordersResp.status, ordersResp.statusText);
        return json({ recommendations: [], reason: `admin_http_${ordersResp.status}` }, {
          headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
        });
      }
      const ordersData: any = await ordersResp.json();
      if ((ordersData as any)?.errors || !(ordersData as any)?.data) {
        console.warn('Admin orders GraphQL error:', (ordersData as any)?.errors || 'No data');
        // Most likely missing read_orders on existing installs until reauthorized
        return json({ recommendations: [], reason: 'admin_orders_error' }, {
          headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
        });
      }
      const orderEdges: any[] = ordersData?.data?.orders?.edges || [];

      // Build decayed stats
      const LN2_OVER_HL = Math.log(2) / HALF_LIFE_DAYS;
      type Assoc = { co:number; wco:number; rev:number; wrev:number; aov:number };
      const assoc: Record<string, { product: any; with: Record<string, Assoc>; wAppear:number; price:number; handle:string; vendor?:string; image?:string } > = {};
      const wAppear: Record<string, number> = {};

      const getPid = (gid?: string) => (gid||'').replace('gid://shopify/Product/','');

      for (const e of orderEdges) {
        const n = e.node;
        const createdAt = new Date(n.createdAt);
        const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / 86400000);
        const w = Math.exp(-LN2_OVER_HL * ageDays);
        const items: Array<{pid:string; title:string; handle:string; img?:string; price:number; vendor?:string}> = [];
        for (const ie of (n.lineItems?.edges||[])) {
          const p = ie.node.product; if (!p?.id) continue;
          const pid = getPid(p.id);
          const price = parseFloat(ie.node.variant?.price || '0') || 0;
          const img = p.images?.edges?.[0]?.node?.url;
          items.push({ pid, title: p.title, handle: p.handle, img, price, vendor: p.vendor });
        }
        if (items.length < 2) continue;

        // appearances (decayed)
        const seen = new Set<string>();
        for (const it of items) {
          if (!seen.has(it.pid)) {
            wAppear[it.pid] = (wAppear[it.pid]||0)+w;
            seen.add(it.pid);
            if (!assoc[it.pid]) assoc[it.pid] = { product: { id: it.pid, title: it.title }, with: {}, wAppear: 0, price: it.price, handle: it.handle, vendor: it.vendor, image: it.img };
            assoc[it.pid].wAppear += w;
            // keep last seen price/title/handle/img simple
            assoc[it.pid].price = it.price; assoc[it.pid].handle = it.handle; assoc[it.pid].image = it.img; assoc[it.pid].product.title = it.title; assoc[it.pid].vendor = it.vendor;
          }
        }

        // pairs
        for (let i=0;i<items.length;i++) for (let j=i+1;j<items.length;j++) {
          const a = items[i], b = items[j];
          if (!assoc[a.pid]) assoc[a.pid] = { product:{id:a.pid,title:a.title}, with:{}, wAppear:0, price:a.price, handle:a.handle, vendor:a.vendor, image:a.img };
          if (!assoc[b.pid]) assoc[b.pid] = { product:{id:b.pid,title:b.title}, with:{}, wAppear:0, price:b.price, handle:b.handle, vendor:b.vendor, image:b.img };
          if (!assoc[a.pid].with[b.pid]) assoc[a.pid].with[b.pid] = { co:0,wco:0,rev:0,wrev:0,aov:0 };
          if (!assoc[b.pid].with[a.pid]) assoc[b.pid].with[a.pid] = { co:0,wco:0,rev:0,wrev:0,aov:0 };
          assoc[a.pid].with[b.pid].co++; assoc[a.pid].with[b.pid].wco+=w;
          assoc[b.pid].with[a.pid].co++; assoc[b.pid].with[a.pid].wco+=w;
        }
      }

      // Build candidate scores across anchors
      const anchorIds = Array.from(anchors);
      const candidate: Record<string, { score:number; lift:number; pop:number; handle?:string; vendor?:string } > = {};
      const totalW = Object.values(wAppear).reduce((a,b)=>a+b,0) || 1;
      const liftCap = 2.0; // cap to avoid niche explosions

      // compute median anchor price (from assoc if available)
      const anchorPrices = anchorIds.map(id => assoc[id]?.price).filter(v => typeof v === 'number' && !isNaN(v)) as number[];
      anchorPrices.sort((a,b)=>a-b);
      const anchorMedian = anchorPrices.length ? anchorPrices[Math.floor(anchorPrices.length/2)] : undefined;

      for (const a of anchorIds) {
        const aStats = assoc[a];
        const wA = aStats?.wAppear || 0;
        if (!aStats || wA <= 0) continue;
        for (const [b, ab] of Object.entries(aStats.with)) {
          if (anchors.has(b)) continue; // don’t recommend items already in context
          const wB = assoc[b]?.wAppear || 0;
          if (wB <= 0) continue;
          const confidence = ab.wco / Math.max(1e-6, wA);
          const probB = wB / totalW;
          const lift = probB > 0 ? confidence / probB : 0;
          const liftNorm = Math.min(liftCap, lift) / liftCap; // [0..1]
          const popNorm = Math.min(1, wB / (totalW * 0.05)); // normalize: top 5% mass ~1
          const s = 0.6 * liftNorm + 0.4 * popNorm;
          if (!candidate[b] || s > candidate[b].score) {
            candidate[b] = { score: s, lift, pop: wB/totalW, handle: assoc[b]?.handle, vendor: assoc[b]?.vendor };
          }
        }
      }

      // OOS filter via Admin API for small top set
      const topIds = Object.entries(candidate)
        .sort((a,b)=>b[1].score - a[1].score)
        .slice(0, 24)
        .map(([id])=>id);

      if (topIds.length === 0) {
        return json({ recommendations: [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      // Fetch inventory/availability and price data for candidates (and anchors if needed)
      const prodGids = topIds.map(id => `gid://shopify/Product/${id}`);
      const invResp = await admin.graphql(`
        #graphql
        query inv($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product { id title handle vendor status totalInventory availableForSale variants(first: 10) { edges { node { id availableForSale price } } } images(first:1){edges{node{url}}} }
          }
        }
      `, { variables: { ids: prodGids } });
      if (!invResp.ok) {
        console.warn('Admin inventory HTTP error:', invResp.status, invResp.statusText);
        return json({ recommendations: [], reason: `admin_http_${invResp.status}` }, {
          headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
        });
      }
      const invData: any = await invResp.json();
      if ((invData as any)?.errors || !(invData as any)?.data) {
        console.warn('Admin inventory GraphQL error:', (invData as any)?.errors || 'No data');
        return json({ recommendations: [], reason: 'admin_inventory_error' }, {
          headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
        });
      }
      const nodes: any[] = invData?.data?.nodes || [];
      const availability: Record<string, { inStock:boolean; price:number; title:string; handle:string; img?:string; vendor?:string } > = {};
      for (const n of nodes) {
        if (!n?.id) continue;
        const id = getPid(n.id);
        const variants = n.variants?.edges || [];
        const inStock = Boolean(n.availableForSale) || variants.some((v:any)=>v?.node?.availableForSale);
        // pick first variant price as representative
        const price = variants.length ? parseFloat(variants[0].node?.price||'0')||0 : (assoc[id]?.price||0);
        availability[id] = { inStock, price, title: n.title, handle: n.handle, img: n.images?.edges?.[0]?.node?.url, vendor: n.vendor };
      }

      // Final ranking with guardrails (price-gap + diversity)
      const results: Array<{ id:string; title:string; handle:string; image?:string; price:number } > = [];
      const usedHandles = new Set<string>();
      const targetPrice = anchorMedian;
      // Optional CTR-based re-ranking: use TrackingEvent signals when available (best-effort)
    let ctrById: Record<string, number> = {};
      try {
        const tracking = (db as any)?.trackingEvent;
        if (tracking?.findMany) {
          const since = new Date(Date.now() - 14 * 86400000); // last 14 days
      // Limit to the small top candidate set for speed
      const candIds = topIds;
          if (candIds.length) {
            const rows = await tracking.findMany({
              where: { shop, createdAt: { gte: since }, productId: { in: candIds } },
              select: { productId: true, event: true },
            });
            const counts: Record<string, { imp: number; clk: number }> = {};
            for (const r of rows) {
              const pid = r.productId as string | null;
              if (!pid) continue;
              const c = counts[pid] || (counts[pid] = { imp: 0, clk: 0 });
              if (r.event === 'impression') c.imp++;
              else if (r.event === 'click') c.clk++;
            }
            // Smooth CTR to avoid noise; baseline ~5%
            const alpha = 1, beta = 20; // Laplace smoothing
            for (const pid of Object.keys(counts)) {
              const { imp, clk } = counts[pid];
              const ctr = (clk + alpha) / (imp + beta);
              ctrById[pid] = ctr; // ~0.0..1.0
            }
          }
        }
      } catch (e) {
        // Ignore CTR re-rank issues; falls back to base ordering
        console.warn('CTR re-rank skipped:', e);
      }

      // Blend CTR into base score in a conservative way
      const BASELINE_CTR = 0.05; // 5% baseline
      const CTR_WEIGHT = 0.35;   // cap influence
      const scored = Object.entries(candidate).map(([bid, meta]) => {
        const ctr = ctrById[bid] ?? BASELINE_CTR;
        const mult = Math.max(0.85, Math.min(1.25, 1 + CTR_WEIGHT * (ctr - BASELINE_CTR)));
        return [bid, { ...meta, score: meta.score * mult } ] as [string, typeof meta];
      }).sort((a,b)=>b[1].score - a[1].score);

      for (const [bid, meta] of scored) {
        if (results.length >= limit) break;
        const info = availability[bid];
        if (!info?.inStock) continue;
        if (typeof targetPrice === 'number' && targetPrice > 0) {
          const ratio = info.price / targetPrice;
          if (ratio < PRICE_GAP_LO || ratio > PRICE_GAP_HI) continue;
        }
        const h = (info.handle || meta.handle || '').split('-')[0];
        if (usedHandles.has(h)) continue; // simple diversity
        usedHandles.add(h);
        results.push({ id: bid, title: info.title || assoc[bid]?.product?.title || '', handle: info.handle || assoc[bid]?.handle || '', image: info.img || assoc[bid]?.image, price: info.price });
      }

      const payload = { recommendations: results };
      // Store in cache for subsequent identical calls
      setRecsCache(cacheKey, payload);

      return json(payload, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
          'X-Recs-Cache': 'MISS'
        },
      });
    } catch (error) {
      console.error('Recs API error:', error);
      // Soft-fail with empty list to avoid breaking the storefront UX
      return json({ recommendations: [], reason: 'unavailable' }, {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=10' }
      });
    }
  }

  // GET /apps/proxy/api/bundles
  // Returns simple, high-confidence bundles for PDP based on recent co-purchases.
  if (path.includes('/api/bundles')) {
    try {
      const { session } = await authenticate.public.appProxy(request);
      const shop = session?.shop;
      if (!shop) return json({ error: 'Unauthorized' }, { status: 401 });

  const context = url.searchParams.get('context') || 'product';
  const productIdParam = url.searchParams.get('product_id') || undefined;
      const limit = Math.min(2, Math.max(1, parseInt(url.searchParams.get('limit') || '2', 10)));

      // Feature flag check
      let settings: any = undefined;
      try { settings = await getSettings(shop); } catch(_){ /* non-fatal */ }
      if (!settings?.enableSmartBundles) {
        return json({ bundles: [], reason: 'disabled' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      if (context === 'product' && !settings?.bundlesOnProductPages) {
        return json({ bundles: [], reason: 'disabled_page' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      if (context !== 'product' || !productIdParam) {
        // For now, only PDP bundles are implemented
        return json({ bundles: [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      // Resolve product id: accept numeric id; if not numeric, try as handle via Admin API
      let productId = productIdParam;
      if (!/^[0-9]+$/.test(productId)) {
        try {
          const { admin } = await unauthenticated.admin(shop);
          const byHandleResp = await admin.graphql(`#graphql
            query($handle: String!) { productByHandle(handle: $handle) { id } }
          `, { variables: { handle: productId } });
          if (byHandleResp.ok) {
            const data: any = await byHandleResp.json();
            const gid: string | undefined = data?.data?.productByHandle?.id;
            if (gid) productId = gid.replace('gid://shopify/Product/','');
          }
        } catch(_) { /* ignore */ }
      }

      const defaultDiscountPct = (() => {
        const v = String(settings?.defaultBundleDiscount ?? '15');
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? Math.min(50, n) : 15;
      })();

      // Build anchor and candidate recs using the same approach as /api/recommendations (simplified and capped)
      const anchors = new Set<string>([productId]);
      const { admin } = await unauthenticated.admin(shop);
      const HALF_LIFE_DAYS = 60;
      const LN2_OVER_HL = Math.log(2) / HALF_LIFE_DAYS;
      const getPid = (gid?: string) => (gid||'').replace('gid://shopify/Product/','');

      // Fetch recent orders
      const ordersResp = await admin.graphql(`
        #graphql
        query getOrders($first: Int!) {
          orders(first: $first, sortKey: CREATED_AT, reverse: true) {
            edges { node {
              id
              createdAt
              lineItems(first: 30) { edges { node {
                product { id title handle images(first: 1) { edges { node { url } } } vendor }
                variant { id price }
              } } }
            } }
          }
        }
      `, { variables: { first: 200 } });
      if (!ordersResp.ok) {
        return json({ bundles: [], reason: `admin_http_${ordersResp.status}` }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      const ordersData: any = await ordersResp.json();
      if (!ordersData?.data) {
        return json({ bundles: [], reason: 'admin_orders_error' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      const orderEdges: any[] = ordersData?.data?.orders?.edges || [];

      // Accumulate co-purchase weights
      type Assoc = { wco:number };
      const wAppear: Record<string, number> = {};
      const assoc: Record<string, { with: Record<string, Assoc>; wAppear:number } > = {};
      for (const e of orderEdges) {
        const n = e.node;
        const ageDays = Math.max(0, (Date.now() - new Date(n.createdAt).getTime()) / 86400000);
        const w = Math.exp(-LN2_OVER_HL * ageDays);
        const items: string[] = [];
        for (const ie of (n.lineItems?.edges||[])) {
          const p = ie.node.product; if (!p?.id) continue;
          const pid = getPid(p.id);
          items.push(pid);
        }
        if (items.length < 2) continue;
        const seen = new Set<string>();
        for (const it of items) {
          if (!seen.has(it)) { wAppear[it] = (wAppear[it]||0)+w; seen.add(it); }
          assoc[it] ||= { with: {}, wAppear: 0 }; assoc[it].wAppear += w;
        }
        for (let i=0;i<items.length;i++) for (let j=i+1;j<items.length;j++) {
          const a = items[i], b = items[j];
          assoc[a] ||= { with: {}, wAppear: 0 }; assoc[b] ||= { with: {}, wAppear: 0 };
          assoc[a].with[b] ||= { wco: 0 }; assoc[a].with[b].wco += w;
          assoc[b].with[a] ||= { wco: 0 }; assoc[b].with[a].wco += w;
        }
      }

      const anchorIds = Array.from(anchors);
      const totalW = Object.values(wAppear).reduce((a,b)=>a+b,0) || 1;
      const candidate: Record<string, number> = {};
      for (const a of anchorIds) {
        const aStats = assoc[a]; const wA = aStats?.wAppear || 0; if (!aStats || wA<=0) continue;
        for (const [b, ab] of Object.entries(aStats.with)) {
          if (anchors.has(b)) continue;
          const wB = assoc[b]?.wAppear || 0; if (wB<=0) continue;
          const confidence = ab.wco / Math.max(1e-6, wA);
          const probB = wB / totalW;
          const lift = probB > 0 ? confidence / probB : 0;
          const s = 0.6 * Math.min(1, lift/2) + 0.4 * Math.min(1, wB / (totalW * 0.05));
          candidate[b] = Math.max(candidate[b]||0, s);
        }
      }

      const recIds = Object.entries(candidate).sort((a,b)=>b[1]-a[1]).slice(0, Math.max(2, limit)).map(([id])=>id);
      if (recIds.length === 0) {
        return json({ bundles: [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      // Fetch product + variant info for anchor and recs in one shot
  const allGids = [productId, ...recIds].map(id => `gid://shopify/Product/${id}`);
      const prodResp = await admin.graphql(`
        #graphql
        query prod($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product { id title handle variants(first: 3) { edges { node { id price availableForSale title } } } }
          }
        }
      `, { variables: { ids: allGids } });
      if (!prodResp.ok) {
        return json({ bundles: [], reason: `admin_http_${prodResp.status}` }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      const prodData: any = await prodResp.json();
      const nodes: any[] = prodData?.data?.nodes || [];
      const byPid: Record<string, any> = {};
      for (const n of nodes) {
        if (!n?.id) continue; const pid = getPid(n.id);
        const firstVar = n.variants?.edges?.[0]?.node;
        const vid = (firstVar?.id||'').replace('gid://shopify/ProductVariant/','');
        const price = parseFloat(firstVar?.price || '0') || 0;
        byPid[pid] = { title: n.title, variantId: vid, price };
      }

      const anchor = byPid[productId];
      if (!anchor) {
        return json({ bundles: [] }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      // Build up to `limit` simple 2-item bundles: anchor + each top rec
      const bundles = [] as Array<any>;
      for (const rid of recIds.slice(0, limit)) {
        const rec = byPid[rid]; if (!rec) continue;
        const regular_total = (anchor.price || 0) + (rec.price || 0);
        const bundle_price = Math.max(0, regular_total * (1 - defaultDiscountPct/100));
        const savings_amount = Math.max(0, regular_total - bundle_price);
        bundles.push({
          id: `AUTO_${productId}_${rid}`,
          name: settings?.bundleTitleTemplate || 'Complete your setup',
          products: [
            { id: productId, variant_id: anchor.variantId, title: byPid[productId]?.title || 'Product', price: anchor.price },
            { id: rid, variant_id: rec.variantId, title: byPid[rid]?.title || 'Recommended', price: rec.price },
          ],
          regular_total,
          bundle_price,
          savings_amount,
          discount_percent: defaultDiscountPct,
          // discount_code intentionally omitted unless we create it in Admin ahead of time
          status: 'active',
          source: 'ml',
        });
      }

      return json({ bundles }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=30'
        }
      });
    } catch (error) {
      console.error('Bundles API error:', error);
      return json({ bundles: [], reason: 'unavailable' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  }

  // Handle /apps/proxy/api/settings
  if (path.includes('/api/settings')) {
    try {
      // Require a valid App Proxy signature and derive the shop from the verified session
      const { session } = await authenticate.public.appProxy(request);
      const shop = session?.shop;
      if (!shop) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      const settings = await getSettings(shop);
      // Normalize layout to theme values
      // Normalize legacy values while preserving new ones.
      // Legacy -> internal classes: horizontal/row/carousel => row, vertical/column/list => column, grid stays grid
      const layoutMap: Record<string, string> = {
        horizontal: 'row',
        row: 'row',
        carousel: 'row',
        vertical: 'column',
        column: 'column',
        list: 'column',
        grid: 'grid'
      };
      const normalized = {
        source: 'db',
        ...settings,
        enableRecommendationTitleCaps: (settings as any).enableRecommendationTitleCaps ?? (settings as any).enableTitleCaps ?? false,
        recommendationLayout: layoutMap[settings.recommendationLayout] || settings.recommendationLayout,
      };

      return json(normalized, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    } catch (error) {
      console.error("Settings API error:", error);
      // Unauthorized or invalid signature
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Default response for other proxy requests
  return json({ message: "Cart Uplift App Proxy" });
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Heartbeat from theme embed to mark installed/enabled
    if (path.includes('/api/embed-heartbeat')) {
      // Verify App Proxy signature and derive shop
      let shop: string | undefined;
      try {
        const { session } = await authenticate.public.appProxy(request);
        shop = session?.shop;
      } catch (e) {
        console.warn('App proxy heartbeat auth failed:', e);
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const now = new Date().toISOString();
      await saveSettings(shop!, { themeEmbedEnabled: true, themeEmbedLastSeen: now });
      return json({ success: true }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Validate discount codes from the storefront (cart modal)
    if (path.includes('/api/discount')) {
      // Verify the app proxy signature and get the shop
      let shopDomain: string | undefined;
      try {
        const { session } = await authenticate.public.appProxy(request);
        shopDomain = session?.shop;
      } catch (e) {
        console.warn('App proxy auth failed:', e);
      }

      const contentType = request.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await request.json()
        : Object.fromEntries(await request.formData());

      const discountCode = String((payload as any).discountCode || '').trim();

      if (!discountCode) {
        return json({ success: false, error: 'Discount code is required' }, {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // If we can't determine the shop, fail closed (do not accept unknown codes)
      if (!shopDomain) {
        return json({ success: false, error: 'Unable to validate discount code' }, {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      try {
        const { admin } = await unauthenticated.admin(shopDomain);
        // Use Admin GraphQL API to validate code existence and extract basic value (percent or fixed amount)
        const query = `#graphql
          query ValidateDiscountCode($code: String!) {
            codeDiscountNodeByCode(code: $code) {
              id
              codeDiscount {
                __typename
                ... on DiscountCodeBasic {
                  title
                  customerGets {
                    value {
                      __typename
                      ... on DiscountPercentage { percentage }
                      ... on DiscountAmount { amount { amount currencyCode } }
                    }
                  }
                }
                ... on DiscountCodeBxgy {
                  title
                }
                ... on DiscountCodeFreeShipping {
                  title
                }
              }
            }
          }
        `;
        const resp = await admin.graphql(query, { variables: { code: discountCode } });
        const data = await resp.json();
        const node = data?.data?.codeDiscountNodeByCode;

        if (!node) {
          return json({ success: false, error: 'Invalid discount code' }, {
            status: 404,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });
        }

        // Default values
        let kind: 'percent' | 'amount' | undefined;
        let percent: number | undefined;
        let amountCents: number | undefined;

        const cd = node.codeDiscount;
    if (cd?.__typename === 'DiscountCodeBasic') {
          const value = cd?.customerGets?.value;
          if (value?.__typename === 'DiscountPercentage' && typeof value.percentage === 'number') {
            kind = 'percent';
            // Shopify typically returns the percent value directly (e.g., 10 for 10%, 0.5 for 0.5%).
            // We'll pass it through unchanged; client divides by 100.
            percent = value.percentage;
          } else if (value?.__typename === 'DiscountAmount' && value.amount?.amount) {
            kind = 'amount';
            // Convert MoneyV2 amount to minor units (cents)
            const amt = parseFloat(value.amount.amount);
            if (!isNaN(amt)) amountCents = Math.round(amt * 100);
          }
        }

        return json({
          success: true,
          discount: {
            code: discountCode,
            summary: `Discount code ${discountCode} will be applied at checkout`,
            status: 'VALID',
            kind,
            percent,
            amountCents,
          }
        }, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      } catch (e) {
        console.error('Error validating discount via Admin API:', e);
        return json({ success: false, error: 'Unable to validate discount code' }, {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
    }

    if (path.includes('/api/cart-tracking')) {
      // Require valid app proxy signature, but treat as best-effort
      let shop: string | undefined;
      try {
        const { session } = await authenticate.public.appProxy(request);
        shop = session?.shop;
        if (!shop) throw new Error('No shop');
      } catch (e) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      try {
        // Respect analytics toggle: if disabled, accept but skip persistence
        try {
          const s = await getSettings(shop);
          if (!s.enableAnalytics) {
            return json({ success: true, skipped: 'analytics_disabled' }, {
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
              },
            });
          }
        } catch(_) { /* if settings fail, proceed to best-effort persist */ }

        const contentType = request.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? await request.json()
          : Object.fromEntries(await request.formData());

        const event = String((data as any).event || (data as any).eventType || '').trim();
        const productId = (data as any).productId ? String((data as any).productId) : undefined;
        const productTitle = (data as any).productTitle ? String((data as any).productTitle) : undefined;
        const priceCentsRaw = (data as any).priceCents ?? (data as any).price_cents;
        const revenueCentsRaw = (data as any).revenueCents ?? (data as any).revenue_cents;
        const priceCents = priceCentsRaw != null ? Number(priceCentsRaw) : undefined;
        const revenueCents = revenueCentsRaw != null ? Number(revenueCentsRaw) : undefined;
        const sessionId = (data as any).sessionId ? String((data as any).sessionId) : undefined;
        const reason = (data as any).reason ? String((data as any).reason) : undefined;
        const slot = (data as any).slot != null ? Number((data as any).slot) : undefined;

        if (!event) {
          return json({ success: false, error: 'Missing event' }, { status: 400 });
        }

        // Persist best-effort; don’t fail the request if DB unavailable
  await (db as any).trackingEvent?.create?.({
          data: {
            shop: shop!,
            event,
            productId: productId ?? null,
            productTitle: productTitle ?? null,
            priceCents: typeof priceCents === 'number' && !isNaN(priceCents) ? priceCents : null,
            revenueCents: typeof revenueCents === 'number' && !isNaN(revenueCents) ? revenueCents : null,
            sessionId: sessionId ?? null,
            reason: reason ?? null,
            slot: typeof slot === 'number' && isFinite(slot) ? slot : null,
          }
  }).catch(() => null);

        return json({ success: true }, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      } catch (e) {
        console.warn('cart-tracking error:', e);
        return json({ success: false }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    }

    if (path.includes('/api/settings')) {
      // Do not allow saving settings via public proxy
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Proxy action error:", error);
    return json({ error: "Failed to process request" }, { status: 500 });
  }
}
