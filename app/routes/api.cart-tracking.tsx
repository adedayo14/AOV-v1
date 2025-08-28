import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
// Note: This endpoint is called from the storefront (unauthenticated). Do not require admin auth.

interface CartEvent {
  eventType: string;
  sessionId: string;
  shop: string;
  productId?: string;
  productTitle?: string;
  revenue?: number;
  timestamp: Date;
}

// Store cart events in a simple in-memory store for this demo
// In production, use a proper database table
const cartEvents: CartEvent[] = [];

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
  return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    
    const eventType = formData.get("eventType") as string;
    const sessionId = formData.get("sessionId") as string;
  const shopFromBody = (formData.get("shop") as string) || "";
    const productId = formData.get("productId") as string | null;
    const productTitle = formData.get("productTitle") as string | null;
    const revenue = formData.get("revenue") ? parseFloat(formData.get("revenue") as string) : null;

    const cartEvent: CartEvent = {
      eventType,
      sessionId,
  shop: shopFromBody,
      productId: productId || undefined,
      productTitle: productTitle || undefined,
      revenue: revenue || undefined,
      timestamp: new Date(),
    };

    cartEvents.push(cartEvent);
    
    console.log("Cart event tracked:", cartEvent);

    return json({ success: true, timestamp: cartEvent.timestamp.toISOString() }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Cart tracking error:", error);
    return json({ error: "Failed to track event" }, { status: 500 });
  }
};

// Support CORS preflight
export const loader = async ({ request }: ActionFunctionArgs) => {
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
  return json({ status: 'ok' });
};

// Helper function to get cart analytics data
export const getCartAnalytics = (shop: string, timeframe: string = "7d") => {
  const now = new Date();
  let startDate: Date;

  switch (timeframe) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "ytd":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const filteredEvents = cartEvents.filter(
    event => event.shop === shop && event.timestamp >= startDate
  );

  const cartImpressions = filteredEvents.filter(e => e.eventType === "cart_open").length;
  const checkoutsCompleted = filteredEvents.filter(e => e.eventType === "checkout_complete").length;
  const totalRevenue = filteredEvents
    .filter(e => e.eventType === "checkout_complete" && e.revenue)
    .reduce((sum, e) => sum + (e.revenue || 0), 0);

  const conversionRate = cartImpressions > 0 ? (checkoutsCompleted / cartImpressions) * 100 : 0;

  // Get top performing products
  const productClicks = filteredEvents.filter(e => e.eventType === "product_click" && e.productId);
  const productClickCounts = productClicks.reduce((acc, event) => {
    const key = `${event.productId}|${event.productTitle}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topProducts = Object.entries(productClickCounts)
    .map(([key, clicks]) => {
      const [productId, productTitle] = key.split('|');
      return { productId, productTitle, clicks };
    })
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5);

  return {
    cartImpressions,
    checkoutsCompleted,
    conversionRate: Math.round(conversionRate * 10) / 10,
    totalRevenue,
    topProducts,
  };
};
