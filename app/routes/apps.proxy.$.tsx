import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { getSettings, saveSettings } from "../models/settings.server";
import { authenticate, unauthenticated } from "../shopify.server";

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
      const ordersData = await ordersResp.json();
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
      const invData = await invResp.json();
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
      for (const [bid, meta] of Object.entries(candidate).sort((a,b)=>b[1].score - a[1].score)) {
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

      return json({ recommendations: results }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60',
        },
      });
    } catch (error) {
      console.error('Recs API error:', error);
      return json({ recommendations: [], error: 'unavailable' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
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
      try {
        await authenticate.public.appProxy(request);
      } catch (e) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      // Accept storefront tracking posts (form-urlencoded) - best-effort
      return json({ success: true }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
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
