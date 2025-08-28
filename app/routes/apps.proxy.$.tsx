import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { getSettings, saveSettings } from "../models/settings.server";

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
