import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
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
  Box
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  
  // Load existing manual bundles (mock data for now)
  const bundles = [
    {
      id: 1,
      name: "Skincare Essentials",
      type: "fixed",
      discount: "15%",
      products: 3,
      status: "active",
      views: 245,
      conversions: 12,
      revenue: 1450.00
    },
    {
      id: 2, 
      name: "Pick Any 5 Supplements",
      type: "category_rule",
      discount: "20%",
      category: "Supplements",
      minItems: 5,
      status: "active", 
      views: 189,
      conversions: 8,
      revenue: 2100.00
    }
  ];

  // Get available products for bundle creation
  const productsResp = await admin.graphql(`
    #graphql
    query getProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            vendor
            status
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                  availableForSale
                }
              }
            }
            media(first: 1) {
              edges {
                node {
                  ... on MediaImage {
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `, { variables: { first: 50 } });

  const productsData = await productsResp.json();
  const products = productsData?.data?.products?.edges?.map((edge: any) => ({
    id: edge.node.id.replace('gid://shopify/Product/', ''),
    title: edge.node.title,
    handle: edge.node.handle,
    vendor: edge.node.vendor,
    status: edge.node.status,
    price: edge.node.variants?.edges?.[0]?.node?.price || "0",
    image: edge.node.media?.edges?.[0]?.node?.image?.url,
    available: edge.node.variants?.edges?.[0]?.node?.availableForSale || false
  })) || [];

  return json({ bundles, products });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin: _admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "create_bundle") {
    // Handle bundle creation
    const bundleData = {
      name: formData.get("name"),
      type: formData.get("type"),
      discountType: formData.get("discountType"),
      discountValue: formData.get("discountValue"),
      products: JSON.parse(String(formData.get("products") || "[]")),
      categoryRule: formData.get("categoryRule")
    };
    
    console.log("Creating bundle:", bundleData);
    // TODO: Save to database
    
    return json({ success: true, message: "Bundle created successfully!" });
  }

  return json({ error: "Invalid action" }, { status: 400 });
};

export default function ManualBundles() {
  const { bundles, products } = useLoaderData<typeof loader>();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bundleType, setBundleType] = useState("fixed");
  const [bundleName, setBundleName] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("15");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [categoryRule, setCategoryRule] = useState("");
  const [minItems, setMinItems] = useState("2");

  const bundleTypeOptions = [
    { label: 'Fixed Bundle (Preset Products)', value: 'fixed' },
    { label: 'Category Rule (Customer Choice)', value: 'category_rule' },
  ];

  const discountTypeOptions = [
    { label: 'Percentage Off', value: 'percentage' },
    { label: 'Fixed Amount Off', value: 'fixed_amount' },
  ];

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const bundleRows = bundles.map((bundle) => [
    <div key={`name-${bundle.id}`}>
      <Text as="p" variant="bodyMd" fontWeight="semibold">{bundle.name}</Text>
      <Text as="p" variant="bodySm" tone="subdued">
        {bundle.type === 'fixed' ? `${(bundle as any).products} products` : `Min ${(bundle as any).minItems} from ${(bundle as any).category}`}
      </Text>
    </div>,
    <Badge key={`type-${bundle.id}`} tone={bundle.type === 'fixed' ? 'info' : 'success'}>
      {bundle.type === 'fixed' ? 'Fixed Bundle' : 'Category Rule'}
    </Badge>,
    bundle.discount,
    <Badge key={`status-${bundle.id}`} tone={bundle.status === 'active' ? 'success' : 'critical'}>
      {bundle.status}
    </Badge>,
    bundle.views.toLocaleString(),
    bundle.conversions,
    `$${bundle.revenue.toFixed(2)}`,
    <ButtonGroup key={`actions-${bundle.id}`}>
      <Button size="micro">Edit</Button>
      <Button size="micro" tone="critical">Delete</Button>
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
                  <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                    Create Bundle
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Bundle Types Info */}
            <Layout>
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">🎯 Fixed Bundles</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Preset product combinations with fixed discounts. Perfect for curated collections.
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
              
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">🛍️ Category Rules</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Let customers build their own bundles from categories. Example: "Pick 5 supplements, save 20%"
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
              
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">🤖 ML Bundles</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      AI-powered bundles based on purchase patterns. Automatically created and optimized.
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>

            {/* Bundles Table */}
            <Card>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'numeric', 'numeric', 'text']}
                headings={['Bundle', 'Type', 'Discount', 'Status', 'Views', 'Conversions', 'Revenue', 'Actions']}
                rows={bundleRows}
              />
            </Card>

          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Create Bundle Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Bundle"
        primaryAction={{
          content: 'Create Bundle',
          onAction: () => {
            // Handle bundle creation
            console.log('Creating bundle...', {
              name: bundleName,
              type: bundleType,
              discountType,
              discountValue,
              selectedProducts,
              categoryRule,
              minItems
            });
            setShowCreateModal(false);
          },
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowCreateModal(false),
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
              />
            </InlineStack>

            {bundleType === 'fixed' && (
              <div>
                <Text variant="headingSm" as="h3">Select Products</Text>
                <Box paddingBlockStart="200">
                  <ResourceList
                    resourceName={{ singular: 'product', plural: 'products' }}
                    items={products.slice(0, 10)}
                    renderItem={(product) => {
                      const { id, title, vendor, price, image } = product;
                      const isSelected = selectedProducts.includes(id);
                      
                      return (
                        <ResourceItem
                          id={id}
                          onClick={() => toggleProductSelection(id)}
                        >
                          <InlineStack gap="300">
                            <Checkbox 
                              label=""
                              checked={isSelected}
                              onChange={() => toggleProductSelection(id)}
                            />
                            <Avatar 
                              source={image || ''} 
                            />
                            <div>
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

            {bundleType === 'category_rule' && (
              <div>
                <TextField
                  label="Category/Collection Rule"
                  value={categoryRule}
                  onChange={setCategoryRule}
                  placeholder="e.g., Supplements, Skincare"
                  helpText="Customers can pick products from this category"
                  autoComplete="off"
                />
                <TextField
                  label="Minimum Items Required"
                  value={minItems}
                  onChange={setMinItems}
                  type="number"
                  helpText="How many items must customers select to get the discount"
                  autoComplete="off"
                />
              </div>
            )}

            <Banner title="Bundle Preview" tone="info">
              <Text as="p">
                {bundleType === 'fixed' 
                  ? `Fixed bundle with ${selectedProducts.length} selected products, ${discountValue}${discountType === 'percentage' ? '%' : '$'} discount`
                  : `Category rule: Pick ${minItems}+ from ${categoryRule || 'selected category'}, save ${discountValue}${discountType === 'percentage' ? '%' : '$'}`
                }
              </Text>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}