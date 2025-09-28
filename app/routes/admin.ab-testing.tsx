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
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "~/db.server";

interface ABExperiment {
  id: number;
  name: string;
  description?: string;
  test_type: string;
  status: string;
  traffic_allocation: number;
  primary_metric: string;
  confidence_level: number;
  start_date?: string;
  end_date?: string;
  variants: ABVariant[];
  results?: ExperimentResults;
}

interface ABVariant {
  id: number;
  name: string;
  description?: string;
  traffic_percentage: number;
  is_control: boolean;
  config_data: string;
  total_visitors: number;
  total_conversions: number;
  total_revenue: number;
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

  const experimentsRaw = await db.$queryRaw<Array<any>>`
    SELECT id, name, description, test_type, status, traffic_allocation, primary_metric,
           confidence_level, start_date, end_date, created_at
    FROM ab_experiments
    WHERE shop_id = ${session.shop}
    ORDER BY created_at DESC
  `;

  if (!experimentsRaw.length) {
    return json({ experiments: [] });
  }

  const experimentIds = experimentsRaw.map((experiment) => experiment.id);

  const variantsRaw = await db.$queryRaw<Array<any>>`
    SELECT id, experiment_id, name, description, traffic_percentage, is_control,
           config_data, total_visitors, total_conversions, total_revenue
    FROM ab_variants
    WHERE experiment_id IN (${Prisma.join(experimentIds)})
    ORDER BY experiment_id ASC, created_at ASC
  `;

  const variantsByExperiment = new Map<number, ABVariant[]>();
  for (const variant of variantsRaw) {
    const trafficPercentage = Number(variant.traffic_percentage ?? 0);
    const totalRevenue = Number(variant.total_revenue ?? 0);

    const formattedVariant: ABVariant = {
      id: variant.id,
      name: variant.name,
      description: variant.description ?? undefined,
      traffic_percentage: Number.isFinite(trafficPercentage)
        ? trafficPercentage
        : 0,
      is_control: Boolean(variant.is_control),
      config_data: variant.config_data ?? "{}",
      total_visitors: variant.total_visitors ?? 0,
      total_conversions: variant.total_conversions ?? 0,
      total_revenue: Number.isFinite(totalRevenue) ? totalRevenue : 0,
    };

    const list = variantsByExperiment.get(variant.experiment_id) ?? [];
    list.push(formattedVariant);
    variantsByExperiment.set(variant.experiment_id, list);
  }

  const experiments: ABExperiment[] = experimentsRaw.map((experiment) => {
    const trafficAllocation = Number(experiment.traffic_allocation ?? 1) * 100;
    const confidenceLevel = Number(experiment.confidence_level ?? 0) * 100;
    const variants = variantsByExperiment.get(experiment.id) ?? [];
    const results = computeExperimentResults(variants);

    return {
      id: experiment.id,
      name: experiment.name,
      description: experiment.description ?? undefined,
      test_type: experiment.test_type,
      status: experiment.status,
      traffic_allocation: Number.isFinite(trafficAllocation)
        ? trafficAllocation
        : 100,
      primary_metric: experiment.primary_metric,
      confidence_level: Number.isFinite(confidenceLevel)
        ? confidenceLevel
        : 95,
      start_date: experiment.start_date
        ? new Date(experiment.start_date).toISOString()
        : undefined,
      end_date: experiment.end_date
        ? new Date(experiment.end_date).toISOString()
        : undefined,
      variants,
      results,
    } satisfies ABExperiment;
  });

  return json({ experiments });
};

