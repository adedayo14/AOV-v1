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
  
  console.log(`[SETTINGS V4 ACTION] ✅✅✅ Action called for shop: ${shop}`);

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
    
    console.log('[SETTINGS V4 ACTION] Processed settings:', Object.keys(settings).length, 'fields');

    await saveSettings(shop, settings);
    console.log('[SETTINGS V4 ACTION] ✅ Settings saved successfully');
    
    return json({ 
      success: true, 
      message: "Settings saved successfully!" 
    });
  } catch (error) {
    console.error("[SETTINGS V4 ACTION] ❌ Error:", error);
    return json({ 
      success: false, 
      message: error instanceof Error ? error.message : "An unknown error occurred",
    }, { status: 500 });
  }
};

export default function SettingsV4() {
  const { settings, cartIconOptions } = useLoaderData<typeof loader>();
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
  
  const [isSaving, setIsSaving] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerTone, setBannerTone] = useState<"success" | "critical">("success");

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setShowBanner(false);
    
    try {
      console.log('[SETTINGS V4 UI] Starting save...');
      
      // Build FormData
      const formData = new FormData();
      formData.append('autoOpenCart', String(autoOpenCart));
      formData.append('enableAnalytics', String(enableAnalytics));
      formData.append('enableAddons', String(enableAddons));
      formData.append('enableExpressCheckout', String(enableExpressCheckout));
      formData.append('enableMLRecommendations', String(enableMLRecommendations));
      formData.append('mlPersonalizationMode', mlPersonalizationMode);
      formData.append('maxRecommendationProducts', maxRecommendationProducts);
      formData.append('cartIcon', cartIcon);
      formData.append('checkoutButtonText', checkoutButtonText);
      formData.append('addButtonText', addButtonText);
      
      console.log('[SETTINGS V4 UI] Submitting to server...');
      
      // Use fetch directly
      const response = await fetch('/app/settings-v4', {
        method: 'POST',
        body: formData,
      });
      
      console.log('[SETTINGS V4 UI] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[SETTINGS V4 UI] Result:', result);
      
      if (result.success) {
        setBannerMessage(result.message);
        setBannerTone("success");
        setShowBanner(true);
        shopify.toast.show("✅ Settings saved successfully!");
        
        // Hide banner after 5 seconds
        setTimeout(() => setShowBanner(false), 5000);
      } else {
        throw new Error(result.message || 'Save failed');
      }
    } catch (error) {
      console.error('[SETTINGS V4 UI] Error:', error);
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      setBannerMessage(message);
      setBannerTone("critical");
      setShowBanner(true);
      shopify.toast.show(`❌ ${message}`, { isError: true });
    } finally {
      setIsSaving(false);
    }
  }, [autoOpenCart, enableAnalytics, enableAddons, enableExpressCheckout, enableMLRecommendations, 
      mlPersonalizationMode, maxRecommendationProducts, cartIcon, checkoutButtonText, addButtonText, shopify]);

  return (
    <Page>
      <TitleBar title="Settings V4 (Fetch-based)" />
      
      <BlockStack gap="500">
        {showBanner && (
          <Banner tone={bannerTone} onDismiss={() => setShowBanner(false)}>
            {bannerMessage}
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Cart Behavior</Text>
            
            <Checkbox
              label="Auto-open cart after adding product"
              checked={autoOpenCart}
              onChange={setAutoOpenCart}
            />
            
            <Checkbox
              label="Enable analytics tracking"
              checked={enableAnalytics}
              onChange={setEnableAnalytics}
            />
            
            <Checkbox
              label="Enable add-ons & cross-sells"
              checked={enableAddons}
              onChange={setEnableAddons}
            />
            
            <Checkbox
              label="Show express checkout buttons"
              checked={enableExpressCheckout}
              onChange={setEnableExpressCheckout}
            />
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">ML Recommendations</Text>
            
            <Checkbox
              label="Enable ML-powered product recommendations"
              checked={enableMLRecommendations}
              onChange={setEnableMLRecommendations}
            />
            
            {enableMLRecommendations && (
              <FormLayout>
                <Select
                  label="Personalization mode"
                  options={[
                    { label: 'Basic', value: 'basic' },
                    { label: 'Advanced', value: 'advanced' },
                  ]}
                  value={mlPersonalizationMode}
                  onChange={setMlPersonalizationMode}
                />
                
                <TextField
                  label="Max recommendation products"
                  type="number"
                  value={maxRecommendationProducts}
                  onChange={setMaxRecommendationProducts}
                  autoComplete="off"
                />
              </FormLayout>
            )}
          </BlockStack>
        </Card>

        <Card>
          <FormLayout>
            <Select
              label="Cart icon style"
              options={cartIconOptions}
              value={cartIcon}
              onChange={setCartIcon}
            />
            
            <TextField
              label="Checkout button text"
              value={checkoutButtonText}
              onChange={setCheckoutButtonText}
              autoComplete="off"
            />
            
            <TextField
              label="Add to cart button text"
              value={addButtonText}
              onChange={setAddButtonText}
              autoComplete="off"
            />
          </FormLayout>
        </Card>

        <InlineStack align="end">
          <Button 
            variant="primary" 
            onClick={handleSave}
            loading={isSaving}
          >
            Save Settings
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
