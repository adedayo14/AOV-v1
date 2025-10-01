import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { getSettings, saveSettings } from "../models/settings.server";
import db from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";
// import { generateBundlesFromOrders } from "../services/ml.server";

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
  console.log('🚀 LOADER ENTRY - URL:', request.url);
  console.log('🚀 LOADER ENTRY - Method:', request.method);
  console.log('🚀 LOADER ENTRY - Headers:', Object.fromEntries(request.headers.entries()));
  
  const url = new URL(request.url);
  const path = url.pathname;

  // Simple test endpoint to verify code execution
  if (path.includes('/api/test')) {
    console.log('🧪 TEST ENDPOINT HIT');
    return json({ 
      message: 'Server code is executing - v387!',
      timestamp: new Date().toISOString(),
      path: path,
      headers: Object.fromEntries(request.headers.entries())
    });
  }

  // GET /apps/proxy/api/diag
  // Diagnostics: verify App Proxy signature, Admin API reachability, and required scopes
  if (path.includes('/api/diag')) {
    const hdrs = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } as Record<string,string>;
    try {
      const { session } = await authenticate.public.appProxy(request);
      const shop = session?.shop;
      if (!shop) return json({ ok: false, proxyAuth: false, reason: 'no_shop' }, { status: 401, headers: hdrs });

      let adminOk = false; let hasReadOrders = false; let hasReadProducts = false; let details: any = {};
      try {
        const { admin } = await unauthenticated.admin(shop as string);
        // Lightweight shop query
        const shopResp = await admin.graphql(`#graphql
          query { shop { name myshopifyDomain } }
        `);
        adminOk = shopResp.ok === true;
        const shopJson: any = adminOk ? await shopResp.json() : null;
        details.shopQuery = { ok: adminOk, data: !!shopJson?.data };
      } catch (_e) {
        details.shopQuery = { ok: false, error: String(_e) };
      }
      try {
        const { admin } = await unauthenticated.admin(shop as string);
        // Minimal orders query to infer read_orders
        const ordersResp = await admin.graphql(`#graphql
          query { orders(first: 1) { edges { node { id } } } }
        `);
        const j: any = await ordersResp.json();
        hasReadOrders = !!j?.data || ordersResp.status !== 403; // 403 often indicates missing scope; presence of data implies scope
        details.ordersProbe = { status: ordersResp.status, hasData: !!j?.data, errors: j?.errors };
      } catch (_e) {
        details.ordersProbe = { error: String(_e) };
      }
      try {
        const { admin } = await unauthenticated.admin(shop as string);
        const productsResp = await admin.graphql(`#graphql
          query { products(first: 1) { edges { node { id } } } }
        `);
        const j: any = await productsResp.json();
        hasReadProducts = !!j?.data || productsResp.status !== 403;
        details.productsProbe = { status: productsResp.status, hasData: !!j?.data, errors: j?.errors };
      } catch (_e) {
        details.productsProbe = { error: String(_e) };
      }

      return json({ ok: true, proxyAuth: true, shop, adminOk, scopes: { read_orders: hasReadOrders, read_products: hasReadProducts }, details }, { headers: hdrs });
    } catch (_e) {
      return json({ ok: false, proxyAuth: false, reason: 'invalid_signature' }, { status: 401, headers: hdrs });
    }
  }

  // GET /apps/proxy/api/recommendations
  // Conservative AOV-focused recs with advanced settings: manual/hybrid, threshold-aware, OOS + price guardrails
  if (path.includes('/api/recommendations')) {
    try {
      const { session } = await authenticate.public.appProxy(request);
      const shop = session?.shop;
      if (!shop) return json({ error: 'Unauthorized' }, { status: 401 });
      const shopStr = shop as string;

      // Query params
      const productIdParam = url.searchParams.get('product_id');
      const productId = productIdParam ? String(productIdParam) : undefined; // single anchor
      const cartParam = url.searchParams.get('cart') || '';
      let limit = Math.min(12, Math.max(1, parseInt(url.searchParams.get('limit') || '6', 10)));
      const subtotalParam = url.searchParams.get('subtotal');
      const subtotal = subtotalParam !== null ? Number(subtotalParam) : undefined; // shop currency units

      // Defaults from settings; override when available
      let enableRecs = true;
      let hideAfterThreshold = false;
      let enableThresholdBasedSuggestions = false;
      let thresholdSuggestionMode = 'smart';
      let manualEnabled = false;
      let manualList: string[] = [];
      let freeShippingThreshold = 0;

      {
        const s = await getSettings(shopStr);
        enableRecs = Boolean(s.enableRecommendations);
        freeShippingThreshold = Number(s.freeShippingThreshold || 0);
        limit = Math.min(limit, Math.max(1, Math.min(12, Number(s.maxRecommendations || limit))));
        hideAfterThreshold = Boolean((s as any).hideRecommendationsAfterThreshold);
        enableThresholdBasedSuggestions = Boolean((s as any).enableThresholdBasedSuggestions);
        thresholdSuggestionMode = String((s as any).thresholdSuggestionMode || 'smart');
        manualEnabled = Boolean((s as any).enableManualRecommendations) || s.complementDetectionMode === 'manual' || s.complementDetectionMode === 'hybrid';
        manualList = (s.manualRecommendationProducts || '').split(',').map((v)=>v.trim()).filter(Boolean);
        
        // 🧠 ML Settings (will be accessed in ML logic below)
        var mlSettings = {
          enabled: Boolean((s as any).enableMLRecommendations),
          personalizationMode: String((s as any).mlPersonalizationMode || 'basic'),
          privacyLevel: String((s as any).mlPrivacyLevel || 'basic'),
          advancedPersonalization: Boolean((s as any).enableAdvancedPersonalization),
          behaviorTracking: Boolean((s as any).enableBehaviorTracking),
          dataRetentionDays: parseInt(String((s as any).mlDataRetentionDays || '90'), 10)
        };

        // Hide entirely once thresholds are met
        if (enableRecs) {
          const need = (typeof subtotal === 'number' && freeShippingThreshold > 0) ? (freeShippingThreshold - subtotal) : undefined;
          if (hideAfterThreshold && typeof need === 'number' && need <= 0) {
            return json({ recommendations: [], reason: 'threshold_met' }, {
              headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60', 'X-Recs-Disabled': 'threshold_met' }
            });
          }
        }

        if (!enableRecs) {
          return json({ recommendations: [], reason: 'disabled' }, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60', 'X-Recs-Disabled': '1' }
          });
        }

        // Cache key includes subtotal + threshold flag (affects filtering)
        const cacheKey = `shop:${shopStr}|pid:${productId||''}|cart:${cartParam}|limit:${limit}|subtotal:${subtotal ?? ''}|thr:${enableThresholdBasedSuggestions?'1':'0'}`;
        const cached = getRecsCache(cacheKey);
        if (cached) {
          return json(cached, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=30',
              'X-Recs-Cache': 'HIT'
            },
          });
        }

        // ---------- ML Settings Integration ----------
        const mlEnabled = mlSettings.enabled;
        const mlPersonalizationMode = mlSettings.personalizationMode;
        const mlPrivacyLevel = mlSettings.privacyLevel;
        const enableAdvancedPersonalization = mlSettings.advancedPersonalization;
        const enableBehaviorTracking = mlSettings.behaviorTracking;
        const mlDataRetentionDays = mlSettings.dataRetentionDays;
        
        console.log('🧠 ML Settings Active:', { 
          mlEnabled, mlPersonalizationMode, mlPrivacyLevel, 
          enableAdvancedPersonalization, enableBehaviorTracking, mlDataRetentionDays 
        });

        // Manual selection pre-fill (deduped, price-threshold aware)
        const needAmount = (typeof subtotal === 'number' && freeShippingThreshold > 0) ? Math.max(0, freeShippingThreshold - subtotal) : 0;
    const { admin } = await unauthenticated.admin(shopStr);

  const normalizeIdsToProducts = async (ids: string[]): Promise<Array<{ id:string; title:string; handle:string; image?:string; price:number; inStock:boolean }>> => {
          if (!ids.length) return [];
          // Fetch nodes for all ids, support both Product and Variant IDs
          const nodeResp = await admin.graphql(`#graphql
            query N($ids: [ID!]!) { nodes(ids: $ids) {
              ... on Product { id title handle vendor status media(first:1){edges{node{... on MediaImage{image{url}}}}} variants(first:1){edges{node{id price availableForSale}}} }
              ... on ProductVariant { id price availableForSale product { id title handle vendor media(first:1){edges{node{... on MediaImage{image{url}}}}} } }
            } }
          `, { variables: { ids } });
          if (!nodeResp.ok) return [];
          const j: any = await nodeResp.json();
          const arr: any[] = j?.data?.nodes || [];
          const out: Array<{ id:string; title:string; handle:string; image?:string; price:number; inStock:boolean }> = [];
          for (const n of arr) {
            if (!n) continue;
            if (n.__typename === 'Product' || (n.id && String(n.id).includes('/Product/'))) {
              const v = n.variants?.edges?.[0]?.node;
              const price = parseFloat(v?.price || '0') || 0;
              const inStock = Boolean(v?.availableForSale) || (n.status === 'ACTIVE');
              out.push({ id: (n.id as string).replace('gid://shopify/Product/',''), title: n.title||'', handle: n.handle||'', image: n.media?.edges?.[0]?.node?.image?.url, price, inStock });
            } else if (n.__typename === 'ProductVariant' || (n.id && String(n.id).includes('/ProductVariant/'))) {
              const price = parseFloat(n.price || '0') || 0;
              const inStock = Boolean(n.availableForSale);
              const p = n.product;
              if (p?.id) out.push({ id: (p.id as string).replace('gid://shopify/Product/',''), title: p.title||'', handle: p.handle||'', image: p.media?.edges?.[0]?.node?.image?.url, price, inStock });
            }
          }
          return out;
        };

        let manualResults: Array<{ id:string; title:string; handle:string; image?:string; price:number }> = [];
        if (manualEnabled && manualList.length) {
          const normalized = await normalizeIdsToProducts(manualList);
          const seen = new Set<string>();
          for (const m of normalized) {
            if (!m.inStock) continue;
            if (enableThresholdBasedSuggestions && needAmount > 0 && m.price < needAmount) continue;
            if (seen.has(m.id)) continue;
            // Avoid recommending items already in context
            if (cartParam.split(',').includes(m.id) || (productId && m.id === productId)) continue;
            seen.add(m.id);
            manualResults.push({ id: m.id, title: m.title, handle: m.handle, image: m.image, price: m.price });
            if (manualResults.length >= limit) break;
          }
          if (manualEnabled && manualResults.length >= limit && (thresholdSuggestionMode === 'price' || (thresholdSuggestionMode === 'smart' && enableThresholdBasedSuggestions))) {
            // Early return when manual fully satisfies quota
            const payload = { recommendations: manualResults.slice(0, limit) };
            setRecsCache(cacheKey, payload);
            return json(payload, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' } });
          }
          // If mode is strictly manual, return immediately regardless of count
          // We infer strict manual when complementDetectionMode === 'manual' (included via manualEnabled above)
        }

        // ---------- AI/Stats-based generation (existing algorithm) ----------
        const HALF_LIFE_DAYS = 60;
        const PRICE_GAP_LO = 0.5;
        const PRICE_GAP_HI = 2.0;

        // Anchor set
        const anchors = new Set<string>();
        if (productId) anchors.add(productId);
        if (cartParam) {
          for (const id of cartParam.split(',').map(s => s.trim()).filter(Boolean)) anchors.add(id);
        }
        if (anchors.size === 0) {
          return json({ recommendations: [], reason: 'no_context' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        // Fetch recent orders to compute decayed associations/popularity
        const ordersResp = await admin.graphql(`
          #graphql
          query getOrders($first: Int!) {
            orders(first: $first, sortKey: CREATED_AT, reverse: true) {
              edges { node {
                id
                createdAt
                lineItems(first: 30) { edges { node {
                  product { id title handle media(first: 1) { edges { node { ... on MediaImage { image { url } } } } } vendor }
                  variant { id price }
                } } }
              } }
            }
          }
        `, { variables: { first: 200 } });
        if (!ordersResp.ok) {
          console.warn('Admin orders HTTP error:', ordersResp.status, ordersResp.statusText);
          return json({ recommendations: [], reason: `admin_http_${ordersResp.status}` }, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
          });
        }
        const ordersData: any = await ordersResp.json();
        if ((ordersData as any)?.errors || !(ordersData as any)?.data) {
          console.warn('Admin orders GraphQL error:', (ordersData as any)?.errors || 'No data');
          return json({ recommendations: [], reason: 'admin_orders_error' }, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
          });
        }
        const orderEdges: any[] = ordersData?.data?.orders?.edges || [];

        // Build decayed stats
        const LN2_OVER_HL = Math.log(2) / HALF_LIFE_DAYS;
        type Assoc = { co:number; wco:number; rev:number; wrev:number; aov:number };
        const assoc: Record<string, { product: any; copurchases: Record<string, Assoc>; wAppear:number; price:number; handle:string; vendor?:string; image?:string } > = {};
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
            const vprice = parseFloat(ie.node.variant?.price || '0') || 0;
            const img = p.media?.edges?.[0]?.node?.image?.url;
            items.push({ pid, title: p.title, handle: p.handle, img, price: vprice, vendor: p.vendor });
          }
          if (items.length < 2) continue;

          // appearances (decayed)
          const seen = new Set<string>();
          for (const it of items) {
            if (!seen.has(it.pid)) {
              wAppear[it.pid] = (wAppear[it.pid]||0)+w;
              seen.add(it.pid);
              if (!assoc[it.pid]) assoc[it.pid] = { product: { id: it.pid, title: it.title }, copurchases: {}, wAppear: 0, price: it.price, handle: it.handle, vendor: it.vendor, image: it.img };
              assoc[it.pid].wAppear += w;
              assoc[it.pid].price = it.price; assoc[it.pid].handle = it.handle; assoc[it.pid].image = it.img; assoc[it.pid].product.title = it.title; assoc[it.pid].vendor = it.vendor;
            }
          }

          // pairs
          for (let i=0;i<items.length;i++) for (let j=i+1;j<items.length;j++) {
            const a = items[i], b = items[j];
            if (!assoc[a.pid]) assoc[a.pid] = { product:{id:a.pid,title:a.title}, copurchases:{}, wAppear:0, price:a.price, handle:a.handle, vendor:a.vendor, image:a.img };
            if (!assoc[b.pid]) assoc[b.pid] = { product:{id:b.pid,title:b.title}, copurchases:{}, wAppear:0, price:b.price, handle:b.handle, vendor:b.vendor, image:b.img };
            if (!assoc[a.pid].copurchases[b.pid]) assoc[a.pid].copurchases[b.pid] = { co:0,wco:0,rev:0,wrev:0,aov:0 };
            if (!assoc[b.pid].copurchases[a.pid]) assoc[b.pid].copurchases[a.pid] = { co:0,wco:0,rev:0,wrev:0,aov:0 };
            assoc[a.pid].copurchases[b.pid].co++; assoc[a.pid].copurchases[b.pid].wco+=w;
            assoc[b.pid].copurchases[a.pid].co++; assoc[b.pid].copurchases[a.pid].wco+=w;
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
          for (const [b, ab] of Object.entries(aStats.copurchases)) {
            if (anchors.has(b)) continue; // don’t recommend items already in context
            const wB = assoc[b]?.wAppear || 0;
            if (wB <= 0) continue;
            const confidence = ab.wco / Math.max(1e-6, wA);
            const probB = wB / totalW;
            const lift = probB > 0 ? confidence / probB : 0;
            const liftNorm = Math.min(liftCap, lift) / liftCap; // [0..1]
            const popNorm = Math.min(1, wB / (totalW * 0.05)); // normalize: top 5% mass ~1
            const sc = 0.6 * liftNorm + 0.4 * popNorm;
            if (!candidate[b] || sc > candidate[b].score) {
              candidate[b] = { score: sc, lift, pop: wB/totalW, handle: assoc[b]?.handle, vendor: assoc[b]?.vendor };
            }
          }
        }

        // OOS filter via Admin API for small top set
        const topIds = Object.entries(candidate)
          .sort((a,b)=>b[1].score - a[1].score)
          .slice(0, 24)
          .map(([id])=>id);

        if (topIds.length === 0) {
          return json({ recommendations: manualResults.slice(0, limit) }, { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        // Fetch inventory/availability and price data for candidates
        const prodGids = topIds.map(id => `gid://shopify/Product/${id}`);
        const invResp = await admin.graphql(`
          #graphql
          query inv($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on Product { id title handle vendor status totalInventory availableForSale variants(first: 10) { edges { node { id availableForSale price } } } media(first:1){edges{node{... on MediaImage { image { url } }}}} }
            }
          }
        `, { variables: { ids: prodGids } });
        if (!invResp.ok) {
          console.warn('Admin inventory HTTP error:', invResp.status, invResp.statusText);
          return json({ recommendations: manualResults.slice(0, limit), reason: `admin_http_${invResp.status}` }, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
          });
        }
        const invData: any = await invResp.json();
        if ((invData as any)?.errors || !(invData as any)?.data) {
          console.warn('Admin inventory GraphQL error:', (invData as any)?.errors || 'No data');
          return json({ recommendations: manualResults.slice(0, limit), reason: 'admin_inventory_error' }, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
          });
        }
        const nodes: any[] = invData?.data?.nodes || [];
        const availability: Record<string, { inStock:boolean; price:number; title:string; handle:string; img?:string; vendor?:string } > = {};
        for (const n of nodes) {
          if (!n?.id) continue;
          const id = (n.id as string).replace('gid://shopify/Product/','');
          const variants = n.variants?.edges || [];
          const inStock = Boolean(n.availableForSale) || variants.some((v:any)=>v?.node?.availableForSale);
          const price = variants.length ? parseFloat(variants[0].node?.price||'0')||0 : (assoc[id]?.price||0);
          availability[id] = { inStock, price, title: n.title, handle: n.handle, img: n.media?.edges?.[0]?.node?.image?.url, vendor: n.vendor };
        }

        // Final ranking with guardrails (price-gap + diversity)
        const results: Array<{ id:string; title:string; handle:string; image?:string; price:number } > = [];
        const usedHandles = new Set<string>();
        const targetPrice = anchorMedian;
        // CTR-based re-ranking (best-effort)
        let ctrById: Record<string, number> = {};
        try {
          const tracking = (db as any)?.trackingEvent;
          if (tracking?.findMany) {
            const since = new Date(Date.now() - 14 * 86400000);
            const candIds = topIds;
            if (candIds.length) {
              const rows = await tracking.findMany({
                where: { shop: shopStr, createdAt: { gte: since }, productId: { in: candIds } },
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
              const alpha = 1, beta = 20; // Laplace smoothing
              for (const pid of Object.keys(counts)) {
                const { imp, clk } = counts[pid];
                const ctr = (clk + alpha) / (imp + beta);
                ctrById[pid] = ctr;
              }
            }
          }
        } catch (_e) {
          console.warn('CTR re-rank skipped:', _e);
        }

        const BASELINE_CTR = 0.05; // 5%
        const CTR_WEIGHT = 0.35;
        const scored = Object.entries(candidate).map(([bid, meta]) => {
          const ctr = ctrById[bid] ?? BASELINE_CTR;
          const mult = Math.max(0.85, Math.min(1.25, 1 + CTR_WEIGHT * (ctr - BASELINE_CTR)));
          return [bid, { ...meta, score: meta.score * mult } ] as [string, typeof meta];
        }).sort((a,b)=>b[1].score - a[1].score);

        for (const [bid, meta] of scored) {
          if (results.length >= Math.max(0, limit - manualResults.length)) break;
          const info = availability[bid];
          if (!info?.inStock) continue;
          if (enableThresholdBasedSuggestions && needAmount > 0 && info.price < needAmount) continue;
          if (typeof targetPrice === 'number' && targetPrice > 0) {
            const ratio = info.price / targetPrice;
            if (ratio < PRICE_GAP_LO || ratio > PRICE_GAP_HI) continue;
          }
          const h = (info.handle || meta.handle || '').split('-')[0];
          if (usedHandles.has(h)) continue; // diversity
          usedHandles.add(h);
          results.push({ id: bid, title: info.title || assoc[bid]?.product?.title || '', handle: info.handle || assoc[bid]?.handle || '', image: info.img || assoc[bid]?.image, price: info.price });
        }

        // Combine manual and algorithmic with de-duplication
        const combined: Array<{ id:string; title:string; handle:string; image?:string; price:number }> = [];
        const seenIds = new Set<string>();
        const pushUnique = (arr: typeof combined) => {
          for (const r of arr) {
            if (seenIds.has(r.id)) continue;
            seenIds.add(r.id);
            combined.push(r);
            if (combined.length >= limit) break;
          }
        };
        if (manualResults.length) pushUnique(manualResults);
        if (combined.length < limit) pushUnique(results);

        if (enableThresholdBasedSuggestions && needAmount > 0 && thresholdSuggestionMode === 'price') {
          combined.sort((a,b)=> (a.price - needAmount) - (b.price - needAmount));
        }

        // ---------- A/B Testing Integration ----------
        let abTestVariant: string | null = null;
        let abTestConfig: any = {};
        
        // Check for active A/B experiments
        try {
          const userId = url.searchParams.get('session_id') || url.searchParams.get('customer_id') || 'anonymous';
          const abResponse = await fetch(`${url.origin}/apps/proxy/api/ab-testing?action=get_active_experiments`, {
            headers: { 'X-Shopify-Shop-Domain': shopStr }
          });
          
          if (abResponse.ok) {
            const abData = await abResponse.json();
            const activeExperiments = abData.experiments || [];
            
            // Find recommendation-related experiments
            const recommendationExperiment = activeExperiments.find((exp: any) => 
              exp.test_type === 'ml_algorithm' || exp.test_type === 'recommendation_copy'
            );
            
            if (recommendationExperiment) {
              // Get variant assignment
              const variantResponse = await fetch(`${url.origin}/apps/proxy/api/ab-testing?action=get_variant&experiment_id=${recommendationExperiment.id}&user_id=${userId}`, {
                headers: { 'X-Shopify-Shop-Domain': shopStr }
              });
              
              if (variantResponse.ok) {
                const variantData = await variantResponse.json();
                abTestVariant = variantData.variant;
                abTestConfig = variantData.config || {};
                
                console.log('🧪 A/B Test Active:', {
                  experiment: recommendationExperiment.name,
                  variant: abTestVariant,
                  config: abTestConfig
                });
              }
            }
          }
        } catch (abError) {
          console.warn('⚠️ A/B testing check failed:', abError);
        }

        // ---------- ML Enhancement & Real Data Tracking ----------
        let finalRecommendations = combined;
        let dataMetrics = {
          orderCount: orderEdges.length,
          associationCount: Object.keys(assoc).length,
          mlEnhanced: false,
          dataQuality: 'basic',
          abTestVariant: abTestVariant,
          abTestConfig: abTestConfig
        };
        
        // Apply A/B test overrides to ML configuration
        let effectiveMlEnabled = mlEnabled;
        let effectivePersonalizationMode = mlPersonalizationMode;
        
        if (abTestVariant && abTestConfig) {
          if ('mlEnabled' in abTestConfig) {
            effectiveMlEnabled = abTestConfig.mlEnabled;
          }
          if (abTestConfig.personalizationMode) {
            effectivePersonalizationMode = abTestConfig.personalizationMode;
          }
          if (abTestConfig.algorithm) {
            console.log('🧪 A/B Test Algorithm Override:', abTestConfig.algorithm);
          }
        }

        if (effectiveMlEnabled && orderEdges.length > 0) {
          try {
            // Real ML enhancement based on actual data
            if (orderEdges.length >= 50 && effectivePersonalizationMode !== 'basic') {
              console.log('🚀 Applying advanced ML with', orderEdges.length, 'orders of data');
              
              // Enhanced scoring with real customer behavior (implemented inline)
              const enhancedScoring = combined.map(rec => {
                // Find frequency of this product in recent orders
                const productAppearances = orderEdges.filter(order => 
                  order.node?.lineItems?.edges?.some((li: any) => 
                    li.node?.product?.id?.includes(rec.id)
                  )
                ).length;
                
                const popularityScore = productAppearances / Math.max(1, orderEdges.length);
                const enhancedScore = popularityScore * (effectivePersonalizationMode === 'advanced' ? 2.0 : 1.5);
                
                return { ...rec, mlScore: enhancedScore };
              });
              
              // Re-sort by ML score
              finalRecommendations = enhancedScoring
                .sort((a, b) => (b.mlScore || 0) - (a.mlScore || 0))
                .slice(0, limit);
              
              dataMetrics.mlEnhanced = true;
              dataMetrics.dataQuality = orderEdges.length >= 200 ? 'rich' : orderEdges.length >= 100 ? 'good' : 'growing';
            } else if (orderEdges.length < 10) {
              console.log('📊 New store detected, using existing algorithm with', orderEdges.length, 'orders');
              // Cold start: Keep existing recommendations but mark as new store
              dataMetrics.dataQuality = 'new_store';
            }
            
            // Track ML recommendation event with real data (if privacy allows)
            if (enableBehaviorTracking && mlPrivacyLevel !== 'basic') {
              try {
                // Real event tracking implementation
                console.log('📈 Tracking ML recommendation event:', {
                  shop: shopStr,
                  eventType: 'ml_recommendation_served',
                  anchors: Array.from(anchors),
                  recommendationCount: finalRecommendations.length,
                  dataQuality: dataMetrics.dataQuality,
                  mlMode: mlPersonalizationMode,
                  orderDataPoints: orderEdges.length
                });
                
                // Store in tracking events if available
                if ((db as any)?.trackingEvent?.create) {
                  await (db as any).trackingEvent.create({
                    data: {
                      shop: shopStr,
                      event: 'ml_recommendation_served',
                      productId: Array.from(anchors)[0] || '',
                      metadata: JSON.stringify({
                        anchors: Array.from(anchors),
                        recommendationCount: finalRecommendations.length,
                        dataQuality: dataMetrics.dataQuality,
                        mlMode: mlPersonalizationMode,
                        orderDataPoints: orderEdges.length
                      }),
                      createdAt: new Date()
                    }
                  }).catch(() => null); // Graceful failure
                }
              } catch (trackingError) {
                console.warn('📊 ML event tracking failed:', trackingError);
              }
            }
          } catch (mlError) {
            console.warn('⚠️ ML enhancement failed, using standard algorithm:', mlError);
            // Graceful degradation - keep original recommendations
          }
        }

        const payload = { 
          recommendations: finalRecommendations,
          ml_data: mlEnabled ? {
            enhanced: dataMetrics.mlEnhanced,
            order_count: dataMetrics.orderCount,
            data_quality: dataMetrics.dataQuality,
            personalization_mode: mlPersonalizationMode,
            privacy_level: mlPrivacyLevel
          } : undefined
        };
        setRecsCache(cacheKey, payload);

        return json(payload, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=60',
            'X-Recs-Cache': 'MISS',
            'X-ML-Enhanced': String(dataMetrics.mlEnhanced),
            'X-Data-Quality': dataMetrics.dataQuality
          },
        });
      }
    } catch (error) {
      console.error('Recs API error:', error);
      // Soft-fail with empty list to avoid breaking the storefront UX
      return json({ recommendations: [], reason: 'unavailable' }, {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=10' }
      });
    }
  }

  // GET /apps/proxy/api/products
  // Lightweight product search for theme/app proxy contexts
  if (path.includes('/api/products')) {
    try {
      const { session } = await authenticate.public.appProxy(request);
      const shop = session?.shop;
      if (!shop) return json({ products: [], error: 'Unauthorized' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });

      const q = url.searchParams.get('query') || '';
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

      const { admin } = await unauthenticated.admin(shop as string);
      const resp = await admin.graphql(`#graphql
        query getProducts($first: Int!, $query: String) {
          products(first: $first, query: $query) {
            edges {
              node {
                id
                title
                handle
                status
                featuredImage { url altText }
                priceRangeV2 { minVariantPrice { amount currencyCode } }
                variants(first: 10) {
                  edges { node { id title price availableForSale } }
                }
              }
            }
            pageInfo { hasNextPage }
          }
        }
      `, { variables: { first: limit, query: q ? `title:*${q}* OR vendor:*${q}* OR tag:*${q}*` : '' } });

      if (!resp.ok) {
        const text = await resp.text();
        console.warn('Proxy products HTTP error:', resp.status, text);
        return json({ products: [], error: `HTTP ${resp.status}` }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      const data: any = await resp.json();
      if (!data?.data) {
        console.warn('Proxy products GraphQL error:', data?.errors);
        return json({ products: [], error: 'GraphQL error' }, { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      const products = (data.data.products.edges || []).map((edge: any) => {
        const n = edge.node;
        const variants = (n.variants?.edges || []).map((ve: any) => ({
          id: ve.node.id,
          title: ve.node.title,
          price: typeof ve.node.price === 'number' ? ve.node.price : parseFloat(ve.node.price ?? '0') || 0,
          availableForSale: ve.node.availableForSale,
        }));
        const minPriceAmount = n.priceRangeV2?.minVariantPrice?.amount;
        const currency = n.priceRangeV2?.minVariantPrice?.currencyCode || 'USD';
        const minPrice = typeof minPriceAmount === 'number' ? minPriceAmount : parseFloat(minPriceAmount ?? '0') || (variants[0]?.price ?? 0);
        return {
          id: n.id,
          title: n.title,
          handle: n.handle,
          status: n.status,
          image: n.featuredImage?.url || null,
          imageAlt: n.featuredImage?.altText || n.title,
          minPrice,
          currency,
          price: minPrice,
          variants,
        };
      });

      return json({ products, hasNextPage: Boolean(data.data.products.pageInfo?.hasNextPage) }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      console.error('Proxy products error:', e);
      return json({ products: [], error: 'unavailable' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  }

  // GET /apps/proxy/api/bundles
  // Returns simple, high-confidence bundles for PDP based on recent co-purchases.
  if (path.includes('/api/bundles')) {
    console.log('[BUNDLES API] === STARTING BUNDLES REQUEST ===');
    console.log('[BUNDLES API] Request URL:', request.url);
    console.log('[BUNDLES API] Request method:', request.method);
    try {
      console.log('[BUNDLES API] Step 1: Authenticating app proxy...');
      const { session } = await authenticate.public.appProxy(request);
      const shop = session?.shop;
      console.log('[BUNDLES API] Step 2: Shop authenticated:', shop);
      
      if (!shop) {
        console.log('[BUNDLES API] ERROR: No shop found, returning unauthorized');
        return json({ error: 'Unauthorized' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*', 'X-Bundles-Reason': 'unauthorized' } });
      }
      const shopStr = shop as string;

      console.log('[BUNDLES API] Step 3: Parsing parameters...');
      const context = url.searchParams.get('context') || 'product';
      const productIdParam = url.searchParams.get('product_id') || undefined;
      console.log('[BUNDLES API] Context:', context, 'Product ID:', productIdParam);

      console.log('[BUNDLES API] Step 4: Loading settings...');
      // Feature flag check
      let settings: any = undefined;
      try { 
        settings = await getSettings(shopStr);
        console.log('[BUNDLES API] Settings loaded successfully:', {
          enableSmartBundles: settings?.enableSmartBundles,
          bundlesOnProductPages: settings?.bundlesOnProductPages,
          enableMLRecommendations: settings?.enableMLRecommendations,
          mlPersonalizationMode: settings?.mlPersonalizationMode,
          settingsKeys: Object.keys(settings || {})
        });
  } catch(_e) { 
  console.error('[BUNDLES API] Failed to load settings:', _e);
      }
      
      // 🧠 ML Settings for Bundles
      const bundleMLSettings = settings ? {
        enabled: Boolean(settings.enableMLRecommendations),
        smartBundlesEnabled: Boolean(settings.enableSmartBundles), 
        personalizationMode: String(settings.mlPersonalizationMode || 'basic'),
        privacyLevel: String(settings.mlPrivacyLevel || 'basic'),
        behaviorTracking: Boolean(settings.enableBehaviorTracking)
      } : { enabled: false, smartBundlesEnabled: false, personalizationMode: 'basic', privacyLevel: 'basic', behaviorTracking: false };
      
      console.log('🛒 Bundle ML Settings:', bundleMLSettings);
      
      console.log('[BUNDLES API] Step 5: Checking feature flags...');
      // Temporarily bypass the setting check for testing
      console.log('[BUNDLES API] Bypassing enableSmartBundles check for testing');
      /*
      if (!settings?.enableSmartBundles) {
        console.log('[BUNDLES API] Smart bundles disabled, enableSmartBundles:', settings?.enableSmartBundles);
        return json({ bundles: [], reason: 'disabled' }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      */
      if (
        context === 'product' &&
        settings &&
        Object.prototype.hasOwnProperty.call(settings, 'bundlesOnProductPages') &&
        settings.bundlesOnProductPages === false
      ) {
        console.log('[BUNDLES API] Bundles on product pages explicitly disabled in settings');
        return json({ bundles: [], reason: 'disabled_page' }, { headers: { 'Access-Control-Allow-Origin': '*', 'X-Bundles-Gated': '1', 'X-Bundles-Reason': 'disabled_page', 'X-Bundles-Context': context, 'Vary': 'X-Bundles-Gated' } });
      }

      // Relaxed gating: only gate if settings are loaded AND bundlesOnProductPages is explicitly false.
      // If settings fail to load, proceed with defaults.
      if (context === 'product' && settings?.bundlesOnProductPages === false) {
        console.log('[BUNDLES API] Bundles on product pages explicitly disabled in settings');
        return json({ bundles: [], reason: 'disabled_page' }, { headers: { 'Access-Control-Allow-Origin': '*', 'X-Bundles-Gated': '1', 'X-Bundles-Reason': 'disabled_page', 'X-Bundles-Context': context, 'Vary': 'X-Bundles-Gated' } });
      }

      if (context !== 'product' || !productIdParam) {
        console.log('[BUNDLES API] Invalid context or missing product ID');
        return json({ bundles: [], reason: 'invalid_params' }, { headers: { 'Access-Control-Allow-Origin': '*', 'X-Bundles-Reason': 'invalid_params', 'X-Bundles-Context': String(context) } });
      }

      // Resolve product id: accept numeric id; if not numeric, try as handle via Admin API
  let productId = String(productIdParam);
      if (!/^[0-9]+$/.test(productId)) {
        try {
          const { admin } = await unauthenticated.admin(shopStr);
          const byHandleResp = await admin.graphql(`#graphql
            query($handle: String!) { productByIdentifier(identifier: { handle: $handle }) { id } }
          `, { variables: { handle: productId } });
          if (byHandleResp.ok) {
            const data: any = await byHandleResp.json();
            const gid: string | undefined = data?.data?.productByIdentifier?.id;
            if (gid) productId = gid.replace('gid://shopify/Product/','');
          }
        } catch(_) { /* ignore */ }
      } else {
        // If numeric, it could be a Variant ID; try resolving to Product ID
        try {
          const { admin } = await unauthenticated.admin(shopStr);
          const nodeResp = await admin.graphql(`#graphql
            query($id: ID!) { node(id: $id) { __typename ... on ProductVariant { product { id } } ... on Product { id } } }
          `, { variables: { id: `gid://shopify/ProductVariant/${productId}` } });
          if (nodeResp.ok) {
            const data: any = await nodeResp.json();
            const n = data?.data?.node;
            if (n?.__typename === 'ProductVariant' && n?.product?.id) {
              productId = String(n.product.id).replace('gid://shopify/Product/','');
            } else if (n?.__typename === 'Product' && n?.id) {
              productId = String(n.id).replace('gid://shopify/Product/','');
            }
          }
        } catch(_) { /* ignore; fall back to provided id */ }
      }

      // Guard: unresolved or invalid product id
      if (!productId || !/^[0-9]+$/.test(productId)) {
        return json({ bundles: [], reason: 'invalid_product' }, { headers: { 'Access-Control-Allow-Origin': '*', 'X-Bundles-Reason': 'invalid_product', 'X-Bundles-Context': context } });
      }

      console.log('[BUNDLES API] Step 6: Generating bundles...');
      
      // Fetch real products from the store to use in bundles
      console.log('[BUNDLES API] Fetching real products from store...');
  const { admin } = await unauthenticated.admin(shopStr);
      
      // Get the current product details
  let currentProduct: any = null;
      try {
    const currentProductResp = await admin.graphql(`#graphql
          query($id: ID!) { 
            product(id: $id) { 
              id 
              title 
              handle
      variants(first: 10) { 
                edges { 
                  node { 
                    id 
                    title
                    price 
                    compareAtPrice
        availableForSale
                    selectedOptions { name value }
                  } 
                } 
              }
              media(first: 1) {
                edges {
                  node {
                    ... on MediaImage {
                      image {
                        url
                      }
                    }
                  }
                }
              }
            } 
          }
        `, { variables: { id: `gid://shopify/Product/${productId}` } });
        
        if (currentProductResp.ok) {
          const data = await currentProductResp.json();
          currentProduct = data?.data?.product;
          console.log('[BUNDLES API] Current product loaded:', currentProduct?.title);
        }
  } catch (_e) {
  console.error('[BUNDLES API] Failed to load current product:', _e);
      }
      
      // Get other products from the store
      let otherProducts = [];
      try {
    const productsResp = await admin.graphql(`#graphql
          query {
            products(first: 50, query: "status:active") {
              edges {
                node {
                  id
                  title
                  handle
      variants(first: 10) {
                    edges {
                      node {
                        id
                        title
                        price
                        compareAtPrice
        availableForSale
                        selectedOptions { name value }
                      }
                    }
                  }
                  media(first: 1) {
                    edges {
                      node {
                        ... on MediaImage {
                          image {
                            url
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `);
        
        if (productsResp.ok) {
          const data: any = await productsResp.json();
          otherProducts = data?.data?.products?.edges?.map((edge: any) => edge.node) || [];
          console.log('[BUNDLES API] Found', otherProducts.length, 'other products');
        }
  } catch (_e) {
  console.error('[BUNDLES API] Failed to load other products:', _e);
      }
      
      // Create bundles using context-aware recommendations
      const bundles = [] as any[];

      if (currentProduct) {
        // Helper function to normalize product with first available variant
        const getProductDetails = (product: any) => {
          const variantEdges = Array.isArray(product?.variants?.edges) ? product.variants.edges : [];
          const firstAvailable = variantEdges.find((e:any)=>e?.node?.availableForSale)?.node || variantEdges[0]?.node;
          const firstVariant = firstAvailable;
          
          // Ensure we have a valid variant
          if (!firstVariant?.id) {
            console.warn(`[BUNDLES API] Product ${product?.title || product?.id} has no valid variants`);
            return null;
          }
          
          const opts = Array.isArray(firstVariant?.selectedOptions)
            ? firstVariant.selectedOptions.map((o: any) => ({ name: o?.name, value: o?.value }))
            : [];
          return {
            id: String(product.id).replace('gid://shopify/Product/', ''),
            variant_id: String(firstVariant.id).replace('gid://shopify/ProductVariant/', ''),
            variant_title: firstVariant?.title,
            options: opts,
            title: product.title,
            price: parseFloat(firstVariant?.price || '0'),
            image: product.media?.edges?.[0]?.node?.image?.url || undefined
          };
        };

  const currentProd = getProductDetails(currentProduct);
        
        // Skip bundle creation if current product doesn't have valid variants
        if (!currentProd) {
          console.warn('[BUNDLES API] Current product has no valid variants, skipping bundle creation');
          console.log(`[BUNDLES API] === BUNDLE GENERATION COMPLETED (NO VARIANTS) ===`);
          return json({ bundles: [], reason: 'no_variants' }, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' }
          });
  }
  const currentProdNN = currentProd as any;

        // Compute related products from recent orders (focused on this anchor)
  const { admin } = await unauthenticated.admin(shopStr);
        const ordersResp = await admin.graphql(`
          #graphql
          query getOrders($first: Int!) {
            orders(first: $first, sortKey: CREATED_AT, reverse: true) {
              edges { node {
                id
                createdAt
                lineItems(first: 30) { edges { node {
                  product { id title handle media(first: 1) { edges { node { ... on MediaImage { image { url } } } } } vendor }
                  variant { id price }
                } } }
              } }
            }
          }
        `, { variables: { first: 200 } });
        let relatedIds: string[] = [];
        let debugInfo = { method: 'none', anchor: String(productId), orderCount: 0, assocCount: 0 } as any;
        try {
          const ok = ordersResp.ok;
          const ordersData: any = ok ? await ordersResp.json() : null;
          const orderEdges: any[] = ordersData?.data?.orders?.edges || [];
          debugInfo.orderCount = orderEdges.length;
          console.log(`[BUNDLES API] Processing ${orderEdges.length} orders for anchor product ${productId}`);
          const getPid = (gid?: string) => (gid||'').replace('gid://shopify/Product/','');
          // Decay setup similar to recommendations endpoint
          const HALF_LIFE_DAYS = 60;
          const LN2_OVER_HL = Math.log(2) / HALF_LIFE_DAYS;
          const wAppear: Record<string, number> = {};
          const assoc: Record<string, { copurchases: Record<string, { wco:number }>, wAppear:number } > = {};
          for (const e of orderEdges) {
            const n = e.node;
            const createdAt = new Date(n.createdAt);
            const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / 86400000);
            const w = Math.exp(-LN2_OVER_HL * ageDays);
            const items: Array<{pid:string}> = [];
            for (const ie of (n.lineItems?.edges||[])) {
              const p = ie.node.product; if (!p?.id) continue;
              const pid = getPid(p.id);
              items.push({ pid });
            }
            if (items.length < 2) continue;
            const seen = new Set<string>();
            for (const it of items) { if (!seen.has(it.pid)) { wAppear[it.pid] = (wAppear[it.pid]||0)+w; seen.add(it.pid); } }
            for (let i=0;i<items.length;i++) for (let j=i+1;j<items.length;j++) {
              const a = items[i].pid, b = items[j].pid;
              assoc[a] = assoc[a] || { copurchases: {}, wAppear: 0 } as any;
              assoc[b] = assoc[b] || { copurchases: {}, wAppear: 0 } as any;
              assoc[a].copurchases[b] = assoc[a].copurchases[b] || { wco: 0 } as any;
              assoc[b].copurchases[a] = assoc[b].copurchases[a] || { wco: 0 } as any;
              assoc[a].copurchases[b].wco += w;
              assoc[b].copurchases[a].wco += w;
              (assoc[a].wAppear as number) += w; (assoc[b].wAppear as number) += w;
            }
          }
          debugInfo.assocCount = Object.keys(assoc).length;
          console.log(`[BUNDLES API] Built associations for ${debugInfo.assocCount} products`);
          const anchor = String(productId);
          const cand: Record<string, number> = {};
          const aStats = assoc[anchor] as any;
          const totalW = Object.values(wAppear).reduce((a,b)=>a+b,0) || 1;
          if (aStats) {
            console.log(`[BUNDLES API] Anchor product ${anchor} found in ${Object.keys(aStats.copurchases).length} associations`);
            for (const [b, ab] of Object.entries(aStats.copurchases)) {
              if (b === anchor) continue;
              const wB = wAppear[b] || 0; if (wB <= 0) continue;
              const confidence = (ab as any).wco / Math.max(1e-6, (aStats.wAppear as number) || 1);
              const probB = wB / totalW;
              const lift = probB > 0 ? confidence / probB : 0;
              // score blend
              const liftCap = 2.0; const liftNorm = Math.min(liftCap, lift) / liftCap;
              const popNorm = Math.min(1, wB / (totalW * 0.05));
              cand[b] = Math.max(cand[b]||0, 0.6*liftNorm + 0.4*popNorm);
            }
            debugInfo.method = 'orders';
          } else {
            console.log(`[BUNDLES API] Anchor product ${anchor} not found in order associations`);
          }
          relatedIds = Object.entries(cand).sort((a,b)=>b[1]-a[1]).slice(0, 4).map(([id])=>id);
          console.log(`[BUNDLES API] Orders-based related IDs:`, relatedIds);
        } catch { 
          console.log(`[BUNDLES API] Orders processing failed, falling back`);
          relatedIds = []; 
        }

        // Fallback: vendor-based or catalog-based when orders are insufficient
        if (relatedIds.length === 0 && otherProducts.length > 0) {
          const curVendor = currentProduct?.vendor;
          console.log(`[BUNDLES API] No orders-based results, falling back. Current vendor: ${curVendor}`);
          const byVendor = curVendor ? otherProducts.filter((p:any)=>p?.vendor && p.vendor === curVendor) : [];
          const candidates = (byVendor.length ? byVendor : otherProducts)
            .filter((p:any)=>String(p.id).replace('gid://shopify/Product/','') !== String(productId));
          console.log(`[BUNDLES API] Catalog fallback candidate count: ${candidates.length}`);
          // Shuffle and take up to 4
          const shuffled = candidates.slice().sort(() => Math.random() - 0.5);
          relatedIds = shuffled.map((p:any)=>String(p.id).replace('gid://shopify/Product/','')).slice(0, 4);
          debugInfo.method = byVendor.length ? 'vendor' : 'catalog';
          console.log(`[BUNDLES API] Fallback method '${debugInfo.method}' selected IDs:`, relatedIds);
        }

        // Fetch details for related products
        let relatedProducts: any[] = [];
        if (relatedIds.length) {
          const prodGids = relatedIds.map(id => `gid://shopify/Product/${id}`);
          const nodesResp = await admin.graphql(`
            #graphql
            query rel($ids: [ID!]!) { nodes(ids: $ids) { ... on Product { id title handle variants(first: 10) { edges { node { id title price compareAtPrice availableForSale selectedOptions { name value } } } } media(first:1){edges{node{... on MediaImage { image { url } }}}} } } }
          `, { variables: { ids: prodGids } });
          if (nodesResp.ok) {
            const nodesData: any = await nodesResp.json();
            relatedProducts = nodesData?.data?.nodes?.filter((n:any)=>n?.id) || [];
          } else {
            console.warn('[BUNDLES API] Related products fetch failed with status', nodesResp.status);
          }
        }

        // Choose top 2 complements, exclude subscription/selling-plan only products heuristically
        let filteredRelated = relatedProducts.filter((p:any)=>{
          const t = (p?.title||'').toLowerCase();
          const h = (p?.handle||'').toLowerCase();
          if (t.includes('selling plan') || h.includes('selling-plan') || t.includes('subscription')) return false;
          const vEdges = Array.isArray(p?.variants?.edges) ? p.variants.edges : [];
          // keep if any variant is available for sale
          return vEdges.some((e:any)=>e?.node?.availableForSale);
        });
        // If filtering removed everything, relax to any product with at least one variant
        if (filteredRelated.length === 0) {
          filteredRelated = relatedProducts.filter((p:any)=>Array.isArray(p?.variants?.edges) && p.variants.edges.length > 0);
        }
        // ensure unique products by id
        const uniq: any[] = [];
  const used = new Set<string>([String(currentProdNN.id)]);
        for (const rp of filteredRelated) {
          const id = String(rp.id).replace('gid://shopify/Product/','');
          if (used.has(id)) continue; used.add(id); uniq.push(rp);
          if (uniq.length >= 2) break;
        }
        let complementProducts = uniq;
        // Second-tier fallback: build complements from other active products
        if (complementProducts.length === 0 && otherProducts.length) {
          const candidates = otherProducts.filter((p:any)=>String(p.id).replace('gid://shopify/Product/','') !== String(currentProdNN.id));
          const mapped = candidates.map(getProductDetails).filter((p:any)=>p && typeof p.price === 'number' && p.price >= 0);
          complementProducts = mapped.slice(0, 2);
        }
        const bundleProducts = [ currentProd, ...complementProducts.map(getProductDetails) ].filter(p => p !== null);
        if (bundleProducts.length >= 2) {
          const regularTotal = bundleProducts.reduce((sum, p) => sum + ((p && typeof p.price === 'number') ? p.price : 0), 0);
          // Discount policy: higher if we have 2 complements
          const discountPercent = bundleProducts.length >= 3 ? 15 : 10;
          const bundlePrice = +(regularTotal * (1 - discountPercent / 100)).toFixed(2);
          bundles.push({
            id: `bundle_dynamic_${productId}`,
            name: 'Perfect Match Bundle',
            description: 'Curated to pair well with this product',
            products: bundleProducts,
            regular_total: regularTotal,
            bundle_price: bundlePrice,
            discount_percent: discountPercent,
            savings_amount: +(regularTotal - bundlePrice).toFixed(2),
            discount_code: discountPercent >= 15 ? 'BUNDLE_MATCH_15' : 'BUNDLE_MATCH_10',
            status: 'active',
            source: 'orders_based',
            debug: debugInfo
          });
        }
      }
      
      console.log(`[BUNDLES API] === REAL PRODUCTS BUNDLE SYSTEM COMPLETED ===`);
      console.log(`[BUNDLES API] Generated ${bundles.length} bundles using real products:`, bundles.map(b => ({ id: b.id, name: b.name, products: b.products?.length || 0 })));

      // Attach a small hint when empty to help diagnose in network panel
      const payload = bundles.length ? { bundles } : { bundles, reason: 'no_candidates' };
      console.log(`[BUNDLES API] Returning payload:`, payload);
      return json(payload, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=30',
          'X-Bundles-Reason': bundles.length ? 'ok' : 'no_candidates',
          'X-Bundles-Context': context,
          'X-Bundles-Shop': shopStr
        }
      });
    } catch (err: unknown) {
      console.error('[BUNDLES API] === ERROR CAUGHT ===');
      console.error('[BUNDLES API] Error:', err);
      console.error('[BUNDLES API] Error message:', err instanceof Error ? err.message : 'Unknown error');
      console.error('[BUNDLES API] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      console.error('[BUNDLES API] Error type:', typeof err);
      console.error('[BUNDLES API] Error constructor:', (err as any)?.constructor?.name);
      return json({ bundles: [], reason: 'unavailable' }, { headers: { 'Access-Control-Allow-Origin': '*', 'X-Bundles-Reason': 'unavailable' } });
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

  const settings = await getSettings(shop as string);
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
  } catch (_e) {
  console.warn('App proxy heartbeat auth failed:', _e);
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      if (!shop) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      const now = new Date().toISOString();
      await saveSettings(shop, { themeEmbedEnabled: true, themeEmbedLastSeen: now });
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
  } catch (_e) {
  console.warn('App proxy auth failed:', _e);
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
  } catch (_e) {
  console.error('Error validating discount via Admin API:', _e);
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
  } catch (_e) {
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

        if (!shop) {
          return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        // Persist best-effort; don’t fail the request if DB unavailable
        await (db as any).trackingEvent?.create?.({
          data: {
            shop,
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
