import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Check for shop parameter to bypass auth hanging
    const url = new URL(request.url);
    const shopParam = url.searchParams.get('shop');
    
    let admin: any;
    
    if (shopParam) {
      // Bypass auth and use shop parameter
      console.log('[Collections API] Using shop parameter:', shopParam);
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
    } else {
      // Regular auth
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
    }
    
    console.log('[Collections API] Fetching collections...');
    
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
      console.error('[Collections API] GraphQL errors:', (responseJson as any).errors);
      return json({ 
        success: false, 
        error: 'Failed to fetch collections from Shopify',
        collections: []
      }, { status: 500 });
    }
    
    const collections = responseJson.data?.collections?.edges || [];
    console.log('[Collections API] Found', collections.length, 'collections');
    
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
    console.error("[Collections API] error:", error);
    return json({ success: false, error: "Failed to load collections" }, { status: 500 });
  }
};