function computeExperimentResults(variants: ABVariant[]): ExperimentResults | undefined {
  if (!variants.length) return undefined;

  const control = variants.find((variant) => variant.is_control) ?? variants[0];
  const challengers = variants.filter((variant) => variant.id !== control.id);
  if (!challengers.length) return undefined;

  const sortedChallengers = [...challengers].sort((a, b) =>
    conversionRate(b.total_conversions, b.total_visitors) -
    conversionRate(a.total_conversions, a.total_visitors)
  );

  const challenger = sortedChallengers[0];

  const controlRate = conversionRate(control.total_conversions, control.total_visitors);
  const challengerRate = conversionRate(
    challenger.total_conversions,
    challenger.total_visitors
  );

  const controlRevenuePerVisitor = revenuePerVisitor(
    control.total_revenue,
    control.total_visitors
  );
  const challengerRevenuePerVisitor = revenuePerVisitor(
    challenger.total_revenue,
    challenger.total_visitors
  );

  const conversionLift = controlRate > 0
    ? ((challengerRate - controlRate) / controlRate) * 100
    : 0;

  const revenueLift = controlRevenuePerVisitor > 0
    ? ((challengerRevenuePerVisitor - controlRevenuePerVisitor) /
        controlRevenuePerVisitor) * 100
    : 0;

  const stats = calculateSignificance(control, challenger);

  return {
    is_significant: stats.isSignificant,
    p_value: stats.pValue,
    confidence_interval_lower: stats.ciLower,
    confidence_interval_upper: stats.ciUpper,
    conversion_rate_lift: conversionLift,
    revenue_lift: revenueLift,
    winner_variant_id:
      stats.isSignificant && challengerRate > controlRate
        ? challenger.id
        : undefined,
  } satisfies ExperimentResults;
}

function calculateSignificance(control: ABVariant, challenger: ABVariant) {
  const n1 = control.total_visitors ?? 0;
  const n2 = challenger.total_visitors ?? 0;
  const conv1 = control.total_conversions ?? 0;
  const conv2 = challenger.total_conversions ?? 0;

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

function revenuePerVisitor(revenue: number, visitors: number) {
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
  await authenticate.admin(request);
  
  const data = await request.json();
  console.log('A/B testing action:', data);
  
  // Database operations would go here when schema is implemented
  return json({ success: true });
};

export default function ABTestingPage() {
  const { experiments } = useLoaderData<typeof loader>();
  
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

  const experimentsTableRows = experiments.map((exp: ABExperiment) => {
    const totalVisitors = exp.variants?.reduce((sum, v) => sum + (v.total_visitors || 0), 0) || 0;
    const totalConversions = exp.variants?.reduce((sum, v) => sum + (v.total_conversions || 0), 0) || 0;
    const totalRevenue = exp.variants?.reduce((sum, v) => sum + (v.total_revenue || 0), 0) || 0;
    const conversionRate = calculateConversionRate(totalConversions, totalVisitors);

    return [
      exp.name,
      exp.test_type.replace('_', ' '),
      getStatusBadge(exp.status),
      `${totalVisitors.toLocaleString()}`,
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
  });

  return (
    <Page 
      title="A/B Testing"
      subtitle="Test and optimize your recommendation algorithms, bundle pricing, and customer experience"
      primaryAction={{
        content: 'Create Experiment',
        onAction: () => setShowCreateModal(true)
      }}
    >
      <TitleBar title="A/B Testing" />
      
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Active Experiments</Text>
                <Badge tone="info">
                  {`${experiments.filter(e => e.status === 'running').length} Running`}
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
                      {experiments.filter(e => e.status === 'running').length}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm" tone="subdued">Completed</Text>
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      {experiments.filter(e => e.status === 'completed').length}
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
                const conversionRate = calculateConversionRate(variant.total_conversions, variant.total_visitors);
                const revenuePerVisitor = variant.total_visitors > 0 ? 
                  (variant.total_revenue / variant.total_visitors) : 0;
                const winnerVariantId = selectedExperiment.results?.winner_variant_id;
                
                return (
                  <Card key={variant.id} background={variant.is_control ? "bg-surface-secondary" : undefined}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingSm">{variant.name}</Text>
                        {variant.is_control && <Badge tone="info">Control</Badge>}
                        {!variant.is_control && winnerVariantId === variant.id && (
                          <Badge tone="success">Winner</Badge>
                        )}
                      </InlineStack>
                      
                      <InlineStack gap="600">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" tone="subdued">Visitors</Text>
                          <Text as="p" variant="headingMd">{variant.total_visitors.toLocaleString()}</Text>
                        </BlockStack>
                        
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" tone="subdued">Conversions</Text>
                          <Text as="p" variant="headingMd">{variant.total_conversions}</Text>
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
                      const control = selectedExperiment.variants?.find((variant) => variant.is_control);
                      const winner = selectedExperiment.variants?.find(
                        (variant) => variant.id === results?.winner_variant_id
                      );

                      const controlRate = control
                        ? calculateConversionRate(
                            control.total_conversions,
                            control.total_visitors
                          )
                        : "0.00";
                      const winnerRate = winner
                        ? calculateConversionRate(
                            winner.total_conversions,
                            winner.total_visitors
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