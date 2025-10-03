
import { useState, useCallback, useEffect } from "react";
import { json, LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Button,
  Modal,
  Form,
  FormLayout,
  TextField,
  Text,
  EmptyState,
  Card,
  InlineStack,
  BlockStack,
  Badge,
  ButtonGroup,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// This interface matches the data structure after JSON serialization from the loader.
// Prisma's Decimal and Date types are converted to strings.
interface SerializedABExperiment {
  id: number;
  name: string;
  status: string;
  testType: string;
  createdAt: string;
  updatedAt: string;
  shopId: string;
  description: string | null;
  trafficAllocation: string;
  startDate: string | null;
  endDate: string | null;
  variants: any; // You might want to type this more strictly
  createdBy: string | null;
}

// Loader to fetch existing experiments
export const loader: LoaderFunction = async ({ request }) => {
  try {
    await authenticate.admin(request);
    const experiments = await prisma.aBExperiment.findMany({
      orderBy: { createdAt: "desc" },
    });
    // Serialize Date and Decimal fields to be JSON-safe
    return json(experiments.map(exp => ({ 
    ...exp, 
    createdAt: exp.createdAt.toISOString(), 
    updatedAt: exp.updatedAt.toISOString(),
    // Convert Decimal to string for JSON serialization
    trafficAllocation: exp.trafficAllocation.toString(),
  })));
  } catch (error) {
    console.error("Error loading A/B experiments:", error);
    return json([]);
  }
};

export default function ABTestingPage() {
  const experiments = useLoaderData<SerializedABExperiment[]>();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [experimentName, setExperimentName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");

  // Fix React #418 hydration errors by rendering dates/badges only on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleOpenCreateModal = () => setIsCreateModalOpen(true);
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setExperimentName("");
  };

  const handleCreateExperiment = useCallback(async () => {
    if (!experimentName.trim()) {
      setShowErrorBanner(true);
      setBannerMessage("Experiment name is required.");
      setTimeout(() => setShowErrorBanner(false), 3000);
      return;
    }
    setIsLoading(true);
    setShowErrorBanner(false);
    setShowSuccessBanner(false);
    console.log("[A/B Testing UI] Starting experiment creation...");

    try {
      // Get shop from URL (same as Settings pattern)
      const urlParams = new URLSearchParams(window.location.search);
      const shop = urlParams.get('shop') || '';
      const sessionToken = urlParams.get('id_token') || '';
      
      // Use JSON payload like Settings does
      const payload = {
        action: 'create',
        name: experimentName,
        shop: shop
      };

      const endpoint = `${window.location.origin}/api/ab-testing-admin`;
      console.log("[A/B Testing UI] Sending request to", endpoint);
      console.log("[A/B Testing UI] Payload:", payload);
      console.log("[A/B Testing UI] Session token present:", !!sessionToken);
      console.log("[A/B Testing UI] Current URL:", window.location.href);
      
      // Add timeout to avoid hanging forever
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      console.log(`[A/B Testing UI] Received response with status: ${response.status}`);
      console.log('[A/B Testing UI] Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[A/B Testing UI] Server responded with an error:", errorText);
        throw new Error(`Server error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("[A/B Testing UI] Experiment created successfully:", result);
      
      setShowSuccessBanner(true);
      setBannerMessage("Experiment created successfully!");
      handleCloseCreateModal();
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error("[A/B Testing UI] An error occurred during fetch:", error);
      if ((error as any)?.name === 'AbortError') {
        console.error('[A/B Testing UI] Request aborted due to timeout');
      }
      setShowErrorBanner(true);
      setBannerMessage("Failed to create experiment.");
      setTimeout(() => setShowErrorBanner(false), 5000);
    } finally {
      setIsLoading(false);
      console.log("[A/B Testing UI] Experiment creation process finished.");
    }
  }, [experimentName]);

  const handleDeleteExperiment = useCallback(async (experimentId: number) => {
    console.log('[A/B Testing UI] Delete button clicked for experiment:', experimentId);
    
    if (!confirm('Are you sure you want to delete this experiment?')) {
      console.log('[A/B Testing UI] User cancelled delete');
      return;
    }
    
    setShowErrorBanner(false);
    setShowSuccessBanner(false);
    
    try {
      const url = new URL(window.location.href);
      const shop = url.searchParams.get('shop');
      const sessionToken = url.searchParams.get('id_token') || '';
      console.log('[A/B Testing UI] Shop parameter:', shop);
      
      const payload = { action: 'delete', experimentId, shop };
      console.log('[A/B Testing UI] Sending delete request with payload:', payload);
      const endpoint = `${window.location.origin}/api/ab-testing-admin`;
      console.log('[A/B Testing UI] Delete endpoint:', endpoint);
      console.log('[A/B Testing UI] Session token present:', !!sessionToken);
      
      // Add timeout to avoid hanging forever
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      console.log('[A/B Testing UI] Delete response status:', response.status);
      console.log('[A/B Testing UI] Delete response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const result = await response.json();
        console.log('[A/B Testing UI] Delete successful:', result);
        
        setShowSuccessBanner(true);
        setBannerMessage('Experiment deleted successfully');
        
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        const errorText = await response.text();
        console.error('[A/B Testing UI] Delete failed:', errorText);
        
        setShowErrorBanner(true);
        setBannerMessage('Failed to delete experiment');
        setTimeout(() => setShowErrorBanner(false), 5000);
      }
    } catch (error) {
      console.error('[A/B Testing UI] Delete error:', error);
      if ((error as any)?.name === 'AbortError') {
        console.error('[A/B Testing UI] Delete request aborted due to timeout');
      }
      
      setShowErrorBanner(true);
      setBannerMessage('Failed to delete experiment');
      setTimeout(() => setShowErrorBanner(false), 5000);
    }
  }, []);

  return (
    <Page
      title="A/B Testing"
      subtitle="✅ UPDATED Oct 3, 2025 - NO App Bridge - Direct fetch like Settings"
      primaryAction={{
        content: "Create Experiment",
        onAction: handleOpenCreateModal
      }}
    >
      <Layout>
        {showSuccessBanner && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setShowSuccessBanner(false)}>
              {bannerMessage}
            </Banner>
          </Layout.Section>
        )}
        {showErrorBanner && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setShowErrorBanner(false)}>
              {bannerMessage}
            </Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          {experiments.length > 0 ? (
            <Card>
              <BlockStack gap="400">
                {experiments.map((exp) => (
                  <Card key={exp.id}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="200">
                          <Text variant="headingMd" as="h3">{exp.name}</Text>
                          {isClient && (
                            <InlineStack gap="200">
                              <Badge tone={exp.status === 'active' ? 'success' : exp.status === 'paused' ? 'warning' : 'info'}>
                                {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                              </Badge>
                              <Text as="span" tone="subdued">Type: {exp.testType}</Text>
                              <Text as="span" tone="subdued">Created: {new Date(exp.createdAt).toLocaleDateString()}</Text>
                            </InlineStack>
                          )}
                        </BlockStack>
                        <ButtonGroup>
                          <Button size="slim" onClick={() => {}}>View Details</Button>
                          <Button 
                            size="slim" 
                            tone="critical" 
                            onClick={() => handleDeleteExperiment(exp.id)}
                          >
                            Delete
                          </Button>
                        </ButtonGroup>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <EmptyState
                heading="No A/B experiments yet"
                action={{ content: "Create Experiment", onAction: handleOpenCreateModal }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create your first A/B test to compare different strategies and boost your sales.</p>
              </EmptyState>
            </Card>
          )}
        </Layout.Section>
      </Layout>

      <Modal
        open={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Create New A/B Experiment"
        primaryAction={{
          content: "Create",
          onAction: handleCreateExperiment,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleCloseCreateModal,
            disabled: isLoading,
          },
        ]}
      >
        <Modal.Section>
          <Form onSubmit={handleCreateExperiment}>
            <FormLayout>
              <TextField
                label="Experiment Name"
                value={experimentName}
                onChange={setExperimentName}
                autoComplete="off"
                placeholder="e.g., Free Shipping vs. 10% Off"
              />
              <Text variant="bodyMd" as="p" tone="subdued">
                This will be the name of your A/B test.
              </Text>
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
