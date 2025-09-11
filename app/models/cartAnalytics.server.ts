import db from "~/db.server";

export interface CartEvent {
  id?: string;
  shop: string;
  sessionId: string;
  eventType: "cart_open" | "cart_close" | "product_view" | "product_click" | "checkout_start" | "checkout_complete";
  productId?: string;
  productTitle?: string;
  revenue?: number;
  timestamp: Date;
}

export interface CartAnalytics {
  cartImpressions: number;
  cartOpens: number;
  checkoutsCompleted: number;
  cartToCheckoutRate: number;
  revenueFromCart: number;
  topProductViews: Array<{
    productId: string;
    productTitle: string;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}

export async function trackCartEvent(event: CartEvent) {
  try {
    // Prefer a dedicated analytics table if present; otherwise, no-op
    // This avoids violating the required fields on the Session model
    // Schema optionality varies between dev/prod, so we guard with try/catch
    await (db as any).cartEvent.create({
      data: {
        shop: event.shop,
        sessionId: event.sessionId,
        eventType: event.eventType,
        productId: event.productId ?? null,
        productTitle: event.productTitle ?? null,
        revenue: event.revenue ?? null,
        timestamp: event.timestamp,
      },
    }).catch(() => {
      // Silently skip if table doesn't exist; analytics are best-effort
      return null;
    });
  } catch (error) {
    console.error("Failed to track cart event:", error);
  }
}

export async function getCartAnalytics(shop: string, startDate: Date, endDate: Date): Promise<CartAnalytics> {
  try {
    // Get all cart events for the time period
    // Prefer reading from dedicated cartEvent table; fall back to zeros
    const rows: Array<any> = await (db as any).cartEvent.findMany?.({
      where: { shop },
    }).catch(() => []) ?? [];

    // Parse and filter events by date
    const events: CartEvent[] = rows
      .map((row: any) => {
        try {
          const timestamp = new Date(row.timestamp);
          if (timestamp >= startDate && timestamp <= endDate) {
            return {
              sessionId: row.sessionId,
              shop: row.shop,
              eventType: row.eventType,
              productId: row.productId ?? undefined,
              productTitle: row.productTitle ?? undefined,
              revenue: typeof row.revenue === 'number' ? row.revenue : undefined,
              timestamp,
            } as CartEvent;
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as CartEvent[];

    // Calculate analytics from events
    const cartOpens = events.filter(e => e.eventType === "cart_open").length;
    const cartImpressions = cartOpens; // For now, assume 1:1 ratio
    const checkoutsCompleted = events.filter(e => e.eventType === "checkout_complete").length;
    const cartToCheckoutRate = cartOpens > 0 ? (checkoutsCompleted / cartOpens) * 100 : 0;
    
    const revenueFromCart = events
      .filter(e => e.eventType === "checkout_complete" && e.revenue)
      .reduce((sum, e) => sum + (e.revenue || 0), 0);

    // Calculate product performance
    const productStats = new Map<string, {
      productId: string;
      productTitle: string;
      impressions: number;
      clicks: number;
      conversions: number;
      revenue: number;
    }>();
    events.forEach((event: CartEvent) => {
      if (event.productId && event.productTitle) {
        const key = event.productId;
        const existing = productStats.get(key) || {
          productId: event.productId,
          productTitle: event.productTitle,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
        };

        if (event.eventType === "product_view") existing.impressions++;
        if (event.eventType === "product_click") existing.clicks++;
        if (event.eventType === "checkout_complete" && event.revenue) {
          existing.conversions++;
          existing.revenue += event.revenue;
        }

        productStats.set(key, existing);
      }
    });

    const topProductViews = Array.from(productStats.values())
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    return {
      cartImpressions,
      cartOpens,
      checkoutsCompleted,
      cartToCheckoutRate,
      revenueFromCart,
      topProductViews,
    };
  } catch (error) {
    console.error("Failed to get cart analytics:", error);
    return {
      cartImpressions: 0,
      cartOpens: 0,
      checkoutsCompleted: 0,
      cartToCheckoutRate: 0,
      revenueFromCart: 0,
      topProductViews: [],
    };
  }
}
