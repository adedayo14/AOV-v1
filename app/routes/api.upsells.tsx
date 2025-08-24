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

  // In a real implementation, you would:
  // 1. Query your database for shop settings
  // 2. Determine upsell strategy (related products, bestsellers, AI recommendations, etc.)
  // 3. Fetch relevant products from Shopify
  // 4. Apply business logic for recommendations

  // For demo purposes, let's fetch some products from the shop
  try {
    const response = await admin.graphql(`
      #graphql
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
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
              variants(first: 1) {
                edges {
                  node {
                    id
                    price
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: {
        first: 4
      }
    });

    const responseJson = await response.json();
    const products = responseJson.data?.products?.edges || [];

    // Transform the products into the format expected by the frontend
    const upsells = products.map((product: any) => {
      const productNode = product.node;
      const firstImage = productNode.images.edges[0]?.node;
      const firstVariant = productNode.variants.edges[0]?.node;
      
      return {
        id: productNode.id.replace('gid://shopify/Product/', ''),
        title: productNode.title,
        price: firstVariant ? parseFloat(firstVariant.price) * 100 : 0, // Convert to cents
        image: firstImage?.url || 'https://via.placeholder.com/150',
        variant_id: firstVariant?.id.replace('gid://shopify/ProductVariant/', '') || '',
        handle: productNode.handle
      };
    });

    return json(upsells);
  } catch (error) {
    console.error('Error fetching products for upsells:', error);
    return json({ error: "Failed to fetch upsells" }, { status: 500 });
  }
};
