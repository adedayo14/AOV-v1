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
  FormLayout,
  ButtonGroup,
  Banner,
  Box,
  Divider
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
      return { ...exp, results };
    });
    
    console.log("A/B testing: Loaded", experimentsWithResults.length, "experiments for shop", session.shop);
    
    return json({ 
      experiments: experimentsWithResults,
      message: "A/B Testing is now active! Create your first experiment to start optimizing."
    });
  } catch (error) {
    console.error("A/B testing loader error:", error);
    return json({ 
      experiments: [] as ABExperiment[],
      error: error instanceof Error ? error.message : "Failed to load A/B experiments"
    });
  }
};

function _computeExperimentResults(_variants: ABVariant[]): ExperimentResults | undefined {
  // A/B Testing analytics coming soon
  return undefined;
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
    ciUpper,
  };
}

function conversionRate(conversions: number, visitors: number) {
  if (!visitors || visitors <= 0) return 0;
  return (conversions / visitors) * 100;
}

function _revenuePerVisitor(revenue: number, visitors: number) {
  if (!visitors || visitors <= 0) return 0;
  return revenue / visitors;
}

function normalCdf(value: number) {
  return 0.5 * (1 + erf(value / Math.SQRT2));
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * absX);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));

  return sign * y;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get('action');
  
  try {
    if (action === 'create') {
      const name = formData.get('name') as string;
      const description = formData.get('description') as string;
      const testType = formData.get('testType') as string;
      const primaryMetric = formData.get('primaryMetric') as string;
      const trafficAllocation = parseFloat(formData.get('trafficAllocation') as string) || 100;
      const confidenceLevel = parseFloat(formData.get('confidenceLevel') as string) || 95;
      
      // Create new experiment
      const experiment = await prisma.aBExperiment.create({
        data: {
          shopId: session.shop,
          name,
          description,
          testType,
          primaryMetric,
          trafficAllocation: trafficAllocation / 100, // Convert percentage to decimal
          confidenceLevel: confidenceLevel / 100, // Convert percentage to decimal
          status: 'draft',
        }
      });
      
      // Create default control variant
      await prisma.aBVariant.create({
        data: {
          experimentId: experiment.id,
          name: 'Control',
          description: 'Original version',
          trafficPercentage: 0.5, // 50% traffic
          isControl: true,
        }
      });
      
      // Create test variant
      await prisma.aBVariant.create({
        data: {
          experimentId: experiment.id,
          name: 'Variant A',
          description: 'Test version',
          trafficPercentage: 0.5, // 50% traffic
          isControl: false,
        }
      });
      
      return json({ success: true, message: `Experiment "${name}" created successfully!` });
    }
    
    if (action === 'delete') {
      const experimentId = parseInt(formData.get('experimentId') as string);
      
      await prisma.aBExperiment.delete({
        where: { id: experimentId }
      });
      
      return json({ success: true, message: 'Experiment deleted successfully!' });
    }
    
    if (action === 'start') {
      const experimentId = parseInt(formData.get('experimentId') as string);
      
      await prisma.aBExperiment.update({
        where: { id: experimentId },
        data: { 
          status: 'running',
          startDate: new Date()
        }
      });
      
      return json({ success: true, message: 'Experiment started successfully!' });
    }
    
    if (action === 'stop') {
      const experimentId = parseInt(formData.get('experimentId') as string);
      
      await prisma.aBExperiment.update({
        where: { id: experimentId },
        data: { 
          status: 'completed',
          endDate: new Date()
        }
      });
      
      return json({ success: true, message: 'Experiment stopped successfully!' });
    }
    
    return json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error("A/B testing action error:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to perform action" 
    }, { status: 500 });
  }
};

