import { useState, useCallback } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  BlockStack,
  Text,
  Checkbox,
  Button,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../models/settings.server";

// Loader: Fetch settings from database
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const settings = await getSettings(shop);
  
  return json({
    settings: settings || {},
    ordersBadgeText: '0 Orders',
    dataQualityTone: 'info',
    dataQualityLabel: 'Low',
    cartIconOptions: [
      { label: 'Default', value: 'default' },
      { label: 'Minimal', value: 'minimal' },
      { label: 'Bold', value: 'bold' },
    ],
  });
};

// Action: Save settings to database
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  console.log(`[SETTINGS ACTION] Received request for shop: ${shop}`);

  try {
    const formData = await request.formData();
    const settingsJson = formData.get("settings");
    
    if (typeof settingsJson !== 'string') {
      throw new Error('Invalid settings data');
    }
    
    const settings = JSON.parse(settingsJson);
    console.log('[SETTINGS ACTION] Parsed settings:', Object.keys(settings).length, 'fields');

    await saveSettings(shop, settings);
    console.log('✅ [SETTINGS ACTION] Successfully saved settings');
    
    return json({ 
      success: true, 
      message: "Settings saved successfully!" 
    });
  } catch (error) {
    console.error("❌ [SETTINGS ACTION] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return json({ 
      success: false, 
      message: errorMessage,
    }, { status: 500 });
  }
};

