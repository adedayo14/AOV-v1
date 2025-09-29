import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  Modal,
  TextField,
  Select,
  FormLayout,
  ButtonGroup,
  Banner,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Checkbox,
  EmptyState,
  Spinner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { PlusIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface Bundle {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  discountType: string;
  discountValue: number;
  minProducts: number;
  totalPurchases: number;
  totalRevenue: number;
  createdAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const url = new URL(request.url);
  const loadProducts = url.searchParams.get('loadProducts') === 'true';
  
  if (loadProducts) {
    try {
      const response = await admin.graphql(`
        #graphql
        query getProducts {
          products(first: 50) {
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
      `);
      
      const responseJson = await response.json();
      
      // Check for GraphQL errors
      if ((responseJson as any).errors) {
        console.error('GraphQL errors:', (responseJson as any).errors);
        return json({ 
          success: false, 
          error: 'Failed to load products: ' + (responseJson as any).errors[0]?.message,
          products: []
        }, { status: 500 });
      }
      
      const products = responseJson.data?.products?.edges?.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        image: edge.node.featuredImage?.url || '',
        price: edge.node.priceRangeV2?.minVariantPrice?.amount || 
               edge.node.variants?.edges?.[0]?.node?.price || '0'
      })) || [];
      
      return json({ success: true, products });
    } catch (error) {
      console.error('Failed to load products:', error);
      return json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to load products',
        products: []
      }, { status: 500 });
    }
  }
  
  // Load bundles
  try {
    const bundles = await (prisma as any).bundle.findMany({
      where: { shop },
      include: {
        products: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return json({ success: true, bundles, products: [] });
  } catch (error) {
    console.error('Failed to load bundles:', error);
    return json({ 
      success: true, 
      bundles: [], 
      products: [],
      error: 'Failed to load bundles'
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    if (actionType === "create-bundle") {
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const bundleType = formData.get("bundleType") as string;
      const discountType = formData.get("discountType") as string;
      const discountValue = parseFloat(formData.get("discountValue") as string);
      const minProducts = parseInt(formData.get("minProducts") as string) || 2;
      const productIds = (formData.get("productIds") as string) || "[]";
      const collectionIds = (formData.get("collectionIds") as string) || "[]";

      if (!name || !bundleType || discountValue < 0) {
        return json({ success: false, error: "Invalid bundle data" }, { status: 400 });
      }

  const bundle = await (prisma as any).bundle.create({
        data: {
          shop: session.shop,
          name,
          description,
          type: bundleType,
          discountType,
          discountValue,
          minProducts,
          productIds: bundleType === 'manual' ? productIds : "[]",
          collectionIds: bundleType === 'category' ? collectionIds : "[]",
          status: "draft",
        },
      });

      return json({ success: true, bundle });
    }

    if (actionType === "toggle-status") {
      const bundleId = formData.get("bundleId") as string;
      const status = formData.get("status") as string;

  const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop: session.shop },
        data: { status },
      });

      return json({ success: true, bundle });
    }

    if (actionType === "delete-bundle") {
      const bundleId = formData.get("bundleId") as string;

  await (prisma as any).bundle.delete({
        where: { id: bundleId, shop: session.shop },
      });

      return json({ success: true, message: "Bundle deleted successfully" });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bundle action error:", error);
    return json({ success: false, error: "Failed to perform action" }, { status: 500 });
  }
};

export default function SimpleBundleManagement() {
  const loaderData = useLoaderData<typeof loader>();
  const productFetcher = useFetcher<typeof loader>();
  const actionFetcher = useFetcher<typeof action>();
  const collectionsFetcher = useFetcher();

  // Handle both bundle and product data from loader
  const bundles = (loaderData as any).bundles || [];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [newBundle, setNewBundle] = useState({
    name: "",
    description: "",
    bundleType: "manual",
    discountType: "percentage",
    discountValue: 10,
    minProducts: 2,
    maxProducts: 10,
    status: "active"
  });
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [availableCollections, setAvailableCollections] = useState<any[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);

  // Auto-load products when modal opens with manual type
  useEffect(() => {
    if (showCreateModal && newBundle.bundleType === 'manual' && 
        !productFetcher.data?.products && productFetcher.state === 'idle') {
      productFetcher.load('/admin/bundle-management-simple?loadProducts=true');
    }
  }, [showCreateModal, newBundle.bundleType, productFetcher]);

  // Auto-load collections when modal opens with category type
  useEffect(() => {
    if (showCreateModal && newBundle.bundleType === 'category' && 
        availableCollections.length === 0 && !isLoadingCollections) {
      console.log('🔥 Loading collections via fetcher...');
      setIsLoadingCollections(true);
      collectionsFetcher.load('/api/collections');
    }
  }, [showCreateModal, newBundle.bundleType, availableCollections.length, isLoadingCollections, collectionsFetcher]);

  // Handle collections fetcher response
  useEffect(() => {
    if (collectionsFetcher.state === 'idle' && collectionsFetcher.data) {
      const data = collectionsFetcher.data as any;
      if (data.success && data.collections) {
        setAvailableCollections(data.collections);
      }
      setIsLoadingCollections(false);
    }
  }, [collectionsFetcher.state, collectionsFetcher.data]);

  // Handle product fetcher state
  const isLoadingProducts = productFetcher.state === 'loading';
  const productLoadError = productFetcher.data && !productFetcher.data.success 
    ? (productFetcher.data as any).error 
    : null;
  const availableProducts = productFetcher.data?.products || [];

  // Handle action fetcher state
  useEffect(() => {
    if (actionFetcher.state === 'idle' && actionFetcher.data) {
      if (actionFetcher.data.success) {
        setShowCreateModal(false);
        resetForm();
        // Reload bundles
        window.location.reload();
      }
    }
  }, [actionFetcher.state, actionFetcher.data]);

  const resetForm = () => {
    setNewBundle({
      name: "",
      description: "",
      bundleType: "manual",
      discountType: "percentage",
      discountValue: 10,
      minProducts: 2,
      maxProducts: 10,
      status: "active"
    });
    setSelectedProducts([]);
    setSelectedCollections([]);
  };

  const handleCreateBundle = () => {
    if (!newBundle.name.trim()) {
      alert('Bundle name is required');
      return;
    }

    const formData = new FormData();
    formData.append('action', 'create-bundle');
    formData.append('name', newBundle.name);
    formData.append('description', newBundle.description);
    formData.append('bundleType', newBundle.bundleType);
    formData.append('discountType', newBundle.discountType);
    formData.append('discountValue', String(newBundle.discountValue));
    formData.append('minProducts', String(newBundle.minProducts));
    formData.append('maxProducts', String(newBundle.maxProducts));
    formData.append('status', newBundle.status);
    
    if (newBundle.bundleType === 'manual' && selectedProducts.length > 0) {
      formData.append('productIds', JSON.stringify(selectedProducts));
    }
    
    if (newBundle.bundleType === 'category' && selectedCollections.length > 0) {
      formData.append('collectionIds', JSON.stringify(selectedCollections));
    }
    
    actionFetcher.submit(formData, { method: 'post' });
  };

  const bundleTypeOptions = [
    { label: "Manual Bundle (Select specific products)", value: "manual" },
    { label: "Category Bundle (All products from categories)", value: "category" },
    { label: "AI Suggested Bundle (Smart recommendations)", value: "ai_suggested" },
  ];

  const discountTypeOptions = [
    { label: "Percentage Off", value: "percentage" },
    { label: "Fixed Amount Off", value: "fixed" },
  ];

  const bundleTableRows = bundles.map((bundle: Bundle) => [
    bundle.name,
    bundle.type === "manual" ? "Manual" : bundle.type === "category" ? "Category" : "AI Suggested",
    <Badge tone={bundle.status === "active" ? "success" : bundle.status === "paused" ? "warning" : "info"} key={bundle.id}>
      {bundle.status === "active" ? "Active" : bundle.status === "paused" ? "Paused" : "Draft"}
    </Badge>,
    bundle.discountType === "percentage" ? `${bundle.discountValue}% off` : `$${bundle.discountValue} off`,
    (bundle.totalPurchases as any)?.toLocaleString?.() || "0",
    `$${(bundle.totalRevenue || 0).toFixed(2)}`,
    <ButtonGroup key={bundle.id}>
      <Button
        size="micro"
        variant={bundle.status === "active" ? "secondary" : "primary"}
        onClick={() => {
          const formData = new FormData();
          formData.append("action", "toggle-status");
          formData.append("bundleId", bundle.id);
          formData.append("status", bundle.status === "active" ? "paused" : "active");
          actionFetcher.submit(formData, { method: "post" });
        }}
      >
        {bundle.status === "active" ? "Pause" : "Activate"}
      </Button>
      <Button
        size="micro"
        tone="critical"
        onClick={() => {
          if (confirm("Are you sure you want to delete this bundle?")) {
            const formData = new FormData();
            formData.append("action", "delete-bundle");
            formData.append("bundleId", bundle.id);
            actionFetcher.submit(formData, { method: "post" });
          }
        }}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  return (
    <Page
      title="Bundle Management"
      subtitle="Create and manage product bundles with AI recommendations and custom discounts"
      primaryAction={
        <Button
          variant="primary"
          icon={PlusIcon}
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          Create Bundle
        </Button>
      }
    >
      <TitleBar title="Bundle Management" />

      <Layout>
        <Layout.Section>
          {bundles.length === 0 ? (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Get Started with Bundles
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Create your first bundle to start increasing average order value through strategic product combinations.
                </Text>
                <Banner>
                  <Text as="p" variant="bodyMd">
                    <strong>Bundle Types:</strong>
                    <br />• <strong>Manual:</strong> Handpick specific products
                    <br />• <strong>Category:</strong> Auto-bundle from categories
                    <br />• <strong>AI Suggested:</strong> Smart recommendations with approval workflow
                  </Text>
                </Banner>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    All Bundles
                  </Text>
                  <Badge tone="info">{`${bundles.length} Bundle${bundles.length === 1 ? "" : "s"}`}</Badge>
                </InlineStack>

                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "numeric", "numeric", "text"]}
                  headings={["Bundle Name", "Type", "Status", "Discount", "Purchases", "Revenue", "Actions"]}
                  rows={bundleTableRows}
                />
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                🎯 Bundle Strategy
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Bundles work seamlessly with your theme embed to show customers relevant product combinations at the perfect moment.
              </Text>
              <BlockStack gap="200">
                <Banner tone="info">
                  <Text as="p" variant="bodySm">
                    <strong>Backend:</strong> Complex logic, product selection, discount rules, approval workflows
                  </Text>
                </Banner>
                <Banner tone="success">
                  <Text as="p" variant="bodySm">
                    <strong>Theme Embed:</strong> Smart display, customer interaction, cart integration
                  </Text>
                </Banner>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                💡 Best Practices
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Start with 10-15% discounts
                <br />• Use AI bundles for cross-sell discovery
                <br />• Test manual bundles for key products
                <br />• Monitor performance in Dashboard
                <br />• A/B test different discount rates
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
        }}
        title="Create New Bundle"
        primaryAction={{
          content: "Create Bundle",
          disabled: !newBundle.name.trim() || actionFetcher.state !== "idle",
          onAction: handleCreateBundle,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setShowCreateModal(false);
            },
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Bundle Name"
              value={newBundle.name}
              onChange={(value) => setNewBundle({ ...newBundle, name: value })}
              placeholder="e.g., Summer Beach Essentials"
              autoComplete="off"
              helpText="This name will be shown to customers"
            />

            <TextField
              label="Description (Optional)"
              value={newBundle.description}
              onChange={(value) => setNewBundle({ ...newBundle, description: value })}
              placeholder="Brief description of the bundle"
              multiline={2}
              autoComplete="off"
            />

            <Select
              label="Bundle Type"
              options={bundleTypeOptions}
              value={newBundle.bundleType}
              onChange={(value) => {
                setNewBundle({ ...newBundle, bundleType: value });
                if (value === "manual" && availableProducts.length === 0) {
                  productFetcher.load('/admin/bundle-management-simple?loadProducts=true');
                }
              }}
              helpText="Choose how products are selected for this bundle"
            />

            {newBundle.bundleType === "manual" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Select Products for Bundle
                  </Text>
                  {isLoadingProducts || productFetcher.state !== "idle" ? (
                    <BlockStack align="center" gap="300">
                      <Spinner size="large" />
                      <Text as="p">Loading products...</Text>
                    </BlockStack>
                  ) : productLoadError ? (
                    <Banner tone="critical" title="Failed to load products">
                      <p>{productLoadError}</p>
                    </Banner>
                  ) : availableProducts.length === 0 ? (
                    <EmptyState
                      heading="No products found"
                      action={{
                        content: "Load Products",
                        onAction: () => productFetcher.load('/admin/bundle-management-simple?loadProducts=true'),
                      }}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Click to load your store's products for bundle selection.</p>
                    </EmptyState>
                  ) : (
                    <ResourceList
                      items={availableProducts.slice(0, 25)}
                      renderItem={(product: any) => (
                        <ResourceItem
                          id={product.id}
                          onClick={() => {
                            const isSelected = selectedProducts.includes(product.id);
                            if (isSelected) {
                              setSelectedProducts(selectedProducts.filter((id: string) => id !== product.id));
                            } else {
                              setSelectedProducts([...selectedProducts, product.id]);
                            }
                          }}
                        >
                          <InlineStack gap="300">
                            <Checkbox label="" checked={selectedProducts.includes(product.id)} onChange={() => {}} />
                            <Thumbnail source={product.featuredImage?.url || ""} alt={product.title} size="small" />
                            <BlockStack gap="100">
                              <Text as="h3" variant="bodyMd">
                                {product.title}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                ${product.variants.edges[0]?.node.price || "0.00"}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </ResourceItem>
                      )}
                    />
                  )}

                  {selectedProducts.length > 0 && (
                    <Banner tone="success">
                      <Text as="p" variant="bodyMd">
                        {selectedProducts.length} product{selectedProducts.length === 1 ? "" : "s"} selected for this bundle
                      </Text>
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            {newBundle.bundleType === "category" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Select Collections for Bundle
                  </Text>
                  <Text as="p" tone="subdued">
                    Choose which collections should be included in this category bundle. All products from selected collections will be eligible for bundling.
                  </Text>
                  
                  {isLoadingCollections || collectionsFetcher.state !== "idle" ? (
                    <BlockStack align="center" gap="300">
                      <Spinner size="large" />
                      <Text as="p">Loading collections...</Text>
                    </BlockStack>
                  ) : availableCollections.length === 0 ? (
                    <EmptyState
                      heading="No collections found"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      action={{
                        content: "Reload Collections",
                        onAction: () => {
                          setIsLoadingCollections(true);
                          collectionsFetcher.load('/api/collections');
                        },
                      }}
                    >
                      <p>No collections available in your store. Create some collections first.</p>
                    </EmptyState>
                  ) : (
                    <ResourceList
                      items={availableCollections}
                      renderItem={(collection: any) => (
                        <ResourceItem
                          id={collection.id}
                          onClick={() => {
                            const isSelected = selectedCollections.includes(collection.id);
                            if (isSelected) {
                              setSelectedCollections(selectedCollections.filter((id: string) => id !== collection.id));
                            } else {
                              setSelectedCollections([...selectedCollections, collection.id]);
                            }
                          }}
                        >
                          <InlineStack gap="300">
                            <Checkbox 
                              label="" 
                              checked={selectedCollections.includes(collection.id)} 
                              onChange={() => {}} 
                            />
                            <BlockStack gap="100">
                              <Text as="h3" variant="bodyMd">
                                {collection.title}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {collection.productsCount} products
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </ResourceItem>
                      )}
                    />
                  )}
                  
                  {selectedCollections.length > 0 && (
                    <Banner tone="success">
                      <Text as="p" variant="bodyMd">
                        {selectedCollections.length} collection{selectedCollections.length === 1 ? '' : 's'} selected for this bundle
                      </Text>
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            <InlineStack gap="400">
              <Select
                label="Discount Type"
                options={discountTypeOptions}
                value={newBundle.discountType}
                onChange={(value) => setNewBundle({ ...newBundle, discountType: value })}
              />
              <TextField
                label={newBundle.discountType === "percentage" ? "Discount %" : "Discount $"}
                type="number"
                value={newBundle.discountValue.toString()}
                onChange={(value) => setNewBundle({ ...newBundle, discountValue: parseFloat(value) || 0 })}
                suffix={newBundle.discountType === "percentage" ? "%" : "$"}
                autoComplete="off"
              />
            </InlineStack>

            <TextField
              label="Minimum Products"
              type="number"
              value={newBundle.minProducts.toString()}
              onChange={(value) => setNewBundle({ ...newBundle, minProducts: parseInt(value) || 2 })}
              helpText="Minimum number of products required for bundle discount"
              autoComplete="off"
            />

            <Banner tone="info">
              <Text as="p" variant="bodyMd">
                {newBundle.bundleType === "manual" && selectedProducts.length > 0
                  ? `Ready to create bundle with ${selectedProducts.length} selected product${selectedProducts.length === 1 ? "" : "s"}.`
                  : newBundle.bundleType === "manual"
                  ? "Please select products above for your manual bundle."
                  : newBundle.bundleType === "category" && selectedCollections.length > 0
                  ? `Ready to create category bundle with ${selectedCollections.length} collection${selectedCollections.length === 1 ? "" : "s"}.`
                  : newBundle.bundleType === "category"
                  ? "Please select collections above for your category bundle."
                  : "AI bundles use machine learning to create intelligent product combinations."}
              </Text>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}