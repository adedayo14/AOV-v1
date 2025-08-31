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
    cartPosition: String(settings.cartPosition) || 'bottom-right',
    cartIcon: String(settings.cartIcon) || 'cart',
    freeShippingText: String(settings.freeShippingText) || "You're {amount} away from free shipping!",
    freeShippingAchievedText: String(settings.freeShippingAchievedText) || "🎉 Congratulations! You've unlocked free shipping!",
    recommendationsTitle: String(settings.recommendationsTitle) || "You might also like",
    actionText: String(settings.actionText) || "Add discount code",
    backgroundColor: String(settings.backgroundColor) || "#ffffff",
    textColor: String(settings.textColor) || "#1A1A1A",
    buttonColor: String(settings.buttonColor) || "#000000",
    recommendationLayout: String(settings.recommendationLayout) || "horizontal",
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
      title="Cart Uplift Settings"
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
          .cartuplift-settings-layout {
            display: grid !important;
            grid-template-columns: 1fr 540px !important;
            gap: 32px;
            width: 100%;
            position: relative;
            padding: 0 20px;
            min-height: 100vh;
          }
          
          @media (max-width: 1000px) {
            .cartuplift-settings-layout {
              grid-template-columns: 1fr !important;
              padding: 0 16px;
            }
            .cartuplift-preview-column {
              display: none !important;
            }
          }
          
          @media (min-width: 1600px) {
            .cartuplift-settings-layout {
              grid-template-columns: 1fr 600px !important;
              gap: 40px;
              padding: 0 40px;
            }
          }
          
          .cartuplift-settings-column {
            min-width: 0;
            width: 100%;
          }
          
          .cartuplift-preview-column {
            position: sticky !important;
            top: 0px;
            height: 100vh;
            max-height: 100vh;
            display: block !important;
          }
          
          .cartuplift-preview-container {
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
          .cartuplift-preview-header {
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

          .cartuplift-cart-title {
            margin: 0;
            font-size: 11px;
            font-weight: 600;
            color: #000;
            letter-spacing: 0.5px;
          }

          .cartuplift-shipping-info {
            text-align: center;
            margin: 8px 0;
          }

          .cartuplift-shipping-message {
            margin: 0 0 4px 0;
            font-size: 10px;
            color: #666;
            font-weight: 500;
          }

          .cartuplift-shipping-progress {
            width: 100%;
            height: 3px;
            background: #f0f0f0;
            border-radius: 2px;
            overflow: hidden;
          }

          .cartuplift-shipping-progress-fill {
            height: 100%;
            background: #28a745;
            border-radius: 2px;
            transition: width 0.3s ease;
          }

          .cartuplift-content-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 8px;
            overflow-y: auto;
          }

          .cartuplift-items {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .cartuplift-item {
            display: flex;
            gap: 8px;
            padding: 6px;
            border-radius: 4px;
            background: #fafafa;
          }

          .cartuplift-item-image {
            width: 50px;
            height: 50px;
            flex-shrink: 0;
          }

          .cartuplift-item-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 3px;
          }

          .cartuplift-item-info {
            flex: 1;
            min-width: 0;
          }

          .cartuplift-item-title {
            margin: 0 0 2px 0;
            font-size: 10px;
            font-weight: 600;
            color: #333;
            line-height: 1.2;
          }

          .cartuplift-item-variant {
            font-size: 9px;
            color: #666;
            margin: 0;
            line-height: 1.1;
          }

          .cartuplift-quantity {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
          }

          .cartuplift-qty-btn {
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

          .cartuplift-qty-display {
            min-width: 20px;
            text-align: center;
            font-size: 10px;
            font-weight: 500;
          }

          .cartuplift-item-price-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
          }

          .cartuplift-item-price {
            font-size: 10px;
            font-weight: 600;
            color: #333;
          }

          .cartuplift-item-remove {
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

          .cartuplift-recommendations {
            border-top: 1px solid #eee;
            padding-top: 6px;
          }

          .cartuplift-recommendations-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
          }

          .cartuplift-recommendations-title {
            margin: 0;
            font-size: 9px;
            font-weight: 600;
            color: #333;
            letter-spacing: 0.3px;
          }

          .cartuplift-recommendations-toggle {
            background: none;
            border: none;
            cursor: pointer;
            padding: 2px;
            color: #666;
          }

          .cartuplift-recommendations-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .cartuplift-recommendation-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px;
            background: #f9f9f9;
            border-radius: 3px;
          }

          .cartuplift-recommendation-item img {
            width: 30px;
            height: 30px;
            object-fit: cover;
            border-radius: 2px;
          }

          .cartuplift-recommendation-info {
            flex: 1;
            min-width: 0;
          }

          .cartuplift-recommendation-info h4 {
            margin: 0 0 1px 0;
            font-size: 9px;
            font-weight: 500;
            color: #333;
            line-height: 1.1;
          }

          .cartuplift-recommendation-price {
            font-size: 8px;
            color: #666;
            margin: 0;
          }

          .cartuplift-add-btn {
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

          .cartuplift-discount-section {
            border-top: 1px solid #eee;
            padding-top: 6px;
          }

          .cartuplift-discount-wrapper {
            display: flex;
            gap: 4px;
          }

          .cartuplift-discount-input {
            flex: 1;
            padding: 4px 6px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 9px;
          }

          .cartuplift-discount-apply {
            padding: 4px 8px;
            background: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 9px;
            cursor: pointer;
          }

          .cartuplift-footer {
            border-top: 1px solid #eee;
            padding: 8px;
            background: #fafafa;
          }

          .cartuplift-subtotal {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 11px;
            font-weight: 600;
          }

          .cartuplift-checkout-btn {
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

          .cartuplift-express-checkout {
            display: flex;
            gap: 4px;
          }

          .cartuplift-paypal-btn,
          .cartuplift-shoppay-btn {
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

          .cartuplift-shipping-info {
            flex: 1;
            text-align: center;
            overflow: hidden;
          }

          .cartuplift-shipping-message {
            margin: 0;
            color: #666;
            font-size: 12px;
            font-weight: 400;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .cartuplift-close {
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

          .cartuplift-close:hover {
            color: #111;
            background: #f0f0f0;
          }

          .cartuplift-shipping-bar {
            padding: 0 16px 8px;
            background: #ffffff;
            flex-shrink: 0;
          }

          .cartuplift-shipping-progress {
            width: 100%;
            height: 6px;
            background: #f0f0f0;
            border-radius: 3px;
            overflow: hidden;
            position: relative;
          }

          .cartuplift-shipping-progress-fill {
            height: 100%;
            background: ${formSettings.buttonColor || '#4CAF50'};
            border-radius: 3px;
            transition: width 0.5s ease, background 0.3s ease;
            min-width: 2px;
          }

          .cartuplift-content-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
          }

          .cartuplift-items {
            flex: 1;
            background: #ffffff;
            padding: 0 16px;
            overflow-y: auto;
            overflow-x: hidden;
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          .cartuplift-items::-webkit-scrollbar {
            display: none;
          }

          .cartuplift-item {
            display: flex;
            align-items: stretch;
            gap: 16px;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
            position: relative;
            min-height: 112px;
          }

          .cartuplift-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .cartuplift-item-image {
            width: 106px;
            height: 112px;
            border-radius: 6px;
            overflow: hidden;
            background: #f8f8f8;
            flex-shrink: 0;
          }

          .cartuplift-item-image img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }

          .cartuplift-item-info {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
            flex: 1;
            padding-right: 8px;
            justify-content: space-between;
          }

          .cartuplift-item-title {
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            line-height: 1.3;
            color: #1a1a1a;
          }

          .cartuplift-item-variant {
            font-size: 12px;
            color: #666;
            line-height: 1.2;
            margin: 0;
          }

          .cartuplift-quantity {
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

          .cartuplift-qty-btn {
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

          .cartuplift-qty-btn:hover {
            background: #f5f5f5;
          }

          .cartuplift-qty-display {
            padding: 0 10px;
            font-size: 12px;
            font-weight: 500;
            color: #000;
            text-align: center;
          }

          .cartuplift-item-price-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: space-between;
            flex-shrink: 0;
            min-width: 60px;
            min-height: 112px;
          }

          .cartuplift-item-price {
            font-weight: 600;
            font-size: 13px;
            color: #000;
            white-space: nowrap;
          }

          .cartuplift-item-remove {
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

          .cartuplift-item-remove:hover {
            color: #111;
            background: #f0f0f0;
          }

          /* Recommendations Section */
          .cartuplift-recommendations {
            background: #ecebe3;
            padding: 4px 0;
            margin-top: 8px;
            flex-shrink: 0;
          }

          .cartuplift-recommendations-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px 0px 16px;
            height: 36px;
          }

          .cartuplift-recommendations-title {
            margin: 0;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.05em;
            color: #1a1a1a;
          }

          .cartuplift-recommendations-toggle {
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

          .cartuplift-recommendations-content {
            padding: 12px 16px;
          }

          .cartuplift-recommendation-item {
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

          .cartuplift-recommendation-item img {
            width: 56px;
            height: 56px;
            object-fit: cover;
            border-radius: 6px;
          }

          .cartuplift-recommendation-info h4 {
            font-size: 14px;
            font-weight: 500;
            color: #000;
            margin: 0 0 4px 0;
          }

          .cartuplift-recommendation-price {
            font-size: 14px;
            font-weight: 500;
            color: #000;
          }

          .cartuplift-add-btn {
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

          .cartuplift-add-btn:hover {
            background: #1a1a1a;
            color: white;
          }

          /* Discount Section */
          .cartuplift-discount-section {
            padding: 8px 16px 4px 16px;
            border-top: 1px solid #e5e5e5;
          }

          .cartuplift-discount-wrapper {
            display: flex;
            gap: 8px;
          }

          .cartuplift-discount-input {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
          }

          .cartuplift-discount-apply {
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
          .cartuplift-footer {
            padding: 12px 16px;
            background: #ffffff;
            border-top: 1px solid #e5e5e5;
            flex-shrink: 0;
          }

          .cartuplift-subtotal {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px 0;
            font-size: 15px;
            font-weight: 600;
            color: #000;
          }

          .cartuplift-checkout-btn {
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

          .cartuplift-express-checkout {
            display: flex;
            gap: 8px;
          }

          .cartuplift-paypal-btn,
          .cartuplift-shoppay-btn {
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

          .cartuplift-shoppay-btn {
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

      <div className="cartuplift-settings-layout">
        {/* Settings Column - Left Side */}
        <div className="cartuplift-settings-column">
          <BlockStack gap="500">
            {/* Core Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">⚙️ Core Settings</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Cart Uplift"
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
                    helpText="Limit cart uplift to cart page only"
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

                  {(formSettings.enableDiscountCode || formSettings.enableNotes) && (
                    <TextField
                      label="Action Button Text"
                      value={formSettings.actionText || ""}
                      onChange={(value) => updateSetting("actionText", value)}
                      placeholder="Add discount codes and notes"
                      helpText="Text shown on the button that opens the discount/notes modal"
                      autoComplete="off"
                    />
                  )}
                  
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
        <div className="cartuplift-preview-column" ref={previewRef}>
          <div className="cartuplift-preview-container">
            {/* Header */}
            <div className="cartuplift-preview-header">
                  <h2 className="cartuplift-cart-title">CART (5)</h2>
                  {formSettings.enableFreeShipping && (
                    <div className="cartuplift-shipping-info">
                      <p className="cartuplift-shipping-message">
                        {remaining > 0 
                          ? (formSettings.freeShippingText || "Spend {amount} more for free shipping!")
                              .replace(/{amount}/g, `£${(remaining / 100).toFixed(2)}`)
                          : formSettings.freeShippingAchievedText || "🎉 Congratulations! You've unlocked free shipping!"
                        }
                      </p>
                    </div>
                  )}
                  <button className="cartuplift-close" aria-label="Close cart">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '24px', height: '24px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Free Shipping Progress Bar */}
                {formSettings.enableFreeShipping && (
                  <div className="cartuplift-shipping-bar">
                    <div className="cartuplift-shipping-progress">
                      <div className="cartuplift-shipping-progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="cartuplift-content-wrapper">
                  <div className="cartuplift-items">
                    {/* Product 1 */}
                    <div className="cartuplift-item">
                      <div className="cartuplift-item-image">
                        <img src="https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=200&h=200&fit=crop" alt="Anytime No Show Sock" />
                      </div>
                      <div className="cartuplift-item-info">
                        <h4 className="cartuplift-item-title">Anytime No Show Sock</h4>
                        <div className="cartuplift-item-variant">Color: White</div>
                        <div className="cartuplift-item-variant">Accessory size: L</div>
                        <div className="cartuplift-quantity">
                          <button className="cartuplift-qty-btn">−</button>
                          <span className="cartuplift-qty-display">1</span>
                          <button className="cartuplift-qty-btn">+</button>
                        </div>
                      </div>
                      <div className="cartuplift-item-price-actions">
                        <div className="cartuplift-item-price">£14.00</div>
                        <button className="cartuplift-item-remove" title="Remove item">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.25" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Product 2 */}
                    <div className="cartuplift-item">
                      <div className="cartuplift-item-image">
                        <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop" alt="Men's Strider" />
                      </div>
                      <div className="cartuplift-item-info">
                        <h4 className="cartuplift-item-title">Men's Strider</h4>
                        <div className="cartuplift-item-variant">Color: White</div>
                        <div className="cartuplift-item-variant">Shoe size: 10</div>
                        <div className="cartuplift-quantity">
                          <button className="cartuplift-qty-btn">−</button>
                          <span className="cartuplift-qty-display">4</span>
                          <button className="cartuplift-qty-btn">+</button>
                        </div>
                      </div>
                      <div className="cartuplift-item-price-actions">
                        <div className="cartuplift-item-price">£115.00</div>
                        <button className="cartuplift-item-remove" title="Remove item">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.25" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations Section */}
                  {formSettings.enableRecommendations && (
                    <div className="cartuplift-recommendations">
                      <div className="cartuplift-recommendations-header">
                        <h3 className="cartuplift-recommendations-title">
                          {formSettings.recommendationsTitle || 'RECOMMENDED FOR YOU'}
                        </h3>
                        <button className="cartuplift-recommendations-toggle" title="Toggle recommendations">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '10px', height: '10px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                          </svg>
                        </button>
                      </div>
                      <div className="cartuplift-recommendations-content">
                        {formSettings.recommendationLayout === 'column' ? (
                          <>
                            <div className="cartuplift-recommendation-item">
                              <img src="https://images.unsplash.com/photo-1521093470119-a3acdc43374a?w=100&h=100&fit=crop" alt="Snowboard" />
                              <div className="cartuplift-recommendation-info">
                                <h4>The Multi-managed Snowboard</h4>
                                <div className="cartuplift-recommendation-price">£629.95</div>
                              </div>
                              <button className="cartuplift-add-btn">+</button>
                            </div>
                            <div className="cartuplift-recommendation-item">
                              <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=100&h=100&fit=crop" alt="Snowboard" />
                              <div className="cartuplift-recommendation-info">
                                <h4>The Collection Snowboard</h4>
                                <div className="cartuplift-recommendation-price">£549.95</div>
                              </div>
                              <button className="cartuplift-add-btn">+</button>
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
                    <div className="cartuplift-discount-section">
                      <div className="cartuplift-discount-wrapper">
                        <input 
                          type="text" 
                          className="cartuplift-discount-input" 
                          placeholder="Enter discount code"
                        />
                        <button className="cartuplift-discount-apply">Apply</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="cartuplift-footer">
                  <div className="cartuplift-subtotal">
                    <span>Subtotal</span>
                    <span>£474.00</span>
                  </div>
                  
                  <button className="cartuplift-checkout-btn">CHECKOUT</button>
                  
                  {formSettings.enableExpressCheckout && (
                    <div className="cartuplift-express-checkout">
                      <button className="cartuplift-paypal-btn">
                        <img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" alt="PayPal" style={{ height: '12px' }} />
                      </button>
                      <button className="cartuplift-shoppay-btn">Shop Pay</button>
                    </div>
                  )}
                </div>
              </div>
        </div>
      </div>
    </Page>
  );
}