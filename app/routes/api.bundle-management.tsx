import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "bundles") {
      // Get all bundles for the shop
  const bundles = await (prisma as any).bundle.findMany({
        where: { shop: session.shop },
        include: {
          bundles: {
            include: {
              // We don't have product relation, so we'll fetch product data separately
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return json({ success: true, bundles });
    }

    if (action === "categories") {
      // Get shop categories via GraphQL
      const { admin } = await authenticate.admin(request);
      const response = await admin.graphql(`
        #graphql
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
      const collections = responseJson.data?.collections?.edges || [];
      
      return json({ 
        success: true, 
        categories: collections.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          productsCount: edge.node.productsCount
        }))
      });
    }

    if (action === "products") {
      const categoryId = url.searchParams.get("categoryId");
      const query = url.searchParams.get("query") || "";
      const { admin } = await authenticate.admin(request);

      let graphqlQuery = `
        #graphql
        query getProducts($query: String!) {
          products(first: 100, query: $query) {
            edges {
              node {
                id
                title
                handle
                status
                totalInventory
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                      inventoryQuantity
                    }
                  }
                }
                featuredImage {
                  url
                  altText
                }
              }
            }
          }
        }
      `;

      if (categoryId) {
        graphqlQuery = `
          #graphql
          query getProductsByCollection($id: ID!, $query: String!) {
            collection(id: $id) {
              products(first: 100, query: $query) {
                edges {
                  node {
                    id
                    title
                    handle
                    status
                    totalInventory
                    variants(first: 10) {
                      edges {
                        node {
                          id
                          title
                          price
                          inventoryQuantity
                        }
                      }
                    }
                    featuredImage {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
        `;
      }

      const variables = categoryId 
        ? { id: categoryId, query } 
        : { query };

      const response = await admin.graphql(graphqlQuery, { variables });
      const responseJson = await response.json();

      let products = [];
      if (categoryId) {
        products = responseJson.data?.collection?.products?.edges || [];
      } else {
        products = responseJson.data?.products?.edges || [];
      }

      return json({
        success: true,
        products: products.map((edge: any) => ({
          id: edge.node.id,
          title: edge.node.title,
          handle: edge.node.handle,
          status: edge.node.status,
          totalInventory: edge.node.totalInventory,
          variants: edge.node.variants.edges.map((v: any) => ({
            id: v.node.id,
            title: v.node.title,
            price: parseFloat(v.node.price),
            inventoryQuantity: v.node.inventoryQuantity
          })),
          image: edge.node.featuredImage?.url
        }))
      });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bundle management loader error:", error);
    return json({ success: false, error: "Failed to load data" }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get('action');

  try {
    if (actionType === 'create-bundle') {
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;
      const type = formData.get('type') as string;
      const discountType = formData.get('discountType') as string;
      const discountValue = parseFloat(formData.get('discountValue') as string);
      const categoryIds = formData.get('categoryIds') as string;
      const productIds = formData.get('productIds') as string;
      const minProducts = parseInt(formData.get('minProducts') as string) || 2;
      const maxProducts = formData.get('maxProducts') ? parseInt(formData.get('maxProducts') as string) : null;
      const aiAutoApprove = formData.get('aiAutoApprove') === 'true';
      const aiDiscountMax = formData.get('aiDiscountMax') ? parseFloat(formData.get('aiDiscountMax') as string) : null;
      const displayTitle = formData.get('displayTitle') as string;

      if (!name || !type || discountValue < 0) {
        return json({ success: false, error: "Invalid bundle data" }, { status: 400 });
      }

      // Create the bundle
  const bundle = await (prisma as any).bundle.create({
        data: {
          shop: session.shop,
          name,
          description,
          type,
          discountType,
          discountValue,
          categoryIds,
          productIds,
          minProducts,
          maxProducts,
          aiAutoApprove,
          aiDiscountMax,
          displayTitle,
          status: 'draft'
        }
      });

      // Add products to bundle if provided
      if (productIds) {
        try {
          const productIdArray = JSON.parse(productIds);
          if (Array.isArray(productIdArray) && productIdArray.length > 0) {
            const bundleProducts = productIdArray.map((productId: string, index: number) => ({
              bundleId: bundle.id,
              productId,
              position: index,
              required: index === 0 // First product is required by default
            }));

            await (prisma as any).bundleProduct.createMany({
              data: bundleProducts
            });
          }
        } catch (e) {
          console.warn("Failed to parse product IDs:", e);
        }
      }

      return json({ success: true, bundle });
    }

    if (actionType === 'update-bundle') {
      const bundleId = formData.get('bundleId') as string;
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;
      const status = formData.get('status') as string;
      const discountValue = parseFloat(formData.get('discountValue') as string);

  const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop: session.shop },
        data: {
          name,
          description,
          status,
          discountValue
        }
      });

      return json({ success: true, bundle });
    }

    if (actionType === 'delete-bundle') {
      const bundleId = formData.get('bundleId') as string;

  await (prisma as any).bundle.delete({
        where: { id: bundleId, shop: session.shop }
      });

      return json({ success: true, message: "Bundle deleted successfully" });
    }

    if (actionType === 'toggle-status') {
      const bundleId = formData.get('bundleId') as string;
      const status = formData.get('status') as string;

  const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop: session.shop },
        data: { status }
      });

      return json({ success: true, bundle });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bundle management action error:", error);
    return json({ success: false, error: "Failed to perform action" }, { status: 500 });
  }
};