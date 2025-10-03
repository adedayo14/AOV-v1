import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Modal,
  TextField,
  InlineStack,
  BlockStack,
  Text,
  Badge,
  EmptyState,
  Banner,
  FormLayout,
  Select,
  ButtonGroup,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

type LoaderVariant = {
  id: number;
  name: string;
  isControl: boolean;
  value: number; // Flexible: discount % | shipping $ | bundle price | etc.
  trafficPct: number;
};

type LoaderExperiment = {
  id: number;
  name: string;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  attribution: string;
  createdAt: string;
  updatedAt: string;
  activeVariantId: number | null;
  variants: LoaderVariant[];
};

type ResultsVariant = {
  variantId: number;
  variantName: string;
  isControl: boolean;
  value: number; // Flexible: discount % | shipping $ | bundle price | etc.
  trafficPct: number;
  visitors: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  revenuePerVisitor: number;
};

type ResultsPayload = {
  experiment: {
    id: number;
    name: string;
    metric: string;
  };
  start: string;
  end: string;
  results: ResultsVariant[];
  leader: number | null;
};

const toNumber = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  if (typeof value === "string") return Number(value) || 0;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value) || 0;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  try {
    const [experiments] = await Promise.all([
      prisma.experiment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        variants: {
          orderBy: [{ isControl: "desc" }, { id: "asc" }],
        },
      },
      }),
    ]);

    const serialized: LoaderExperiment[] = experiments.map((exp): LoaderExperiment => ({
      id: exp.id,
      name: exp.name,
      type: (exp as any).type || "discount", // Type field exists in schema, TS cache issue
      status: exp.status,
      startDate: exp.startDate ? exp.startDate.toISOString() : null,
      endDate: exp.endDate ? exp.endDate.toISOString() : null,
      attribution: exp.attribution,
      createdAt: exp.createdAt.toISOString(),
      updatedAt: exp.updatedAt.toISOString(),
      activeVariantId: exp.activeVariantId ?? null,
      variants: exp.variants.map((variant): LoaderVariant => ({
        id: variant.id,
        name: variant.name,
        isControl: variant.isControl,
        value: toNumber((variant as any).value || (variant as any).discountPct || 0), // Support both old and new schema
        trafficPct: toNumber(variant.trafficPct),
      })),
    }));

    // Note: If you have a place to store currency (Settings or Session), use it here.
    // Falling back to USD if not available.
    const currencyCode = 'USD';
    return json({ experiments: serialized, currencyCode });
  } catch (err) {
    console.error("[app.ab-testing] Failed to load experiments. If you recently changed the Prisma schema, run migrations.", err);
    // Fail-open: return an empty list so the page renders with an EmptyState instead of 500
    return json({ experiments: [] as LoaderExperiment[] });
  }
};

