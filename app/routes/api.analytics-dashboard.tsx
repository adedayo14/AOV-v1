// Phase 6: Real Analytics Dashboard - Replace mock with Shopify data
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
// import prisma from "../db.server"; // Disabled: Event model is for AB testing, need separate analytics table

interface AnalyticsPeriod {
  start: string;
  end: string;
}

interface CartMetrics {
  totalCarts: number;
  completedOrders: number;
  conversionRate: number;
  averageOrderValue: number;
  totalRevenue: number;
  cartAbandonmentRate: number;
  upliftRevenue: number;
  bundlePerformance: BundleMetrics[];
}

interface BundleMetrics {
  bundleId: string;
  bundleName: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  clickThroughRate: number;
  conversionRate: number;
  source: 'ml' | 'manual' | 'rules';
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const period = url.searchParams.get("period") || "30d";
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  
  try {
    // Calculate date range
    const dateRange = calculateDateRange(period, startDate, endDate);
    
    // Get real Shopify order data
    const shopifyMetrics = await getShopifyOrderMetrics(admin, dateRange);
    
    // Get cart uplift analytics from our database
    const cartAnalytics = await getCartAnalytics(session.shop, dateRange);
    
    // Get bundle performance data
    const bundleMetrics = await getBundleAnalytics(session.shop, dateRange);
    
    // Get real-time metrics for dashboard
    const realtimeMetrics = await getRealtimeMetrics(session.shop);
    
    // Combine all metrics
    const analytics = {
      period: dateRange,
      shopifyMetrics,
      cartMetrics: cartAnalytics,
      bundleMetrics,
      realtimeMetrics,
      trends: await calculateTrends(session.shop, dateRange),
      geographic: await getGeographicData(admin, dateRange),
      deviceBreakdown: await getDeviceBreakdown(session.shop, dateRange)
    };

    return json(analytics);

  } catch (error) {
    console.error("Analytics error:", error);
    return json({ 
      error: "Failed to load analytics",
      analytics: null 
    }, { status: 500 });
  }
};

