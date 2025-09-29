import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
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
  FormLayout,
  ButtonGroup,
  Banner
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
  const { session } = await authenticate.admin(request);

  try {
    // Get all bundles for the shop
    const bundles = await prisma.bundle.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: 'desc' }
    });

    return json({ success: true, bundles });
  } catch (error) {
    console.error("Bundle loader error:", error);
    return json({ success: false, bundles: [], error: "Failed to load bundles" });
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
      const minProducts = parseInt(formData.get('minProducts') as string) || 2;

      if (!name || !type || discountValue < 0) {
        return json({ success: false, error: "Invalid bundle data" }, { status: 400 });
      }

      // Create the bundle
      const bundle = await prisma.bundle.create({
        data: {
          shop: session.shop,
          name,
          description,
          type,
          discountType,
          discountValue,
          minProducts,
          productIds: "[]", // Empty array for now
          status: 'draft'
        }
      });

      return json({ success: true, bundle });
    }

    if (actionType === 'toggle-status') {
      const bundleId = formData.get('bundleId') as string;
      const status = formData.get('status') as string;

      const bundle = await prisma.bundle.update({
        where: { id: bundleId, shop: session.shop },
        data: { status }
      });

      return json({ success: true, bundle });
    }

    if (actionType === 'delete-bundle') {
      const bundleId = formData.get('bundleId') as string;

      await prisma.bundle.delete({
        where: { id: bundleId, shop: session.shop }
      });

      return json({ success: true, message: "Bundle deleted successfully" });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bundle action error:", error);
    return json({ success: false, error: "Failed to perform action" }, { status: 500 });
  }
};

