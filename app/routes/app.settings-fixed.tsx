import { useState, useEffect } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
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
  
  console.log(`[SETTINGS FIXED ACTION] ✅ Action called for shop: ${shop}`);

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

    console.log('[SETTINGS FIXED] Saving settings:', settings);

    await saveSettings(shop, settings);
    
    console.log('[SETTINGS FIXED] Settings saved successfully');
    
    // Return JSON directly - no redirect needed!
    return json({ 
      success: true, 
      message: 'Settings saved successfully!' 
    });
  } catch (error) {
    console.error('[SETTINGS FIXED] Error saving settings:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save settings' 
    }, { status: 500 });
  }
};

export default function SettingsFixed() {
  const { settings: initialSettings, cartIconOptions } = useLoaderData<typeof loader>();
  
  // Use useFetcher instead of Form - this is the Shopify-recommended way!
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  // Local state for form fields - using actual SettingsData fields
  const [cartIcon, setCartIcon] = useState(initialSettings.cartIcon || 'default');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    initialSettings.freeShippingThreshold?.toString() || '50'
  );
  const [enableRecommendations, setEnableRecommendations] = useState(
    initialSettings.enableRecommendations || false
  );
  const [maxRecommendations, setMaxRecommendations] = useState(
    initialSettings.maxRecommendations?.toString() || '4'
  );
  const [enableAddons, setEnableAddons] = useState(
    initialSettings.enableAddons || false
  );
  const [enableDiscountCode, setEnableDiscountCode] = useState(
    initialSettings.enableDiscountCode || false
  );
  const [enableNotes, setEnableNotes] = useState(
    initialSettings.enableNotes || false
  );
  const [enableExpressCheckout, setEnableExpressCheckout] = useState(
    initialSettings.enableExpressCheckout || false
  );
  const [freeShippingText, setFreeShippingText] = useState(
    initialSettings.freeShippingText || 'Free shipping on orders over ${{threshold}}'
  );
  const [checkoutButtonText, setCheckoutButtonText] = useState(
    initialSettings.checkoutButtonText || 'Checkout'
  );

  // Check if fetcher is submitting
  const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";

  // Show toast notification when save completes successfully
  useEffect(() => {
    if (fetcher.data?.success && fetcher.state === "idle") {
      shopify.toast.show("Settings saved!");
    }
  }, [fetcher.data, fetcher.state, shopify]);

  // Handle save using fetcher.submit() - Shopify's recommended pattern
  const handleSave = () => {
    const formData = new FormData();
    formData.append('cartIcon', cartIcon);
    formData.append('freeShippingThreshold', freeShippingThreshold);
    formData.append('enableRecommendations', enableRecommendations.toString());
    formData.append('maxRecommendations', maxRecommendations);
    formData.append('enableAddons', enableAddons.toString());
    formData.append('enableDiscountCode', enableDiscountCode.toString());
    formData.append('enableNotes', enableNotes.toString());
    formData.append('enableExpressCheckout', enableExpressCheckout.toString());
    formData.append('freeShippingText', freeShippingText);
    formData.append('checkoutButtonText', checkoutButtonText);

    // Use fetcher.submit() - this is the key!
    fetcher.submit(formData, { method: "POST" });
  };

  const showError = fetcher.data && 'error' in fetcher.data;

  return (
    <Page>
      <TitleBar title="Settings (Fixed with useFetcher)" />
      <BlockStack gap="500">
        {showError && fetcher.data && 'error' in fetcher.data && (
          <Banner tone="critical" title="Error">
            <p>{fetcher.data.error}</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Cart Display Settings
            </Text>
            <FormLayout>
              <Select
                label="Cart Icon Style"
                options={cartIconOptions}
                value={cartIcon}
                onChange={setCartIcon}
              />
              <TextField
                label="Free Shipping Threshold ($)"
                type="number"
                value={freeShippingThreshold}
                onChange={setFreeShippingThreshold}
                autoComplete="off"
              />
              <TextField
                label="Free Shipping Message"
                value={freeShippingText}
                onChange={setFreeShippingText}
                autoComplete="off"
                helpText="Use {{threshold}} as placeholder for the threshold amount"
              />
            </FormLayout>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Features
            </Text>
            <BlockStack gap="300">
              <Checkbox
                label="Enable Product Recommendations"
                checked={enableRecommendations}
                onChange={setEnableRecommendations}
              />
              {enableRecommendations && (
                <TextField
                  label="Maximum Recommendations"
                  type="number"
                  value={maxRecommendations}
                  onChange={setMaxRecommendations}
                  autoComplete="off"
                />
              )}
              <Checkbox
                label="Enable Add-ons"
                checked={enableAddons}
                onChange={setEnableAddons}
              />
              <Checkbox
                label="Enable Discount Code Input"
                checked={enableDiscountCode}
                onChange={setEnableDiscountCode}
              />
              <Checkbox
                label="Enable Order Notes"
                checked={enableNotes}
                onChange={setEnableNotes}
              />
              <Checkbox
                label="Enable Express Checkout"
                checked={enableExpressCheckout}
                onChange={setEnableExpressCheckout}
              />
            </BlockStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Button Text
            </Text>
            <TextField
              label="Checkout Button Text"
              value={checkoutButtonText}
              onChange={setCheckoutButtonText}
              autoComplete="off"
            />
          </BlockStack>
        </Card>

        <InlineStack align="end">
          <Button 
            variant="primary" 
            onClick={handleSave}
            loading={isLoading}
          >
            Save Settings
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