export default function ABTestingPage() {
  const data = useLoaderData<{ experiments: LoaderExperiment[]; currencyCode?: string | undefined }>();
  const experiments = data.experiments;
  const revalidator = useRevalidator();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [experimentType, setExperimentType] = useState<"discount"|"bundle"|"shipping"|"upsell">("discount");
  const [controlDiscount, setControlDiscount] = useState("0");
  const [variantDiscount, setVariantDiscount] = useState("10");
  const [variantName, setVariantName] = useState("Stronger Offer");
  const [attributionWindow, setAttributionWindow] = useState<"session"|"24h"|"7d">("session");
  const [activateNow, setActivateNow] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<LoaderExperiment | null>(null);
  const [resultsPayload, setResultsPayload] = useState<ResultsPayload | null>(null);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const resetCreateForm = () => {
    setNewName("");
    setExperimentType("discount");
    setControlDiscount("0");
    setVariantDiscount("10");
    setVariantName("Stronger Offer");
    setAttributionWindow("session");
    setActivateNow(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    resetCreateForm();
  };

  const handleCreate = async () => {
    setErrorBanner(null);
    setSuccessBanner(null);

    if (!newName.trim()) {
      setErrorBanner("Give your experiment a name so the team knows what you're testing.");
      return;
    }

    const controlPct = Number(controlDiscount);
    const challengerPct = Number(variantDiscount);

    if (Number.isNaN(controlPct) || Number.isNaN(challengerPct)) {
      setErrorBanner("Discount percentages must be numbers.");
      return;
    }

    if (controlPct < 0 || challengerPct < 0 || controlPct > 100 || challengerPct > 100) {
      setErrorBanner("Discount percentages should be between 0 and 100.");
      return;
    }

    setIsSaving(true);

    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const sessionToken = params.get('id_token') || '';
      const payload = {
        action: "create",
        experiment: {
          name: newName.trim(),
          type: experimentType,
          status: activateNow ? "running" : "paused",
          startDate: activateNow ? new Date().toISOString() : null,
          endDate: null,
          attributionWindow,
        },
        variants: [
          {
            name: "Control",
            isControl: true,
            trafficPct: 50,
            value: controlPct, // Generic value field (discount %, shipping $, etc.)
          },
          {
            name: variantName.trim() || "Variant",
            isControl: false,
            trafficPct: 50,
            value: challengerPct, // Generic value field (discount %, shipping $, etc.)
          },
        ],
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`/api/ab-testing-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text();
        console.error("[ABTesting] Create failed:", text);
        throw new Error("Server error while creating experiment");
      }

      await response.json();
      setSuccessBanner(
        activateNow
          ? "Experiment launched. Give it a few minutes to start collecting assignments."
          : "Saved as paused. Start it from the list when you're ready."
      );
      closeCreateModal();
      revalidator.revalidate();
    } catch (error) {
      console.error("[ABTesting] Create error", error);
      setErrorBanner("We couldn't create that experiment. Try again in a moment.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (experimentId: number) => {
    const confirmation = typeof window !== "undefined" ? window.confirm("Delete this experiment? Data keeps for reporting; traffic stops immediately.") : false;
    if (!confirmation) return;

    setErrorBanner(null);
    setSuccessBanner(null);

    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      const sessionToken = params.get('id_token') || '';
      const response = await fetch(`/api/ab-testing-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ action: "delete", experimentId }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("[ABTesting] Delete failed:", text);
        throw new Error("Delete request failed");
      }

      setSuccessBanner("Experiment deleted");
      revalidator.revalidate();
    } catch (error) {
      console.error("[ABTesting] Delete error", error);
      setErrorBanner("We couldn't delete that experiment. Refresh and try again.");
    }
  };

  const openResultsModal = async (experiment: LoaderExperiment) => {
    setSelectedExperiment(experiment);
    setResultsPayload(null);
    setResultsError(null);
    setResultsLoading(true);
    setResultsModalOpen(true);

    try {
      const response = await fetch(`/api/ab-results?experimentId=${experiment.id}&period=7d`);
      if (!response.ok) {
        throw new Error(`Failed to load results (${response.status})`);
      }
      const data: ResultsPayload = await response.json();
      setResultsPayload(data);
    } catch (error) {
      console.error("[ABTesting] Results error", error);
      setResultsError("Results aren't ready yet. Give it a little longer.");
    } finally {
      setResultsLoading(false);
    }
  };

  const closeResultsModal = () => {
    setResultsModalOpen(false);
    setResultsPayload(null);
    setResultsError(null);
    setSelectedExperiment(null);
  };

  const renderExperimentCard = (experiment: LoaderExperiment) => {
    const statusTone: BadgeProps["tone"] = experiment.status === "running"
      ? "success"
      : experiment.status === "completed"
        ? "attention"
        : "critical";
    
    const typeEmoji: Record<string, string> = {
      discount: "💰",
      bundle: "📦",
      shipping: "🚚",
      upsell: "⬆️"
    };
    const typeLabel = `${typeEmoji[experiment.type] || ""} ${experiment.type}`.trim();
    
    // Helper to format value based on experiment type
    const formatValue = (value: number, type: string): string => {
      switch(type) {
        case 'discount':
          return `${value}% off`;
        case 'shipping':
          return `$${value} threshold`;
        case 'bundle':
          return `$${value} bundle price`;
        case 'upsell':
          return `$${value} upsell`;
        default:
          return String(value);
      }
    };
    
    const control = experiment.variants.find((variant) => variant.isControl);
    const challenger = experiment.variants.find((variant) => !variant.isControl);

    return (
      <Card key={experiment.id} padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">{experiment.name}</Text>
              <InlineStack gap="200">
                <Badge>{typeLabel}</Badge>
                <Badge tone={statusTone}>{experiment.status}</Badge>
                <Badge tone="info">{`Attribution: ${experiment.attribution}`}</Badge>
              </InlineStack>
            </BlockStack>
            <ButtonGroup>
              <Button onClick={() => openResultsModal(experiment)}>View results</Button>
              <Button tone="critical" onClick={() => handleDelete(experiment.id)} disabled={experiment.status === "running"}>
                Delete
              </Button>
            </ButtonGroup>
          </InlineStack>

          <InlineStack gap="400" wrap>
            {control && (
              <Card key={`${experiment.id}-control`} background="bg-surface-secondary" padding="400">
                <BlockStack gap="150">
                  <Text variant="headingSm" as="h3">Control</Text>
                  <Text as="p" tone="subdued">Offer: {formatValue(control.value, experiment.type)}</Text>
                  <Text as="p" tone="subdued">Traffic: {control.trafficPct}%</Text>
                </BlockStack>
              </Card>
            )}
            {challenger && (
              <Card key={`${experiment.id}-challenger`} background="bg-surface-secondary" padding="400">
                <BlockStack gap="150">
                  <Text variant="headingSm" as="h3">{challenger.name}</Text>
                  <Text as="p" tone="subdued">Offer: {formatValue(challenger.value, experiment.type)}</Text>
                  <Text as="p" tone="subdued">Traffic: {challenger.trafficPct}%</Text>
                </BlockStack>
              </Card>
            )}
          </InlineStack>
        </BlockStack>
      </Card>
    );
  };

  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: data.currencyCode || "USD" });
  const renderResults = () => {
    if (resultsLoading) {
      return <Text as="p">Crunching numbers…</Text>;
    }

    if (resultsError) {
      return <Banner tone="critical" title="No recommendation just yet">{resultsError}</Banner>;
    }

    if (!resultsPayload) {
      return <Text as="p">No data yet.</Text>;
    }

    const { results, leader, start, end } = resultsPayload;

    // Check if there's any actual data
    const hasData = results.some(v => v.visitors > 0);
    
    if (!hasData) {
      return (
        <BlockStack gap="300">
          <Banner tone="info" title="Not enough data yet">
            <Text as="p">Your experiment is running, but we haven't collected enough traffic yet.</Text>
            <Text as="p">Check back in a few hours once visitors start seeing your variants.</Text>
          </Banner>
          <Text as="p" tone="subdued">
            Window: {new Date(start).toLocaleDateString()} - {new Date(end).toLocaleDateString()}
          </Text>
        </BlockStack>
      );
    }

    return (
      <BlockStack gap="400">
        <Text as="p" tone="subdued">
          Window: {new Date(start).toLocaleDateString()} - {new Date(end).toLocaleDateString()}
        </Text>
        {results.map((variant: ResultsVariant) => {
          const isLeader = leader === variant.variantId;
          return (
            <Card key={variant.variantId} padding="400">
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="start">
                  <BlockStack gap="100">
                    <InlineStack gap="200" align="center">
                      <Text variant="headingSm" as="h3">{variant.variantName}</Text>
                      {isLeader && <Badge tone="success">Recommended</Badge>}
                    </InlineStack>
                    <InlineStack gap="400">
                      <Text as="p" tone="subdued">Visitors: {variant.visitors}</Text>
                      <Text as="p" tone="subdued">Orders: {variant.conversions}</Text>
                      <Text as="p" tone="subdued">Revenue: {money.format(variant.revenue)}</Text>
                    </InlineStack>
                  </BlockStack>
                  <BlockStack gap="150" align="end">
                    <Text as="p">Revenue / visitor: {money.format(variant.revenuePerVisitor)}</Text>
                    <Text as="p">Conversion rate: {(variant.conversionRate * 100).toFixed(2)}%</Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          );
        })}
        {leader && selectedExperiment && (
          <InlineStack align="end">
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  const res = await fetch("/api/ab-rollout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ experimentId: selectedExperiment.id, winnerVariantId: leader }),
                  });
                  if (res.ok) {
                    setSuccessBanner("Rolled out the winner. New visitors will see it going forward.");
                    setResultsModalOpen(false);
                    revalidator.revalidate();
                  } else {
                    setResultsError("Couldn’t roll out just now. Try again.");
                  }
                } catch {
                  setResultsError("Couldn’t roll out just now. Try again.");
                }
              }}
            >
              Roll out winner
            </Button>
          </InlineStack>
        )}
      </BlockStack>
    );
  };

  return (
    <Page
      title="Discount Experiments"
      primaryAction={{
        content: "New experiment",
        onAction: () => setCreateModalOpen(true),
      }}
    >
      <Layout>
        <Layout.Section>
          {errorBanner && (
            <Banner tone="critical" title="Something went wrong" onDismiss={() => setErrorBanner(null)}>
              {errorBanner}
            </Banner>
          )}
          {successBanner && (
            <Banner tone="success" title="All set" onDismiss={() => setSuccessBanner(null)}>
              {successBanner}
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section>
          {experiments.length === 0 ? (
            <Card padding="400">
              <EmptyState
                heading="Launch your first test"
                action={{ content: "Create experiment", onAction: () => setCreateModalOpen(true) }}
                image="https://cdn.shopify.com/s/files/1/0780/2207/collections/empty-state.svg"
              >
                Try a simple price incentive: keep one drawer as-is, and offer a sweeter discount to half of shoppers.
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="400">
              {experiments.map((experiment) => renderExperimentCard(experiment))}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>

      <Modal
        open={createModalOpen}
        onClose={closeCreateModal}
  title="Start a new test"
        primaryAction={{
          content: isSaving ? "Saving…" : "Launch experiment",
          onAction: handleCreate,
          disabled: isSaving,
        }}
        secondaryActions={[{ content: "Cancel", onAction: closeCreateModal }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <TextField
                label="Give your test a name"
                value={newName}
                placeholder="👉 Example: “Free Shipping vs 10% Off”"
                onChange={setNewName}
                autoComplete="off"
              />
            </BlockStack>

            <BlockStack gap="150">
              <Text as="p">What type of experiment?</Text>
              <Select
                label="Experiment type"
                labelHidden
                value={experimentType}
                onChange={(value) => setExperimentType(value as "discount"|"bundle"|"shipping"|"upsell")}
                options={[
                  { label: "💰 Discount offer", value: "discount" },
                  { label: "📦 Bundle deal", value: "bundle" },
                  { label: "🚚 Shipping threshold", value: "shipping" },
                  { label: "⬆️ Upsell", value: "upsell" },
                ]}
              />
            </BlockStack>

            <BlockStack gap="150">
              <Text as="p">How long should we count orders for this test?</Text>
              <Select
                label="Attribution window"
                labelHidden
                value={attributionWindow}
                onChange={(value) => setAttributionWindow(value as "session"|"24h"|"7d")}
                options={[
                  { label: "Same session only", value: "session" },
                  { label: "Orders placed within 24 hours", value: "24h" },
                  { label: "Orders placed within 7 days", value: "7d" },
                ]}
              />
            </BlockStack>

            <BlockStack gap="150">
              <Text as="p">Start the test right away?</Text>
              <Select
                label="Start the test right away?"
                labelHidden
                value={activateNow ? "yes" : "no"}
                onChange={(value) => setActivateNow(value === "yes")}
                options={[
                  { label: "Yes", value: "yes" },
                  { label: "No, save it for later", value: "no" },
                ]}
              />
            </BlockStack>

            <BlockStack gap="200">
              <Text as="p">What do you want to compare?</Text>
              <InlineStack gap="400" wrap>
                <Card padding="300" background="bg-surface-secondary">
                  <BlockStack gap="150">
                    <Text variant="headingSm" as="h3">Control (current offer)</Text>
                    <FormLayout>
                      <TextField
                        label={
                          experimentType === 'discount' ? 'Discount %:' :
                          experimentType === 'shipping' ? 'Shipping Threshold $:' :
                          experimentType === 'bundle' ? 'Bundle Price $:' :
                          'Value:'
                        }
                        value={controlDiscount}
                        onChange={setControlDiscount}
                        type="number"
                        suffix={experimentType === 'discount' ? '%' : '$'}
                        min="0"
                        autoComplete="off"
                        helpText={
                          experimentType === 'discount' ? 'Percentage off (e.g., 10 for 10% off)' :
                          experimentType === 'shipping' ? 'Free shipping at this cart value (e.g., 50 for $50)' :
                          experimentType === 'bundle' ? 'Bundle price in dollars' :
                          'Value for this offer'
                        }
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
                <Card padding="300" background="bg-surface-secondary">
                  <BlockStack gap="150">
                    <Text variant="headingSm" as="h3">Challenger (new offer)</Text>
                    <FormLayout>
                      <TextField
                        label="Name:"
                        value={variantName}
                        onChange={setVariantName}
                        placeholder={
                          experimentType === 'discount' ? 'Stronger Discount' :
                          experimentType === 'shipping' ? 'Lower Threshold' :
                          experimentType === 'bundle' ? 'Better Bundle' :
                          'Stronger Offer'
                        }
                        autoComplete="off"
                      />
                      <TextField
                        label={
                          experimentType === 'discount' ? 'Discount %:' :
                          experimentType === 'shipping' ? 'Shipping Threshold $:' :
                          experimentType === 'bundle' ? 'Bundle Price $:' :
                          'Value:'
                        }
                        value={variantDiscount}
                        onChange={setVariantDiscount}
                        type="number"
                        suffix={experimentType === 'discount' ? '%' : '$'}
                        min="0"
                        autoComplete="off"
                        helpText={
                          experimentType === 'discount' ? 'Percentage off (e.g., 20 for 20% off)' :
                          experimentType === 'shipping' ? 'Free shipping at this cart value (e.g., 100 for $100)' :
                          experimentType === 'bundle' ? 'Bundle price in dollars' :
                          'Value for this offer'
                        }
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal
        open={resultsModalOpen}
        onClose={closeResultsModal}
        title={selectedExperiment ? `${selectedExperiment.name} results` : "Experiment results"}
      >
        <Modal.Section>
          {renderResults()}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
