import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useState, useEffect } from "react";
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
  Box,
  Divider,
  Toast,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface ABExperiment {
  id: number;
  shopId: string;
  name: string;
  description?: string;
  testType: string;
  status: string;
  trafficAllocation: number;
  primaryMetric: string;
  confidenceLevel: number;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  variants?: ABVariant[];
  results?: ExperimentResults;
}

interface ABVariant {
  id: number;
  experimentId: number;
  name: string;
  description?: string;
  trafficPercentage: number;
  isControl: boolean;
  configData: string;
  totalVisitors: number;
  totalConversions: number;
  totalRevenue: number;
  createdAt: Date;
}

interface ExperimentResults {
  is_significant: boolean;
  p_value: number | null;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  conversion_rate_lift: number;
  revenue_lift: number;
  winner_variant_id?: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  try {
    // Fetch existing A/B experiments for this shop
    const experiments = await prisma.aBExperiment.findMany({
      where: { shopId: session.shop },
      include: {
        variants: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate results for each experiment
    const experimentsWithResults = experiments.map((exp: any) => {
      const results = _computeExperimentResults(exp.variants);
      return { 
        ...exp,
        results,
        trafficAllocation: Number(exp.trafficAllocation),
        confidenceLevel: Number(exp.confidenceLevel),
        variants: exp.variants.map((v: any) => ({
          ...v,
          trafficPercentage: Number(v.trafficPercentage),
          totalRevenue: Number(v.totalRevenue),
        }))
      };
    });
    
    console.log("A/B testing: Loaded", experimentsWithResults.length, "experiments for shop", session.shop);
    
    return json({ 
      experiments: experimentsWithResults,
      shop: session.shop
    });
  } catch (error) {
    console.error("A/B testing loader error:", error);
    return json({ 
      experiments: [] as ABExperiment[],
      shop: session.shop,
      error: error instanceof Error ? error.message : "Failed to load A/B experiments"
    });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    switch (intent) {
      case "create": {
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const testType = formData.get("testType") as string;
        const trafficAllocation = Number(formData.get("trafficAllocation") || 100);
        
        // Parse variants
        const variantsData = JSON.parse(formData.get("variants") as string);
        
        // Create experiment with variants
        const experiment = await prisma.aBExperiment.create({
          data: {
            shopId: session.shop,
            name,
            description,
            testType,
            trafficAllocation,
            status: "draft",
            primaryMetric: "conversion_rate",
            confidenceLevel: 0.95,
            minSampleSize: 100,
            variants: {
              create: variantsData.map((v: any, index: number) => ({
                name: v.name,
                description: v.description || "",
                trafficPercentage: v.trafficPercentage,
                isControl: index === 0, // First variant is control
                configData: JSON.stringify(v.config),
                totalVisitors: 0,
                totalConversions: 0,
                totalRevenue: 0,
              }))
            }
          },
          include: {
            variants: true
          }
        });

        return json({ 
          success: true, 
          message: "Experiment created successfully",
          experiment 
        });
      }

      case "update": {
        const experimentId = Number(formData.get("experimentId"));
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const status = formData.get("status") as string;
        
        const experiment = await prisma.aBExperiment.update({
          where: { id: experimentId },
          data: {
            name,
            description,
            status,
            updatedAt: new Date(),
          },
          include: {
            variants: true
          }
        });

        return json({ 
          success: true, 
          message: "Experiment updated successfully",
          experiment 
        });
      }

      case "toggle": {
        const experimentId = Number(formData.get("experimentId"));
        
        const currentExp = await prisma.aBExperiment.findUnique({
          where: { id: experimentId }
        });

        if (!currentExp) {
          return json({ error: "Experiment not found" }, { status: 404 });
        }

        const newStatus = currentExp.status === "active" ? "paused" : "active";
        const updateData: any = {
          status: newStatus,
          updatedAt: new Date(),
        };

        // Set startDate when activating
        if (newStatus === "active" && !currentExp.startDate) {
          updateData.startDate = new Date();
        }

        const experiment = await prisma.aBExperiment.update({
          where: { id: experimentId },
          data: updateData,
          include: {
            variants: true
          }
        });

        return json({ 
          success: true, 
          message: `Experiment ${newStatus === "active" ? "started" : "paused"}`,
          experiment 
        });
      }

      case "delete": {
        const experimentId = Number(formData.get("experimentId"));
        
        await prisma.aBExperiment.delete({
          where: { id: experimentId }
        });

        return json({ 
          success: true, 
          message: "Experiment deleted successfully" 
        });
      }

      case "stop": {
        const experimentId = Number(formData.get("experimentId"));
        
        const experiment = await prisma.aBExperiment.update({
          where: { id: experimentId },
          data: {
            status: "completed",
            endDate: new Date(),
            updatedAt: new Date(),
          },
          include: {
            variants: true
          }
        });

        return json({ 
          success: true, 
          message: "Experiment stopped and marked as completed",
          experiment 
        });
      }

      default:
        return json({ error: "Invalid intent" }, { status: 400 });
    }
  } catch (error) {
    console.error("A/B testing action error:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Action failed" 
    }, { status: 500 });
  }
};

// Helper function to compute experiment results
function _computeExperimentResults(variants: ABVariant[]): ExperimentResults | undefined {
  if (!variants || variants.length < 2) return undefined;
  
  const control = variants.find(v => v.isControl) || variants[0];
  const challenger = variants.find(v => !v.isControl) || variants[1];

  const controlRate = conversionRate(control.totalConversions, control.totalVisitors);
  const challengerRate = conversionRate(challenger.totalConversions, challenger.totalVisitors);
  
  const conversionLift = controlRate > 0 ? ((challengerRate - controlRate) / controlRate) * 100 : 0;
  
  const controlRevenue = Number(control.totalRevenue) / Math.max(control.totalVisitors, 1);
  const challengerRevenue = Number(challenger.totalRevenue) / Math.max(challenger.totalVisitors, 1);
  const revenueLift = controlRevenue > 0 ? ((challengerRevenue - controlRevenue) / controlRevenue) * 100 : 0;

  const { isSignificant, pValue, ciLower, ciUpper } = _calculateSignificance(control, challenger);

  return {
    is_significant: isSignificant,
    p_value: pValue,
    confidence_interval_lower: ciLower,
    confidence_interval_upper: ciUpper,
    conversion_rate_lift: conversionLift,
    revenue_lift: revenueLift,
    winner_variant_id: isSignificant && challengerRate > controlRate ? challenger.id : undefined
  };
}

function conversionRate(conversions: number, visitors: number): number {
  return visitors > 0 ? (conversions / visitors) * 100 : 0;
}

function _calculateSignificance(control: ABVariant, challenger: ABVariant) {
  const n1 = control.totalVisitors ?? 0;
  const n2 = challenger.totalVisitors ?? 0;
  const conv1 = control.totalConversions ?? 0;
  const conv2 = challenger.totalConversions ?? 0;

  if (n1 < 30 || n2 < 30) {
    return { isSignificant: false, pValue: null, ciLower: 0, ciUpper: 0 };
  }

  const p1 = conversionRate(conv1, n1) / 100;
  const p2 = conversionRate(conv2, n2) / 100;
  const pooled = (conv1 + conv2) / (n1 + n2);
  const stdErr = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));

