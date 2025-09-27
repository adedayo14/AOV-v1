import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  // Optional mode to switch scoring strategy without breaking callers
  // "basic" keeps the old behavior; "advanced" uses time-decayed lift/confidence.
  const mode = (url.searchParams.get("mode") || "advanced").toLowerCase();
  const includeDebug = url.searchParams.get("debug") === "1";
  
  if (!shop) {
    return json({ error: "Shop parameter is required" }, { status: 400 });
  }

  try {
    // Fetch recent orders to analyze product associations
    const response = await admin.graphql(`
      #graphql
      query getOrderAssociations($first: Int!) {
        orders(first: $first, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              createdAt
              totalPriceSet {
                shopMoney {
                  amount
                }
              }
              lineItems(first: 20) {
                edges {
                  node {
                    quantity
                    product {
                      id
                      title
                      handle
                      media(first: 1) {
                        edges {
                          node {
                            ... on MediaImage {
                              image {
                                url
                                altText
                              }
                            }
                          }
                        }
                      }
                    }
                    variant {
                      id
                      price
                    }
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: {
        first: 500 // Analyze more orders for better associations
      }
    });

    const responseData = await response.json();
    const orders = responseData.data?.orders?.edges || [];

    // Build product association matrix
    const associations: Record<string, {
      product: any;
      associatedWith: Record<string, {
        product: any;
        coOccurrence: number; // raw count
        weightedCoOccurrence: number; // time-decayed
        totalRevenue: number; // raw revenue sum
        weightedRevenue: number; // time-decayed revenue
        avgOrderValue: number; // raw AOV when paired
      }>;
      totalOrders: number; // raw orders containing the product (paired context)
      appearances: number; // raw appearances of the product across orders
      weightedAppearances: number; // time-decayed appearances
    }> = {};

    // Global counters
    const productAppearances: Record<string, number> = {};
    const productWeightedAppearances: Record<string, number> = {};

    // Time-decay settings: half-life in days
    const HALF_LIFE_DAYS = 90;
    const LN2_OVER_HL = Math.log(2) / HALF_LIFE_DAYS;

    // Analyze each order for product associations
    orders.forEach((order: any) => {
      const orderNode = order.node;
      const orderValue = parseFloat(orderNode.totalPriceSet.shopMoney.amount);
      const lineItems = orderNode.lineItems.edges;
      const createdAt = new Date(orderNode.createdAt);
      const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const decayWeight = Math.exp(-LN2_OVER_HL * ageDays);

      // Skip single-item orders for association analysis
      if (lineItems.length < 2) return;

      // Analyze all product pairs in this order
      for (let i = 0; i < lineItems.length; i++) {
        for (let j = i + 1; j < lineItems.length; j++) {
          const itemA = lineItems[i].node;
          const itemB = lineItems[j].node;
          
          if (!itemA.product || !itemB.product) continue;

          const productAId = itemA.product.id.replace('gid://shopify/Product/', '');
          const productBId = itemB.product.id.replace('gid://shopify/Product/', '');

          // Initialize tracking for product A
          if (!associations[productAId]) {
            associations[productAId] = {
              product: {
                id: productAId,
                title: itemA.product.title,
                handle: itemA.product.handle,
                image: itemA.product.media.edges[0]?.node?.image?.url || '',
                price: parseFloat(itemA.variant?.price || 0)
              },
              associatedWith: {},
              totalOrders: 0,
              appearances: 0,
              weightedAppearances: 0,
            };
          }

          // Initialize tracking for product B
          if (!associations[productBId]) {
            associations[productBId] = {
              product: {
                id: productBId,
                title: itemB.product.title,
                handle: itemB.product.handle,
                image: itemB.product.media.edges[0]?.node?.image?.url || '',
                price: parseFloat(itemB.variant?.price || 0)
              },
              associatedWith: {},
              totalOrders: 0,
              appearances: 0,
              weightedAppearances: 0,
            };
          }

          // Track association A -> B
          if (!associations[productAId].associatedWith[productBId]) {
            associations[productAId].associatedWith[productBId] = {
              product: associations[productBId].product,
              coOccurrence: 0,
              weightedCoOccurrence: 0,
              totalRevenue: 0,
              weightedRevenue: 0,
              avgOrderValue: 0
            };
          }

          // Track association B -> A
          if (!associations[productBId].associatedWith[productAId]) {
            associations[productBId].associatedWith[productAId] = {
              product: associations[productAId].product,
              coOccurrence: 0,
              weightedCoOccurrence: 0,
              totalRevenue: 0,
              weightedRevenue: 0,
              avgOrderValue: 0
            };
          }

          // Update association metrics
          associations[productAId].associatedWith[productBId].coOccurrence++;
          associations[productAId].associatedWith[productBId].weightedCoOccurrence += decayWeight;
          associations[productAId].associatedWith[productBId].totalRevenue += orderValue;
          associations[productAId].associatedWith[productBId].weightedRevenue += orderValue * decayWeight;
          associations[productAId].associatedWith[productBId].avgOrderValue = 
            associations[productAId].associatedWith[productBId].totalRevenue / 
            associations[productAId].associatedWith[productBId].coOccurrence;

          associations[productBId].associatedWith[productAId].coOccurrence++;
          associations[productBId].associatedWith[productAId].weightedCoOccurrence += decayWeight;
          associations[productBId].associatedWith[productAId].totalRevenue += orderValue;
          associations[productBId].associatedWith[productAId].weightedRevenue += orderValue * decayWeight;
          associations[productBId].associatedWith[productAId].avgOrderValue = 
            associations[productBId].associatedWith[productAId].totalRevenue / 
            associations[productBId].associatedWith[productAId].coOccurrence;

          associations[productAId].totalOrders++;
          associations[productBId].totalOrders++;

          // Track appearances per order (count each item once per order for A and B)
          associations[productAId].appearances++;
          associations[productBId].appearances++;
          associations[productAId].weightedAppearances += decayWeight;
          associations[productBId].weightedAppearances += decayWeight;
          productAppearances[productAId] = (productAppearances[productAId] || 0) + 1;
          productAppearances[productBId] = (productAppearances[productBId] || 0) + 1;
          productWeightedAppearances[productAId] = (productWeightedAppearances[productAId] || 0) + decayWeight;
          productWeightedAppearances[productBId] = (productWeightedAppearances[productBId] || 0) + decayWeight;
        }
      }
    });

    // Find the best bundle opportunities
    const bundleOpportunities: Array<{
      productA: any;
      productB: any;
      coOccurrence: number;
      associationStrength: number;
      totalBundleValue: number;
      suggestedDiscount: number;
      potentialRevenue: number;
      avgOrderValue: number;
      // Optional advanced metrics when debug=1
      weightedCoOccurrence?: number;
      supportPct?: number;
      confidencePct?: number;
      lift?: number;
    }> = [];
    
    // Total unique products considered
    for (const [productId, data] of Object.entries(associations)) {
      // Only consider products that appear in multiple orders
      if (data.totalOrders < 3) continue;

      for (const [associatedId, assocData] of Object.entries(data.associatedWith)) {
        // BASIC MODE: original behavior using raw frequency
        if (mode === 'basic') {
          const associationStrength = assocData.coOccurrence / data.totalOrders;
          if (associationStrength >= 0.6 && assocData.coOccurrence >= 5) {
            // Check if we already have this bundle (avoid duplicates)
            const existingBundle = bundleOpportunities.find(bundle => 
              (bundle.productA.id === productId && bundle.productB.id === associatedId) ||
              (bundle.productA.id === associatedId && bundle.productB.id === productId)
            );

            if (!existingBundle) {
              const totalBundleValue = data.product.price + (associations[associatedId]?.product.price || 0);
              const suggestedDiscount = Math.min(Math.floor(associationStrength * 20), 15); // Max 15% discount

              bundleOpportunities.push({
                productA: data.product,
                productB: assocData.product,
                coOccurrence: assocData.coOccurrence,
                associationStrength: Math.round(associationStrength * 100),
                totalBundleValue,
                suggestedDiscount,
                potentialRevenue: assocData.totalRevenue,
                avgOrderValue: assocData.avgOrderValue
              });
            }
          }
          continue;
        }

        // ADVANCED MODE: use time-decayed confidence and lift
        const weightedA = data.weightedAppearances || productWeightedAppearances[productId] || 1;
        const weightedB = associations[associatedId]?.weightedAppearances || productWeightedAppearances[associatedId] || 1;

        const weightedCo = assocData.weightedCoOccurrence || 0;
        const support = weightedCo / Math.max(1, Object.values(productWeightedAppearances).reduce((a, b) => a + b, 0));
        const confidence = weightedCo / Math.max(1e-6, weightedA);
        const probB = weightedB / Math.max(1e-6, Object.values(productWeightedAppearances).reduce((a, b) => a + b, 0));
        const lift = probB > 0 ? confidence / probB : 0;

        // Thresholds tuned for decayed stats
        const passes = (confidence >= 0.3 && weightedCo >= 3) || (lift >= 1.2 && weightedCo >= 2.5);
        if (!passes) continue;

          // Check if we already have this bundle (avoid duplicates)
          const existingBundle = bundleOpportunities.find(bundle => 
            (bundle.productA.id === productId && bundle.productB.id === associatedId) ||
            (bundle.productA.id === associatedId && bundle.productB.id === productId)
          );

          if (!existingBundle) {
            const totalBundleValue = data.product.price + (associations[associatedId]?.product.price || 0);
            // Scale suggested discount by confidence, cap at 15%
            const suggestedDiscount = Math.min(Math.floor(Math.min(1, confidence) * 20), 15);

            bundleOpportunities.push({
              productA: data.product,
              productB: assocData.product,
              coOccurrence: assocData.coOccurrence,
              associationStrength: Math.round(Math.min(1, confidence) * 100),
              totalBundleValue,
              suggestedDiscount,
              potentialRevenue: assocData.weightedRevenue || assocData.totalRevenue,
              avgOrderValue: assocData.avgOrderValue,
              ...(includeDebug ? { weightedCoOccurrence: Number(weightedCo.toFixed(2)), supportPct: Number((support * 100).toFixed(2)), confidencePct: Number((confidence * 100).toFixed(2)), lift: Number(lift.toFixed(2)) } : {})
            });
          }
        }
      }

    // Sort by score: prefer higher lift/confidence and revenue (advanced), fall back to old score (basic)
    bundleOpportunities.sort((a, b) => {
      if (mode === 'advanced') {
        const liftA = (a as any).lift ?? a.associationStrength / 100;
        const liftB = (b as any).lift ?? b.associationStrength / 100;
        const scoreA = liftA * (a.potentialRevenue || 0) * (1 + a.associationStrength / 100);
        const scoreB = liftB * (b.potentialRevenue || 0) * (1 + b.associationStrength / 100);
        return scoreB - scoreA;
      }
      const scoreA = a.associationStrength * (a.potentialRevenue || 0);
      const scoreB = b.associationStrength * (b.potentialRevenue || 0);
      return scoreB - scoreA;
    });

    return json({
      bundleOpportunities: bundleOpportunities.slice(0, 10), // Top 10 bundle opportunities
      totalAssociations: Object.keys(associations).length,
      analyzedOrders: orders.length,
      mode
    });

  } catch (error) {
    console.error('Error analyzing product associations:', error);
    return json({ error: "Failed to analyze product associations" }, { status: 500 });
  }
};
