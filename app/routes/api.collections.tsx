import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    const response = await admin.graphql(`
      query getCollections {
        collections(first: 100) {
          edges {
            node {
              id
              title
              handle
              productsCount
            }
          }
        }
      }
    `);

    const responseJson = await response.json();
    
    if ((responseJson as any).errors) {
      console.error('GraphQL errors:', (responseJson as any).errors);
      return json({ 
        success: false, 
        error: 'Failed to fetch collections from Shopify',
        collections: []
      }, { status: 500 });
    }
    
    const collections = responseJson.data?.collections?.edges || [];
    
    return json({ 
      success: true, 
      collections: collections.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        productsCount: edge.node.productsCount
      }))
    });
  } catch (error) {
    console.error("Collections API error:", error);
    return json({ success: false, error: "Failed to load collections" }, { status: 500 });
  }
};