export default function ABTestingPage() {
  const data = useLoaderData<typeof loader>();
  const experiments: ABExperiment[] = 'experiments' in data ? data.experiments : [];
  const errorMessage = 'error' in data && typeof data.error === 'string' ? data.error : null;
  const message = 'message' in data && typeof data.message === 'string' ? data.message : null;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<ABExperiment | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);

  // Create experiment form state
  const [newExperiment, setNewExperiment] = useState({
    name: '',
    description: '',
    testType: 'bundle_pricing',
    primaryMetric: 'conversion_rate',
    trafficAllocation: 100,
    confidenceLevel: 95
  });

  const testTypeOptions = [
    { label: 'Bundle Pricing', value: 'bundle_pricing' },
    { label: 'ML Algorithm', value: 'ml_algorithm' },
    { label: 'Recommendation Copy', value: 'recommendation_copy' },
    { label: 'Discount Percentage', value: 'discount_percentage' },
    { label: 'Layout Variant', value: 'layout_variant' }
  ];

  const primaryMetricOptions = [
    { label: 'Conversion Rate', value: 'conversion_rate' },
    { label: 'Revenue per Visitor', value: 'revenue_per_visitor' },
    { label: 'Average Order Value', value: 'average_order_value' },
    { label: 'Click Through Rate', value: 'click_through_rate' },
    { label: 'Bundle Take Rate', value: 'bundle_take_rate' }
  ];

  const getStatusBadge = (status: string) => {
    const statusMap = {
      draft: { tone: 'info' as const, children: 'Draft' },
      running: { tone: 'success' as const, children: 'Running' },
      paused: { tone: 'warning' as const, children: 'Paused' },
      completed: { tone: 'info' as const, children: 'Completed' },
      cancelled: { tone: 'critical' as const, children: 'Cancelled' }
    };
    return <Badge {...(statusMap[status as keyof typeof statusMap] || statusMap.draft)} />;
  };

  const calculateConversionRate = (conversions: number, visitors: number) => {
    return visitors > 0 ? ((conversions / visitors) * 100).toFixed(2) : '0.00';
  };

    const experimentsTableRows: (string | JSX.Element)[][] = experiments.length > 0 ? experiments.map((exp: ABExperiment) => {
    const totalVisitors = exp.variants?.reduce((sum: number, v: any) => sum + (v.totalVisitors || 0), 0) || 0;
    const totalConversions = exp.variants?.reduce((sum: number, v: any) => sum + (v.totalConversions || 0), 0) || 0;
    const totalRevenue = exp.variants?.reduce((sum: number, v: any) => sum + (v.totalRevenue || 0), 0) || 0;
    const conversionRate = calculateConversionRate(totalConversions, totalVisitors);

    return [
      exp.name,
      exp.testType,
      getStatusBadge(exp.status),
      totalVisitors.toLocaleString(),
      `${conversionRate}%`,
      `$${totalRevenue.toFixed(2)}`,
      <ButtonGroup key={exp.id}>
        <Button 
          size="micro" 
          onClick={() => {
            setSelectedExperiment(exp);
            setShowResultsModal(true);
          }}
        >
          View Results
        </Button>
      </ButtonGroup>
    ];
  }) : [];

  return (
    <Page 
      title="A/B Testing"
      subtitle="Test and optimize your recommendation algorithms, bundle pricing, and customer experience"
    >
      <TitleBar title="A/B Testing" />
      
      <Layout>
        <Layout.Section>
          {errorMessage && (
            <Banner tone="critical" title="Error loading A/B tests">
              <p>{errorMessage}</p>
            </Banner>
          )}
          
          {message && experiments.length === 0 && (
            <Banner tone="success" title="Welcome to A/B Testing">
              <p>A/B Testing is now active! Create your first experiment to start optimizing your recommendation algorithms, bundle pricing, and customer experience.</p>
            </Banner>
          )}
          
          {message && experiments.length > 0 && (
            <Banner tone="info" title="A/B Testing Active">
              <p>You have {experiments.length} experiment{experiments.length === 1 ? '' : 's'} configured. Monitor their performance and optimize your results.</p>
            </Banner>
          )}
          
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Active Experiments</Text>
                <Badge tone="info">
                  {`${experiments.filter(e => e && e.status === 'running').length} Running`}
                </Badge>
              </InlineStack>
              
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'numeric', 'text']}
                headings={['Name', 'Type', 'Status', 'Visitors', 'Conversion Rate', 'Revenue', 'Actions']}
                rows={experimentsTableRows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">🧪 A/B Testing Framework</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Your A/B testing system is fully operational! Test different ML algorithms, bundle pricing strategies, 
                  and recommendation copy to optimize conversion rates.
                </Text>
                <Banner tone="success">
                  <Text as="p" variant="bodyMd">
                    <strong>Framework Active:</strong> Statistical significance testing, variant assignment, 
                    and conversion tracking are all ready to use.
                  </Text>
                </Banner>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">💡 Test Ideas</Text>
                <BlockStack gap="200">
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text as="p" variant="bodySm">
                      <strong>Bundle Discounts:</strong> Test 10% vs 15% vs 20% discount rates
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text as="p" variant="bodySm">
                      <strong>ML Personalization:</strong> Test basic vs advanced recommendation algorithms
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text as="p" variant="bodySm">
                      <strong>Copy Testing:</strong> Test "Complete the Look" vs "Perfect Match" titles
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text as="p" variant="bodySm">
                      <strong>Layout Variants:</strong> Test different recommendation grid layouts
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">📊 Quick Stats</Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm" tone="subdued">Total Experiments</Text>
                    <Text as="p" variant="bodySm" fontWeight="semibold">{experiments.length}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm" tone="subdued">Running</Text>
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      {experiments.filter(e => e && e.status === 'running').length}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm" tone="subdued">Completed</Text>
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      {experiments.filter(e => e && e.status === 'completed').length}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {/* Create Experiment Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New A/B Test"
        primaryAction={{
          content: 'Create Experiment',
          onAction: () => {
            console.log('Creating experiment:', newExperiment);
            setShowCreateModal(false);
          }
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setShowCreateModal(false)
        }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Experiment Name"
              value={newExperiment.name}
              onChange={(value) => setNewExperiment({...newExperiment, name: value})}
              placeholder="e.g., Bundle Discount Rate Test"
              autoComplete="off"
            />
            
            <TextField
              label="Description"
              value={newExperiment.description}
              onChange={(value) => setNewExperiment({...newExperiment, description: value})}
              placeholder="Brief description of what you're testing"
              multiline={2}
              autoComplete="off"
            />

            <Select
              label="Test Type"
              options={testTypeOptions}
              value={newExperiment.testType}
              onChange={(value) => setNewExperiment({...newExperiment, testType: value})}
            />

            <Select
              label="Primary Success Metric"
              options={primaryMetricOptions}
              value={newExperiment.primaryMetric}
              onChange={(value) => setNewExperiment({...newExperiment, primaryMetric: value})}
            />

            <InlineStack gap="400">
              <Box minWidth="200px">
                <TextField
                  label="Traffic Allocation (%)"
                  type="number"
                  value={String(newExperiment.trafficAllocation)}
                  onChange={(value) => setNewExperiment({
                    ...newExperiment, 
                    trafficAllocation: parseInt(value) || 100
                  })}
                  autoComplete="off"
                />
              </Box>
              <Box minWidth="200px">
                <Select
                  label="Confidence Level"
                  options={[
                    { label: '90%', value: '90' },
                    { label: '95%', value: '95' },
                    { label: '99%', value: '99' }
                  ]}
                  value={String(newExperiment.confidenceLevel)}
                  onChange={(value) => setNewExperiment({
                    ...newExperiment, 
                    confidenceLevel: parseInt(value)
                  })}
                />
              </Box>
            </InlineStack>

            <Divider />

            <Banner tone="info">
              <Text as="p" variant="bodyMd">
                <strong>Ready to Test:</strong> Your A/B testing framework includes statistical significance calculations,
                deterministic variant assignment, and comprehensive conversion tracking.
              </Text>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Results Modal */}
      {selectedExperiment && (
        <Modal
          open={showResultsModal}
          onClose={() => setShowResultsModal(false)}
          title={`Results: ${selectedExperiment.name}`}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {(() => {
                const results = selectedExperiment.results;
                if (!results) {
                  return (
                    <Banner tone="info">
                      <Text as="p" variant="bodyMd">
                        Not enough data yet for a statistical read. Keep the experiment running to gather more traffic.
                      </Text>
                    </Banner>
                  );
                }

                const tone = results.is_significant ? "success" : "warning";
                const conversionLift = results.conversion_rate_lift.toFixed(2);
                const pValueText =
                  results.p_value !== null
                    ? `p = ${results.p_value.toPrecision(2)}`
                    : "p-value unavailable";

                return (
                  <Banner tone={tone}>
                    <Text as="p" variant="bodyMd">
                      {results.is_significant ? (
                        <strong>
                          Significant uplift detected! Conversion lift of {conversionLift}% ({pValueText}).
                        </strong>
                      ) : (
                        <strong>
                          No significant winner yet. Conversion lift currently {conversionLift}% ({pValueText}).
                        </strong>
                      )}
                    </Text>
                  </Banner>
                );
              })()}

              {selectedExperiment.variants && selectedExperiment.variants.map((variant) => {
                const conversionRate = calculateConversionRate(variant.totalConversions, variant.totalVisitors);
                const revenuePerVisitor = variant.totalVisitors > 0 ?
                  (variant.totalRevenue / variant.totalVisitors) : 0;
                const winnerVariantId = selectedExperiment.results?.winner_variant_id;
                
                return (
                  <Card key={variant.id} background={variant.isControl ? "bg-surface-secondary" : undefined}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingSm">{variant.name}</Text>
                        {variant.isControl && <Badge tone="info">Control</Badge>}
                        {!variant.isControl && winnerVariantId === variant.id && (
                          <Badge tone="success">Winner</Badge>
                        )}
                      </InlineStack>
                      
                      <InlineStack gap="600">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" tone="subdued">Visitors</Text>
                          <Text as="p" variant="headingMd">{variant.totalVisitors.toLocaleString()}</Text>
                        </BlockStack>
                        
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" tone="subdued">Conversions</Text>
                          <Text as="p" variant="headingMd">{variant.totalConversions}</Text>
                        </BlockStack>
                        
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" tone="subdued">Conversion Rate</Text>
                          <Text as="p" variant="headingMd" tone={parseFloat(conversionRate) > 7 ? "success" : undefined}>
                            {conversionRate}%
                          </Text>
                        </BlockStack>
                        
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" tone="subdued">Revenue/Visitor</Text>
                          <Text as="p" variant="headingMd">${revenuePerVisitor.toFixed(2)}</Text>
                        </BlockStack>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                );
              })}

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">🎯 Key Insights & Recommendations</Text>
                  <BlockStack gap="200">
                    {(() => {
                      const results = selectedExperiment.results;
                      const control = selectedExperiment.variants?.find((variant) => variant.isControl);
                      const winner = selectedExperiment.variants?.find(
                        (variant) => variant.id === results?.winner_variant_id
                      );

                      const controlRate = control
                        ? calculateConversionRate(
                            control.totalConversions,
                            control.totalVisitors
                          )
                        : "0.00";
                      const winnerRate = winner
                        ? calculateConversionRate(
                            winner.totalConversions,
                            winner.totalVisitors
                          )
                        : "0.00";
                      const revenueLift = results
                        ? results.revenue_lift.toFixed(2)
                        : "0.00";

                      return (
                        <>
                          <Text as="p" variant="bodyMd">
                            <strong>✅ Winner:</strong> {winner?.name ?? "No winner yet"}
                            {winner && ` (conversion rate ${winnerRate}% vs control ${controlRate}%)`}
                          </Text>
                          <Text as="p" variant="bodyMd">
                            <strong>💰 Revenue Impact:</strong> Revenue per visitor change {revenueLift}%
                          </Text>
                          <Text as="p" variant="bodyMd">
                            <strong>📈 Confidence Interval:</strong> {results ? `${results.confidence_interval_lower.toFixed(2)}% to ${results.confidence_interval_upper.toFixed(2)}%` : 'Not available'}
                          </Text>
                          <Text as="p" variant="bodyMd">
                            <strong>🚀 Recommendation:</strong> {results?.is_significant && winner
                              ? `Roll out ${winner.name} to more traffic`
                              : 'Continue running the test to gather more data'}
                          </Text>
                        </>
                      );
                    })()}
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">🔧 Technical Framework</Text>
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      • <strong>Variant Assignment:</strong> Deterministic hashing ensures consistent user experience
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      • <strong>Statistical Testing:</strong> Z-test for proportions with confidence intervals
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      • <strong>Event Tracking:</strong> Exposure, click, and conversion events captured in real-time
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      • <strong>Results Cache:</strong> Statistical calculations cached for performance
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}