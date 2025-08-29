import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Select,
  Text,
  Banner,
  BlockStack,
  Button,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../models/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await getSettings(shop);
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const settings = Object.fromEntries(formData);
  
  // Convert string values to appropriate types
  const processedSettings = {
    ...settings,
    enableApp: settings.enableApp === 'true',
    enableStickyCart: settings.enableStickyCart === 'true',
    showOnlyOnCartPage: settings.showOnlyOnCartPage === 'true',
    enableFreeShipping: settings.enableFreeShipping === 'true',
    freeShippingThreshold: Number(settings.freeShippingThreshold) || 100,
    enableRecommendations: settings.enableRecommendations === 'true',
    enableAddons: settings.enableAddons === 'true',
    enableDiscountCode: settings.enableDiscountCode === 'true',
    enableNotes: settings.enableNotes === 'true',
    enableExpressCheckout: settings.enableExpressCheckout === 'true',
    enableAnalytics: settings.enableAnalytics === 'true',
    maxRecommendations: Number(settings.maxRecommendations) || 6,
    complementDetectionMode: settings.complementDetectionMode || 'automatic',
    manualComplementRules: settings.manualComplementRules || '{}',
  };
  
  try {
    await saveSettings(shop, processedSettings);
    return json({ success: true, message: "Settings saved successfully!" });
  } catch (error) {
    console.error("Error saving settings:", error);
    return json({ success: false, message: "Failed to save settings" }, { status: 500 });
  }
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  const [formSettings, setFormSettings] = useState(settings);

  const handleSubmit = () => {
    const formData = new FormData();
    Object.entries(formSettings).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    fetcher.submit(formData, { method: "post" });
  };

  const updateSetting = (key: string, value: any) => {
    setFormSettings(prev => ({ ...prev, [key]: value }));
  };

  const cartPositionOptions = [
    { label: "Bottom Right", value: "bottom-right" },
    { label: "Bottom Left", value: "bottom-left" },
    { label: "Top Right", value: "top-right" },
    { label: "Top Left", value: "top-left" },
  ];

  const cartIconOptions = [
    { label: "Shopping Cart", value: "cart" },
    { label: "Shopping Bag", value: "bag" },
    { label: "Basket", value: "basket" },
  ];

  const recommendationLayoutOptions = [
    { label: "Horizontal Row (Card Style)", value: "horizontal" },
    { label: "Vertical Stack", value: "vertical" },
    { label: "Grid Layout", value: "grid" },
  ];

  const complementDetectionModeOptions = [
    { label: "✨ Automatic (AI-Powered)", value: "automatic" },
    { label: "⚙️ Manual Rules Only", value: "manual" },
    { label: "🔄 Hybrid (Auto + Overrides)", value: "hybrid" },
  ];

  return (
    <Page
      title="UpCart Settings & Live Preview"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSubmit,
        loading: fetcher.state === "submitting",
      }}
    >
      {fetcher.state === "idle" && fetcher.data && (fetcher.data as any)?.success && (
        <Banner tone="success">
          Settings saved successfully!
        </Banner>
      )}
      
      {/* Full Width Layout - Maximize Available Space */}
      <div className="settings-grid-container">
        {/* Settings Column - Left Side - Full Space Usage */}
        <div className="settings-column">
          <BlockStack gap="500">
            
            {/* Welcome Section - Moved from _index */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">🛒 Welcome to UpCart</Text>
                <Text variant="bodyMd" as="p">
                  Transform your store's cart experience with our powerful cart drawer
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  ✨ Smart upsells • 🚀 Free shipping progress • 📱 Mobile responsive • 🎨 Fully customizable
                </Text>
                <InlineStack gap="300">
                  <Button 
                    variant="secondary" 
                    onClick={() => window.open(window.location.origin, '_blank')}
                  >
                    🏪 View Storefront
                  </Button>
                  <Button 
                    variant="secondary"
                    url="/app/dashboard"
                  >
                    📊 Analytics
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
            
            {/* Core App Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Core Settings</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable UpCart"
                    checked={formSettings.enableApp}
                    onChange={(value) => updateSetting("enableApp", value)}
                    helpText="Master toggle for the entire cart functionality"
                  />
                  
                  <Checkbox
                    label="Enable Sticky Cart Button"
                    checked={formSettings.enableStickyCart}
                    onChange={(value) => updateSetting("enableStickyCart", value)}
                    helpText="Show floating cart button on all pages"
                  />
                  
                  <Checkbox
                    label="Show only on cart page"
                    checked={formSettings.showOnlyOnCartPage}
                    onChange={(value) => updateSetting("showOnlyOnCartPage", value)}
                    helpText="If enabled, the cart drawer will only appear on the cart page"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Quick Test Actions - Enhanced */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">⚡ Quick Test Actions</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Test your cart drawer functionality quickly with these actions:
                </Text>
                <FormLayout>
                  <InlineStack gap="300">
                    <Button 
                      variant="secondary" 
                      onClick={() => window.open(window.location.origin, '_blank')}
                    >
                      🏪 Open Storefront
                    </Button>
                    <Button 
                      variant="secondary"
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.cartUpliftDrawer) {
                          window.cartUpliftDrawer.openDrawer();
                        } else {
                          alert('Visit your storefront to test the cart drawer');
                        }
                      }}
                    >
                      🛒 Test Cart Open
                    </Button>
                    <Button 
                      variant="secondary"
                      url="/app/dashboard"
                    >
                      📊 View Analytics
                    </Button>
                  </InlineStack>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    💡 Make sure the app embed is enabled in your theme editor first.
                  </Text>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Free Shipping Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Free Shipping Configuration</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Free Shipping Bar"
                    checked={formSettings.enableFreeShipping}
                    onChange={(value) => updateSetting("enableFreeShipping", value)}
                    helpText="Show progress bar and messages for free shipping threshold"
                  />
                  
                  <TextField
                    label="Free Shipping Threshold ($)"
                    type="number"
                    value={String(formSettings.freeShippingThreshold)}
                    onChange={(value) => updateSetting("freeShippingThreshold", parseInt(value) || 100)}
                    helpText="Minimum order amount for free shipping"
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Shipping Message"
                    value={formSettings.freeShippingText}
                    onChange={(value) => updateSetting("freeShippingText", value)}
                    helpText="Use {amount} as placeholder for remaining amount"
                    multiline={2}
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Free Shipping Success Message"
                    value={formSettings.freeShippingAchievedText}
                    onChange={(value) => updateSetting("freeShippingAchievedText", value)}
                    multiline={2}
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Cart Position & Appearance */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Cart Position & Styling</Text>
                <FormLayout>
                  <Select
                    label="Cart Position"
                    options={cartPositionOptions}
                    value={formSettings.cartPosition}
                    onChange={(value) => updateSetting("cartPosition", value)}
                  />
                  
                  <Select
                    label="Cart Icon Style"
                    options={cartIconOptions}
                    value={formSettings.cartIcon}
                    onChange={(value) => updateSetting("cartIcon", value)}
                  />
                  
                  <Divider />
                  
                  <TextField
                    label="Background Color"
                    value={formSettings.backgroundColor}
                    onChange={(value) => updateSetting("backgroundColor", value)}
                    helpText="Cart drawer background color (hex format)"
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Text Color"
                    value={formSettings.textColor}
                    onChange={(value) => updateSetting("textColor", value)}
                    helpText="Main text color in cart (hex format)"
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Button Color"
                    value={formSettings.buttonColor}
                    onChange={(value) => updateSetting("buttonColor", value)}
                    helpText="Primary button and accent color (hex format)"
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Product Recommendations */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Product Recommendations</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Product Recommendations"
                    checked={formSettings.enableRecommendations}
                    onChange={(value) => updateSetting("enableRecommendations", value)}
                    helpText="Show recommended products in cart drawer"
                  />
                  
                  <Select
                    label="Recommendation Layout"
                    options={recommendationLayoutOptions}
                    value={formSettings.recommendationLayout}
                    onChange={(value) => updateSetting("recommendationLayout", value)}
                    disabled={!formSettings.enableRecommendations}
                  />
                  
                  <TextField
                    label="Max Recommendations"
                    type="number"
                    value={String(formSettings.maxRecommendations)}
                    onChange={(value) => updateSetting("maxRecommendations", parseInt(value) || 6)}
                    helpText="Maximum number of products to show (2-8)"
                    disabled={!formSettings.enableRecommendations}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Recommendations Title"
                    value={formSettings.recommendationsTitle}
                    onChange={(value) => updateSetting("recommendationsTitle", value)}
                    helpText="Title shown above recommendations"
                    disabled={!formSettings.enableRecommendations}
                    autoComplete="off"
                  />
                  
                  <Select
                    label="✨ Smart Complement Detection Mode"
                    options={complementDetectionModeOptions}
                    value={(formSettings as any).complementDetectionMode || 'automatic'}
                    onChange={(value) => updateSetting("complementDetectionMode", value)}
                    helpText="How Cart Uplift identifies complementary products for recommendations"
                    disabled={!formSettings.enableRecommendations}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Manual Complement Rules */}
            {formSettings.enableRecommendations && (formSettings as any).complementDetectionMode !== 'automatic' && (
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">⚙️ Manual Complement Rules</Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Override AI detection with custom rules. Define which products should recommend specific complements.
                  </Text>
                  
                  <FormLayout>
                    <BlockStack gap="300">
                      <div className="cartuplift-detection-preview">
                        <Text variant="headingMd" as="h3">✨ Automatic Detections Preview:</Text>
                        <ul style={{ fontSize: '14px', color: '#6B7280', marginTop: '8px', paddingLeft: '20px' }}>
                          <li>Running Shoes → Socks, Insoles, Water Bottle</li>
                          <li>Dress Shirts → Ties, Cufflinks, Collar Stays</li>
                          <li>Laptops → Cases, Mouse, Keyboard</li>
                          <li>Coffee Makers → Coffee Beans, Filters, Mugs</li>
                          <li>Yoga Mats → Yoga Blocks, Straps, Water Bottles</li>
                        </ul>
                      </div>
                      
                      <TextField
                        label="Manual Override Rules (JSON Format)"
                        value={(formSettings as any).manualComplementRules || '{}'}
                        onChange={(value) => updateSetting("manualComplementRules", value)}
                        multiline={6}
                        helpText='Example: {"winter boots": ["wool socks", "boot spray"], "limited edition sneakers": ["display case", "sneaker cleaner"]}'
                        autoComplete="off"
                      />
                    </BlockStack>
                  </FormLayout>
                </BlockStack>
              </Card>
            )}

            {/* Additional Features */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Additional Features</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Discount Code Field"
                    checked={formSettings.enableDiscountCode}
                    onChange={(value) => updateSetting("enableDiscountCode", value)}
                    helpText="Allow customers to enter discount codes in cart"
                  />
                  
                  <Checkbox
                    label="Enable Order Notes"
                    checked={formSettings.enableNotes}
                    onChange={(value) => updateSetting("enableNotes", value)}
                    helpText="Allow customers to add notes to their order"
                  />
                  
                  <Checkbox
                    label="Enable Express Checkout"
                    checked={formSettings.enableExpressCheckout}
                    onChange={(value) => updateSetting("enableExpressCheckout", value)}
                    helpText="Show express checkout buttons (Apple Pay, Shop Pay, etc.)"
                  />
                  
                  <Checkbox
                    label="Enable Analytics"
                    checked={formSettings.enableAnalytics}
                    onChange={(value) => updateSetting("enableAnalytics", value)}
                    helpText="Track cart interactions and performance metrics"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
        
        {/* Cart Preview Column - Right Side - Larger Container */}
        <div className="settings-column">
          <BlockStack gap="500">
            {/* Live Cart Preview - Enhanced with Better Container */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">🛒 Live Cart Preview</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Exact replica of your cart drawer - updates in real-time as you change settings
                </Text>
                
                {/* Inject Cart Uplift CSS + Layout Styles */}
                <style dangerouslySetInnerHTML={{
                  __html: `
                    /* Grid Layout Styles for Settings Page */
                    .settings-grid-container {
                      display: grid;
                      grid-template-columns: 1fr 1fr;
                      gap: 24px;
                      min-height: 80vh;
                      width: 100%;
                      max-width: 1400px;
                      margin: 0 auto;
                    }
                    
                    .settings-column {
                      min-width: 0;
                    }
                    
                    .preview-link-button {
                      background: none;
                      border: none;
                      padding: 0;
                      font-size: inherit;
                      font-weight: inherit;
                      color: inherit;
                      text-decoration: underline;
                      cursor: pointer;
                    }
                    
                    .close-icon {
                      width: 24px;
                      height: 24px;
                    }
                    
                    /* Cart Uplift Preview Styles - Exact match to cart-uplift.css */
                    .cartuplift-preview-container {
                      --cartuplift-primary: #1a1a1a;
                      --cartuplift-secondary: #666666;
                      --cartuplift-border: #e5e5e5;
                      --cartuplift-background: #ffffff;
                      --cartuplift-button-color: ${formSettings.buttonColor || '#4CAF50'};
                      --cartuplift-teal: #16a085;
                      --cartuplift-danger: #ff4444;
                      --cartuplift-success: #22c55e;
                      --cartuplift-drawer-width: 520px;
                      --cartuplift-border-radius: 6px;
                      --cartuplift-recommendations-bg: #f6fafd;
                      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                      -webkit-font-smoothing: antialiased;
                      -moz-osx-font-smoothing: grayscale;
                    }

                    /* Enhanced Preview Container - Bigger and Better */
                    .cartuplift-preview-wrapper {
                      width: 100%;
                      max-width: 600px;
                      margin: 0 auto;
                      overflow: visible;
                      padding: 20px;
                      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                      border-radius: 16px;
                      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                    }

                    .cartuplift-preview-drawer {
                      width: 100%;
                      max-width: 560px;
                      height: 700px;
                      background: var(--cartuplift-background);
                      border: 1px solid var(--cartuplift-border);
                      border-radius: 12px;
                      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                      display: flex;
                      flex-direction: column;
                      overflow: hidden;
                      position: relative;
                      margin: 0 auto;
                    }

                    .cartuplift-preview-drawer .cartuplift-header {
                      padding: 20px;
                      background: var(--cartuplift-background);
                      flex-shrink: 0;
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      gap: 20px;
                    }

                    .cartuplift-preview-drawer .cartuplift-cart-title {
                      margin: 0;
                      font-size: 15px;
                      font-weight: 600;
                      color: var(--cartuplift-primary);
                      text-transform: uppercase;
                      letter-spacing: 1.5px;
                    }

                    .cartuplift-preview-drawer .cartuplift-close {
                      background: transparent;
                      border: none;
                      width: 32px;
                      height: 32px;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      cursor: pointer;
                      color: var(--cartuplift-secondary);
                      transition: all 0.2s ease;
                    }

                    .cartuplift-preview-drawer .cartuplift-close:hover {
                      background: #f5f5f5;
                      color: var(--cartuplift-primary);
                    }

                    .cartuplift-preview-drawer .cartuplift-shipping-info {
                      margin-top: 12px;
                    }

                    .cartuplift-preview-drawer .cartuplift-shipping-message {
                      margin: 0;
                      font-size: 14px;
                      color: #333;
                      text-align: center;
                    }

                    .cartuplift-preview-drawer .cartuplift-shipping-bar {
                      padding: 0 20px 16px;
                      flex-shrink: 0;
                    }

                    .cartuplift-preview-drawer .cartuplift-shipping-progress {
                      width: 100%;
                      height: 8px;
                      background: #f0f0f0;
                      border-radius: 4px;
                      overflow: hidden;
                    }

                    .cartuplift-preview-drawer .cartuplift-shipping-progress-fill {
                      height: 100%;
                      background: var(--cartuplift-button-color);
                      border-radius: 4px;
                      transition: width 0.5s ease;
                    }

                    .cartuplift-preview-drawer .cartuplift-content-wrapper {
                      flex: 1;
                      display: flex;
                      flex-direction: column;
                      overflow: hidden;
                    }

                    .cartuplift-preview-drawer .cartuplift-items {
                      padding: 0 20px;
                      overflow-y: auto;
                      flex: 1;
                    }

                    .cartuplift-preview-drawer .cartuplift-item {
                      display: grid;
                      grid-template-columns: 80px 1fr 60px;
                      gap: 16px;
                      padding: 20px 0;
                      border-bottom: 1px solid var(--cartuplift-border);
                    }

                    .cartuplift-preview-drawer .cartuplift-item:last-child {
                      border-bottom: none;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-image {
                      width: 80px;
                      height: 88px;
                      border-radius: var(--cartuplift-border-radius);
                      overflow: hidden;
                      background: #f8f8f8;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-image img {
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-info {
                      display: flex;
                      flex-direction: column;
                      gap: 6px;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-title {
                      margin: 0;
                      font-size: 15px;
                      font-weight: 600;
                      color: var(--cartuplift-primary);
                      line-height: 1.4;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-title a {
                      color: inherit;
                      text-decoration: none;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-variant {
                      font-size: 14px;
                      color: var(--cartuplift-secondary);
                      margin: 0;
                    }

                    .cartuplift-preview-drawer .cartuplift-quantity {
                      display: inline-flex;
                      align-items: center;
                      border: 1px solid #d1d5db;
                      border-radius: 24px;
                      height: 36px;
                      margin-top: 8px;
                      width: fit-content;
                    }

                    .cartuplift-preview-drawer .cartuplift-qty-minus,
                    .cartuplift-preview-drawer .cartuplift-qty-plus {
                      background: transparent;
                      border: none;
                      width: 36px;
                      height: 34px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 18px;
                      color: #333;
                      cursor: pointer;
                      transition: all 0.2s ease;
                    }

                    .cartuplift-preview-drawer .cartuplift-qty-display {
                      padding: 0 16px;
                      font-size: 15px;
                      font-weight: 500;
                      color: var(--cartuplift-primary);
                      min-width: 20px;
                      text-align: center;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-price-actions {
                      display: flex;
                      flex-direction: column;
                      align-items: flex-end;
                      justify-content: space-between;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-price {
                      font-weight: 500;
                      font-size: 16px;
                      color: var(--cartuplift-primary);
                    }

                    .cartuplift-preview-drawer .cartuplift-item-remove-x {
                      background: transparent;
                      border: none;
                      width: 28px;
                      height: 28px;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: var(--cartuplift-secondary);
                      cursor: pointer;
                      transition: all 0.2s ease;
                    }

                    .cartuplift-preview-drawer .cartuplift-item-remove-x:hover {
                      background: #f5f5f5;
                      color: var(--cartuplift-danger);
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendations {
                      background: var(--cartuplift-recommendations-bg);
                      border-top: 1px solid var(--cartuplift-border);
                      flex-shrink: 0;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendations-header {
                      padding: 16px 20px 12px;
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendations-title {
                      margin: 0;
                      font-size: 14px;
                      font-weight: 600;
                      letter-spacing: 1.5px;
                      color: var(--cartuplift-primary);
                      text-transform: uppercase;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendations-toggle {
                      background: transparent;
                      border: none;
                      width: 24px;
                      height: 24px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      cursor: pointer;
                      color: var(--cartuplift-secondary);
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendations-content {
                      padding: 0 20px 16px;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendations-row .cartuplift-recommendations-content {
                      overflow-x: auto;
                      padding-bottom: 8px;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendations-track {
                      display: flex;
                      gap: 15px;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendation-card {
                      min-width: 160px;
                      max-width: 160px;
                      background: white;
                      border: 1px solid var(--cartuplift-border);
                      border-radius: var(--cartuplift-border-radius);
                      overflow: hidden;
                      flex-shrink: 0;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendation-item {
                      display: flex;
                      align-items: center;
                      gap: 12px;
                      padding: 12px 0;
                      border-bottom: 1px solid #e8e8e8;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendation-item:last-child {
                      border-bottom: none;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendation-item img {
                      width: 60px;
                      height: 60px;
                      border-radius: 4px;
                      object-fit: cover;
                    }

                    .cartuplift-preview-drawer .cartuplift-product-image {
                      height: 120px;
                      overflow: hidden;
                    }

                    .cartuplift-preview-drawer .cartuplift-product-image img {
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                    }

                    .cartuplift-preview-drawer .cartuplift-card-content {
                      padding: 12px;
                      display: flex;
                      flex-direction: column;
                      gap: 8px;
                    }

                    .cartuplift-preview-drawer .cartuplift-product-info h4 {
                      margin: 0;
                      font-size: 13px;
                      font-weight: 500;
                      line-height: 1.3;
                      color: var(--cartuplift-primary);
                    }

                    .cartuplift-preview-drawer .cartuplift-product-actions {
                      margin-top: 8px;
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                    }

                    .cartuplift-preview-drawer .cartuplift-recommendation-price {
                      font-weight: 600;
                      font-size: 14px;
                      color: var(--cartuplift-primary);
                    }

                    .cartuplift-preview-drawer .cartuplift-add-recommendation {
                      background: var(--cartuplift-button-color);
                      color: white;
                      border: none;
                      padding: 6px 12px;
                      border-radius: 4px;
                      font-size: 12px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s ease;
                    }

                    .cartuplift-preview-drawer .cartuplift-add-recommendation-circle {
                      width: 28px;
                      height: 28px;
                      border: 2px solid var(--cartuplift-button-color);
                      background: transparent;
                      color: var(--cartuplift-button-color);
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 16px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s ease;
                    }

                    .cartuplift-preview-drawer .cartuplift-add-recommendation-circle:hover {
                      background: var(--cartuplift-button-color);
                      color: white;
                    }

                    .cartuplift-preview-drawer .cartuplift-footer {
                      padding: 16px 20px;
                      background: var(--cartuplift-background);
                      border-top: 1px solid var(--cartuplift-border);
                      flex-shrink: 0;
                    }

                    .cartuplift-preview-drawer .cartuplift-discount {
                      display: flex;
                      gap: 8px;
                      margin-bottom: 12px;
                    }

                    .cartuplift-preview-drawer .cartuplift-discount-input {
                      flex: 1;
                      padding: 10px 12px;
                      border: 1px solid var(--cartuplift-border);
                      border-radius: var(--cartuplift-border-radius);
                      font-size: 14px;
                    }

                    .cartuplift-preview-drawer .cartuplift-discount-apply {
                      padding: 10px 20px;
                      background: var(--cartuplift-button-color);
                      color: white;
                      border: none;
                      border-radius: var(--cartuplift-border-radius);
                      font-size: 12px;
                      font-weight: 600;
                      text-transform: uppercase;
                      cursor: pointer;
                    }

                    .cartuplift-preview-drawer .cartuplift-notes-input {
                      width: 100%;
                      padding: 10px 12px;
                      border: 1px solid var(--cartuplift-border);
                      border-radius: var(--cartuplift-border-radius);
                      font-size: 14px;
                      min-height: 60px;
                      resize: vertical;
                      margin-bottom: 12px;
                    }

                    .cartuplift-preview-drawer .cartuplift-subtotal {
                      display: flex;
                      justify-content: space-between;
                      margin-bottom: 16px;
                      font-size: 18px;
                      font-weight: 600;
                      color: var(--cartuplift-primary);
                    }

                    .cartuplift-preview-drawer .cartuplift-checkout-btn {
                      width: 100%;
                      padding: 16px;
                      background: var(--cartuplift-primary);
                      color: white;
                      border: none;
                      border-radius: var(--cartuplift-border-radius);
                      font-size: 14px;
                      font-weight: 600;
                      text-transform: uppercase;
                      letter-spacing: 1px;
                      cursor: pointer;
                      margin-bottom: 12px;
                      transition: all 0.2s ease;
                    }

                    .cartuplift-preview-drawer .cartuplift-checkout-btn:hover {
                      background: #000;
                    }

                    .cartuplift-preview-drawer .cartuplift-express-checkout {
                      display: flex;
                      gap: 8px;
                    }

                    .cartuplift-preview-drawer .cartuplift-paypal-btn,
                    .cartuplift-preview-drawer .cartuplift-shoppay-btn {
                      flex: 1;
                      padding: 12px;
                      border: 1px solid var(--cartuplift-border);
                      border-radius: var(--cartuplift-border-radius);
                      background: white;
                      cursor: pointer;
                      font-size: 12px;
                      font-weight: 600;
                    }

                    .cartuplift-preview-drawer .cartuplift-shoppay-btn {
                      background: #5a31f4;
                      color: white;
                      border-color: #5a31f4;
                    }

                    .cartuplift-preview-drawer .cartuplift-empty {
                      text-align: center;
                      padding: 40px 20px;
                      color: var(--cartuplift-secondary);
                    }

                    .cartuplift-preview-drawer .cartuplift-empty h4 {
                      margin: 0 0 8px 0;
                      font-size: 16px;
                      color: var(--cartuplift-primary);
                    }

                    .cartuplift-preview-drawer .cartuplift-empty p {
                      margin: 0;
                      font-size: 14px;
                    }
                  `
                }} />
                
                {/* Cart Drawer Preview - Enhanced Container */}
                <div className="cartuplift-preview-wrapper">
                  <div className="cartuplift-preview-drawer">
                    {/* Header - Exact match to getHeaderHTML() */}
                    <div className="cartuplift-header">
                      <h2 className="cartuplift-cart-title">Cart (3)</h2>
                      {formSettings.enableFreeShipping && (
                        <div className="cartuplift-shipping-info">
                          <p className="cartuplift-shipping-message">
                            {(() => {
                              const threshold = (formSettings.freeShippingThreshold || 100) * 100; // Convert to cents
                              const currentTotal = 10498; // Sample total: $104.98
                              const remaining = Math.max(0, threshold - currentTotal);
                              if (remaining > 0) {
                                return (formSettings.freeShippingText || "Spend {amount} more for free shipping!")
                                  .replace(/{amount}/g, `$${(remaining / 100).toFixed(2)}`);
                              } else {
                                return formSettings.freeShippingAchievedText || "🎉 Free shipping unlocked!";
                              }
                            })()}
                          </p>
                        </div>
                      )}
                      <button className="cartuplift-close" aria-label="Close cart">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="close-icon">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Free Shipping Progress Bar - Exact match */}
                    {formSettings.enableFreeShipping && (
                      <div className="cartuplift-shipping-bar">
                        <div className="cartuplift-shipping-progress">
                          <div 
                            className="cartuplift-shipping-progress-fill" 
                            style={{ 
                              width: `${(() => {
                                const threshold = (formSettings.freeShippingThreshold || 100) * 100;
                                const currentTotal = 10498;
                                return Math.min((currentTotal / threshold) * 100, 100);
                              })()}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Content Wrapper - Exact match to cart structure */}
                    <div className="cartuplift-content-wrapper">
                      <div className="cartuplift-items">
                        {/* Sample Cart Items - Exact match to getCartItemsHTML() */}
                        <div className="cartuplift-item" data-variant-id="123456" data-line="1">
                          <div className="cartuplift-item-image">
                            <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop&crop=center" alt="Premium Wireless Headphones" loading="lazy" />
                          </div>
                          <div className="cartuplift-item-info">
                            <h4 className="cartuplift-item-title">
                              <button className="preview-link-button">Premium Wireless Headphones</button>
                            </h4>
                            <div className="cartuplift-item-variant">Color: Matte Black</div>
                            <div className="cartuplift-item-variant">Size: One Size</div>
                            <div className="cartuplift-item-quantity-wrapper">
                              <div className="cartuplift-quantity">
                                <button className="cartuplift-qty-minus" data-line="1">−</button>
                                <span className="cartuplift-qty-display">2</span>
                                <button className="cartuplift-qty-plus" data-line="1">+</button>
                              </div>
                            </div>
                          </div>
                          <div className="cartuplift-item-price-actions">
                            <div className="cartuplift-item-price">$79.99</div>
                            <button className="cartuplift-item-remove-x" data-line="1" aria-label="Remove item">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="cartuplift-item" data-variant-id="123457" data-line="2">
                          <div className="cartuplift-item-image">
                            <img src="https://images.unsplash.com/photo-1556656793-08538906a9f8?w=100&h=100&fit=crop&crop=center" alt="Protective Phone Case" loading="lazy" />
                          </div>
                          <div className="cartuplift-item-info">
                            <h4 className="cartuplift-item-title">
                              <button className="preview-link-button">Protective Phone Case</button>
                            </h4>
                            <div className="cartuplift-item-variant">Color: Clear</div>
                            <div className="cartuplift-item-variant">Size: iPhone 15 Pro</div>
                            <div className="cartuplift-item-quantity-wrapper">
                              <div className="cartuplift-quantity">
                                <button className="cartuplift-qty-minus" data-line="2">−</button>
                                <span className="cartuplift-qty-display">1</span>
                                <button className="cartuplift-qty-plus" data-line="2">+</button>
                              </div>
                            </div>
                          </div>
                          <div className="cartuplift-item-price-actions">
                            <div className="cartuplift-item-price">$24.99</div>
                            <button className="cartuplift-item-remove-x" data-line="2" aria-label="Remove item">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations Section - Exact match to getRecommendationsHTML() */}
                    {formSettings.enableRecommendations && (
                      <div className={`cartuplift-recommendations cartuplift-recommendations-${formSettings.recommendationLayout || 'column'}`}>
                        <div className="cartuplift-recommendations-header">
                          <h3 className="cartuplift-recommendations-title">
                            {formSettings.recommendationsTitle || 'You might also like'}
                          </h3>
                          <button className="cartuplift-recommendations-toggle" data-toggle="recommendations" aria-expanded="true" aria-label="Toggle recommendations">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                        <div className="cartuplift-recommendations-content">
                          {formSettings.recommendationLayout === 'row' ? (
                            /* Horizontal Layout */
                            <div className="cartuplift-recommendations-track">
                              <div className="cartuplift-recommendation-card">
                                <div className="cartuplift-card-content">
                                  <div className="cartuplift-product-image">
                                    <img src="https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=150&h=120&fit=crop&crop=center" alt="Bluetooth Speaker" loading="lazy" />
                                  </div>
                                  <div className="cartuplift-product-info">
                                    <h4><button className="preview-link-button cartuplift-product-link">Bluetooth Speaker</button></h4>
                                  </div>
                                  <div className="cartuplift-product-actions">
                                    <div className="cartuplift-recommendation-price">$39.99</div>
                                    <button className="cartuplift-add-recommendation" data-product-id="789" data-variant-id="789123">
                                      Add+
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div className="cartuplift-recommendation-card">
                                <div className="cartuplift-card-content">
                                  <div className="cartuplift-product-image">
                                    <img src="https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=150&h=120&fit=crop&crop=center" alt="Wireless Charger" loading="lazy" />
                                  </div>
                                  <div className="cartuplift-product-info">
                                    <h4><button className="preview-link-button cartuplift-product-link">Wireless Charger</button></h4>
                                  </div>
                                  <div className="cartuplift-product-actions">
                                    <div className="cartuplift-recommendation-price">$29.99</div>
                                    <button className="cartuplift-add-recommendation" data-product-id="790" data-variant-id="790123">
                                      Add+
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Vertical Layout */
                            <>
                              <div className="cartuplift-recommendation-item">
                                <img src="https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=60&h=60&fit=crop&crop=center" alt="Bluetooth Speaker" loading="lazy" />
                                <div className="cartuplift-recommendation-info">
                                  <h4><button className="preview-link-button cartuplift-product-link">Bluetooth Speaker</button></h4>
                                  <div className="cartuplift-recommendation-price">$39.99</div>
                                </div>
                                <button className="cartuplift-add-recommendation-circle" data-variant-id="789123">
                                  +
                                </button>
                              </div>
                              <div className="cartuplift-recommendation-item">
                                <img src="https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=60&h=60&fit=crop&crop=center" alt="Wireless Charger" loading="lazy" />
                                <div className="cartuplift-recommendation-info">
                                  <h4><button className="preview-link-button cartuplift-product-link">Wireless Charger</button></h4>
                                  <div className="cartuplift-recommendation-price">$29.99</div>
                                </div>
                                <button className="cartuplift-add-recommendation-circle" data-variant-id="790123">
                                  +
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Footer - Exact match to cart footer */}
                    <div className="cartuplift-footer">
                      {formSettings.enableDiscountCode && (
                        <div className="cartuplift-discount">
                          <input type="text" className="cartuplift-discount-input" placeholder="Discount code" disabled />
                          <button className="cartuplift-discount-apply">Apply</button>
                        </div>
                      )}
                      
                      {formSettings.enableNotes && (
                        <div className="cartuplift-notes">
                          <textarea className="cartuplift-notes-input" placeholder="Order notes..." rows={3} disabled></textarea>
                        </div>
                      )}
                      
                      <div className="cartuplift-subtotal">
                        <span>Subtotal</span>
                        <span className="cartuplift-subtotal-amount">$104.98</span>
                      </div>
                      
                      <button className="cartuplift-checkout-btn">
                        CHECKOUT
                      </button>
                      
                      {formSettings.enableExpressCheckout && (
                        <div className="cartuplift-express-checkout">
                          <button className="cartuplift-paypal-btn">
                            PayPal
                          </button>
                          <button className="cartuplift-shoppay-btn">
                            Shop Pay
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Text variant="bodyMd" as="p" tone="subdued">
                  💡 This is an exact replica of your cart drawer that updates live as you change settings. 
                  The enhanced container provides better visibility of your cart's actual appearance.
                </Text>
              </BlockStack>
            </Card>
            
            {/* Additional Preview Info */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">Preview Features</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  • Real-time updates as you change settings<br/>
                  • Exact CSS matching your live cart<br/>
                  • Enhanced container for better visibility<br/>
                  • No horizontal scrolling needed
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    </Page>
  );
}