  if (!Number.isFinite(stdErr) || stdErr === 0) {
    return { isSignificant: false, pValue: null, ciLower: 0, ciUpper: 0 };
  }

  const zScore = (p2 - p1) / stdErr;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));

  const diff = p2 - p1;
  const seDiff = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const margin = 1.96 * seDiff;
  const ciLower = (diff - margin) * 100;
  const ciUpper = (diff + margin) * 100;

  return {
    isSignificant: pValue < 0.05,
    pValue,
    ciLower,
    ciUpper
  };
}

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

export default function ABTestingPage() {
  const loaderData = useLoaderData<typeof loader>();
  const { experiments: initialExperiments } = loaderData;
  const loadError = 'error' in loaderData ? (loaderData as any).error : undefined;
  const fetcher = useFetcher<any>();
  
  const [experiments, setExperiments] = useState<ABExperiment[]>(initialExperiments || []);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<ABExperiment | null>(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  // Form state for creating experiment
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    testType: "free_shipping",
    trafficAllocation: 100,
    variants: [
      { name: "Control (Original)", description: "", trafficPercentage: 50, config: { threshold: 50 } },
      { name: "Variant A", description: "", trafficPercentage: 50, config: { threshold: 75 } },
    ]
  });

  // Update local state when fetcher returns success
  useEffect(() => {
    if (fetcher.data?.success) {
      setToastMessage(fetcher.data.message);
      setToastActive(true);
      
      // Refresh experiments list
      if (fetcher.data.experiment) {
        const exp = fetcher.data.experiment;
        setExperiments(prev => {
          const exists = prev.find(e => e.id === exp.id);
          if (exists) {
            return prev.map(e => e.id === exp.id ? exp : e);
          } else {
            return [exp, ...prev];
          }
        });
      }
      
      // Close modals
      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingExperiment(null);
    }
  }, [fetcher.data]);

  // Reload from loader data
  useEffect(() => {
    if (initialExperiments) {
      setExperiments(initialExperiments);
    }
  }, [initialExperiments]);

  const handleCreateExperiment = () => {
    const data = new FormData();
    data.append("intent", "create");
    data.append("name", formData.name);
    data.append("description", formData.description);
    data.append("testType", formData.testType);
    data.append("trafficAllocation", formData.trafficAllocation.toString());
    data.append("variants", JSON.stringify(formData.variants));
    
    fetcher.submit(data, { method: "post" });
  };

  const handleToggleExperiment = (experimentId: number) => {
    const data = new FormData();
    data.append("intent", "toggle");
    data.append("experimentId", experimentId.toString());
    fetcher.submit(data, { method: "post" });
  };

  const handleStopExperiment = (experimentId: number) => {
    const data = new FormData();
    data.append("intent", "stop");
    data.append("experimentId", experimentId.toString());
    fetcher.submit(data, { method: "post" });
  };

  const handleDeleteExperiment = (experimentId: number) => {
    if (confirm("Are you sure you want to delete this experiment? This action cannot be undone.")) {
      const data = new FormData();
      data.append("intent", "delete");
      data.append("experimentId", experimentId.toString());
      fetcher.submit(data, { method: "post" });
      
      // Optimistically update UI
      setExperiments(prev => prev.filter(e => e.id !== experimentId));
    }
  };

  const handleEditExperiment = (experiment: ABExperiment) => {
    setEditingExperiment(experiment);
    setShowEditModal(true);
  };

  const handleUpdateExperiment = () => {
    if (!editingExperiment) return;
    
    const data = new FormData();
    data.append("intent", "update");
    data.append("experimentId", editingExperiment.id.toString());
    data.append("name", editingExperiment.name);
    data.append("description", editingExperiment.description || "");
    data.append("status", editingExperiment.status);
    
    fetcher.submit(data, { method: "post" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge tone="success">Active</Badge>;
      case "paused":
        return <Badge tone="attention">Paused</Badge>;
      case "completed":
        return <Badge>Completed</Badge>;
      case "draft":
      default:
        return <Badge tone="info">Draft</Badge>;
    }
  };

  const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";

  return (
    <Page fullWidth>
      <TitleBar title="A/B Testing" />
      
      <BlockStack gap="500">
        {loadError && (
          <Banner tone="critical">
            <p>{loadError}</p>
          </Banner>
        )}

        {/* Header */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="200">
                <Text variant="headingLg" as="h1">A/B Testing Experiments</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Test different cart configurations to optimize conversions and revenue.
                </Text>
              </BlockStack>
              <Button 
                variant="primary" 
                onClick={() => setShowCreateModal(true)}
                disabled={isLoading}
              >
                Create New Test
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Experiments List */}
        {experiments.length === 0 ? (
          <Card>
            <EmptyState
              heading="No A/B tests yet"
              action={{
                content: "Create Your First Test",
                onAction: () => setShowCreateModal(true)
              }}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Start testing different cart features to find what works best for your store.</p>
            </EmptyState>
          </Card>
        ) : (
          <Layout>
            {experiments.map((experiment) => (
              <Layout.Section key={experiment.id}>
                <Card>
                  <BlockStack gap="400">
                    {/* Experiment Header */}
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="200">
                        <InlineStack gap="300" blockAlign="center">
                          <Text variant="headingMd" as="h2">{experiment.name}</Text>
                          {getStatusBadge(experiment.status)}
                        </InlineStack>
                        {experiment.description && (
                          <Text variant="bodyMd" as="p" tone="subdued">
                            {experiment.description}
                          </Text>
                        )}
                        <InlineStack gap="400">
                          <Text variant="bodySm" as="span" tone="subdued">
                            Type: {experiment.testType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Text>
                          <Text variant="bodySm" as="span" tone="subdued">
                            Traffic: {Math.round(Number(experiment.trafficAllocation))}%
                          </Text>
                          {experiment.startDate && (
                            <Text variant="bodySm" as="span" tone="subdued">
                              Started: {new Date(experiment.startDate).toLocaleDateString()}
                            </Text>
                          )}
                        </InlineStack>
                      </BlockStack>
                      
                      <ButtonGroup>
                        {experiment.status === "active" && (
                          <Button 
                            onClick={() => handleToggleExperiment(experiment.id)}
                            disabled={isLoading}
                          >
                            Pause
                          </Button>
                        )}
                        {(experiment.status === "draft" || experiment.status === "paused") && (
                          <Button 
                            onClick={() => handleToggleExperiment(experiment.id)}
                            disabled={isLoading}
                            variant="primary"
                          >
                            {experiment.status === "draft" ? "Start" : "Resume"}
                          </Button>
                        )}
                        {experiment.status === "active" && (
                          <Button 
                            onClick={() => handleStopExperiment(experiment.id)}
                            disabled={isLoading}
                            tone="critical"
                          >
                            Stop Test
                          </Button>
                        )}
                        <Button 
                          onClick={() => handleEditExperiment(experiment)}
                          disabled={isLoading || experiment.status === "active"}
                        >
                          Edit
                        </Button>
                        <Button 
                          onClick={() => handleDeleteExperiment(experiment.id)}
                          disabled={isLoading || experiment.status === "active"}
                          tone="critical"
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </InlineStack>

                    <Divider />

                    {/* Variants Performance */}
                    {experiment.variants && experiment.variants.length > 0 && (
                      <Box>
                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h3">Variant Performance</Text>
                          <DataTable
                            columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric']}
                            headings={['Variant', 'Traffic %', 'Visitors', 'Conversions', 'Conv. Rate', 'Revenue']}
                            rows={experiment.variants.map(variant => [
                              <InlineStack gap="200" blockAlign="center" key={variant.id}>
                                <Text variant="bodyMd" as="span">{variant.name}</Text>
                                {variant.isControl && <Badge tone="info">Control</Badge>}
                              </InlineStack>,
                              `${Math.round(Number(variant.trafficPercentage))}%`,
                              variant.totalVisitors.toString(),
                              variant.totalConversions.toString(),
                              `${conversionRate(variant.totalConversions, variant.totalVisitors).toFixed(2)}%`,
                              `$${Number(variant.totalRevenue).toFixed(2)}`
                            ])}
                          />
                        </BlockStack>
                      </Box>
                    )}

                    {/* Results Summary */}
                    {experiment.results && experiment.variants && experiment.variants.length >= 2 && (
                      <Box>
                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h3">Test Results</Text>
                          <InlineStack gap="400">
                            <Box>
                              <Text variant="bodySm" as="p" tone="subdued">Conversion Lift</Text>
                              <Text variant="headingMd" as="p">
                                {experiment.results.conversion_rate_lift > 0 ? '+' : ''}
                                {experiment.results.conversion_rate_lift.toFixed(2)}%
                              </Text>
                            </Box>
                            <Box>
                              <Text variant="bodySm" as="p" tone="subdued">Revenue Lift</Text>
                              <Text variant="headingMd" as="p">
                                {experiment.results.revenue_lift > 0 ? '+' : ''}
                                {experiment.results.revenue_lift.toFixed(2)}%
                              </Text>
                            </Box>
                            <Box>
                              <Text variant="bodySm" as="p" tone="subdued">Statistical Significance</Text>
                              <Text variant="headingMd" as="p">
                                {experiment.results.is_significant ? (
                                  <Badge tone="success">Significant</Badge>
                                ) : (
                                  <Badge tone="attention">Not Yet</Badge>
                                )}
                              </Text>
                            </Box>
                            {experiment.results.p_value !== null && (
                              <Box>
                                <Text variant="bodySm" as="p" tone="subdued">P-Value</Text>
                                <Text variant="bodyMd" as="p">
                                  {experiment.results.p_value.toFixed(4)}
                                </Text>
                              </Box>
                            )}
                          </InlineStack>
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            ))}
          </Layout>
        )}
      </BlockStack>

      {/* Create Experiment Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New A/B Test"
        primaryAction={{
          content: "Create Test",
          onAction: handleCreateExperiment,
          disabled: !formData.name || isLoading,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowCreateModal(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Test Name"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="e.g., Free Shipping Threshold Test"
              autoComplete="off"
            />
            
            <TextField
              label="Description (optional)"
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder="What are you testing?"
              multiline={3}
              autoComplete="off"
            />

            <Select
              label="Test Type"
              options={[
                { label: "Free Shipping Threshold", value: "free_shipping" },
                { label: "Product Recommendations", value: "recommendations" },
                { label: "Cart Design", value: "cart_design" },
                { label: "Discount Messaging", value: "discount_messaging" },
                { label: "Urgency Messages", value: "urgency" },
              ]}
              value={formData.testType}
              onChange={(value) => setFormData({ ...formData, testType: value })}
            />

            <TextField
              label="Traffic Allocation (%)"
              type="number"
              value={formData.trafficAllocation.toString()}
              onChange={(value) => setFormData({ ...formData, trafficAllocation: Number(value) || 100 })}
              min={10}
              max={100}
              helpText="Percentage of users who will see this test"
              autoComplete="off"
            />

            <Divider />

            <Text variant="headingSm" as="h3">Variants</Text>
            
            {formData.variants.map((variant, index) => (
              <Card key={index}>
                <BlockStack gap="300">
                  <TextField
                    label={`Variant ${index === 0 ? '(Control)' : String.fromCharCode(65 + index - 1)} Name`}
                    value={variant.name}
                    onChange={(value) => {
                      const newVariants = [...formData.variants];
                      newVariants[index].name = value;
                      setFormData({ ...formData, variants: newVariants });
                    }}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Traffic Split (%)"
                    type="number"
                    value={variant.trafficPercentage.toString()}
                    onChange={(value) => {
                      const newVariants = [...formData.variants];
                      newVariants[index].trafficPercentage = Number(value) || 50;
                      setFormData({ ...formData, variants: newVariants });
                    }}
                    min={0}
                    max={100}
                    autoComplete="off"
                  />

                  {formData.testType === "free_shipping" && (
                    <TextField
                      label="Free Shipping Threshold ($)"
                      type="number"
                      value={variant.config.threshold?.toString() || ""}
                      onChange={(value) => {
                        const newVariants = [...formData.variants];
                        newVariants[index].config = { threshold: Number(value) || 0 };
                        setFormData({ ...formData, variants: newVariants });
                      }}
                      autoComplete="off"
                    />
                  )}
                </BlockStack>
              </Card>
            ))}

            {formData.variants.length < 4 && (
              <Button
                onClick={() => {
                  setFormData({
                    ...formData,
                    variants: [
                      ...formData.variants,
                      {
                        name: `Variant ${String.fromCharCode(65 + formData.variants.length - 1)}`,
                        description: "",
                        trafficPercentage: 50,
                        config: { threshold: 100 }
                      }
                    ]
                  });
                }}
              >
                Add Another Variant
              </Button>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Edit Experiment Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Experiment"
        primaryAction={{
          content: "Save Changes",
          onAction: handleUpdateExperiment,
          disabled: !editingExperiment?.name || isLoading,
          loading: isLoading,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setShowEditModal(false);
              setEditingExperiment(null);
            },
          },
        ]}
      >
        {editingExperiment && (
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Test Name"
                value={editingExperiment.name}
                onChange={(value) => setEditingExperiment({ ...editingExperiment, name: value })}
                autoComplete="off"
              />
              
              <TextField
                label="Description"
                value={editingExperiment.description || ""}
                onChange={(value) => setEditingExperiment({ ...editingExperiment, description: value })}
                multiline={3}
                autoComplete="off"
              />

              <Banner tone="info">
                <p>Note: You can only edit name and description. To change variants or settings, create a new test.</p>
              </Banner>
            </FormLayout>
          </Modal.Section>
        )}
      </Modal>

      {/* Toast */}
      {toastActive && (
        <Toast 
          content={toastMessage} 
          onDismiss={() => setToastActive(false)} 
          duration={4000}
        />
      )}
    </Page>
  );
}
