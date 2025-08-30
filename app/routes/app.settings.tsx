import { useState, useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  BlockStack,
  Text,
  Banner,
  Checkbox,
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
  const previewRef = useRef<HTMLDivElement>(null);

  // Scroll event handler to update preview position
  useEffect(() => {
    const handleScroll = () => {
      if (previewRef.current) {
        const scrollTop = window.scrollY;
        // Keep preview in viewport when scrolling
        if (scrollTop > 100) {
          previewRef.current.style.position = 'fixed';
          previewRef.current.style.top = '20px';
        } else {
          previewRef.current.style.position = 'sticky';
          previewRef.current.style.top = '100px';
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    { label: "Horizontal Cards", value: "row" },
    { label: "Vertical List", value: "column" },
  ];

  const complementDetectionModeOptions = [
    { label: "✨ Automatic (AI-Powered)", value: "automatic" },
    { label: "⚙️ Manual Rules Only", value: "manual" },
    { label: "🔄 Hybrid (Auto + Overrides)", value: "hybrid" },
  ];

  // Calculate free shipping progress
  const threshold = (formSettings.freeShippingThreshold || 100) * 100;
  const currentTotal = 47400; // £474.00 in pence
  const remaining = Math.max(0, threshold - currentTotal);
  const progress = Math.min((currentTotal / threshold) * 100, 100);

  return (
    <Page
      title="UpCart Settings"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSubmit,
        loading: fetcher.state === "submitting",
      }}
      fullWidth
    >
      <style dangerouslySetInnerHTML={{
        __html: `
          /* Fixed Layout Styles */
          .upcart-settings-layout {
            display: grid !important;
            grid-template-columns: 1fr 540px !important;
            gap: 32px;
            width: 100%;
            position: relative;
            padding: 0 20px;
            min-height: 100vh;
          }
          
          @media (max-width: 1000px) {
            .upcart-settings-layout {
              grid-template-columns: 1fr !important;
              padding: 0 16px;
            }
            .upcart-preview-column {
              display: none !important;
            }
          }
          
          @media (min-width: 1600px) {
            .upcart-settings-layout {
              grid-template-columns: 1fr 600px !important;
              gap: 40px;
              padding: 0 40px;
            }
          }
          
          .upcart-settings-column {
            min-width: 0;
            width: 100%;
          }
          
          .upcart-preview-column {
            position: sticky !important;
            top: 0px;
            height: 100vh;
            max-height: 100vh;
            display: block !important;
          }
          
          .upcart-preview-container {
            width: 520px;
            height: 100vh;
            background: #ffffff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            border-radius: 0;
            display: flex;
            flex-direction: column;
            border: 1px solid #e1e3e5;
            overflow: hidden;
          }

          /* Cart Styles - Compact for preview */
          .upcart-preview-header {
            padding: 8px 12px;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-height: 32px;
            flex-shrink: 0;
            border-bottom: 1px solid #e1e3e5;
          }

          .upcart-cart-title {
            margin: 0;
            font-size: 11px;
            font-weight: 600;
            color: #000;
            letter-spacing: 0.5px;
          }

          .upcart-shipping-info {
            text-align: center;
            margin: 8px 0;
          }

          .upcart-shipping-message {
            margin: 0 0 4px 0;
            font-size: 10px;
            color: #666;
            font-weight: 500;
          }

          .upcart-shipping-progress {
            width: 100%;
            height: 3px;
            background: #f0f0f0;
            border-radius: 2px;
            overflow: hidden;
          }

          .upcart-shipping-progress-fill {
            height: 100%;
            background: #28a745;
            border-radius: 2px;
            transition: width 0.3s ease;
          }

          .upcart-content-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 8px;
            overflow-y: auto;
          }

          .upcart-items {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .upcart-item {
            display: flex;
            gap: 8px;
            padding: 6px;
            border-radius: 4px;
            background: #fafafa;
          }

          .upcart-item-image {
            width: 50px;
            height: 50px;
            flex-shrink: 0;
          }

          .upcart-item-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 3px;
          }

          .upcart-item-info {
            flex: 1;
            min-width: 0;
          }

          .upcart-item-title {
            margin: 0 0 2px 0;
            font-size: 10px;
            font-weight: 600;
            color: #333;
            line-height: 1.2;
          }

          .upcart-item-variant {
            font-size: 9px;
            color: #666;
            margin: 0;
            line-height: 1.1;
          }

          .upcart-quantity {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
          }

          .upcart-qty-btn {
            width: 18px;
            height: 18px;
            border: 1px solid #ccc;
            background: white;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            cursor: pointer;
          }

          .upcart-qty-display {
            min-width: 20px;
            text-align: center;
            font-size: 10px;
            font-weight: 500;
          }

          .upcart-item-price-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
          }

          .upcart-item-price {
            font-size: 10px;
            font-weight: 600;
            color: #333;
          }

          .upcart-item-remove {
            width: 16px;
            height: 16px;
            border: none;
            background: #f5f5f5;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #666;
          }

          .upcart-recommendations {
            border-top: 1px solid #eee;
            padding-top: 6px;
          }

          .upcart-recommendations-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
          }

          .upcart-recommendations-title {
            margin: 0;
            font-size: 9px;
            font-weight: 600;
            color: #333;
            letter-spacing: 0.3px;
          }

          .upcart-recommendations-toggle {
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px;
            color: #666;
          }

          .upcart-recommendations-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .upcart-recommendation-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px;
            background: #f9f9f9;
            border-radius: 3px;
          }

          .upcart-recommendation-item img {
            width: 30px;
            height: 30px;
            object-fit: cover;
            border-radius: 2px;
          }

          .upcart-recommendation-info {
            flex: 1;
            min-width: 0;
          }

          .upcart-recommendation-info h4 {
            margin: 0 0 1px 0;
            font-size: 9px;
            font-weight: 500;
            color: #333;
            line-height: 1.1;
          }

          .upcart-recommendation-price {
            font-size: 8px;
            color: #666;
            margin: 0;
          }

          .upcart-add-btn {
            width: 20px;
            height: 20px;
            border: 1px solid #007c41;
            background: white;
            color: #007c41;
            border-radius: 2px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .upcart-discount-section {
            border-top: 1px solid #eee;
            padding-top: 6px;
          }

          .upcart-discount-wrapper {
            display: flex;
            gap: 4px;
          }

          .upcart-discount-input {
            flex: 1;
            padding: 4px 6px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 9px;
          }

          .upcart-discount-apply {
            padding: 4px 8px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 9px;
            cursor: pointer;
          }

          .upcart-footer {
            border-top: 1px solid #eee;
            padding: 8px;
            background: #fafafa;
          }

          .upcart-subtotal {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 11px;
            font-weight: 600;
          }

          .upcart-checkout-btn {
            width: 100%;
            padding: 8px 12px;
            background: #1a1a1a;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            margin-bottom: 6px;
            cursor: pointer;
          }

          .upcart-express-checkout {
            display: flex;
            gap: 4px;
          }

          .upcart-paypal-btn,
          .upcart-shoppay-btn {
            flex: 1;
            padding: 4px 6px;
            border: 1px solid #ddd;
            border-radius: 3px;
            background: white;
            font-size: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }
            text-transform: uppercase;
            flex-shrink: 0;
          }

          .upcart-shipping-info {
            flex: 1;
            text-align: center;
            overflow: hidden;
          }

          .upcart-shipping-message {
            margin: 0;
            color: #666;
            font-size: 12px;
            font-weight: 400;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .upcart-close {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 6px;
            color: #000;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            flex-shrink: 0;
          }

          .upcart-close:hover {
            color: #111;
            background: #f0f0f0;
          }

          .upcart-shipping-bar {
            padding: 0 16px 8px;
            background: #ffffff;
            flex-shrink: 0;
          }

          .upcart-shipping-progress {
            width: 100%;
            height: 6px;
            background: #f0f0f0;
            border-radius: 3px;
            overflow: hidden;
            position: relative;
          }

          .upcart-shipping-progress-fill {
            height: 100%;
            background: ${formSettings.buttonColor || '#4CAF50'};
            border-radius: 3px;
            transition: width 0.5s ease, background 0.3s ease;
            min-width: 2px;
          }

          .upcart-content-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
          }

          .upcart-items {
            flex: 1;
            background: #ffffff;
            padding: 0 16px;
            overflow-y: auto;
            overflow-x: hidden;
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          .upcart-items::-webkit-scrollbar {
            display: none;
          }

          .upcart-item {
            display: flex;
            align-items: stretch;
            gap: 16px;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
            position: relative;
            min-height: 112px;
          }

          .upcart-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .upcart-item-image {
            width: 106px;
            height: 112px;
            border-radius: 6px;
            overflow: hidden;
            background: #f8f8f8;
            flex-shrink: 0;
          }

          .upcart-item-image img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }

          .upcart-item-info {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
            flex: 1;
            padding-right: 8px;
            justify-content: space-between;
          }

          .upcart-item-title {
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            line-height: 1.3;
            color: #1a1a1a;
          }

          .upcart-item-variant {
            font-size: 12px;
            color: #666;
            line-height: 1.2;
            margin: 0;
          }

          .upcart-quantity {
            display: inline-flex;
            align-items: center;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            background: #ffffff;
            height: 32px;
            min-width: 100px;
            overflow: hidden;
            justify-content: space-around;
          }

          .upcart-qty-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 8px;
            font-size: 14px;
            color: #333;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
          }

          .upcart-qty-btn:hover {
            background: #f5f5f5;
          }

          .upcart-qty-display {
            padding: 0 10px;
            font-size: 12px;
            font-weight: 500;
            color: #000;
            text-align: center;
          }

          .upcart-item-price-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: space-between;
            flex-shrink: 0;
            min-width: 60px;
            min-height: 112px;
          }

          .upcart-item-price {
            font-weight: 600;
            font-size: 13px;
            color: #000;
            white-space: nowrap;
          }

          .upcart-item-remove {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 6px;
            color: #000;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
          }

          .upcart-item-remove:hover {
            color: #111;
            background: #f0f0f0;
          }

          /* Recommendations Section */
          .upcart-recommendations {
            background: #ecebe3;
            padding: 4px 0;
            margin-top: 8px;
            flex-shrink: 0;
          }

          .upcart-recommendations-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px 0px 16px;
            height: 36px;
          }

          .upcart-recommendations-title {
            margin: 0;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.05em;
            color: #1a1a1a;
          }

          .upcart-recommendations-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border: 1px solid #111;
            border-radius: 50%;
            background: transparent;
            cursor: pointer;
          }

          .upcart-recommendations-content {
            padding: 12px 16px;
          }

          .upcart-recommendation-item {
            display: grid;
            grid-template-columns: 56px 1fr 24px;
            gap: 12px;
            padding: 12px;
            border: 1px solid #f0f0f0;
            border-radius: 8px;
            margin-bottom: 12px;
            align-items: center;
            background: white;
          }

          .upcart-recommendation-item img {
            width: 56px;
            height: 56px;
            object-fit: cover;
            border-radius: 6px;
          }

          .upcart-recommendation-info h4 {
            font-size: 14px;
            font-weight: 500;
            color: #000;
            margin: 0 0 4px 0;
          }

          .upcart-recommendation-price {
            font-size: 14px;
            font-weight: 500;
            color: #000;
          }

          .upcart-add-btn {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid #1a1a1a;
            background: #ffffff;
            color: #1a1a1a;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          }

          .upcart-add-btn:hover {
            background: #1a1a1a;
            color: white;
          }

          /* Discount Section */
          .upcart-discount-section {
            padding: 8px 16px 4px 16px;
            border-top: 1px solid #e5e5e5;
          }

          .upcart-discount-wrapper {
            display: flex;
            gap: 8px;
          }

          .upcart-discount-input {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
          }

          .upcart-discount-apply {
            padding: 10px 16px;
            background: #333;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          /* Footer */
          .upcart-footer {
            padding: 12px 16px;
            background: #ffffff;
            border-top: 1px solid #e5e5e5;
            flex-shrink: 0;
          }

          .upcart-subtotal {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px 0;
            font-size: 15px;
            font-weight: 600;
            color: #000;
          }

          .upcart-checkout-btn {
            width: 100%;
            padding: 12px 16px;
            background: #1a1a1a;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            margin-bottom: 8px;
            cursor: pointer;
          }

          .upcart-express-checkout {
            display: flex;
            gap: 8px;
          }

          .upcart-paypal-btn,
          .upcart-shoppay-btn {
            flex: 1;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            font-size: 12px;
          }

          .upcart-shoppay-btn {
            background: #5a31f4;
            color: white;
            border-color: #5a31f4;
            font-weight: 600;
          }
        `
      }} />

      {fetcher.state === "idle" && fetcher.data && (fetcher.data as any)?.success && (
        <Banner tone="success">Settings saved successfully!</Banner>
      )}

      <div className="upcart-settings-layout">
        {/* Settings Column - Left Side */}
        <div className="upcart-settings-column">
          <BlockStack gap="500">
            {/* Core Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">⚙️ Core Settings</Text>
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
                    helpText="Limit cart drawer to cart page only"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Free Shipping Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">🚚 Free Shipping</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Free Shipping Bar"
                    checked={formSettings.enableFreeShipping}
                    onChange={(value) => updateSetting("enableFreeShipping", value)}
                  />
                  
                  <TextField
                    label="Free Shipping Threshold (£)"
                    type="number"
                    value={String(formSettings.freeShippingThreshold)}
                    onChange={(value) => updateSetting("freeShippingThreshold", parseInt(value) || 100)}
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Shipping Message"
                    value={formSettings.freeShippingText}
                    onChange={(value) => updateSetting("freeShippingText", value)}
                    helpText="Use {amount} as placeholder"
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Success Message"
                    value={formSettings.freeShippingAchievedText}
                    onChange={(value) => updateSetting("freeShippingAchievedText", value)}
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Appearance Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">🎨 Appearance</Text>
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
                  
                  <TextField
                    label="Button Color"
                    value={formSettings.buttonColor}
                    onChange={(value) => updateSetting("buttonColor", value)}
                    helpText="Hex color for buttons"
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Recommendations Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">🎯 Smart Recommendations</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Product Recommendations"
                    checked={formSettings.enableRecommendations}
                    onChange={(value) => updateSetting("enableRecommendations", value)}
                  />
                  
                  <Select
                    label="Layout"
                    options={recommendationLayoutOptions}
                    value={formSettings.recommendationLayout}
                    onChange={(value) => updateSetting("recommendationLayout", value)}
                    disabled={!formSettings.enableRecommendations}
                  />
                  
                  <TextField
                    label="Max Recommendations"
                    type="number"
                    value={String(formSettings.maxRecommendations)}
                    onChange={(value) => updateSetting("maxRecommendations", parseInt(value) || 4)}
                    disabled={!formSettings.enableRecommendations}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Section Title"
                    value={formSettings.recommendationsTitle}
                    onChange={(value) => updateSetting("recommendationsTitle", value)}
                    disabled={!formSettings.enableRecommendations}
                    autoComplete="off"
                  />
                  
                  <Select
                    label="Detection Mode"
                    options={complementDetectionModeOptions}
                    value="automatic"
                    onChange={(value) => updateSetting("complementDetectionMode", value)}
                    disabled={!formSettings.enableRecommendations}
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Additional Features */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">🚀 Advanced Features</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Discount Code Field"
                    checked={formSettings.enableDiscountCode}
                    onChange={(value) => updateSetting("enableDiscountCode", value)}
                  />
                  
                  <Checkbox
                    label="Enable Order Notes"
                    checked={formSettings.enableNotes}
                    onChange={(value) => updateSetting("enableNotes", value)}
                  />
                  
                  <Checkbox
                    label="Enable Express Checkout"
                    checked={formSettings.enableExpressCheckout}
                    onChange={(value) => updateSetting("enableExpressCheckout", value)}
                  />
                  
                  <Checkbox
                    label="Enable Analytics"
                    checked={formSettings.enableAnalytics}
                    onChange={(value) => updateSetting("enableAnalytics", value)}
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>

        {/* Live Preview - Right Side (Fixed) */}
        <div className="upcart-preview-column" ref={previewRef}>
          <div className="upcart-preview-container">
            {/* Header */}
            <div className="upcart-preview-header">
                  <h2 className="upcart-cart-title">CART (5)</h2>
                  {formSettings.enableFreeShipping && (
                    <div className="upcart-shipping-info">
                      <p className="upcart-shipping-message">
                        {remaining > 0 
                          ? (formSettings.freeShippingText || "Spend {amount} more for free shipping!")
                              .replace(/{amount}/g, `£${(remaining / 100).toFixed(2)}`)
                          : formSettings.freeShippingAchievedText || "🎉 Congratulations! You've unlocked free shipping!"
                        }
                      </p>
                    </div>
                  )}
                  <button className="upcart-close" aria-label="Close cart">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '24px', height: '24px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Free Shipping Progress Bar */}
                {formSettings.enableFreeShipping && (
                  <div className="upcart-shipping-bar">
                    <div className="upcart-shipping-progress">
                      <div className="upcart-shipping-progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="upcart-content-wrapper">
                  <div className="upcart-items">
                    {/* Product 1 */}
                    <div className="upcart-item">
                      <div className="upcart-item-image">
                        <img src="https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=200&h=200&fit=crop" alt="Anytime No Show Sock" />
                      </div>
                      <div className="upcart-item-info">
                        <h4 className="upcart-item-title">Anytime No Show Sock</h4>
                        <div className="upcart-item-variant">Color: White</div>
                        <div className="upcart-item-variant">Accessory size: L</div>
                        <div className="upcart-quantity">
                          <button className="upcart-qty-btn">−</button>
                          <span className="upcart-qty-display">1</span>
                          <button className="upcart-qty-btn">+</button>
                        </div>
                      </div>
                      <div className="upcart-item-price-actions">
                        <div className="upcart-item-price">£14.00</div>
                        <button className="upcart-item-remove" title="Remove item">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.25" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Product 2 */}
                    <div className="upcart-item">
                      <div className="upcart-item-image">
                        <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop" alt="Men's Strider" />
                      </div>
                      <div className="upcart-item-info">
                        <h4 className="upcart-item-title">Men's Strider</h4>
                        <div className="upcart-item-variant">Color: White</div>
                        <div className="upcart-item-variant">Shoe size: 10</div>
                        <div className="upcart-quantity">
                          <button className="upcart-qty-btn">−</button>
                          <span className="upcart-qty-display">4</span>
                          <button className="upcart-qty-btn">+</button>
                        </div>
                      </div>
                      <div className="upcart-item-price-actions">
                        <div className="upcart-item-price">£115.00</div>
                        <button className="upcart-item-remove" title="Remove item">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.25" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations Section */}
                  {formSettings.enableRecommendations && (
                    <div className="upcart-recommendations">
                      <div className="upcart-recommendations-header">
                        <h3 className="upcart-recommendations-title">
                          {formSettings.recommendationsTitle || 'RECOMMENDED FOR YOU'}
                        </h3>
                        <button className="upcart-recommendations-toggle" title="Toggle recommendations">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '10px', height: '10px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                      </div>
                      <div className="upcart-recommendations-content">
                        {formSettings.recommendationLayout === 'column' ? (
                          <>
                            <div className="upcart-recommendation-item">
                              <img src="https://images.unsplash.com/photo-1521093470119-a3acdc43374a?w=100&h=100&fit=crop" alt="Snowboard" />
                              <div className="upcart-recommendation-info">
                                <h4>The Multi-managed Snowboard</h4>
                                <div className="upcart-recommendation-price">£629.95</div>
                              </div>
                              <button className="upcart-add-btn">+</button>
                            </div>
                            <div className="upcart-recommendation-item">
                              <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=100&h=100&fit=crop" alt="Snowboard" />
                              <div className="upcart-recommendation-info">
                                <h4>The Collection Snowboard</h4>
                                <div className="upcart-recommendation-price">£549.95</div>
                              </div>
                              <button className="upcart-add-btn">+</button>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }}>
                            {/* Horizontal card layout would go here */}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Discount Section */}
                  {formSettings.enableDiscountCode && (
                    <div className="upcart-discount-section">
                      <div className="upcart-discount-wrapper">
                        <input 
                          type="text" 
                          className="upcart-discount-input" 
                          placeholder="Enter discount code"
                        />
                        <button className="upcart-discount-apply">Apply</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="upcart-footer">
                  <div className="upcart-subtotal">
                    <span>Subtotal</span>
                    <span>£474.00</span>
                  </div>
                  
                  <button className="upcart-checkout-btn">CHECKOUT</button>
                  
                  {formSettings.enableExpressCheckout && (
                    <div className="upcart-express-checkout">
                      <button className="upcart-paypal-btn">
                        <img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" alt="PayPal" style={{ height: '12px' }} />
                      </button>
                      <button className="upcart-shoppay-btn">Shop Pay</button>
                    </div>
                  )}
                </div>
              </div>
        </div>
      </div>
    </Page>
  );
}