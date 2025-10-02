import { useState, useEffect } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const settings = await getSettings(shop);
  
  return json({
    settings: settings || {},
    cartIconOptions: [
      { label: 'Default', value: 'default' },
      { label: 'Minimal', value: 'minimal' },
      { label: 'Bold', value: 'bold' },
    ],
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  console.log(`[SETTINGS V3 ACTION] ✅✅✅ Action called for shop: ${shop}`);

  try {
    const formData = await request.formData();
    
    // Convert FormData to settings object
    const settings: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      if (value === 'true') settings[key] = true;
      else if (value === 'false') settings[key] = false;
      else if (!isNaN(Number(value)) && value.toString().trim() !== '') settings[key] = Number(value);
      else settings[key] = value;
    }
    
    console.log('[SETTINGS V3 ACTION] Processed settings:', Object.keys(settings).length, 'fields');

    await saveSettings(shop, settings);
    console.log('[SETTINGS V3 ACTION] ✅ Settings saved successfully');
    
    // Return success - we'll handle navigation on client side
    return json({ 
      success: true, 
      message: "Settings saved successfully!" 
    });
  } catch (error) {
    console.error("[SETTINGS V3 ACTION] ❌ Error:", error);
    return json({ 
      success: false, 
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }, { status: 500 });
  }
};

export default function SettingsV3() {
  const { settings, cartIconOptions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  
  // Local state for form fields
  const [autoOpenCart, setAutoOpenCart] = useState(settings.autoOpenCart !== false);
  const [enableAnalytics, setEnableAnalytics] = useState(settings.enableAnalytics || false);
  const [enableAddons, setEnableAddons] = useState(settings.enableAddons || false);
  const [enableExpressCheckout, setEnableExpressCheckout] = useState(settings.enableExpressCheckout || false);
  const [enableMLRecommendations, setEnableMLRecommendations] = useState(settings.enableMLRecommendations || false);
  const [mlPersonalizationMode, setMlPersonalizationMode] = useState(settings.mlPersonalizationMode || "basic");
  const [maxRecommendationProducts, setMaxRecommendationProducts] = useState(String((settings as any).maxRecommendationProducts || 3));
  const [cartIcon, setCartIcon] = useState(settings.cartIcon || 'default');
  const [checkoutButtonText, setCheckoutButtonText] = useState(settings.checkoutButtonText || "CHECKOUT");
  const [addButtonText, setAddButtonText] = useState(settings.addButtonText || "Add");
  
  const isSubmitting = navigation.state === "submitting";

  // Show toast when action completes successfully
  useEffect(() => {
    if (actionData?.success) {
      shopify.toast.show("✅ Settings saved successfully!");
    } else if (actionData && !actionData.success) {
      shopify.toast.show(`❌ ${actionData.message}`, { isError: true });
    }
  }, [actionData, shopify]);

  return (
    <Page>
      <TitleBar title="Settings (Working Version)" />
      
      <Form method="post">
        <BlockStack gap="500">
          {actionData && (
            <Banner 
              tone={actionData.success ? "success" : "critical"}
            >
              {actionData.message}
            </Banner>
          )}

          {/* Header */}
          <Card>
            <Text as="p" variant="bodyMd" tone="subdued" fontWeight="bold">
              Settings • Configure your cart optimization features
            </Text>
          </Card>
          
          {/* Quick Setup */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">🚀 Quick Setup</Text>
              <FormLayout>
                <Checkbox
                  label="Auto-open cart when item added"
                  checked={autoOpenCart}
                  onChange={setAutoOpenCart}
                  helpText="Automatically show cart when customers add items (recommended)"
                />
                <input type="hidden" name="autoOpenCart" value={String(autoOpenCart)} />
                
                <Checkbox
                  label="Enable Analytics Tracking"
                  checked={enableAnalytics}
                  onChange={setEnableAnalytics}
                  helpText="Track cart opens, clicks on recommendations, and checkout starts"
                />
                <input type="hidden" name="enableAnalytics" value={String(enableAnalytics)} />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Advanced Cart Features */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">🛒 Advanced Cart Features</Text>
              <FormLayout>
                <Checkbox
                  label="Enable Add-ons & Upsells"
                  checked={enableAddons}
                  onChange={setEnableAddons}
                  helpText="Display product add-ons and upsell opportunities"
                />
                <input type="hidden" name="enableAddons" value={String(enableAddons)} />

                <Checkbox
                  label="Enable Express Checkout Buttons"
                  checked={enableExpressCheckout}
                  onChange={setEnableExpressCheckout}
                  helpText="Show PayPal, Shop Pay, and other express checkout options"
                />
                <input type="hidden" name="enableExpressCheckout" value={String(enableExpressCheckout)} />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* AI Recommendations */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">🤖 AI-Powered Recommendations</Text>
              <FormLayout>
                <Checkbox
                  label="Enable ML Recommendations"
                  checked={enableMLRecommendations}
                  onChange={setEnableMLRecommendations}
                  helpText="Use machine learning to personalize product recommendations"
                />
                <input type="hidden" name="enableMLRecommendations" value={String(enableMLRecommendations)} />

                {enableMLRecommendations && (
                  <BlockStack gap="400">
                    <Select
                      label="ML Personalization Mode"
                      options={[
                        { label: 'Basic', value: 'basic' },
                        { label: 'Advanced', value: 'advanced' },
                        { label: 'Custom', value: 'custom' }
                      ]}
                      value={mlPersonalizationMode}
                      onChange={setMlPersonalizationMode}
                      name="mlPersonalizationMode"
                    />

                    <TextField
                      label="Maximum Products to Show"
                      value={maxRecommendationProducts}
                      onChange={setMaxRecommendationProducts}
                      name="maxRecommendationProducts"
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

          {/* Cart Icon */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">🎨 Cart Icon Style</Text>
              <FormLayout>
                <Select
                  label="Cart Icon Style"
                  options={cartIconOptions}
                  value={cartIcon}
                  onChange={setCartIcon}
                  name="cartIcon"
                />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* Text Customization */}
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">✏️ Button Labels</Text>
              <FormLayout>
                <InlineStack gap="400" wrap={false}>
                  <TextField
                    label="Checkout Button"
                    value={checkoutButtonText}
                    onChange={setCheckoutButtonText}
                    name="checkoutButtonText"
                    autoComplete="off"
                  />

                  <TextField
                    label="Add Button"
                    value={addButtonText}
                    onChange={setAddButtonText}
                    name="addButtonText"
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
                submit
                loading={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Settings"}
              </Button>
            </InlineStack>
          </Card>
        </BlockStack>
      </Form>
    </Page>
  );
}
