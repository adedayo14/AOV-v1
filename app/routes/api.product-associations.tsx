import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
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
                      images(first: 1) {
                        edges {
                          node {
                            url
                            altText
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
        coOccurrence: number;
        totalRevenue: number;
        avgOrderValue: number;
      }>;
      totalOrders: number;
    }> = {};

    // Analyze each order for product associations
    orders.forEach((order: any) => {
      const orderNode = order.node;
      const orderValue = parseFloat(orderNode.totalPriceSet.shopMoney.amount);
      const lineItems = orderNode.lineItems.edges;

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
                image: itemA.product.images.edges[0]?.node?.url || '',
                price: parseFloat(itemA.variant?.price || 0)
              },
              associatedWith: {},
              totalOrders: 0
            };
          }

          // Initialize tracking for product B
          if (!associations[productBId]) {
            associations[productBId] = {
              product: {
                id: productBId,
                title: itemB.product.title,
                handle: itemB.product.handle,
                image: itemB.product.images.edges[0]?.node?.url || '',
                price: parseFloat(itemB.variant?.price || 0)
              },
              associatedWith: {},
              totalOrders: 0
            };
          }

          // Track association A -> B
          if (!associations[productAId].associatedWith[productBId]) {
            associations[productAId].associatedWith[productBId] = {
              product: associations[productBId].product,
              coOccurrence: 0,
              totalRevenue: 0,
              avgOrderValue: 0
            };
          }

          // Track association B -> A
          if (!associations[productBId].associatedWith[productAId]) {
            associations[productBId].associatedWith[productAId] = {
              product: associations[productAId].product,
              coOccurrence: 0,
              totalRevenue: 0,
              avgOrderValue: 0
            };
          }

          // Update association metrics
          associations[productAId].associatedWith[productBId].coOccurrence++;
          associations[productAId].associatedWith[productBId].totalRevenue += orderValue;
          associations[productAId].associatedWith[productBId].avgOrderValue = 
            associations[productAId].associatedWith[productBId].totalRevenue / 
            associations[productAId].associatedWith[productBId].coOccurrence;

          associations[productBId].associatedWith[productAId].coOccurrence++;
          associations[productBId].associatedWith[productAId].totalRevenue += orderValue;
          associations[productBId].associatedWith[productAId].avgOrderValue = 
            associations[productBId].associatedWith[productAId].totalRevenue / 
            associations[productBId].associatedWith[productAId].coOccurrence;

          associations[productAId].totalOrders++;
          associations[productBId].totalOrders++;
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
    }> = [];
    
    for (const [productId, data] of Object.entries(associations)) {
      // Only consider products that appear in multiple orders
      if (data.totalOrders < 3) continue;

      for (const [associatedId, assocData] of Object.entries(data.associatedWith)) {
        // Calculate association strength (frequency of co-occurrence)
        const associationStrength = assocData.coOccurrence / data.totalOrders;
        
        // Only suggest bundles for strong associations (60%+ co-occurrence)
        if (associationStrength >= 0.6 && assocData.coOccurrence >= 5) {
          // Check if we already have this bundle (avoid duplicates)
          const existingBundle = bundleOpportunities.find(bundle => 
            (bundle.productA.id === productId && bundle.productB.id === associatedId) ||
            (bundle.productA.id === associatedId && bundle.productB.id === productId)
          );

          if (!existingBundle) {
            const totalBundleValue = data.product.price + assocData.product.price;
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
      }
    }

    // Sort by association strength and potential revenue
    bundleOpportunities.sort((a, b) => {
      const scoreA = a.associationStrength * a.potentialRevenue;
      const scoreB = b.associationStrength * b.potentialRevenue;
      return scoreB - scoreA;
    });

    return json({
      bundleOpportunities: bundleOpportunities.slice(0, 10), // Top 10 bundle opportunities
      totalAssociations: Object.keys(associations).length,
      analyzedOrders: orders.length
    });

  } catch (error) {
    console.error('Error analyzing product associations:', error);
    return json({ error: "Failed to analyze product associations" }, { status: 500 });
  }
};
