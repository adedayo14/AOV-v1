import { useState, useEffect, useRef } from "react";
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
import { withAuth, withAuthAction } from "../utils/auth.server";
import { getSettings, saveSettings } from "../models/settings.server";

export const loader = withAuth(async ({ auth }) => {
  const shop = auth.session.shop;
  const settings = await getSettings(shop);
  return json({ settings });
});

export const action = withAuthAction(async ({ request, auth }) => {
  const shop = auth.session.shop;
  
  const formData = await request.formData();
  const settings = Object.fromEntries(formData);
  
  // Convert string values to appropriate types
  const processedSettings = {
    enableApp: settings.enableApp === 'true',
    enableStickyCart: settings.enableStickyCart === 'true',
    showOnlyOnCartPage: settings.showOnlyOnCartPage === 'true',
    autoOpenCart: settings.autoOpenCart === 'true',
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
    freeShippingText: String(settings.freeShippingText) || "You're {{ amount }} away from free shipping!",
    freeShippingAchievedText: String(settings.freeShippingAchievedText) || "🎉 Congratulations! You've unlocked free shipping!",
    recommendationsTitle: String(settings.recommendationsTitle) || "You might also like",
    actionText: String(settings.actionText) || "Add discount code",
    addButtonText: String(settings.addButtonText) || "Add",
    checkoutButtonText: String(settings.checkoutButtonText) || "CHECKOUT",
    applyButtonText: String(settings.applyButtonText) || "Apply",
    backgroundColor: String(settings.backgroundColor) || "#ffffff",
    textColor: String(settings.textColor) || "#1A1A1A",
    buttonColor: String(settings.buttonColor) || "#000000",
    buttonTextColor: String(settings.buttonTextColor) || "#ffffff",
    recommendationsBackgroundColor: String(settings.recommendationsBackgroundColor) || "#ecebe3",
    shippingBarBackgroundColor: String(settings.shippingBarBackgroundColor) || "#f0f0f0",
    shippingBarColor: String(settings.shippingBarColor) || "#4CAF50",
    recommendationLayout: String(settings.recommendationLayout) || "horizontal",
    complementDetectionMode: String(settings.complementDetectionMode) || "automatic",
    manualRecommendationProducts: String(settings.manualRecommendationProducts) || "",
  };
  
  try {
    await saveSettings(shop, processedSettings);
    return json({ success: true, message: "Settings saved successfully!" });
  } catch (error) {
    console.error("Error saving settings:", error);
    return json({ success: false, message: "Failed to save settings" }, { status: 500 });
  }
});

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [formSettings, setFormSettings] = useState(settings);

  // Helper function to resolve CSS custom properties with fallbacks for preview
  const resolveColor = (colorValue: string, fallback: string = '#000000'): string => {
    // If it's a CSS custom property, extract the fallback value
    if (colorValue.startsWith('var(')) {
      const fallbackMatch = colorValue.match(/var\([^,]+,\s*([^)]+)\)/);
      return fallbackMatch ? fallbackMatch[1].trim() : fallback;
    }
    return colorValue || fallback;
  };

  // Manual recommendation product selection state (for future implementation)
  // const [showProductSelector, setShowProductSelector] = useState(false);
  // const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  // const [productSearchQuery, setProductSearchQuery] = useState("");
  // const [selectedProducts, setSelectedProducts] = useState<string[]>(
  //   settings.manualRecommendationProducts ? settings.manualRecommendationProducts.split(',').filter(Boolean) : []
  // );
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Success banner auto-hide state
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Auto-hide success banner after 3 seconds
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && (fetcher.data as any)?.success) {
      setShowSuccessBanner(true);
      const timer = setTimeout(() => {
        setShowSuccessBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.state, fetcher.data]);

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
    { label: "Bottom Center", value: "bottom-center" },
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
    { label: "Horizontal", value: "row" },
    { label: "Vertical", value: "column" },
  ];

  const complementDetectionModeOptions = [
    { label: "✨ Sales Data Analysis", value: "automatic" },
    { label: "⚙️ Manual Rules Only", value: "manual" },
    { label: "🔄 Hybrid (Sales + Manual)", value: "hybrid" },
  ];

  // Calculate free shipping progress
  const threshold = (formSettings.freeShippingThreshold || 100) * 100;
  const currentTotal = 47400; // £474.00 in pence
  const remaining = Math.max(0, threshold - currentTotal);
  const progress = Math.min((currentTotal / threshold) * 100, 100);

  return (
    <Page
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
            grid-template-columns: 1fr 480px !important;
            gap: 24px;
            width: 100%;
            position: relative;
            padding: 0;
            min-height: 100vh;
          }
          
          @media (max-width: 1000px) {
            .cartuplift-settings-layout {
              grid-template-columns: 1fr !important;
              padding: 0;
            }
            .cartuplift-preview-column {
              position: relative !important;
              height: auto !important;
              max-height: none !important;
              margin-bottom: 24px;
              order: -1; /* Show preview first on mobile */
            }
            .cartuplift-preview-container {
              max-width: 400px !important;
              margin: 0 auto !important;
            }
          }
          
          @media (min-width: 1600px) {
            .cartuplift-settings-layout {
              grid-template-columns: 1fr 520px !important;
              gap: 32px;
              padding: 0;
            }
          }
          
          .cartuplift-settings-column {
            min-width: 0;
            width: 100%;
            padding-right: 24px;
          }
          
          .cartuplift-success-banner {
            grid-column: 1 / -1;
            margin-bottom: 20px;
          }
          
          .cartuplift-preview-column {
            position: sticky !important;
            top: 0px;
            height: 100vh;
            max-height: 100vh;
            display: block !important;
          }
          
          .cartuplift-preview-container {
            width: 480px;
            height: 100vh;
            background: ${formSettings.backgroundColor || '#ffffff'};
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            border-radius: 0;
            display: flex;
            flex-direction: column;
            border: 1px solid #e1e3e5;
            overflow: hidden;
            color: ${formSettings.textColor || '#1a1a1a'};
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
            background: ${resolveColor(formSettings.shippingBarBackgroundColor, '#f0f0f0')};
            border-radius: 2px;
            overflow: hidden;
          }

          .cartuplift-shipping-progress-fill {
            height: 100%;
            background: ${resolveColor(formSettings.shippingBarColor, '#4CAF50')};
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
            display: inline-flex;
            align-items: center;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            background: white;
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
            font-weight: 400;
            color: #333;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
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
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            flex: 1;
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
            padding-top: 6px;
            width: 100%;
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

          .cartuplift-notes-wrapper {
            margin-top: 6px;
          }

          .cartuplift-notes-input {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 9px;
            font-family: inherit;
            resize: vertical;
            min-height: 40px;
          }

          .cartuplift-combined-action {
            margin-top: 8px;
            text-align: center;
          }

          .cartuplift-action-button {
            width: 100%;
            padding: 8px 12px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            border: none;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* Modal Preview Styles */
          .cartuplift-modal-preview {
            margin-top: 12px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-size: 10px;
            overflow: hidden;
          }

          .cartuplift-modal-preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
          }

          .cartuplift-modal-preview-title {
            font-size: 11px;
            font-weight: 600;
            margin: 0;
          }

          .cartuplift-modal-preview-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: inherit;
            font-size: 14px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .cartuplift-modal-preview-body {
            padding: 12px;
            background: white;
          }

          .cartuplift-modal-preview-section {
            margin-bottom: 12px;
          }

          .cartuplift-modal-preview-section:last-child {
            margin-bottom: 0;
          }

          .cartuplift-modal-preview-label {
            display: block;
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
            font-size: 9px;
          }

          .cartuplift-modal-preview-input-group {
            display: flex;
            gap: 6px;
          }

          .cartuplift-modal-preview-input {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 9px;
            background: white;
          }

          .cartuplift-modal-preview-textarea {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 9px;
            background: white;
            resize: vertical;
            font-family: inherit;
            min-height: 40px;
          }

          .cartuplift-modal-preview-apply {
            padding: 6px 10px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            border: none;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
          }

          .cartuplift-modal-preview-footer {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            padding: 8px 12px;
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
          }

          .cartuplift-modal-preview-btn {
            padding: 4px 12px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            cursor: pointer;
            border: none;
          }

          .cartuplift-modal-preview-btn.secondary {
            background: #f3f4f6;
            color: #374151;
          }

          .cartuplift-modal-preview-btn.primary {
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
          }

          /* Sticky Cart Preview Styles */
          .cartuplift-sticky-preview {
            position: absolute;
            z-index: 10;
            transition: all 0.3s ease;
          }

          .cartuplift-sticky-preview.bottom-right {
            bottom: 20px;
            right: 20px;
          }

          .cartuplift-sticky-preview.bottom-center {
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
          }

          .cartuplift-sticky-preview.bottom-left {
            bottom: 20px;
            left: 20px;
          }

          .cartuplift-sticky-preview.top-right {
            top: 20px;
            right: 20px;
          }

          .cartuplift-sticky-preview.top-left {
            top: 20px;
            left: 20px;
          }

          .cartuplift-sticky-preview .cartuplift-sticky-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            border: none;
            border-radius: 25px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            font-size: 11px;
            font-weight: 600;
            transition: all 0.3s ease;
          }

          .cartuplift-sticky-icon {
            width: 14px;
            height: 14px;
          }

          .cartuplift-sticky-preview .cartuplift-sticky-count {
            background: #ff4444;
            color: white;
            border-radius: 8px;
            padding: 1px 4px;
            font-size: 9px;
            font-weight: bold;
            min-width: 14px;
            text-align: center;
          }

          .cartuplift-sticky-preview .cartuplift-sticky-total {
            font-weight: 700;
            font-size: 11px;
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
            background: ${resolveColor(formSettings.shippingBarBackgroundColor, '#f0f0f0')};
            border-radius: 3px;
            overflow: hidden;
            position: relative;
          }

          .cartuplift-shipping-progress-fill {
            height: 100%;
            background: ${resolveColor(formSettings.shippingBarColor, '#4CAF50')};
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
            width: 100%;
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
          
          /* Color Picker Styles */
          .cartuplift-color-picker-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 8px;
          }
          
          .cartuplift-color-input {
            width: 50px;
            height: 36px;
            border: 1px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
            background: none;
          }
          
          .cartuplift-color-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 12px;
          }
          
          .cartuplift-color-input-full {
            width: 50px;
            height: 36px;
            border: 1px solid #ddd;
            border-radius: 6px;
            cursor: pointer;
            background: none;
            margin-bottom: 8px;
          }
          
          .cartuplift-shipping-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 24px;
            align-items: start;
            margin-top: 12px;
          }
          
          .cartuplift-shipping-row > div {
            display: flex;
            flex-direction: column;
            width: 100%;
          }
          
          .cartuplift-shipping-row .cartuplift-threshold-input {
            margin-top: 8px;
          }
          
          .cartuplift-appearance-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 24px;
            align-items: start;
            margin-top: 12px;
          }
          
          .cartuplift-appearance-row > div {
            display: flex;
            flex-direction: column;
            width: 100%;
          }
          
          .cartuplift-color-input-full-width {
            width: 100%;
            height: 40px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            background: none;
            margin-top: 8px;
            display: block;
            box-sizing: border-box;
          }
          
          .cartuplift-icon-small { width: 10px; height: 10px; }
          .cartuplift-icon-medium { width: 18px; height: 18px; }
          .cartuplift-icon-large { width: 24px; height: 24px; }
          .cartuplift-paypal-logo { height: 12px; }
          
          /* Recommendations Styling */
          .cartuplift-recommendations {
            background: ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
            margin-top: 8px;
            border-radius: 8px;
          }
          
          .cartuplift-recommendations-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
            border-radius: 8px 8px 0 0;
          }
          
          .cartuplift-recommendations-title {
            font-size: 12px;
            font-weight: 600;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: ${formSettings.textColor || '#1a1a1a'};
          }
          
          .cartuplift-recommendations-toggle {
            width: 24px;
            height: 24px;
            border: 1px solid ${formSettings.textColor || '#111'};
            border-radius: 50%;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${formSettings.textColor || '#111'};
          }
          
          .cartuplift-recommendations-content {
            padding: 0 16px 16px;
            background: ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
          }
          
          .cartuplift-recommendations-row {
            position: relative;
          }
          
          .cartuplift-recommendations-track {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding: 8px 0;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }
          
          .cartuplift-recommendations-track::-webkit-scrollbar {
            display: none;
          }
          
          .cartuplift-recommendation-card {
            flex: 0 0 280px;
            background: white;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
            border: 1px solid #e0e0e0;
          }
          
          .cartuplift-card-content {
            display: flex;
            gap: 10px;
            align-items: flex-start;
          }
          
          .cartuplift-product-image {
            width: 60px;
            height: 60px;
            border-radius: 6px;
            overflow: hidden;
            background: #fafafa;
            flex-shrink: 0;
          }
          
          .cartuplift-product-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .cartuplift-product-info {
            flex: 1;
            min-width: 0;
          }
          
          .cartuplift-product-info h4 {
            font-size: 13px;
            font-weight: 500;
            margin: 0 0 6px 0;
            line-height: 1.3;
            color: #000;
          }
          
          .cartuplift-product-variation {
            margin-top: 4px;
          }
          
          .cartuplift-size-dropdown {
            padding: 4px 16px 4px 8px;
            border: 1px solid #ddd;
            border-radius: 12px;
            background: white;
            font-size: 10px;
            font-weight: 500;
            appearance: none;
            cursor: pointer;
            max-width: 80px;
          }
          
          .cartuplift-product-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: space-between;
            height: 60px;
            flex-shrink: 0;
          }
          
          .cartuplift-recommendation-price {
            font-size: 13px;
            font-weight: 600;
            color: #000;
          }
          
          .cartuplift-add-recommendation {
            padding: 4px 10px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            border: 1px solid ${resolveColor(formSettings.buttonColor, '#000000')};
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
          }
          
          .cartuplift-checkout-btn {
            width: 100%;
            padding: 12px 16px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            margin-bottom: 8px;
            cursor: pointer;
          }
          
          .cartuplift-shipping-progress-fill {
            height: 100%;
            background: ${resolveColor(formSettings.shippingBarColor, '#4CAF50')};
            border-radius: 3px;
            transition: width 0.5s ease;
            min-width: 2px;
          }
          
          .cartuplift-carousel-controls {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 8px 0;
          }
          
          .cartuplift-carousel-nav {
            width: 24px;
            height: 24px;
            border: 1px solid ${formSettings.textColor || '#111'};
            border-radius: 50%;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${formSettings.textColor || '#111'};
          }
          
          /* Cart items styling */
          .cartuplift-item {
            display: flex;
            align-items: stretch;
            gap: 16px;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
            color: ${formSettings.textColor || '#1a1a1a'};
          }
          
          .cartuplift-item-title {
            font-size: 13px;
            font-weight: 600;
            margin: 0 0 4px 0;
            color: ${formSettings.textColor || '#1a1a1a'};
          }
          
          .cartuplift-item-variant {
            font-size: 12px;
            color: #666;
            margin: 2px 0;
          }
          
          .cartuplift-item-price {
            font-weight: 600;
            font-size: 13px;
            color: ${formSettings.textColor || '#000'};
          }
          
          .cartuplift-quantity {
            display: inline-flex;
            align-items: center;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            background: ${formSettings.backgroundColor || '#ffffff'};
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
            color: ${formSettings.textColor || '#333'};
          }
          
          .cartuplift-qty-display {
            font-size: 12px;
            font-weight: 500;
            color: ${formSettings.textColor || '#000'};
          }
          
          .cartuplift-item-remove {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 6px;
            color: ${formSettings.textColor || '#000'};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .cartuplift-item-image {
            width: 90px;
            height: 90px;
            border-radius: 6px;
            overflow: hidden;
            background: #f8f8f8;
            flex-shrink: 0;
          }
          
          .cartuplift-item-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .cartuplift-item-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          
          .cartuplift-item-price-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: space-between;
            height: 90px;
          }
          
          /* Footer and other elements */
          .cartuplift-preview-header {
            padding: 12px 16px 8px;
            background: ${formSettings.backgroundColor || '#ffffff'};
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-bottom: 1px solid #f0f0f0;
          }
          
          .cartuplift-cart-title {
            font-size: 13px;
            font-weight: 600;
            color: ${formSettings.textColor || '#000'};
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin: 0;
          }
          
          .cartuplift-shipping-message {
            font-size: 12px;
            color: ${formSettings.textColor || '#333'};
            margin: 0;
            text-align: center;
          }
          
          .cartuplift-close {
            background: transparent;
            border: none;
            cursor: pointer;
            color: ${formSettings.textColor || '#000'};
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .cartuplift-shipping-bar {
            padding: 0 16px 8px;
            background: ${formSettings.backgroundColor || '#ffffff'};
          }
          
          .cartuplift-shipping-progress {
            width: 100%;
            height: 6px;
            background: ${resolveColor(formSettings.shippingBarBackgroundColor, '#f0f0f0')};
            border-radius: 3px;
            overflow: hidden;
          }
          
          .cartuplift-content-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: ${formSettings.backgroundColor || '#ffffff'};
          }
          
          .cartuplift-items {
            flex: 1;
            padding: 0 16px;
            overflow-y: auto;
            background: ${formSettings.backgroundColor || '#ffffff'};
          }
          
          .cartuplift-footer {
            padding: 12px 16px;
            background: ${formSettings.backgroundColor || '#ffffff'};
          }
          
          .cartuplift-subtotal {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 8px 0;
            font-size: 15px;
            font-weight: 600;
            color: ${formSettings.textColor || '#000'};
          }
          
          .cartuplift-discount-section {
            padding: 8px 16px;
            background: ${formSettings.backgroundColor || '#ffffff'};
            width: 100%;
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
            background: ${formSettings.backgroundColor || 'white'};
            color: ${formSettings.textColor || '#000'};
          }
          
          .cartuplift-discount-apply {
            padding: 10px 16px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
          }
          
          .cartuplift-manual-rec-section {
            margin-top: 16px;
          }
          
          .cartuplift-manual-rec-info {
            margin-top: 8px;
            padding: 12px;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            background-color: #f8f9fa;
          }
          
          .cartuplift-manual-rec-products {
            margin-top: 12px;
          }
          
          .cartuplift-shipping-progress-fill {
            width: 65%;
            height: 100%;
            background: ${resolveColor(formSettings.shippingBarColor, '#4CAF50')};
            border-radius: 3px;
            transition: width 0.3s ease;
          }
          
          /* Column layout for recommendations */
          .cartuplift-recommendation-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: white;
            border: 1px solid #f0f0f0;
            border-radius: 8px;
            margin-bottom: 8px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          }
          
          .cartuplift-recommendation-item img {
            width: 48px;
            height: 48px;
            object-fit: cover;
            border-radius: 6px;
          }
          
          .cartuplift-recommendation-info {
            flex: 1;
            min-width: 0;
          }
          
          .cartuplift-recommendation-info h4 {
            font-size: 13px;
            font-weight: 500;
            margin: 0 0 4px 0;
            color: #000;
          }
          
          .cartuplift-add-btn {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid #000;
            background: white;
            color: #000;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: normal;
          }
          
          /* Full Width Showcase Layout */
          .cartuplift-fullwidth-showcase {
            background: white;
            border-radius: 8px;
            padding: 16px;
            border: 1px solid #e0e0e0;
          }
          
          .cartuplift-fullwidth-item {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          
          .cartuplift-fullwidth-item img {
            width: 150px;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
          }
          
          .cartuplift-fullwidth-info {
            flex: 1;
          }
          
          .cartuplift-fullwidth-info h4 {
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 8px 0;
            color: #000;
          }
          
          .cartuplift-fullwidth-info p {
            font-size: 14px;
            color: #666;
            margin: 0 0 12px 0;
          }
          
          .cartuplift-fullwidth-price {
            font-size: 24px;
            font-weight: 700;
            color: #000;
            margin-bottom: 16px;
          }
          
          .cartuplift-fullwidth-add {
            padding: 12px 24px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          /* Grid Layout (2x2) */
          .cartuplift-grid-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          
          .cartuplift-grid-item {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
          
          .cartuplift-grid-item img {
            width: 100%;
            max-width: 120px;
            height: 120px;
            object-fit: cover;
            border-radius: 6px;
            margin-bottom: 8px;
          }
          
          .cartuplift-grid-item h5 {
            font-size: 12px;
            font-weight: 500;
            margin: 0 0 4px 0;
            color: #000;
            line-height: 1.3;
          }
          
          .cartuplift-grid-item span {
            font-size: 13px;
            font-weight: 600;
            color: #000;
            display: block;
            margin-bottom: 8px;
          }
          
          .cartuplift-grid-item button {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid ${resolveColor(formSettings.buttonColor, '#000000')};
            background: white;
            color: ${resolveColor(formSettings.buttonColor, '#000000')};
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            margin: 0 auto;
          }
          
          .cartuplift-grid-item button:hover {
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: white;
          }
        `
      }} />

      <div className="cartuplift-settings-layout">
        {showSuccessBanner && (
          <div className="cartuplift-success-banner">
            <Banner tone="success">Settings saved successfully!</Banner>
          </div>
        )}
        
        {/* Settings Column - Left Side */}
        <div className="cartuplift-settings-column">
          <BlockStack gap="500">
            {/* Header */}
            <Card padding="300">
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
                    checked={(formSettings as any).autoOpenCart !== false}
                    onChange={(value) => updateSetting("autoOpenCart", value)}
                    helpText="Automatically show cart when customers add items (recommended)"
                  />
                  
                  <Checkbox
                    label="Enable Product Recommendations"
                    checked={formSettings.enableRecommendations}
                    onChange={(value) => updateSetting("enableRecommendations", value)}
                    helpText="Show related products to increase average order value"
                  />
                  
                  <Checkbox
                    label="Enable Analytics Tracking"
                    checked={formSettings.enableAnalytics}
                    onChange={(value) => updateSetting("enableAnalytics", value)}
                    helpText="Track cart performance and user behavior"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Free Shipping Incentive */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🚚 Free Shipping Incentive</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable free shipping progress bar"
                    checked={formSettings.enableFreeShipping}
                    onChange={(value) => updateSetting("enableFreeShipping", value)}
                    helpText="ℹ️ Show a progress bar to motivate customers to reach your free shipping threshold."
                  />
                  
                  {formSettings.enableFreeShipping && (
                    <BlockStack gap="600">
                      <BlockStack gap="400">
                        <TextField
                          label="Progress message"
                          value={formSettings.freeShippingText}
                          onChange={(value) => updateSetting("freeShippingText", value)}
                          helpText="ℹ️ Use {{ amount }} or {amount} where you want the remaining balance to appear. It will update automatically."
                          placeholder="You're {{ amount }} away from free shipping!"
                          autoComplete="off"
                        />
                        
                        <TextField
                          label="Success message"
                          value={formSettings.freeShippingAchievedText}
                          onChange={(value) => updateSetting("freeShippingAchievedText", value)}
                          helpText="ℹ️ This message is shown once the free shipping threshold is reached."
                          placeholder="🎉 Congratulations! You've unlocked free shipping!"
                          autoComplete="off"
                        />
                      </BlockStack>
                      
                      <div className="cartuplift-shipping-row">
                        <div>
                          <Text variant="headingMd" as="h3">Threshold</Text>
                          <div className="cartuplift-threshold-input">
                            <TextField
                              label=""
                              labelHidden
                              type="number"
                              value={String(formSettings.freeShippingThreshold)}
                              onChange={(value) => updateSetting("freeShippingThreshold", parseInt(value) || 100)}
                              helpText="ℹ️ Minimum amount for free shipping"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Text variant="headingMd" as="h3">Background</Text>
                          <input
                            type="color"
                            value={resolveColor(formSettings.shippingBarBackgroundColor, '#f0f0f0')}
                            onChange={(e) => updateSetting("shippingBarBackgroundColor", e.target.value)}
                            className="cartuplift-color-input-full-width"
                            title={resolveColor(formSettings.shippingBarBackgroundColor, '#f0f0f0')}
                            aria-label={`Shipping bar background color: ${resolveColor(formSettings.shippingBarBackgroundColor, '#f0f0f0')}`}
                          />
                        </div>
                        
                        <div>
                          <Text variant="headingMd" as="h3">Bar Color</Text>
                          <input
                            type="color"
                            value={resolveColor(formSettings.shippingBarColor, '#4CAF50')}
                            onChange={(e) => updateSetting("shippingBarColor", e.target.value)}
                            className="cartuplift-color-input-full-width"
                            title={resolveColor(formSettings.shippingBarColor, '#4CAF50')}
                            aria-label={`Shipping bar color: ${resolveColor(formSettings.shippingBarColor, '#4CAF50')}`}
                          />
                        </div>
                      </div>
                    </BlockStack>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Appearance & Positioning */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🎨 Appearance & Style</Text>
                <FormLayout>
                  <Select
                    label="Cart Icon Style"
                    options={cartIconOptions}
                    value={formSettings.cartIcon}
                    onChange={(value) => updateSetting("cartIcon", value)}
                  />
                  
                  <div className="cartuplift-appearance-row">
                    <div>
                      <Text variant="headingMd" as="h3">Button Color</Text>
                      <input
                        type="color"
                        value={resolveColor(formSettings.buttonColor, '#000000')}
                        onChange={(e) => updateSetting("buttonColor", e.target.value)}
                        className="cartuplift-color-input-full-width"
                        title={resolveColor(formSettings.buttonColor, '#000000')}
                        aria-label={`Button color: ${resolveColor(formSettings.buttonColor, '#000000')}`}
                      />
                    </div>
                    
                    <div>
                      <Text variant="headingMd" as="h3">Button Text</Text>
                      <input
                        type="color"
                        value={resolveColor(formSettings.buttonTextColor, '#ffffff')}
                        onChange={(e) => updateSetting("buttonTextColor", e.target.value)}
                        className="cartuplift-color-input-full-width"
                        title={resolveColor(formSettings.buttonTextColor, '#ffffff')}
                        aria-label={`Button text color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')}`}
                      />
                    </div>
                    
                    <div>
                      <Text variant="headingMd" as="h3">Text Color</Text>
                      <input
                        type="color"
                        value={formSettings.textColor || '#1A1A1A'}
                        onChange={(e) => updateSetting("textColor", e.target.value)}
                        className="cartuplift-color-input-full-width"
                        title={formSettings.textColor || '#1A1A1A'}
                        aria-label={`Text color: ${formSettings.textColor || '#1A1A1A'}`}
                      />
                    </div>
                  </div>
                  
                  <Checkbox
                    label="Enable Sticky Cart"
                    checked={formSettings.enableStickyCart}
                    onChange={(checked) => updateSetting("enableStickyCart", checked)}
                    helpText="Keep the cart accessible as users browse your store"
                  />

                  <Select
                    label="Cart Position"
                    options={cartPositionOptions}
                    value={formSettings.cartPosition}
                    onChange={(value) => updateSetting("cartPosition", value)}
                    helpText="Where the cart button appears on your store"
                  />
                  
                  <Checkbox
                    label="Show only on cart page"
                    checked={formSettings.showOnlyOnCartPage}
                    onChange={(value) => updateSetting("showOnlyOnCartPage", value)}
                    helpText="Limit cart uplift features to cart page only (disables recommendations and upsells on other pages)"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Smart Recommendations - Only show if enabled */}
            {formSettings.enableRecommendations && (
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">🎯 Smart Recommendations</Text>
                  <FormLayout>
                    <Select
                      label="Layout Style"
                      options={recommendationLayoutOptions}
                      value={formSettings.recommendationLayout}
                      onChange={(value) => updateSetting("recommendationLayout", value)}
                      helpText="How recommendations are displayed in the cart"
                    />
                    
                    <TextField
                      label="Maximum Products to Show"
                      type="number"
                      value={String(formSettings.maxRecommendations)}
                      onChange={(value) => updateSetting("maxRecommendations", parseInt(value) || 4)}
                      helpText="We recommend 2–4 cards to keep it focused. You can choose any number."
                      autoComplete="off"
                    />
                    
                    <TextField
                      label="Section Title"
                      value={formSettings.recommendationsTitle}
                      onChange={(value) => updateSetting("recommendationsTitle", value)}
                      helpText="Header text for the recommendations section"
                      placeholder="You might also like"
                      autoComplete="off"
                    />
                    
                    <div>
                      <Text variant="headingMd" as="h3">Background Color</Text>
                      <input
                        type="color"
                        value={(formSettings as any).recommendationsBackgroundColor || '#ecebe3'}
                        onChange={(e) => updateSetting("recommendationsBackgroundColor", e.target.value)}
                        className="cartuplift-color-input-full-width"
                        title={(formSettings as any).recommendationsBackgroundColor || '#ecebe3'}
                        aria-label={`Recommendations background: ${(formSettings as any).recommendationsBackgroundColor || '#ecebe3'}`}
                      />
                    </div>
                    
                    <TextField
                      label="Add Button Text"
                      value={formSettings.addButtonText || 'Add'}
                      onChange={(value) => updateSetting("addButtonText", value)}
                      helpText="Text for recommendation Add buttons"
                      placeholder="Add"
                      autoComplete="off"
                    />
                    
                    <Select
                      label="Recommendation Engine"
                      options={complementDetectionModeOptions}
                      value={formSettings.complementDetectionMode}
                      onChange={(value) => updateSetting("complementDetectionMode", value)}
                      helpText="How products are selected for recommendations"
                    />
                    
                    {formSettings.complementDetectionMode === 'manual' && (
                      <div className="cartuplift-manual-rec-section">
                        <Text variant="bodyMd" as="p" tone="subdued">
                          🛠️ Manual Product Selection
                        </Text>
                        <div className="cartuplift-manual-rec-info">
                          <Text variant="bodyMd" as="p">
                            When manual mode is selected, you can choose specific products to recommend. This feature will show a product selector where you can search and select products from your store.
                          </Text>
                          <div className="cartuplift-manual-rec-products">
                            <Text variant="bodyMd" as="p" tone="subdued">
                              📝 Coming soon: Product selection interface
                            </Text>
                          </div>
                        </div>
                      </div>
                    )}
                  </FormLayout>
                </BlockStack>
              </Card>
            )}

            {/* Additional Features */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">⚡ Additional Features</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Discount Code Field"
                    checked={formSettings.enableDiscountCode}
                    onChange={(value) => updateSetting("enableDiscountCode", value)}
                    helpText="Allow customers to apply discount codes in cart"
                  />
                  
                  {formSettings.enableDiscountCode && (
                    <TextField
                      label="Apply Button Text"
                      value={formSettings.applyButtonText || 'Apply'}
                      onChange={(value) => updateSetting("applyButtonText", value)}
                      helpText="Text for discount code apply button"
                      placeholder="Apply"
                      autoComplete="off"
                    />
                  )}
                  
                  <Checkbox
                    label="Enable Order Notes"
                    checked={formSettings.enableNotes}
                    onChange={(value) => updateSetting("enableNotes", value)}
                    helpText="Let customers add special instructions"
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
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Checkout Options */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">💳 Checkout Options</Text>
                <FormLayout>
                  <TextField
                    label="Checkout Button Text"
                    value={formSettings.checkoutButtonText || 'CHECKOUT'}
                    onChange={(value) => updateSetting("checkoutButtonText", value)}
                    helpText="Text for the main checkout button"
                    placeholder="CHECKOUT"
                    autoComplete="off"
                  />
                  
                  <Checkbox
                    label="Enable Express Checkout Buttons"
                    checked={formSettings.enableExpressCheckout}
                    onChange={(value) => updateSetting("enableExpressCheckout", value)}
                    helpText="Show PayPal, Shop Pay, and other express checkout options"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>

        {/* Preview Column - Right Side */}
        <div className="cartuplift-preview-column" ref={previewRef}>
          <div className="cartuplift-preview-container">
            {/* Header */}
            <div className="cartuplift-preview-header">
                  <h2 className="cartuplift-cart-title">CART (5)</h2>
                  {formSettings.enableFreeShipping && (
                    <div className="cartuplift-shipping-info">
                      <p className="cartuplift-shipping-message">
                        {remaining > 0 
                          ? (formSettings.freeShippingText || "Spend {{ amount }} more for free shipping!")
                              .replace(/\{\{\s*amount\s*\}\}/g, `${(remaining / 100).toFixed(2)}`)
                              .replace(/{amount}/g, `${(remaining / 100).toFixed(2)}`)
                          : formSettings.freeShippingAchievedText || "🎉 Congratulations! You've unlocked free shipping!"
                        }
                      </p>
                    </div>
                  )}
                  <button className="cartuplift-close" aria-label="Close cart">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-large">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Free Shipping Progress Bar */}
                {formSettings.enableFreeShipping && (
                  <div className="cartuplift-shipping-bar">
                    <div className="cartuplift-shipping-progress">
                      <div className="cartuplift-shipping-progress-fill" data-progress={progress}></div>
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
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.25" stroke="currentColor" className="cartuplift-icon-medium">
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
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.25" stroke="currentColor" className="cartuplift-icon-medium">
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
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-small">
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
                        ) : formSettings.recommendationLayout === 'fullwidth' ? (
                          <div className="cartuplift-fullwidth-showcase">
                            <div className="cartuplift-fullwidth-item">
                              <img src="https://images.unsplash.com/photo-1521093470119-a3acdc43374a?w=150&h=150&fit=crop" alt="Snowboard" />
                              <div className="cartuplift-fullwidth-info">
                                <h4>🔥 Top Seller: The Multi-managed Snowboard</h4>
                                <p>Best performance in your category</p>
                                <div className="cartuplift-fullwidth-price">£629.95</div>
                                <button className="cartuplift-fullwidth-add">{formSettings.addButtonText || 'Add to Cart'}</button>
                              </div>
                            </div>
                          </div>
                        ) : formSettings.recommendationLayout === 'grid' ? (
                          <div className="cartuplift-grid-layout">
                            <div className="cartuplift-grid-item">
                              <img src="https://images.unsplash.com/photo-1521093470119-a3acdc43374a?w=120&h=120&fit=crop" alt="Snowboard" />
                              <h5>Multi-managed Snowboard</h5>
                              <span>£629.95</span>
                              <button>+</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=120&h=120&fit=crop" alt="Collection" />
                              <h5>Collection Snowboard</h5>
                              <span>£549.95</span>
                              <button>+</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=120&h=120&fit=crop" alt="Jacket" />
                              <h5>Winter Jacket</h5>
                              <span>£329.95</span>
                              <button>+</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=120&h=120&fit=crop" alt="Gloves" />
                              <h5>Winter Gloves</h5>
                              <span>£89.95</span>
                              <button>+</button>
                            </div>
                          </div>
                        ) : (
                          <div className="cartuplift-recommendations-row">
                            <div className="cartuplift-recommendations-track">
                              <div className="cartuplift-recommendation-card">
                                <div className="cartuplift-card-content">
                                  <div className="cartuplift-product-image">
                                    <img src="https://images.unsplash.com/photo-1521093470119-a3acdc43374a?w=100&h=100&fit=crop" alt="Snowboard" />
                                  </div>
                                  <div className="cartuplift-product-info">
                                    <h4>The Multi-managed Snowboard</h4>
                                    <div className="cartuplift-product-variation">
                                      <select className="cartuplift-size-dropdown" title="Select size">
                                        <option>Size: M</option>
                                        <option>Size: L</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="cartuplift-product-actions">
                                    <div className="cartuplift-recommendation-price">£629.95</div>
                                    <button className="cartuplift-add-recommendation">{formSettings.addButtonText || 'Add'}</button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="cartuplift-recommendation-card">
                                <div className="cartuplift-card-content">
                                  <div className="cartuplift-product-image">
                                    <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=100&h=100&fit=crop" alt="Collection Snowboard" />
                                  </div>
                                  <div className="cartuplift-product-info">
                                    <h4>The Collection Snowboard</h4>
                                    <div className="cartuplift-product-variation">
                                      <select className="cartuplift-size-dropdown" title="Select size">
                                        <option>Size: S</option>
                                        <option>Size: M</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="cartuplift-product-actions">
                                    <div className="cartuplift-recommendation-price">£549.95</div>
                                    <button className="cartuplift-add-recommendation">{formSettings.addButtonText || 'Add'}</button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="cartuplift-recommendation-card">
                                <div className="cartuplift-card-content">
                                  <div className="cartuplift-product-image">
                                    <img src="https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=100&h=100&fit=crop" alt="Winter Jacket" />
                                  </div>
                                  <div className="cartuplift-product-info">
                                    <h4>Winter Jacket Pro</h4>
                                    <div className="cartuplift-product-variation">
                                      <select className="cartuplift-size-dropdown" title="Select size">
                                        <option>Size: L</option>
                                        <option>Size: XL</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="cartuplift-product-actions">
                                    <div className="cartuplift-recommendation-price">£299.95</div>
                                    <button className="cartuplift-add-recommendation">{formSettings.addButtonText || 'Add'}</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="cartuplift-carousel-controls">
                              <button className="cartuplift-carousel-nav" title="Previous">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                </svg>
                              </button>
                              <button className="cartuplift-carousel-nav" title="Next">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Discount & Notes Section - Simple Button Only */}
                  {(formSettings.enableDiscountCode || formSettings.enableNotes) && (
                    <div className="cartuplift-discount-section">
                      <button className="cartuplift-action-button">
                        {formSettings.actionText || 'Add discount codes and notes'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="cartuplift-footer">
                  <div className="cartuplift-subtotal">
                    <span>Subtotal</span>
                    <span>£474.00</span>
                  </div>
                  
                  <button className="cartuplift-checkout-btn">{formSettings.checkoutButtonText || 'CHECKOUT'}</button>
                  
                  {formSettings.enableExpressCheckout && (
                    <div className="cartuplift-express-checkout">
                      <button className="cartuplift-paypal-btn">
                        <img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" alt="PayPal" className="cartuplift-paypal-logo" />
                      </button>
                      <button className="cartuplift-shoppay-btn">Shop Pay</button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sticky Cart Preview */}
              <div className={`cartuplift-sticky-preview ${formSettings.cartPosition || 'bottom-right'}`}>
                <button className="cartuplift-sticky-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-sticky-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  <span className="cartuplift-sticky-count">5</span>
                  <span className="cartuplift-sticky-total">£474.00</span>
                </button>
              </div>
        </div>
      </div>
    </Page>
  );
}