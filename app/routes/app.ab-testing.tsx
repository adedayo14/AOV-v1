
import { useState, useEffect } from "react";
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
  Select,
  Checkbox,
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
  const [experimentDescription, setExperimentDescription] = useState("");
  const [testType, setTestType] = useState<'discount' | 'free_shipping' | 'bundle'>("discount");
  const [primaryMetric, setPrimaryMetric] = useState<'conversion_rate' | 'average_order_value' | 'revenue_per_visitor'>("conversion_rate");
  const [confidenceLevelPct, setConfidenceLevelPct] = useState<string>("95");
  const [minSampleSize, setMinSampleSize] = useState<string>("100");
  const [trafficAllocationPct, setTrafficAllocationPct] = useState<string>("100");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Variant A (Control)
  const [variantAName, setVariantAName] = useState<string>("Control");
  const [variantAPct, setVariantAPct] = useState<string>("50");
  const [variantADesc, setVariantADesc] = useState<string>("");
  const [variantADiscountType, setVariantADiscountType] = useState<'percentage' | 'fixed'>("percentage");
  const [variantADiscountValue, setVariantADiscountValue] = useState<string>("0");
  const [variantAFreeShipThreshold, setVariantAFreeShipThreshold] = useState<string>("0");
  const [variantABundleId, setVariantABundleId] = useState<string>("");

  // Variant B (Challenger)
  const [variantBName, setVariantBName] = useState<string>("Variant B");
  const [variantBPct, setVariantBPct] = useState<string>("50");
  const [variantBDesc, setVariantBDesc] = useState<string>("");
  const [variantBDiscountType, setVariantBDiscountType] = useState<'percentage' | 'fixed'>("percentage");
  const [variantBDiscountValue, setVariantBDiscountValue] = useState<string>("10");
  const [variantBFreeShipThreshold, setVariantBFreeShipThreshold] = useState<string>("0");
  const [variantBBundleId, setVariantBBundleId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [activateNow, setActivateNow] = useState(true);

  // Fix React #418 hydration errors by rendering dates/badges only on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleOpenCreateModal = () => setIsCreateModalOpen(true);
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setExperimentName("");
    setExperimentDescription("");
    setTestType('discount');
    setPrimaryMetric('conversion_rate');
    setConfidenceLevelPct('95');
    setMinSampleSize('100');
    setTrafficAllocationPct('100');
    setStartDate("");
    setEndDate("");
    setVariantAName('Control');
    setVariantAPct('50');
    setVariantADesc("");
    setVariantADiscountType('percentage');
    setVariantADiscountValue('0');
    setVariantAFreeShipThreshold('0');
    setVariantABundleId("");
    setVariantBName('Variant B');
    setVariantBPct('50');
    setVariantBDesc("");
    setVariantBDiscountType('percentage');
    setVariantBDiscountValue('10');
    setVariantBFreeShipThreshold('0');
    setVariantBBundleId("");
    setActivateNow(true);
  };

  const handleCreateExperiment = async () => {
    if (!experimentName.trim()) {
      setShowErrorBanner(true);
      setBannerMessage("Experiment name is required.");
      setTimeout(() => setShowErrorBanner(false), 3000);
      return;
    }
    // Validate variant percentages sum to 100
    const aPct = Number(variantAPct);
    const bPct = Number(variantBPct);
    if (Number.isNaN(aPct) || Number.isNaN(bPct) || aPct + bPct !== 100) {
      setShowErrorBanner(true);
      setBannerMessage("Variant traffic must sum to 100%.");
      setTimeout(() => setShowErrorBanner(false), 4000);
      return;
    }
    // Validate numeric inputs
    if (Number.isNaN(Number(confidenceLevelPct)) || Number.isNaN(Number(minSampleSize)) || Number.isNaN(Number(trafficAllocationPct))) {
      setShowErrorBanner(true);
      setBannerMessage("Please enter valid numbers for confidence level, sample size, and traffic allocation.");
      setTimeout(() => setShowErrorBanner(false), 4000);
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
      
      // Build experiment + variants payload
      const exp = {
        name: experimentName.trim(),
        description: experimentDescription.trim() || null,
        testType,
        primaryMetric,
        confidenceLevelPct: Number(confidenceLevelPct),
        minSampleSize: Number(minSampleSize),
        trafficAllocationPct: Number(trafficAllocationPct),
        startDate: startDate || null,
        endDate: endDate || null,
        status: activateNow ? 'active' as const : 'draft' as const,
      };

      const variantConfigs = (variant: 'A' | 'B') => {
        if (testType === 'discount') {
          const type = variant === 'A' ? variantADiscountType : variantBDiscountType;
          const val = variant === 'A' ? variantADiscountValue : variantBDiscountValue;
          // Optional discount code mapping for checkout apply
          const codeFieldId = variant === 'A' ? 'cu_variantA_discountCode' : 'cu_variantB_discountCode';
          const codeEl = document.getElementById(codeFieldId) as HTMLInputElement | null;
          const discountCode = codeEl?.value?.trim() || undefined;
          return { discountType: type, discountValue: Number(val), ...(discountCode ? { discountCode } : {}) };
        }
        if (testType === 'free_shipping') {
          const thr = variant === 'A' ? variantAFreeShipThreshold : variantBFreeShipThreshold;
          return { freeShippingThreshold: Number(thr) };
        }
        if (testType === 'bundle') {
          const id = variant === 'A' ? variantABundleId : variantBBundleId;
          return { bundleId: id };
        }
        return {};
      };

      const variants = [
        {
          name: variantAName.trim() || 'Control',
          description: variantADesc.trim() || null,
          isControl: true,
          trafficPercentage: Number(variantAPct),
          config: variantConfigs('A'),
        },
        {
          name: variantBName.trim() || 'Variant B',
          description: variantBDesc.trim() || null,
          isControl: false,
          trafficPercentage: Number(variantBPct),
          config: variantConfigs('B'),
        }
      ];

      const payload = { action: 'create', shop, experiment: exp, variants };

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
  };

  const handleDeleteExperiment = async (experimentId: number) => {
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
  };

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
              <TextField label="Experiment Name" value={experimentName} onChange={setExperimentName} autoComplete="off" placeholder="e.g., Free Shipping vs. 10% Off" />
              <TextField label="Description" value={experimentDescription} onChange={setExperimentDescription} autoComplete="off" multiline={2} />
              <FormLayout.Group>
                <Select label="Test Type" value={testType} onChange={(v) => setTestType(v as any)} options={[
                  { label: 'Discount', value: 'discount' },
                  { label: 'Free Shipping', value: 'free_shipping' },
                  { label: 'Bundle', value: 'bundle' },
                ]} />
                <Select label="Primary Metric" value={primaryMetric} onChange={(v) => setPrimaryMetric(v as any)} options={[
                  { label: 'Conversion Rate', value: 'conversion_rate' },
                  { label: 'Average Order Value', value: 'average_order_value' },
                  { label: 'Revenue per Visitor', value: 'revenue_per_visitor' },
                ]} />
              </FormLayout.Group>

              <Checkbox label="Activate now" checked={activateNow} onChange={(v) => setActivateNow(!!v)} />

              <FormLayout.Group>
                <TextField label="Confidence Level (%)" value={confidenceLevelPct} onChange={setConfidenceLevelPct} type="number" suffix="%" autoComplete="off" />
                <TextField label="Min Sample Size" value={minSampleSize} onChange={setMinSampleSize} type="number" autoComplete="off" />
                <TextField label="Traffic Allocation (%)" value={trafficAllocationPct} onChange={setTrafficAllocationPct} type="number" suffix="%" autoComplete="off" />
              </FormLayout.Group>

              <FormLayout.Group>
                <TextField label="Start Date" value={startDate} onChange={setStartDate} type="date" autoComplete="off" />
                <TextField label="End Date" value={endDate} onChange={setEndDate} type="date" autoComplete="off" />
              </FormLayout.Group>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Variant A (Control)</Text>
                  <FormLayout.Group>
                    <TextField label="Name" value={variantAName} onChange={setVariantAName} autoComplete="off" />
                    <TextField label="Traffic %" value={variantAPct} onChange={setVariantAPct} type="number" suffix="%" autoComplete="off" />
                  </FormLayout.Group>
                  <TextField label="Description" value={variantADesc} onChange={setVariantADesc} multiline={2} autoComplete="off" />
                  {testType === 'discount' && (
                    <FormLayout.Group>
                      <Select label="Discount Type" value={variantADiscountType} onChange={(v) => setVariantADiscountType(v as any)} options={[{ label: 'Percentage', value: 'percentage' }, { label: 'Fixed', value: 'fixed' }]} />
                      <TextField label="Discount Value" value={variantADiscountValue} onChange={setVariantADiscountValue} type="number" autoComplete="off" />
                      <TextField id="cu_variantA_discountCode" label="Discount Code (optional)" value={(document.getElementById('cu_variantA_discountCode') as HTMLInputElement)?.value || ''} onChange={() => { /* value read at submit */ }} autoComplete="off" helpText="If provided, this code will be applied at checkout for Variant A" />
                    </FormLayout.Group>
                  )}
                  {testType === 'free_shipping' && (
                    <TextField label="Free Shipping Threshold" value={variantAFreeShipThreshold} onChange={setVariantAFreeShipThreshold} type="number" prefix="$" autoComplete="off" />
                  )}
                  {testType === 'bundle' && (
                    <TextField label="Bundle ID" value={variantABundleId} onChange={setVariantABundleId} autoComplete="off" />
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">Variant B (Challenger)</Text>
                  <FormLayout.Group>
                    <TextField label="Name" value={variantBName} onChange={setVariantBName} autoComplete="off" />
                    <TextField label="Traffic %" value={variantBPct} onChange={setVariantBPct} type="number" suffix="%" autoComplete="off" />
                  </FormLayout.Group>
                  <TextField label="Description" value={variantBDesc} onChange={setVariantBDesc} multiline={2} autoComplete="off" />
                  {testType === 'discount' && (
                    <FormLayout.Group>
                      <Select label="Discount Type" value={variantBDiscountType} onChange={(v) => setVariantBDiscountType(v as any)} options={[{ label: 'Percentage', value: 'percentage' }, { label: 'Fixed', value: 'fixed' }]} />
                      <TextField label="Discount Value" value={variantBDiscountValue} onChange={setVariantBDiscountValue} type="number" autoComplete="off" />
                      <TextField id="cu_variantB_discountCode" label="Discount Code (optional)" value={(document.getElementById('cu_variantB_discountCode') as HTMLInputElement)?.value || ''} onChange={() => { /* value read at submit */ }} autoComplete="off" helpText="If provided, this code will be applied at checkout for Variant B" />
                    </FormLayout.Group>
                  )}
                  {testType === 'free_shipping' && (
                    <TextField label="Free Shipping Threshold" value={variantBFreeShipThreshold} onChange={setVariantBFreeShipThreshold} type="number" prefix="$" autoComplete="off" />
                  )}
                  {testType === 'bundle' && (
                    <TextField label="Bundle ID" value={variantBBundleId} onChange={setVariantBBundleId} autoComplete="off" />
                  )}
                </BlockStack>
              </Card>
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
