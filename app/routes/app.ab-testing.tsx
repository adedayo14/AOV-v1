
import { useState, useCallback } from "react";
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
  LegacyCard,
  DataTable,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import type { ABExperiment } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";

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
  const shopify = useAppBridge();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [experimentName, setExperimentName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenCreateModal = () => setIsCreateModalOpen(true);
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setExperimentName("");
  };

  const handleCreateExperiment = useCallback(async () => {
    if (!experimentName.trim()) {
      shopify.toast.show("Experiment name is required.", { isError: true });
      return;
    }
    setIsLoading(true);
    console.log("[A/B Testing UI] Starting experiment creation...");

    // Get shop from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const shop = urlParams.get('shop') || '';

    const formData = new FormData();
    formData.append("intent", "create");
    formData.append("name", experimentName);
    formData.append("shop", shop); // Pass shop to bypass auth

    try {
      console.log("[A/B Testing UI] Sending request to /api/ab-testing-admin");
      const response = await fetch("/api/ab-testing-admin", {
        method: "POST",
        body: formData,
      });

      console.log(`[A/B Testing UI] Received response with status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[A/B Testing UI] Server responded with an error:", errorText);
        throw new Error(`Server error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("[A/B Testing UI] Experiment created successfully:", result);
      shopify.toast.show("Experiment created successfully!");
      handleCloseCreateModal();
      window.location.reload();

    } catch (error) {
      console.error("[A/B Testing UI] An error occurred during fetch:", error);
      shopify.toast.show("Failed to create experiment.", { isError: true });
    } finally {
      setIsLoading(false);
      console.log("[A/B Testing UI] Experiment creation process finished.");
    }
  }, [experimentName, shopify]);

  const rows = experiments.map((exp) => [
    exp.name,
    exp.status,
    exp.testType,
    new Date(exp.createdAt).toLocaleDateString(),
  ]);

  return (
    <Page>
      <TitleBar title="A/B Testing">
        <Button variant="primary" onClick={handleOpenCreateModal}>
          Create Experiment
        </Button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <LegacyCard>
            {experiments.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Name", "Status", "Type", "Created At"]}
                rows={rows}
              />
            ) : (
              <EmptyState
                heading="No A/B experiments yet"
                action={{ content: "Create Experiment", onAction: handleOpenCreateModal }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create your first A/B test to compare different strategies and boost your sales.</p>
              </EmptyState>
            )}
          </LegacyCard>
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
