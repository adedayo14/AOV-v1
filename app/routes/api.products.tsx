import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const response = await admin.graphql(`
      query getProducts($first: Int!, $query: String) {
        products(first: $first, query: $query) {
          edges {
            node {
              id
              title
              handle
              status
              featuredImage { url altText }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    availableForSale
                  }
                }
              }
            }
          }
          pageInfo { hasNextPage hasPreviousPage }
        }
      }
    `, {
      variables: {
        first: limit,
        query: query ? "title:*" + query + "* OR vendor:*" + query + "* OR tag:*" + query + "*" : '',
      },
    });

    const data = await response.json();

    if (!data || !(data as any).data) {
      console.error('Invalid GraphQL response:', data);
      return json({ products: [], error: 'Failed to fetch products' });
    }

    // Transform the data to a simpler format
    const products = (data as any).data.products.edges.map((edge: any) => {
      const product = edge.node;
      const variants = (product.variants?.edges || []).map((variantEdge: any) => ({
        id: variantEdge.node.id,
        title: variantEdge.node.title,
        price: variantEdge.node.price,
        availableForSale: variantEdge.node.availableForSale,
      }));
      const minVariant = variants.find((v: any) => v.price != null) || variants[0];
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        image: product.featuredImage?.url || null,
        imageAlt: product.featuredImage?.altText || product.title,
        minPrice: minVariant?.price ?? null,
        variants,
      };
    });

  return json({ products, hasNextPage: (data as any).data.products.pageInfo.hasNextPage });

  } catch (error) {
    console.error('Error fetching products:', error);
    return json({ products: [], error: 'Failed to fetch products' });
  }
}
