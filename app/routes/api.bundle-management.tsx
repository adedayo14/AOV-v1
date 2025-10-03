import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('🔥 Bundle Management API: Request received');
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  
  console.log('🔥 Bundle Management API called:', { action, shop: session.shop });

  try {
    if (action === "bundles") {
      // Get all bundles for the shop
      const bundles = await (prisma as any).bundle.findMany({
        where: { shop: session.shop },
        include: {
          bundles: true  // Include BundleProduct relations
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
      
      if ((responseJson as any).errors) {
        console.error('GraphQL errors:', (responseJson as any).errors);
        return json({ 
          success: false, 
          error: 'Failed to fetch collections from Shopify',
          categories: []
        }, { status: 500 });
      }
      
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
  // Support both JSON and FormData bodies
  let actionType: any;
  let body: any = {};
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await request.json();
      actionType = body.action;
    } catch (_e) {
      return json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }
  } else {
    const formData = await request.formData();
    actionType = formData.get('action');
    formData.forEach((v, k) => { (body as any)[k] = v; });
  }

  try {
    if (actionType === 'create-bundle') {
      const name = (body.name as string) || '';
      const description = (body.description as string) || '';
      const type = (body.type as string) || (body.bundleType as string);
      const discountType = (body.discountType as string) || 'percentage';
      const discountValue = parseFloat(String(body.discountValue));
      const categoryIds = (body.categoryIds as string) || (body.collectionIds as string);
      const productIds = (body.productIds as string);
      const minProducts = body.minProducts ? parseInt(String(body.minProducts)) : 2;
      const maxProducts = body.maxProducts ? parseInt(String(body.maxProducts)) : null;
      const aiAutoApprove = String(body.aiAutoApprove) === 'true';
      const aiDiscountMax = body.aiDiscountMax ? parseFloat(String(body.aiDiscountMax)) : null;
      const displayTitle = (body.displayTitle as string);

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
      const bundleId = (body.bundleId as string);
      const name = (body.name as string);
      const description = (body.description as string);
      const status = (body.status as string);
      const discountValue = parseFloat(String(body.discountValue));

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
      const bundleId = (body.bundleId as string);

  await (prisma as any).bundle.delete({
        where: { id: bundleId, shop: session.shop }
      });

      return json({ success: true, message: "Bundle deleted successfully" });
    }

    if (actionType === 'toggle-status') {
      const bundleId = (body.bundleId as string);
      const status = (body.status as string);

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