// Get real order data from Shopify
async function getShopifyOrderMetrics(admin: any, dateRange: AnalyticsPeriod) {
  const ordersQuery = `
    query getOrderMetrics($query: String!) {
      orders(first: 250, query: $query) {
        edges {
          node {
            id
            name
            createdAt
            totalPrice
            subtotalPrice
            totalTax
            currencyCode
            fulfillmentStatus
            financialStatus
            customer {
              id
              email
            }
            shippingAddress {
              country
              province
              city
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  quantity
                  product {
                    id
                    title
                    vendor
                  }
                  variant {
                    id
                    title
                    price
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(ordersQuery, {
      variables: {
        query: `created_at:>=${dateRange.start} created_at:<=${dateRange.end}`
      }
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const orders = data.data.orders.edges.map(({ node }: any) => node);

    return {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum: number, order: any) => 
        sum + parseFloat(order.totalPrice), 0),
      averageOrderValue: orders.length > 0 ? 
        orders.reduce((sum: number, order: any) => sum + parseFloat(order.totalPrice), 0) / orders.length : 0,
      completedOrders: orders.filter((order: any) => 
        order.fulfillmentStatus === 'fulfilled' || 
        order.financialStatus === 'paid').length,
      topProducts: getTopProducts(orders),
      ordersByDay: getOrdersByDay(orders, dateRange),
      customerSegments: getCustomerSegments(orders)
    };
  } catch (error) {
    console.error("Shopify metrics error:", error);
    return {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      completedOrders: 0,
      topProducts: [],
      ordersByDay: [],
      customerSegments: []
    };
  }
}

// Get cart analytics from our database
async function getCartAnalytics(_shop: string, _dateRange: AnalyticsPeriod): Promise<CartMetrics> {
  try {
    // TODO: Event model is for AB testing (experimentId, variantId, unitId, type)
    // Need separate analytics/tracking table with shopId, timestamp, eventType, bundleId, orderValue
    // For now, return mock data until proper analytics table is created
    const analytics: any[] = [];
    
    const cartViews = analytics.filter((a: any) => a.eventType === 'cart_view');
    const purchases = analytics.filter((a: any) => a.eventType === 'purchase');
    const bundleConversions = analytics.filter((a: any) => 
      a.eventType === 'purchase' && a.bundleId);

    const totalRevenue = purchases.reduce((sum: number, p: any) => sum + (p.orderValue || 0), 0);
    const upliftRevenue = bundleConversions.reduce((sum: number, p: any) => sum + (p.orderValue || 0), 0);

    return {
      totalCarts: cartViews.length,
      completedOrders: purchases.length,
      conversionRate: cartViews.length > 0 ? (purchases.length / cartViews.length) * 100 : 0,
      averageOrderValue: purchases.length > 0 ? totalRevenue / purchases.length : 0,
      totalRevenue,
      cartAbandonmentRate: cartViews.length > 0 ? 
        ((cartViews.length - purchases.length) / cartViews.length) * 100 : 0,
      upliftRevenue,
      bundlePerformance: await getBundleMetrics(analytics)
    };
  } catch (error) {
    console.error("Cart analytics error:", error);
    return {
      totalCarts: 0,
      completedOrders: 0,
      conversionRate: 0,
      averageOrderValue: 0,
      totalRevenue: 0,
      cartAbandonmentRate: 0,
      upliftRevenue: 0,
      bundlePerformance: []
    };
  }
}

async function getBundleMetrics(analytics: any[]): Promise<BundleMetrics[]> {
  const bundleStats = new Map();

  // Group by bundle ID
  analytics.forEach(record => {
    if (!record.bundleId) return;

    if (!bundleStats.has(record.bundleId)) {
      bundleStats.set(record.bundleId, {
        bundleId: record.bundleId,
        bundleName: record.bundleName || `Bundle ${record.bundleId}`,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        source: record.bundleSource || 'ml'
      });
    }

    const stats = bundleStats.get(record.bundleId);

    switch (record.eventType) {
      case 'bundle_impression':
        stats.impressions++;
        break;
      case 'bundle_click':
        stats.clicks++;
        break;
      case 'purchase':
        if (record.bundleId) {
          stats.conversions++;
          stats.revenue += record.orderValue || 0;
        }
        break;
    }
  });

  // Calculate rates
  return Array.from(bundleStats.values()).map(stats => ({
    ...stats,
    clickThroughRate: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
    conversionRate: stats.clicks > 0 ? (stats.conversions / stats.clicks) * 100 : 0
  }));
}

async function getBundleAnalytics(_shop: string, _dateRange: AnalyticsPeriod) {
  try {
    // Get bundle performance data
    // Use empty array temporarily until ABEvent is properly set up
    const bundleAnalytics: any[] = [];

    return getBundleMetrics(bundleAnalytics);
  } catch (error) {
    console.error("Bundle analytics error:", error);
    return [];
  }
}

async function getRealtimeMetrics(_shop: string) {
  try {
    // Use empty array temporarily until ABEvent is properly set up
    const recentAnalytics: any[] = [];

    return {
      activeUsers: new Set(recentAnalytics.map((a: any) => a.sessionId)).size,
      recentPurchases: recentAnalytics.filter((a: any) => a.eventType === 'purchase').length,
      liveRevenue: recentAnalytics
        .filter((a: any) => a.eventType === 'purchase')
        .reduce((sum: number, a: any) => sum + (a.orderValue || 0), 0)
    };
  } catch (error) {
    console.error("Realtime metrics error:", error);
    return { activeUsers: 0, recentPurchases: 0, liveRevenue: 0 };
  }
}

async function calculateTrends(shop: string, dateRange: AnalyticsPeriod) {
  // Calculate trends by comparing current period with previous period
  const periodDuration = new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime();
  const previousPeriodStart = new Date(new Date(dateRange.start).getTime() - periodDuration);
  const previousPeriodEnd = new Date(dateRange.start);

  try {
    const [currentPeriod, previousPeriod] = await Promise.all([
      getCartAnalytics(shop, dateRange),
      getCartAnalytics(shop, { 
        start: previousPeriodStart.toISOString(), 
        end: previousPeriodEnd.toISOString() 
      })
    ]);

    return {
      revenueChange: calculatePercentageChange(currentPeriod.totalRevenue, previousPeriod.totalRevenue),
      conversionChange: calculatePercentageChange(currentPeriod.conversionRate, previousPeriod.conversionRate),
      aovChange: calculatePercentageChange(currentPeriod.averageOrderValue, previousPeriod.averageOrderValue),
      orderChange: calculatePercentageChange(currentPeriod.completedOrders, previousPeriod.completedOrders)
    };
  } catch (error) {
    console.error("Trends calculation error:", error);
    return { revenueChange: 0, conversionChange: 0, aovChange: 0, orderChange: 0 };
  }
}

async function getGeographicData(_admin: any, _dateRange: AnalyticsPeriod) {
  // This would use Shopify's Analytics API if available
  // For now, return placeholder data
  return [
    { country: 'US', orders: 0, revenue: 0 },
    { country: 'CA', orders: 0, revenue: 0 },
    { country: 'GB', orders: 0, revenue: 0 }
  ];
}

async function getDeviceBreakdown(_shop: string, _dateRange: AnalyticsPeriod) {
  try {
    // Use Settings table temporarily until ABEvent is properly set up
    // This would be replaced with actual analytics data when the schema is updated
    const analytics: any[] = [];    // Group by device type if you track this data
    const deviceStats = analytics.reduce((acc: Record<string, number>, record: any) => {
      const device = record.deviceType || 'Unknown';
      if (!acc[device]) acc[device] = 0;
      acc[device]++;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(deviceStats).map(([device, count]) => ({ device, count }));
  } catch (error) {
    console.error("Device breakdown error:", error);
    return [];
  }
}

// Helper functions
function calculateDateRange(period: string, startDate?: string | null, endDate?: string | null): AnalyticsPeriod {
  const now = new Date();
  
  if (startDate && endDate) {
    return { start: startDate, end: endDate };
  }
  
  switch (period) {
    case '7d':
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString()
      };
    case '30d':
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString()
      };
    case '90d':
      return {
        start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString()
      };
    default:
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString()
      };
  }
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function getTopProducts(orders: any[]) {
  const productStats = new Map();
  
  orders.forEach(order => {
    order.lineItems.edges.forEach(({ node }: any) => {
      const productId = node.product.id;
      if (!productStats.has(productId)) {
        productStats.set(productId, {
          id: productId,
          title: node.product.title,
          vendor: node.product.vendor,
          quantity: 0,
          revenue: 0
        });
      }
      
      const stats = productStats.get(productId);
      stats.quantity += node.quantity;
      stats.revenue += parseFloat(node.variant.price) * node.quantity;
    });
  });
  
  return Array.from(productStats.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function getOrdersByDay(orders: any[], _dateRange: AnalyticsPeriod) {
  const dayStats = new Map();
  
  orders.forEach(order => {
    const date = new Date(order.createdAt).toISOString().split('T')[0];
    if (!dayStats.has(date)) {
      dayStats.set(date, { date, orders: 0, revenue: 0 });
    }
    
    const stats = dayStats.get(date);
    stats.orders++;
    stats.revenue += parseFloat(order.totalPrice);
  });
  
  return Array.from(dayStats.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function getCustomerSegments(orders: any[]) {
  const customerStats = new Map();
  
  orders.forEach(order => {
    if (order.customer?.id) {
      const customerId = order.customer.id;
      if (!customerStats.has(customerId)) {
        customerStats.set(customerId, {
          id: customerId,
          email: order.customer.email,
          orders: 0,
          revenue: 0
        });
      }
      
      const stats = customerStats.get(customerId);
      stats.orders++;
      stats.revenue += parseFloat(order.totalPrice);
    }
  });
  
  const customers = Array.from(customerStats.values());
  
  return {
    newCustomers: customers.filter(c => c.orders === 1).length,
    returningCustomers: customers.filter(c => c.orders > 1).length,
    vipCustomers: customers.filter(c => c.revenue > 500).length,
    totalCustomers: customers.length
  };
}