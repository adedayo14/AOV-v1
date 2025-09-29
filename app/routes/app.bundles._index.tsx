import { json } from "@remix-run/node";
import { useEffect, useState } from "react";
import { Button, Card, FormLayout, Select, Text, TextField } from "@shopify/polaris";

import { prisma } from "~/db.server";
import { authenticate } from "~/session.server";

// ...existing code...

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  
  const shop = session.shop;

  try {
    const currentSettings = await prisma.settings.findUnique({
      where: { shop },
    });

    if (action === "save") {
      const bundlesData = formData.get("bundles");
      const bundles = bundlesData ? JSON.parse(bundlesData) : [];
      
      // Ensure each bundle has required fields
      const validBundles = bundles.map((bundle, index) => ({
        id: bundle.id || `bundle_${Date.now()}_${index}`,
        name: bundle.name || `Bundle ${index + 1}`,
        trigger: bundle.trigger || "manual",
        discountType: bundle.discountType || "percentage",
        discountValue: parseFloat(bundle.discountValue) || 0,
        bundleType: bundle.bundleType || "product",
        categories: bundle.categories || [],
        products: bundle.products || [],
        collections: bundle.collections || [],
        minItems: parseInt(bundle.minItems) || 2,
        maxItems: parseInt(bundle.maxItems) || 5,
        active: bundle.active !== false,
      }));

      await prisma.settings.update({
        where: { shop },
        data: {
          manualBundles: validBundles,
        },
      });

      return json({ 
        success: true, 
        message: "Bundles saved successfully",
        bundles: validBundles 
      });
    }

    if (action === "toggle") {
      const bundleId = formData.get("bundleId");
      const active = formData.get("active") === "true";
      
      const bundles = currentSettings?.manualBundles || [];
      const updatedBundles = bundles.map(bundle =>
        bundle.id === bundleId ? { ...bundle, active } : bundle
      );

      await prisma.settings.update({
        where: { shop },
        data: {
          manualBundles: updatedBundles,
        },
      });

      return json({ success: true });
    }

    if (action === "delete") {
      const bundleId = formData.get("bundleId");
      
      const bundles = currentSettings?.manualBundles || [];
      const updatedBundles = bundles.filter(bundle => bundle.id !== bundleId);

      await prisma.settings.update({
        where: { shop },
        data: {
          manualBundles: updatedBundles,
        },
      });

      return json({ success: true });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bundle action error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

function BundleForm({ bundle, index, onUpdate, onDelete }) {
  const [localBundle, setLocalBundle] = useState({
    id: bundle?.id || `bundle_${Date.now()}_${index}`,
    name: bundle?.name || "",
    trigger: bundle?.trigger || "manual",
    discountType: bundle?.discountType || "percentage",
    discountValue: bundle?.discountValue || 10,
    bundleType: bundle?.bundleType || "product",
    categories: bundle?.categories || [],
    products: bundle?.products || [],
    collections: bundle?.collections || [],
    minItems: bundle?.minItems || 2,
    maxItems: bundle?.maxItems || 5,
    active: bundle?.active !== false,
  });

  const [selectedItems, setSelectedItems] = useState({
    products: bundle?.products || [],
    collections: bundle?.collections || [],
  });

  useEffect(() => {
    // Listen for product selection from popup
    const handleMessage = (event) => {
      if (event.data.type === "bundle-selection") {
        const { selectedProducts, selectedCollections } = event.data;
        
        setSelectedItems({
          products: selectedProducts || [],
          collections: selectedCollections || [],
        });
        
        setLocalBundle(prev => ({
          ...prev,
          products: selectedProducts || [],
          collections: selectedCollections || [],
        }));

        // Update parent
        onUpdate(index, {
          ...localBundle,
          products: selectedProducts || [],
          collections: selectedCollections || [],
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [index, localBundle, onUpdate]);

  const handleFieldChange = (field, value) => {
    const updatedBundle = { ...localBundle, [field]: value };
    setLocalBundle(updatedBundle);
    onUpdate(index, updatedBundle);
  };

  const openProductSelector = () => {
    const width = 800;
    const height = 600;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    window.open(
      "/app/bundles/collections",
      "productSelector",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  return (
    <Card sectioned>
      <FormLayout>
        <TextField
          label="Bundle Name"
          value={localBundle.name}
          onChange={(value) => handleFieldChange("name", value)}
          placeholder="e.g., Summer Collection Bundle"
        />

        <Select
          label="Trigger Type"
          options={[
            { label: "Manual Selection", value: "manual" },
            { label: "ML Recommendations", value: "ml" },
            { label: "Category-based", value: "category" },
          ]}
          value={localBundle.trigger}
          onChange={(value) => handleFieldChange("trigger", value)}
        />

        <FormLayout.Group>
          <Select
            label="Discount Type"
            options={[
              { label: "Percentage", value: "percentage" },
              { label: "Fixed Amount", value: "fixed" },
            ]}
            value={localBundle.discountType}
            onChange={(value) => handleFieldChange("discountType", value)}
          />
          <TextField
            label="Discount Value"
            type="number"
            value={localBundle.discountValue.toString()}
            onChange={(value) => handleFieldChange("discountValue", parseFloat(value) || 0)}
            suffix={localBundle.discountType === "percentage" ? "%" : "$"}
          />
        </FormLayout.Group>

        <FormLayout.Group>
          <TextField
            label="Minimum Items"
            type="number"
            value={localBundle.minItems.toString()}
            onChange={(value) => handleFieldChange("minItems", parseInt(value) || 2)}
          />
          <TextField
            label="Maximum Items"
            type="number"
            value={localBundle.maxItems.toString()}
            onChange={(value) => handleFieldChange("maxItems", parseInt(value) || 5)}
          />
        </FormLayout.Group>

        <div style={{ marginTop: "1rem" }}>
          <Text variant="headingMd" as="h3">
            Products in Bundle
          </Text>
          <div style={{ marginTop: "0.5rem" }}>
            {selectedItems.products.length > 0 ? (
              <Text>{selectedItems.products.length} products selected</Text>
            ) : (
              <Text tone="subdued">No products selected</Text>
            )}
            {selectedItems.collections.length > 0 && (
              <Text>{selectedItems.collections.length} collections selected</Text>
            )}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <Button onClick={openProductSelector}>
              Select Products/Collections
            </Button>
          </div>
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
          <Button destructive onClick={() => onDelete(index)}>
            Delete Bundle
          </Button>
        </div>
      </FormLayout>
    </Card>
  );
}

// ...existing code...