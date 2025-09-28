import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
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
  Grid,
  DataTable,
  Modal,
  TextField,
  Select,
  FormLayout,
  ButtonGroup,
  Banner,
  Box,
  Icon
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { 
  PlusIcon,
  EditIcon,
  DeleteIcon,
  MagicIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// Mock data - replace with real data from your API
const mockBundles = [
  {
    id: "1",
    name: "Summer Essentials",
    products: ["Sunscreen SPF 50", "Beach Towel", "Sunglasses"],
    discount: 15,
    status: "active",
    sales: 89,
    revenue: 4230.50,
    type: "manual"
  },
  {
    id: "2", 
    name: "Tech Starter Pack",
    products: ["Wireless Charger", "Phone Case", "Screen Protector"],
    discount: 20,
    status: "active", 
    sales: 67,
    revenue: 3890.20,
    type: "manual"
  }
];

const mockAIOpportunities = [
  {
    id: "ai-1",
    product1: "Yoga Mat",
    product2: "Water Bottle", 
    frequency: "78%",
    potentialRevenue: 2450.00,
    confidence: "High"
  },
  {
    id: "ai-2",
    product1: "Running Shoes",
    product2: "Athletic Socks",
    frequency: "65%", 
    potentialRevenue: 1890.00,
    confidence: "Medium"
  }
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  // TODO: Replace with real data from your bundle management system
  return json({
    bundles: mockBundles,
    aiOpportunities: mockAIOpportunities
  });
};

export default function ManageProducts() {
  const { bundles, aiOpportunities } = useLoaderData<typeof loader>();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const bundleTableRows = bundles.map((bundle: any) => [
    bundle.name,
    bundle.products.join(", "),
    `${bundle.discount}%`,
    <Badge key={bundle.id} tone={bundle.status === 'active' ? 'success' : 'info'}>
      {bundle.status}
    </Badge>,
    bundle.sales,
    `$${bundle.revenue.toFixed(2)}`,
    <ButtonGroup key={bundle.id}>
      <Button size="micro" icon={EditIcon}>Edit</Button>
      <Button size="micro" icon={DeleteIcon} tone="critical">Delete</Button>
    </ButtonGroup>
  ]);

  const aiOpportunityRows = aiOpportunities.map((opportunity: any) => [
    `${opportunity.product1} + ${opportunity.product2}`,
    opportunity.frequency,
    opportunity.confidence,
    `$${opportunity.potentialRevenue.toFixed(2)}`,
    <Button key={opportunity.id} size="micro" variant="primary">Create Bundle</Button>
  ]);

  return (
    <Page>
      <TitleBar title="🎛️ Manage Products & Bundles" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Header with Create Button */}
            <Card>
              <InlineStack align="space-between">
                <BlockStack gap="200">
                  <Text variant="headingLg" as="h1">Product Bundle Management</Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Create and manage product bundles to increase average order value
                  </Text>
                </BlockStack>
                <Button variant="primary" icon={PlusIcon} onClick={() => setShowCreateModal(true)}>
                  Create Bundle
                </Button>
              </InlineStack>
            </Card>

            {/* Manual Bundles */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" align="space-between">
                  <Text variant="headingMd" as="h2">Active Bundles</Text>
                  <Badge tone="info">{`${bundles.length} bundles`}</Badge>
                </InlineStack>
                
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'text', 'text']}
                  headings={['Bundle Name', 'Products', 'Discount', 'Status', 'Sales', 'Revenue', 'Actions']}
                  rows={bundleTableRows}
                />
                
                <InlineStack gap="300">
                  <Button onClick={() => setShowCreateModal(true)}>Add New Bundle</Button>
                  <Link to="/admin/settings">
                    <Button>Bundle Settings</Button>
                  </Link>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* AI-Discovered Opportunities */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" align="space-between">
                  <InlineStack gap="200" align="center">
                    <Icon source={MagicIcon} tone="magic" />
                    <Text variant="headingMd" as="h2">AI-Discovered Bundle Opportunities</Text>
                  </InlineStack>
                  <Button size="micro" variant="primary">AI Powered</Button>
                </InlineStack>
                
                <Banner tone="info">
                  <p>These product combinations are frequently bought together based on your sales data analysis.</p>
                </Banner>

                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Product Combination', 'Co-Purchase Rate', 'Confidence', 'Potential Revenue', 'Action']}
                  rows={aiOpportunityRows}
                />
                
                <Text variant="bodySm" as="p" tone="subdued">
                  💡 AI analyzes your order history to identify products frequently purchased together
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Bundle Performance Overview */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">Bundle Performance</Text>
                <Grid>
                  <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <BlockStack gap="100">
                      <Text variant="bodySm" as="p" tone="subdued">Total Bundle Sales</Text>
                      <Text variant="headingMd" as="p">
                        {bundles.reduce((sum, b) => sum + b.sales, 0)}
                      </Text>
                    </BlockStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <BlockStack gap="100">
                      <Text variant="bodySm" as="p" tone="subdued">Bundle Revenue</Text>
                      <Text variant="headingMd" as="p">
                        ${bundles.reduce((sum, b) => sum + b.revenue, 0).toFixed(2)}
                      </Text>
                    </BlockStack>
                  </Grid.Cell>
                </Grid>
              </BlockStack>
            </Card>

            {/* Quick Actions */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">Quick Actions</Text>
                <BlockStack gap="200">
                  <Button fullWidth onClick={() => setShowCreateModal(true)}>
                    Create New Bundle
                  </Button>
                  <Link to="/admin/settings">
                    <Button fullWidth>Bundle Settings</Button>
                  </Link>
                  <Link to="/admin/preview">
                    <Button fullWidth>Preview Cart</Button>
                  </Link>
                  <Link to="/admin/dashboard">
                    <Button fullWidth>View Analytics</Button>
                  </Link>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Tips */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">💡 Bundle Tips</Text>
                <BlockStack gap="200">
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text variant="bodySm" as="p">
                      <strong>Optimal Discount:</strong> 15-25% increases conversions without hurting margins
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text variant="bodySm" as="p">
                      <strong>Product Selection:</strong> Bundle complementary items customers already buy together
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text variant="bodySm" as="p">
                      <strong>AI Suggestions:</strong> Create bundles from high co-purchase rate opportunities first
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Create Bundle Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Product Bundle"
        primaryAction={{
          content: 'Create Bundle',
          onAction: () => {
            // TODO: Implement bundle creation
            setShowCreateModal(false);
          },
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setShowCreateModal(false),
        }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Bundle Name"
              placeholder="e.g., Summer Essentials Pack"
              autoComplete="off"
            />
            <TextField
              label="Discount Percentage"
              type="number"
              placeholder="15"
              suffix="%"
              autoComplete="off"
            />
            <Select
              label="Bundle Status"
              options={[
                {label: 'Active', value: 'active'},
                {label: 'Draft', value: 'draft'},
                {label: 'Paused', value: 'paused'},
              ]}
              value="active"
            />
            <Text variant="bodySm" as="p" tone="subdued">
              Select products to include in this bundle on the next step.
            </Text>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
