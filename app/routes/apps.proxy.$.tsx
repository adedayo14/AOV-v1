import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { getSettings, saveSettings } from "../models/settings.server";
import { authenticate, unauthenticated } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle /apps/proxy/api/settings
  if (path.includes('/api/settings')) {
    try {
      const shop = url.searchParams.get('shop')
        || request.headers.get('X-Shopify-Shop-Domain')
        || request.headers.get('x-shopify-shop-domain')
        || 'unknown-shop.myshopify.com';

      const settings = await getSettings(shop);
      // Normalize layout to theme values
      const layoutMap: Record<string, string> = { horizontal: 'row', vertical: 'column', grid: 'row' };
      const normalized = {
        ...settings,
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
      return json({ error: "Failed to load settings" }, { status: 500 });
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
    // Validate discount codes from the storefront (cart modal)
    if (path.includes('/api/discount')) {
      // Verify the app proxy signature and get the shop
      let shopDomain: string | undefined;
      try {
        const { session } = await authenticate.public.appProxy(request);
        shopDomain = session?.shop;
      } catch (e) {
        console.warn('App proxy auth failed (continuing with best-effort validation):', e);
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

      // Try to look up this discount in Admin to retrieve a human summary and infer value
      let summary = `Discount code ${discountCode} will be applied at checkout`;
      let status = 'ACCEPTED';
      // Kind/value for client-side estimate
      let kind: 'percent' | 'amount' | 'unknown' = 'unknown';
      let percent: number | undefined;
      let amountCents: number | undefined;

      try {
        if (shopDomain) {
          const { admin } = await unauthenticated.admin(shopDomain);
          const discountQuery = `#graphql
            query getDiscountByCode($query: String!) {
              discountCodes(first: 1, query: $query) {
                edges { node { 
                  code
                  status
                  summary
                } }
              }
            }
          `;
          const resp = await admin.graphql(discountQuery, { variables: { query: `code:${discountCode}` } });
          const data = await resp.json();
          const node = data?.data?.discountCodes?.edges?.[0]?.node;
          if (node) {
            summary = node.summary || summary;
            status = node.status || status;
          }
        }
      } catch (e) {
        console.warn('Admin lookup for discount failed, using default summary:', e);
      }

      // Heuristic parse from summary for a quick estimate
      // Examples: "Save 10%", "Get 15% off", "$5 off", "Save £10"
      try {
        const text = String(summary);
        const percentMatch = text.match(/(\d+[.,]?\d*)\s*%/);
        const amountMatch = text.match(/([$£€])\s*(\d+[.,]?\d*)/);
        if (percentMatch) {
          kind = 'percent';
          percent = parseFloat(percentMatch[1].replace(',', '.'));
        } else if (amountMatch) {
          kind = 'amount';
          const major = parseFloat(amountMatch[2].replace(',', '.'));
          amountCents = Math.round(major * 100);
        }
      } catch {}

      return json({
        success: true,
        discount: {
          code: discountCode,
          summary,
          status,
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
    }

    if (path.includes('/api/cart-tracking')) {
      // Accept storefront tracking posts (form-urlencoded)
      const formData = await request.formData();
      const eventType = String(formData.get('eventType') || '');
      const sessionId = String(formData.get('sessionId') || '');
      const shop = String(formData.get('shop') || '');
      const productId = String(formData.get('productId') || '');
      const productTitle = String(formData.get('productTitle') || '');
      const revenue = formData.get('revenue') ? Number(formData.get('revenue')) : undefined;

      console.log('Proxy cart event:', { eventType, sessionId, shop, productId, productTitle, revenue });

      return json({ success: true }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (path.includes('/api/settings')) {
      // Optional: allow saving via proxy (not used by storefront)
      const contentType = request.headers.get('content-type') || '';
      const url = new URL(request.url);
      const shop = url.searchParams.get('shop') || '';
      const payload = contentType.includes('application/json')
        ? await request.json()
        : Object.fromEntries(await request.formData());
      const saved = await saveSettings(shop, payload as any);
      return json({ success: true, settings: saved });
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Proxy action error:", error);
    return json({ error: "Failed to process request" }, { status: 500 });
  }
}