export default function SettingsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  
  const [formSettings, setFormSettings] = useState<any>(loaderData.settings || {});
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const updateSetting = useCallback((key: string, value: any) => {
    setFormSettings((prev: any) => ({ ...prev, [key]: value }));
  }, []);

  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    setShowSuccessBanner(false);
    setShowErrorBanner(false);
    
    console.log('[SETTINGS UI] Starting save process...');
    
    try {
      // Create form data with JSON stringified settings
      const formData = new FormData();
      formData.append('settings', JSON.stringify(formSettings));
      
      console.log('[SETTINGS UI] Submitting settings via fetch...');
      
      // Use fetch directly instead of Remix submit for better control
      const response = await fetch('/app/settings-new', {
        method: 'POST',
        body: formData,
      });
      
      console.log('[SETTINGS UI] Received response:', response.status);
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ [SETTINGS UI] Settings saved successfully');
        setShowSuccessBanner(true);
        shopify.toast.show("Settings saved successfully!");
        
        // Hide success banner after 3 seconds
        setTimeout(() => {
          setShowSuccessBanner(false);
        }, 3000);
      } else {
        console.error('❌ [SETTINGS UI] Save failed:', result.message);
        setShowErrorBanner(true);
        setErrorMessage(result.message || 'Failed to save settings');
        shopify.toast.show("Failed to save settings", { isError: true });
      }
    } catch (error) {
      console.error('❌ [SETTINGS UI] Exception during save:', error);
      setShowErrorBanner(true);
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
      shopify.toast.show("Failed to save settings", { isError: true });
    } finally {
      setIsSaving(false);
    }
  }, [formSettings, shopify]);

  const cartIconOptions = loaderData.cartIconOptions || [];

  return (
    <Page>
      <TitleBar title="Settings">
        <button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {showSuccessBanner && (
          <Banner tone="success" onDismiss={() => setShowSuccessBanner(false)}>
            Settings saved successfully!
          </Banner>
        )}
        {showErrorBanner && (
          <Banner tone="critical" onDismiss={() => setShowErrorBanner(false)}>
            {errorMessage || 'Failed to save settings'}
          </Banner>
        )}

        {/* Header */}
        <Card>
          <Text as="p" variant="bodyMd" tone="subdued" fontWeight="bold">
            Settings • Configure your cart optimization features
          </Text>
        </Card>
        
        {/* Quick Setup - Most Important First */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">🚀 Quick Setup</Text>
            <FormLayout>
              <Checkbox
                label="Auto-open cart when item added"
                checked={formSettings.autoOpenCart !== false}
                onChange={(value) => updateSetting("autoOpenCart", value)}
                helpText="Automatically show cart when customers add items (recommended)"
              />
              
              <Checkbox
                label="Enable Analytics Tracking"
                checked={formSettings.enableAnalytics || false}
                onChange={(value) => updateSetting("enableAnalytics", value)}
                helpText="Optional. Tracks cart opens, clicks on recommendations, and checkout starts. No PII collected."
              />
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Core Cart Features */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">🛒 Advanced Cart Features</Text>
            <Text as="p" variant="bodyMd">Advanced functionality beyond basic cart features (basic features are configured in theme editor).</Text>
            <FormLayout>
              <Checkbox
                label="Enable Add-ons & Upsells"
                checked={formSettings.enableAddons || false}
                onChange={(value) => updateSetting("enableAddons", value)}
                helpText="Display product add-ons and upsell opportunities"
              />

              <Checkbox
                label="Enable Express Checkout Buttons"
                checked={formSettings.enableExpressCheckout || false}
                onChange={(value) => updateSetting("enableExpressCheckout", value)}
                helpText="Show PayPal, Shop Pay, and other express checkout options"
              />
            </FormLayout>
          </BlockStack>
        </Card>

        {/* AI-Powered Recommendations */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">🤖 AI-Powered Recommendations</Text>
            <Text as="p" variant="bodyMd">Configure machine learning and intelligent product recommendations to boost conversions.</Text>
            <FormLayout>
              <Checkbox
                label="Enable ML Recommendations"
                checked={formSettings.enableMLRecommendations || false}
                onChange={(value) => updateSetting("enableMLRecommendations", value)}
                helpText="Use machine learning to personalize product recommendations"
              />

              {formSettings.enableMLRecommendations && (
                <BlockStack gap="400">
                  <Select
                    label="ML Personalization Mode"
                    options={[
                      { label: 'Basic', value: 'basic' },
                      { label: 'Advanced', value: 'advanced' },
                      { label: 'Custom', value: 'custom' }
                    ]}
                    value={formSettings.mlPersonalizationMode || "basic"}
                    onChange={(value) => updateSetting("mlPersonalizationMode", value)}
                    helpText="Choose the level of personalization for recommendations"
                  />

                  <TextField
                    label="Maximum Products to Show"
                    value={String(formSettings.maxRecommendationProducts || 3)}
                    onChange={(value) => updateSetting("maxRecommendationProducts", parseInt(value) || 3)}
                    helpText="Number of recommendation products to display (1-12)"
                    type="number"
                    min={1}
                    max={12}
                    autoComplete="off"
                  />
                </BlockStack>
              )}
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Smart Bundles Configuration */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">📦 Smart Bundles</Text>
            <Text as="p" variant="bodyMd">Configure AI-powered product bundling to create compelling offers and increase average order value.</Text>
            <FormLayout>
              <Checkbox
                label="Enable Smart Bundles"
                checked={formSettings.enableSmartBundles || false}
                onChange={(value) => updateSetting("enableSmartBundles", value)}
                helpText="Enable AI-powered product bundling on your store"
              />

              {formSettings.enableSmartBundles && (
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">Bundle Placement & Display</Text>
                  
                  <Checkbox
                    label="Show bundles on product pages"
                    checked={formSettings.bundlesOnProductPages || false}
                    onChange={(value) => updateSetting("bundlesOnProductPages", value)}
                    helpText="Display smart bundles on individual product pages"
                  />
                  
                  <Checkbox
                    label="Show bundles in cart drawer"
                    checked={formSettings.bundlesInCartDrawer || false}
                    onChange={(value) => updateSetting("bundlesInCartDrawer", value)}
                    helpText="Show bundle suggestions inside the cart drawer"
                  />

                  <TextField
                    label="Default Bundle Discount (%)"
                    value={String(formSettings.defaultBundleDiscount || 10)}
                    onChange={(value) => updateSetting("defaultBundleDiscount", parseInt(value) || 10)}
                    helpText="Default discount percentage for smart bundles"
                    type="number"
                    min={0}
                    max={50}
                    autoComplete="off"
                  />
                </BlockStack>
              )}
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Cart Icon Selection */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">🎨 Cart Icon Style</Text>
            <Text as="p" variant="bodyMd">Choose your cart icon style. Colors and styling are configured in the theme editor.</Text>
            <FormLayout>
              <Select
                label="Cart Icon Style"
                options={cartIconOptions}
                value={formSettings.cartIcon || 'default'}
                onChange={(value) => updateSetting("cartIcon", value)}
                helpText="Choose the icon style for your cart (colors configured in theme editor)"
              />
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Text & Copy Customization */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">✏️ Text & Copy</Text>
            <Text as="p" variant="bodyMd">Customize all text displayed to customers in the cart experience.</Text>
            <FormLayout>
              <Text variant="headingSm" as="h3">🔘 Button Labels</Text>

              <InlineStack gap="400" wrap={false}>
                <TextField
                  label="Checkout Button"
                  value={formSettings.checkoutButtonText || "CHECKOUT"}
                  onChange={(value) => updateSetting("checkoutButtonText", value)}
                  helpText="Main checkout button text"
                  autoComplete="off"
                />

                <TextField
                  label="Add Button"
                  value={formSettings.addButtonText || "Add"}
                  onChange={(value) => updateSetting("addButtonText", value)}
                  helpText="Add to cart button text"
                  autoComplete="off"
                />
              </InlineStack>
            </FormLayout>
          </BlockStack>
        </Card>

        {/* Save Button */}
        <Card>
          <InlineStack align="end">
            <Button
              variant="primary"
              size="large"
              onClick={handleSaveSettings}
              loading={isSaving}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </InlineStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
