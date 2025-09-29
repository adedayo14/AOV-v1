import { json, redirect } from "@remix-run/node";
import { useActionData, useFetcher, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";
import { Page, Card, EmptyState } from "@shopify/polaris";
// Note: ExperimentCard component needs to be created or imported from correct location
// import { ExperimentCard } from "../components/ExperimentCard";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await prisma.settings.findUnique({
    where: { shop },
    select: {
      abExperiments: true,
    },
  });

  return json({ settings });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const shop = session.shop;

  try {
    const intent = formData.get("intent");
    const settings = await prisma.settings.findUnique({
      where: { shop }
    });

    let experiments = settings?.abExperiments || [];

    switch (intent) {
      case "save": {
        const experimentData = formData.get("experiments");
        experiments = experimentData ? JSON.parse(experimentData) : [];
        
        // Validate experiments
        experiments = experiments.map((exp, index) => ({
          id: exp.id || `exp_${Date.now()}_${index}`,
          name: exp.name || `Experiment ${index + 1}`,
          feature: exp.feature || "free_shipping",
          variantA: exp.variantA || {},
          variantB: exp.variantB || {},
          trafficSplit: parseInt(exp.trafficSplit) || 50,
          status: exp.status || "draft",
          startDate: exp.startDate || new Date().toISOString(),
          endDate: exp.endDate || null,
          metrics: exp.metrics || {
            variantA: { conversions: 0, revenue: 0, views: 0 },
            variantB: { conversions: 0, revenue: 0, views: 0 }
          }
        }));
        break;
      }

      case "toggle": {
        const experimentId = formData.get("experimentId");
        const experimentIndex = experiments.findIndex(e => e.id === experimentId);
        if (experimentIndex !== -1) {
          experiments[experimentIndex].status = 
            experiments[experimentIndex].status === "active" ? "paused" : "active";
        }
        break;
      }

      case "delete": {
        const experimentId = formData.get("experimentId");
        experiments = experiments.filter(e => e.id !== experimentId);
        break;
      }
    }

    // Update settings
    await prisma.settings.upsert({
      where: { shop },
      update: { abExperiments: experiments },
      create: { 
        shop, 
        abExperiments: experiments,
        cartEnabled: true
      }
    });

    return json({ 
      success: true, 
      message: "A/B tests saved successfully",
      experiments 
    });
  } catch (error) {
    console.error("A/B testing save error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

export default function ABTestingIndex() {
  const { settings } = useLoaderData();
  const actionData = useActionData();
  const fetcher = useFetcher();
  const navigation = useNavigation();
  
  const [experiments, setExperiments] = useState(settings?.abExperiments || []);
  const [toastActive, setToastActive] = useState(false);

  useEffect(() => {
    if (actionData?.success) {
      setToastActive(true);
      if (actionData.experiments) {
        setExperiments(actionData.experiments);
      }
    }
  }, [actionData]);

  const handleAddExperiment = () => {
    const newExperiment = {
      id: `exp_${Date.now()}`,
      name: `New Experiment ${experiments.length + 1}`,
      feature: "free_shipping",
      variantA: {
        enabled: true,
        threshold: 50,
        message: "Free shipping on orders over $50!"
      },
      variantB: {
        enabled: true,
        threshold: 75,
        message: "Free shipping on orders over $75!"
      },
      trafficSplit: 50,
      status: "draft",
      startDate: new Date().toISOString(),
      metrics: {
        variantA: { conversions: 0, revenue: 0, views: 0 },
        variantB: { conversions: 0, revenue: 0, views: 0 }
      }
    };
    setExperiments([...experiments, newExperiment]);
  };

  const handleUpdateExperiment = (index, updatedExperiment) => {
    const updated = [...experiments];
    updated[index] = { ...updated[index], ...updatedExperiment };
    setExperiments(updated);
  };

  const handleDeleteExperiment = (index) => {
    setExperiments(experiments.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("intent", "save");
    formData.append("experiments", JSON.stringify(experiments));
    fetcher.submit(formData, { method: "post" });
  };

  const handleToggleExperiment = (experimentId) => {
    const formData = new FormData();
    formData.append("intent", "toggle");
    formData.append("experimentId", experimentId);
    fetcher.submit(formData, { method: "post" });
  };

  const isLoading = navigation.state === "submitting" || fetcher.state === "submitting";

  return (
    <Page
      title="A/B Testing"
      primaryAction={{
        content: "Save All Tests",
        onAction: handleSave,
        loading: isLoading,
        disabled: experiments.length === 0
      }}
      secondaryActions={[
        {
          content: "Create New Test",
          onAction: handleAddExperiment,
        },
      ]}
    >
      {experiments.length === 0 ? (
        <Card sectioned>
          <EmptyState
            heading="Start A/B testing your cart features"
            action={{
              content: "Create First Test",
              onAction: handleAddExperiment,
            }}
            image="/empty-state.svg"
          >
            <p>Test different cart configurations to optimize conversions.</p>
          </EmptyState>
        </Card>
      ) : (
        <>
          {experiments.map((experiment, index) => (
            <div key={experiment.id} style={{ marginBottom: "1rem" }}>
              <ExperimentCard
                experiment={experiment}
                index={index}
                onUpdate={handleUpdateExperiment}
                onDelete={handleDeleteExperiment}
              />
            </div>
          ))}
        </>
      )}

      {toastActive && (
        <Toast
          content={actionData?.message || "Changes saved"}
          onDismiss={() => setToastActive(false)}
        />
      )}
    </Page>
  );
}