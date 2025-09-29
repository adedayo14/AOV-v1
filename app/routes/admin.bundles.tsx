import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
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
  Checkbox,
  FormLayout,
  ButtonGroup,
  Banner,
  ResourceList,
  ResourceItem,
  Avatar,
  Box,
  EmptyState,
  Toast
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  
  try {
    // Fetch settings with manual bundles
    const settings = await prisma.settings.findUnique({
      where: { shop },
      select: { manualBundles: true }
    });
    
    // Fetch products for bundle selection
    const productsResponse = await admin.graphql(`
      #graphql
      query getProductsForBundles {
        products(first: 100) {
          edges {
            node {
              id
              title
              handle
              vendor
              images(first: 1) {
                edges {
                  node { url }
                }
              }
              variants(first: 1) {
                edges {
                  node { price }
                }
              }
            }
          }
        }
      }
    `);
    
    // Fetch collections for category bundles
    const collectionsResponse = await admin.graphql(`
      #graphql
      query getCollectionsForBundles {
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
    
    const productsData = await productsResponse.json();
    const collectionsData = await collectionsResponse.json();
    
    const products = productsData.data?.products?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      vendor: edge.node.vendor || '',
      image: edge.node.images?.edges?.[0]?.node?.url || null,
      price: edge.node.variants?.edges?.[0]?.node?.price || '0'
    })) || [];
    
    const collections = collectionsData.data?.collections?.edges?.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      productsCount: edge.node.productsCount
    })) || [];
    
    const bundles = settings?.manualBundles || [];
    
    return json({ bundles, products, collections, shop });
  } catch (error) {
    console.error('Failed to load bundles data:', error);
    return json({ 
      bundles: [], 
      products: [], 
      collections: [],
      shop: session.shop,
      error: 'Failed to load data' 
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    const settings = await prisma.settings.findUnique({
      where: { shop }
    });

    let bundles = settings?.manualBundles || [];

    switch (intent) {
      case "create": {
        const newBundle = {
          id: `bundle_${Date.now()}`,
          name: String(formData.get("name") || "New Bundle"),
          description: String(formData.get("description") || ""),
          bundleType: String(formData.get("bundleType") || "fixed"),
          discountType: String(formData.get("discountType") || "percentage"),
          discountValue: parseFloat(String(formData.get("discountValue") || "10")),
          products: JSON.parse(String(formData.get("products") || "[]")),
          collections: JSON.parse(String(formData.get("collections") || "[]")),
          minItems: parseInt(String(formData.get("minItems") || "2")),
          maxItems: parseInt(String(formData.get("maxItems") || "5")),
          active: formData.get("active") === "true",
          createdAt: new Date().toISOString()
        };

        bundles.push(newBundle);
        break;
      }

      case "update": {
        const bundleId = String(formData.get("bundleId"));
        const bundleIndex = bundles.findIndex(b => b.id === bundleId);
        
        if (bundleIndex !== -1) {
          bundles[bundleIndex] = {
            ...bundles[bundleIndex],
            name: String(formData.get("name") || bundles[bundleIndex].name),
            description: String(formData.get("description") || ""),
            bundleType: String(formData.get("bundleType") || bundles[bundleIndex].bundleType),
            discountType: String(formData.get("discountType") || bundles[bundleIndex].discountType),
            discountValue: parseFloat(String(formData.get("discountValue") || bundles[bundleIndex].discountValue)),
            products: JSON.parse(String(formData.get("products") || "[]")),
            collections: JSON.parse(String(formData.get("collections") || "[]")),
            minItems: parseInt(String(formData.get("minItems") || "2")),
            maxItems: parseInt(String(formData.get("maxItems") || "5")),
            active: formData.get("active") === "true",
          };
        }
        break;
      }

      case "delete": {
        const bundleId = String(formData.get("bundleId"));
        bundles = bundles.filter(b => b.id !== bundleId);
        break;
      }

      case "toggle": {
        const bundleId = String(formData.get("bundleId"));
        const bundleIndex = bundles.findIndex(b => b.id === bundleId);
        
        if (bundleIndex !== -1) {
          bundles[bundleIndex].active = !bundles[bundleIndex].active;
        }
        break;
      }
    }

    // Update settings with new bundles array
    await prisma.settings.upsert({
      where: { shop },
      update: { manualBundles: bundles },
      create: { 
        shop, 
        manualBundles: bundles,
        cartEnabled: true
      }
    });

    return json({ success: true, message: `Bundle ${intent}d successfully!` });
  } catch (error) {
    console.error(`Failed to ${intent} bundle:`, error);
    return json({ error: `Failed to ${intent} bundle` }, { status: 500 });
  }
};

export default function Bundles() {
  const { bundles, products, collections } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<any>(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState("");
  
  // Form state
  const [bundleName, setBundleName] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundleType, setBundleType] = useState("fixed");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("15");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [minItems, setMinItems] = useState("2");
  const [maxItems, setMaxItems] = useState("5");
  const [isActive, setIsActive] = useState(true);

  const bundleTypeOptions = [
    { label: 'Fixed Bundle (Preset Products)', value: 'fixed' },
    { label: 'Category Rule (Customer Choice)', value: 'category' },
  ];

  const discountTypeOptions = [
    { label: 'Percentage Off', value: 'percentage' },
    { label: 'Fixed Amount Off', value: 'fixed' },
  ];

  useEffect(() => {
    if (fetcher.data) {
      if ((fetcher.data as any).success) {
        setToastContent((fetcher.data as any).message || "Action completed successfully");
        setToastActive(true);
        closeModal();
      } else if ((fetcher.data as any).error) {
        setToastContent((fetcher.data as any).error);
        setToastActive(true);
      }
    }
  }, [fetcher.data]);

  const openModal = (bundle?: any) => {
    if (bundle) {
      setEditingBundle(bundle);
      setBundleName(bundle.name);
      setBundleDescription(bundle.description || "");
      setBundleType(bundle.bundleType || "fixed");
      setDiscountType(bundle.discountType || "percentage");
      setDiscountValue(bundle.discountValue?.toString() || "15");
      setSelectedProducts(bundle.products || []);
      setSelectedCollections(bundle.collections || []);
      setMinItems(bundle.minItems?.toString() || "2");
      setMaxItems(bundle.maxItems?.toString() || "5");
      setIsActive(bundle.active !== false);
    } else {
      resetForm();
    }
    setShowBundleModal(true);
  };

  const closeModal = () => {
    setShowBundleModal(false);
    setEditingBundle(null);
    resetForm();
  };

  const resetForm = () => {
    setBundleName("");
    setBundleDescription("");
    setBundleType("fixed");
    setDiscountType("percentage");
    setDiscountValue("15");
    setSelectedProducts([]);
    setSelectedCollections([]);
    setMinItems("2");
    setMaxItems("5");
    setIsActive(true);
  };

  const handleSaveBundle = () => {
    const formData = new FormData();
    formData.append('intent', editingBundle ? 'update' : 'create');
    formData.append('name', bundleName);
    formData.append('description', bundleDescription);
    formData.append('bundleType', bundleType);
    formData.append('discountType', discountType);
    formData.append('discountValue', discountValue);
    formData.append('products', JSON.stringify(selectedProducts));
    formData.append('collections', JSON.stringify(selectedCollections));
    formData.append('minItems', minItems);
    formData.append('maxItems', maxItems);
    formData.append('active', isActive.toString());
    
    if (editingBundle) {
      formData.append('bundleId', editingBundle.id);
    }
    
    fetcher.submit(formData, { method: 'post' });
  };

  const handleDeleteBundle = (bundleId: string) => {
    const formData = new FormData();
    formData.append('intent', 'delete');
    formData.append('bundleId', bundleId);
    fetcher.submit(formData, { method: 'post' });
  };

  const handleToggleBundle = (bundleId: string) => {
    const formData = new FormData();
    formData.append('intent', 'toggle');
    formData.append('bundleId', bundleId);
    fetcher.submit(formData, { method: 'post' });
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleCollectionSelection = (collectionId: string) => {
    setSelectedCollections(prev => 
      prev.includes(collectionId) 
        ? prev.filter(id => id !== collectionId)
        : [...prev, collectionId]
    );
  };

  const bundleRows = bundles.map((bundle: any) => [
    <div key={`name-${bundle.id}`}>
      <Text as="p" variant="bodyMd" fontWeight="semibold">{bundle.name}</Text>
      <Text as="p" variant="bodySm" tone="subdued">
        {bundle.bundleType === 'fixed' 
          ? `${bundle.products?.length || 0} products`
          : `${bundle.collections?.length || 0} collections`}
      </Text>
    </div>,
    <Badge key={`type-${bundle.id}`} tone={bundle.bundleType === 'fixed' ? 'info' : 'success'}>
      {bundle.bundleType === 'fixed' ? 'Fixed' : 'Category'}
    </Badge>,
    `${bundle.discountValue}${bundle.discountType === 'percentage' ? '%' : '$'}`,
    <Badge key={`status-${bundle.id}`} tone={bundle.active ? 'success' : 'warning'}>
      {bundle.active ? 'Active' : 'Inactive'}
    </Badge>,
    <ButtonGroup key={`actions-${bundle.id}`}>
      <Button size="micro" onClick={() => openModal(bundle)}>Edit</Button>
      <Button size="micro" tone={bundle.active ? 'base' : 'success'} onClick={() => handleToggleBundle(bundle.id)}>
        {bundle.active ? 'Disable' : 'Enable'}
      </Button>
      <Button size="micro" tone="critical" onClick={() => handleDeleteBundle(bundle.id)}>Delete</Button>
    </ButtonGroup>
  ]);

  return (
    <Page>
      <TitleBar title="Manual Bundles" />
      
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            
            {/* Header with Create Button */}
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <div>
                    <Text as="h2" variant="headingLg">Bundle Management</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Create custom bundles and category-based rules for your customers
                    </Text>
                  </div>
                  <Button variant="primary" onClick={() => openModal()}>
                    Create Bundle
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Bundles Table */}
            {bundles.length > 0 ? (
              <Card>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Bundle', 'Type', 'Discount', 'Status', 'Actions']}
                  rows={bundleRows}
                />
              </Card>
            ) : (
              <Card sectioned>
                <EmptyState
                  heading="Create your first bundle"
                  action={{
                    content: 'Create Bundle',
                    onAction: () => openModal(),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Start creating bundles to increase your average order value.</p>
                </EmptyState>
              </Card>
            )}

          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Create/Edit Bundle Modal */}
      <Modal
        open={showBundleModal}
        onClose={closeModal}
        title={editingBundle ? "Edit Bundle" : "Create New Bundle"}
        primaryAction={{
          content: editingBundle ? 'Update Bundle' : 'Create Bundle',
          onAction: handleSaveBundle,
          loading: fetcher.state === 'submitting',
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: closeModal,
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Bundle Name"
              value={bundleName}
              onChange={setBundleName}
              placeholder="e.g., Skincare Essentials"
              autoComplete="off"
              requiredIndicator
            />

            <TextField
              label="Description"
              value={bundleDescription}
              onChange={setBundleDescription}
              placeholder="Describe this bundle"
              multiline={2}
              autoComplete="off"
            />

            <Select
              label="Bundle Type"
              options={bundleTypeOptions}
              value={bundleType}
              onChange={setBundleType}
            />

            <InlineStack gap="200">
              <Box minWidth="150px">
                <Select
                  label="Discount Type"
                  options={discountTypeOptions}
                  value={discountType}
                  onChange={setDiscountType}
                />
              </Box>
              <TextField
                label={discountType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
                value={discountValue}
                onChange={setDiscountValue}
                type="number"
                autoComplete="off"
                requiredIndicator
              />
            </InlineStack>

            {bundleType === 'fixed' && (
              <div>
                <Text variant="headingSm" as="h3">Select Products ({selectedProducts.length} selected)</Text>
                <Box paddingBlockStart="200" maxHeight="300px" overflow="auto">
                  <ResourceList
                    resourceName={{ singular: 'product', plural: 'products' }}
                    items={products}
                    renderItem={(product) => {
                      const { id, title, vendor, price, image } = product;
                      const isSelected = selectedProducts.includes(id);
                      
                      return (
                        <ResourceItem
                          id={id}
                          onClick={() => toggleProductSelection(id)}
                        >
                          <InlineStack gap="300" align="center">
                            <Checkbox 
                              label=""
                              checked={isSelected}
                              onChange={() => toggleProductSelection(id)}
                            />
                            <Avatar source={image || ''} size="small" />
                            <div style={{ flex: 1 }}>
                              <Text as="p" variant="bodyMd" fontWeight="semibold">{title}</Text>
                              <Text as="p" variant="bodySm" tone="subdued">{vendor} • ${price}</Text>
                            </div>
                          </InlineStack>
                        </ResourceItem>
                      );
                    }}
                  />
                </Box>
              </div>
            )}

            {bundleType === 'category' && (
              <>
                <div>
                  <Text variant="headingSm" as="h3">Select Collections ({selectedCollections.length} selected)</Text>
                  <Box paddingBlockStart="200" maxHeight="300px" overflow="auto">
                    <ResourceList
                      resourceName={{ singular: 'collection', plural: 'collections' }}
                      items={collections}
                      renderItem={(collection) => {
                        const { id, title, productsCount } = collection;
                        const isSelected = selectedCollections.includes(id);
                        
                        return (
                          <ResourceItem
                            id={id}
                            onClick={() => toggleCollectionSelection(id)}
                          >
                            <InlineStack gap="300" align="center">
                              <Checkbox 
                                label=""
                                checked={isSelected}
                                onChange={() => toggleCollectionSelection(id)}
                              />
                              <div style={{ flex: 1 }}>
                                <Text as="p" variant="bodyMd" fontWeight="semibold">{title}</Text>
                                <Text as="p" variant="bodySm" tone="subdued">{productsCount} products</Text>
                              </div>
                            </InlineStack>
                          </ResourceItem>
                        );
                      }}
                    />
                  </Box>
                </div>
                <InlineStack gap="200">
                  <TextField
                    label="Minimum Items"
                    value={minItems}
                    onChange={setMinItems}
                    type="number"
                    helpText="Minimum items to qualify for discount"
                    autoComplete="off"
                  />
                  <TextField
                    label="Maximum Items"
                    value={maxItems}
                    onChange={setMaxItems}
                    type="number"
                    helpText="Maximum items allowed in bundle"
                    autoComplete="off"
                  />
                </InlineStack>
              </>
            )}

            <Checkbox
              label="Bundle is active"
              checked={isActive}
              onChange={setIsActive}
            />

            <Banner title="Bundle Preview" tone="info">
              <Text as="p">
                {bundleType === 'fixed' 
                  ? `Fixed bundle with ${selectedProducts.length} products, ${discountValue}${discountType === 'percentage' ? '%' : '$'} off`
                  : `Pick ${minItems}-${maxItems} items from ${selectedCollections.length} collections, save ${discountValue}${discountType === 'percentage' ? '%' : '$'}`
                }
              </Text>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>

      {toastActive && (
        <Toast
          content={toastContent}
          onDismiss={() => setToastActive(false)}
          duration={3000}
        />
      )}
    </Page>
  );
}