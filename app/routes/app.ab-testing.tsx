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
  discountPct: number;
  trafficPct: number;
};

type LoaderExperiment = {
  id: number;
  name: string;
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
  discountPct: number;
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
    const experiments = await prisma.experiment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        variants: {
          orderBy: [{ isControl: "desc" }, { id: "asc" }],
        },
      },
    });

    const serialized: LoaderExperiment[] = experiments.map((exp): LoaderExperiment => ({
      id: exp.id,
      name: exp.name,
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
        discountPct: toNumber(variant.discountPct),
        trafficPct: toNumber(variant.trafficPct),
      })),
    }));

    return json(serialized);
  } catch (err) {
    console.error("[app.ab-testing] Failed to load experiments. If you recently changed the Prisma schema, run migrations.", err);
    // Fail-open: return an empty list so the page renders with an EmptyState instead of 500
    return json([] satisfies LoaderExperiment[]);
  }
};

export default function ABTestingPage() {
  const experiments = useLoaderData<LoaderExperiment[]>();
  const revalidator = useRevalidator();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
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
      const payload = {
        action: "create",
        experiment: {
          name: newName.trim(),
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
            discountPct: controlPct,
          },
          {
            name: variantName.trim() || "Variant",
            isControl: false,
            trafficPct: 50,
            discountPct: challengerPct,
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
      const response = await fetch(`/api/ab-testing-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
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
    const control = experiment.variants.find((variant) => variant.isControl);
    const challenger = experiment.variants.find((variant) => !variant.isControl);

    return (
      <Card key={experiment.id} padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">{experiment.name}</Text>
              <InlineStack gap="200">
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
                  <Text as="p" tone="subdued">Discount: {control.discountPct}%</Text>
                  <Text as="p" tone="subdued">Traffic: {control.trafficPct}%</Text>
                </BlockStack>
              </Card>
            )}
            {challenger && (
              <Card key={`${experiment.id}-challenger`} background="bg-surface-secondary" padding="400">
                <BlockStack gap="150">
                  <Text variant="headingSm" as="h3">{challenger.name}</Text>
                  <Text as="p" tone="subdued">Discount: {challenger.discountPct}%</Text>
                  <Text as="p" tone="subdued">Traffic: {challenger.trafficPct}%</Text>
                </BlockStack>
              </Card>
            )}
          </InlineStack>
        </BlockStack>
      </Card>
    );
  };

  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
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
        title="Create experiment"
        primaryAction={{
          content: isSaving ? "Saving…" : "Launch experiment",
          onAction: handleCreate,
          disabled: isSaving,
        }}
        secondaryActions={[{ content: "Cancel", onAction: closeCreateModal }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Experiment name"
              value={newName}
              onChange={setNewName}
              autoComplete="off"
            />
            <Select
              label="Attribution window"
              value={attributionWindow}
              onChange={(value) => setAttributionWindow(value as "session"|"24h"|"7d")}
              options={[
                { label: "Session", value: "session" },
                { label: "24 hours", value: "24h" },
                { label: "7 days", value: "7d" },
              ]}
            />
            <Select
              label="Start immediately"
              value={activateNow ? "yes" : "no"}
              onChange={(value) => setActivateNow(value === "yes")}
              options={[
                { label: "Yes", value: "yes" },
                { label: "No", value: "no" },
              ]}
            />
            <Card padding="300" background="bg-surface-secondary">
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Control</Text>
                <FormLayout>
                  <TextField
                    label="Discount percentage"
                    value={controlDiscount}
                    onChange={setControlDiscount}
                    type="number"
                    suffix="%"
                    min="0"
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
            <Card padding="300" background="bg-surface-secondary">
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Variant</Text>
                <FormLayout>
                  <TextField
                    label="Variant name"
                    value={variantName}
                    onChange={setVariantName}
                    autoComplete="off"
                  />
                  <TextField
                    label="Discount percentage"
                    value={variantDiscount}
                    onChange={setVariantDiscount}
                    type="number"
                    suffix="%"
                    min="0"
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </FormLayout>
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