export default function BundleManagement() {
  const { bundles = [] } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  // Modal and form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form state
  const [bundleForm, setBundleForm] = useState({
    name: '',
    description: '',
    type: 'manual',
    discountType: 'percentage',
    discountValue: 10,
    minProducts: 2
  });

  // Bundle type options
  const bundleTypeOptions = [
    { label: 'Manual Bundle (Select specific products)', value: 'manual' },
    { label: 'Category Bundle (All products from categories)', value: 'category' },
    { label: 'AI Suggested Bundle (Smart recommendations)', value: 'ai_suggested' }
  ];

  const discountTypeOptions = [
    { label: 'Percentage Off', value: 'percentage' },
    { label: 'Fixed Amount Off', value: 'fixed' }
  ];

  // Create bundle table data
  const bundleTableRows = bundles.map((bundle: Bundle) => [
    bundle.name,
    bundle.type === 'manual' ? 'Manual' : 
    bundle.type === 'category' ? 'Category' : 'AI Suggested',
    <Badge tone={bundle.status === 'active' ? 'success' : 
                  bundle.status === 'paused' ? 'warning' : 'info'} key={bundle.id}>
      {bundle.status === 'active' ? 'Active' : 
       bundle.status === 'paused' ? 'Paused' : 'Draft'}
    </Badge>,
    bundle.discountType === 'percentage' 
      ? `${bundle.discountValue}% off` 
      : `$${bundle.discountValue} off`,
    bundle.totalPurchases?.toLocaleString() || '0',
    `$${(bundle.totalRevenue || 0).toFixed(2)}`,
    <ButtonGroup key={bundle.id}>
      <Button 
        size="micro" 
        variant={bundle.status === 'active' ? 'secondary' : 'primary'}
        onClick={() => {
          const formData = new FormData();
          formData.append('action', 'toggle-status');
          formData.append('bundleId', bundle.id);
          formData.append('status', bundle.status === 'active' ? 'paused' : 'active');
          fetcher.submit(formData, { method: 'post' });
        }}
      >
        {bundle.status === 'active' ? 'Pause' : 'Activate'}
      </Button>
      <Button 
        size="micro" 
        tone="critical"
        onClick={() => {
          if (confirm('Are you sure you want to delete this bundle?')) {
            const formData = new FormData();
            formData.append('action', 'delete-bundle');
            formData.append('bundleId', bundle.id);
            fetcher.submit(formData, { method: 'post' });
          }
        }}
      >
        Delete
      </Button>
    </ButtonGroup>
  ]);

  // Reset form
  const resetForm = () => {
    setBundleForm({
      name: '',
      description: '',
      type: 'manual',
      discountType: 'percentage',
      discountValue: 10,
      minProducts: 2
    });
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!bundleForm.name.trim()) {
      alert('Please enter a bundle name');
      return;
    }

    const formData = new FormData();
    formData.append('action', 'create-bundle');
    formData.append('name', bundleForm.name);
    formData.append('description', bundleForm.description);
    formData.append('type', bundleForm.type);
    formData.append('discountType', bundleForm.discountType);
    formData.append('discountValue', bundleForm.discountValue.toString());
    formData.append('minProducts', bundleForm.minProducts.toString());

    fetcher.submit(formData, { method: 'post' });

    // Close modal and reset form
    setShowCreateModal(false);
    resetForm();
  };

  return (
    <Page 
      title="Bundle Management"
      subtitle="Create and manage product bundles with AI recommendations and custom discounts"
      primaryAction={
        <Button variant="primary" icon={PlusIcon} onClick={() => {
          resetForm();
          setShowCreateModal(true);
        }}>
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
                <Text as="h2" variant="headingMd">Get Started with Bundles</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Create your first bundle to start increasing average order value through strategic product combinations.
                </Text>
                <Banner>
                  <Text as="p" variant="bodyMd">
                    <strong>Bundle Types:</strong><br/>
                    • <strong>Manual:</strong> Handpick specific products<br/>
                    • <strong>Category:</strong> Auto-bundle from categories<br/>  
                    • <strong>AI Suggested:</strong> Smart recommendations with approval workflow
                  </Text>
                </Banner>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">All Bundles</Text>
                  <Badge tone="info">
                    {bundles.length} Bundle{bundles.length === 1 ? '' : 's'}
                  </Badge>
                </InlineStack>
                
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'numeric', 'numeric', 'text']}
                  headings={['Bundle Name', 'Type', 'Status', 'Discount', 'Purchases', 'Revenue', 'Actions']}
                  rows={bundleTableRows}
                />
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">🎯 Bundle Strategy</Text>
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
              <Text as="h3" variant="headingSm">💡 Best Practices</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Start with 10-15% discounts<br/>
                • Use AI bundles for cross-sell discovery<br/>
                • Test manual bundles for key products<br/>
                • Monitor performance in Dashboard<br/>
                • A/B test different discount rates
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Create Bundle Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Create New Bundle"
        primaryAction={{
          content: 'Create Bundle',
          disabled: !bundleForm.name.trim(),
          onAction: handleSubmit
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => {
            setShowCreateModal(false);
            resetForm();
          }
        }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Bundle Name"
              value={bundleForm.name}
              onChange={(value) => setBundleForm({...bundleForm, name: value})}
              placeholder="e.g., Summer Beach Essentials"
              autoComplete="off"
              helpText="This name will be shown to customers"
            />

            <TextField
              label="Description (Optional)"
              value={bundleForm.description}
              onChange={(value) => setBundleForm({...bundleForm, description: value})}
              placeholder="Brief description of the bundle"
              multiline={2}
              autoComplete="off"
            />

            <Select
              label="Bundle Type"
              options={bundleTypeOptions}
              value={bundleForm.type}
              onChange={(value) => setBundleForm({...bundleForm, type: value})}
              helpText="Manual bundles require product selection after creation"
            />

            <InlineStack gap="400">
              <Select
                label="Discount Type"
                options={discountTypeOptions}
                value={bundleForm.discountType}
                onChange={(value) => setBundleForm({...bundleForm, discountType: value})}
              />
              <TextField
                label={bundleForm.discountType === 'percentage' ? "Discount %" : "Discount $"}
                type="number"
                value={bundleForm.discountValue.toString()}
                onChange={(value) => setBundleForm({
                  ...bundleForm, 
                  discountValue: parseFloat(value) || 0
                })}
                suffix={bundleForm.discountType === 'percentage' ? '%' : '$'}
                autoComplete="off"
              />
            </InlineStack>

            <TextField
              label="Minimum Products"
              type="number"
              value={bundleForm.minProducts.toString()}
              onChange={(value) => setBundleForm({
                ...bundleForm, 
                minProducts: parseInt(value) || 2
              })}
              helpText="Minimum number of products required for bundle discount"
              autoComplete="off"
            />

            <Banner tone="info">
              <Text as="p" variant="bodyMd">
                After creating the bundle, you'll be able to select specific products, configure advanced settings, and set up approval workflows.
              </Text>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}