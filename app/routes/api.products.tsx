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
        priceRangeV2 { minVariantPrice { amount currencyCode } }
              metafields(first: 10) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
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
        price: typeof variantEdge.node.price === 'number' ? variantEdge.node.price : parseFloat(variantEdge.node.price ?? '0') || 0,
        availableForSale: variantEdge.node.availableForSale,
      }));
      
      // Transform metafields to a more usable format
      const metafields: any = {};
      (product.metafields?.edges || []).forEach((metafield: any) => {
        const { namespace, key, value } = metafield.node;
        if (!metafields[namespace]) metafields[namespace] = {};
        try {
          metafields[namespace][key] = JSON.parse(value);
        } catch {
          metafields[namespace][key] = value;
        }
      });
      
      const minVariant = variants.find((v: any) => typeof v.price === 'number') || variants[0];
      const minPriceAmount = product.priceRangeV2?.minVariantPrice?.amount;
      const currencyCode = product.priceRangeV2?.minVariantPrice?.currencyCode || 'USD';
      const minPrice = typeof minPriceAmount === 'number' ? minPriceAmount : parseFloat(minPriceAmount ?? '0') || (minVariant?.price ?? 0);
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        image: product.featuredImage?.url || null,
        imageAlt: product.featuredImage?.altText || product.title,
        minPrice,
        currency: currencyCode,
        // Back-compat for UIs expecting `price`
        price: minPrice,
        variants,
        metafields,
      };
    });

  return json({ products, hasNextPage: (data as any).data.products.pageInfo.hasNextPage });

  } catch (error) {
    console.error('Error fetching products:', error);
    return json({ products: [], error: 'Failed to fetch products' });
  }
}
