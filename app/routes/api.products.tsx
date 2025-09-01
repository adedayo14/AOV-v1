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
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    availableForSale
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `, {
      variables: {
        first: limit,
        query: query ? `title:*${query}* OR vendor:*${query}* OR tag:*${query}*` : '',
      },
    });

    const data = await response.json();

    if (!data || !data.data) {
      console.error('Invalid GraphQL response:', data);
      return json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // Transform the data to a simpler format
    const products = data.data.products.edges.map((edge: any) => {
      const product = edge.node;
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        image: product.featuredImage?.url || null,
        imageAlt: product.featuredImage?.altText || product.title,
        minPrice: product.priceRangeV2.minVariantPrice.amount,
        maxPrice: product.priceRangeV2.maxVariantPrice.amount,
        currency: product.priceRangeV2.minVariantPrice.currencyCode,
        variants: product.variants.edges.map((variantEdge: any) => ({
          id: variantEdge.node.id,
          title: variantEdge.node.title,
          price: variantEdge.node.price.amount,
          availableForSale: variantEdge.node.availableForSale,
        })),
      };
    });

    return json({
      products,
      hasNextPage: data.data.products.pageInfo.hasNextPage,
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
