import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { getSettings, saveSettings } from "../models/settings.server";
import { authenticate, unauthenticated } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname;

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
