import * as React from "react";
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
  Button,
  InlineStack,
  Badge,
  Divider,
  Modal,
  Spinner,




} from "@shopify/polaris";
import { withAuth, withAuthAction } from "../utils/auth.server";
import { getSettings, saveSettings } from "../models/settings.server";

const { useState, useEffect, useRef } = React;

export const loader = withAuth(async ({ auth }) => {
  console.log('📥 [LOADER v2.0] Settings loader called');
  const shop = auth.session.shop;
  console.log('📥 [LOADER v2.0] Shop:', shop);
  const settings = await getSettings(shop);
  console.log('📥 [LOADER v2.0] Settings loaded successfully');

  
  // Get shop currency information
  let shopCurrency = { currencyCode: 'USD', moneyFormat: undefined }; // Default fallback
  try {
    const shopQuery = `
      query getShop {
        shop {
          currencyCode
        }
      }
    `;
    
    const response = await auth.admin.graphql(shopQuery);
    const shopData = await response.json();
    
    if (shopData.data?.shop) {
      shopCurrency = {
        currencyCode: shopData.data.shop.currencyCode || 'USD',
        moneyFormat: undefined
      };
    }
  } catch (error) {
    console.error('Error fetching shop currency:', error);
  }
  
  return json({ settings, shopCurrency });
});

export const action = withAuthAction(async ({ request, auth }) => {
  console.log('🔥 [ACTION v2.0] =====================================');
  console.log('🔥 [ACTION v2.0] Form action DEFINITELY CALLED!');
  console.log('🔥 [ACTION v2.0] Request method:', request.method);
  console.log('🔥 [ACTION v2.0] Request URL:', request.url);
  console.log('🔥 [ACTION v2.0] Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('🔥 [ACTION v2.0] =====================================');
  
  const shop = auth.session.shop;
  console.log('🔥 [ACTION v2.0] Shop:', shop);
  
  const formData = await request.formData();
  const settings = Object.fromEntries(formData);
  console.log('🔥 [ACTION v2.0] Settings received:', Object.keys(settings).length, 'fields');
  console.log('🔥 [ACTION v2.0] First 3 settings:', Object.entries(settings).slice(0, 3));
  
  // Convert string values to appropriate types
  const processedSettings = {
    enableApp: settings.enableApp === 'true',
    autoOpenCart: settings.autoOpenCart === 'true',

    // Advanced cart features (basic features handled by theme embed)
    enableAddons: settings.enableAddons === 'true',
    enableExpressCheckout: settings.enableExpressCheckout === 'true',
    enableAnalytics: settings.enableAnalytics === 'true',

    actionText: String(settings.actionText) || "Add discount code",
    addButtonText: String(settings.addButtonText) || "Add",
    checkoutButtonText: String(settings.checkoutButtonText) || "CHECKOUT",
    applyButtonText: String(settings.applyButtonText) || "Apply",
    
    // Advanced text customization (basic text handled by theme embed)
    
    // Cart icon selection (colors handled by theme embed)
    cartIcon: String(settings.cartIcon) || 'cart',

    // Progress Bar System

  // ML / Smart Bundles
  enableMLRecommendations: settings.enableMLRecommendations === 'true',
  enableSmartBundles: settings.enableSmartBundles === 'true',
  mlPersonalizationMode: String(settings.mlPersonalizationMode) || 'basic',
  mlPrivacyLevel: String(settings.mlPrivacyLevel) || 'basic',
  // Advanced Recommendation Settings
  maxRecommendationProducts: Number(settings.maxRecommendationProducts ?? 3),
  hideRecommendationsAfterThreshold: settings.hideRecommendationsAfterThreshold === 'true',
  enableThresholdBasedSuggestions: settings.enableThresholdBasedSuggestions === 'true',
  thresholdSuggestionMode: String(settings.thresholdSuggestionMode) || 'smart',
  manualRecommendationProducts: String(settings.manualRecommendationProducts) || '',
  enableManualRecommendations: settings.enableManualRecommendations === 'true',
  enableAdvancedPersonalization: settings.enableAdvancedPersonalization === 'true',
  enableBehaviorTracking: settings.enableBehaviorTracking === 'true',
  mlDataRetentionDays: String(settings.mlDataRetentionDays) || '30',
  
  // Smart Bundle Settings
  bundlesOnProductPages: settings.bundlesOnProductPages === 'true',
  bundlesInCartDrawer: settings.bundlesInCartDrawer === 'true',
  bundlesOnCollectionPages: settings.bundlesOnCollectionPages === 'true',
  defaultBundleDiscount: String(settings.defaultBundleDiscount) || '10',
  };
  
  try {
    console.log('🔥 [ACTION v2.0] Attempting to save settings...');
    await saveSettings(shop, processedSettings);
    console.log('🔥 [ACTION v2.0] Settings saved successfully!');

    return json({ success: true, message: "Settings saved successfully!" }, {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("🔥 [ACTION v2.0] Error saving settings:", error);
    return json({ success: false, message: "Failed to save settings" }, {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});

// Currency formatting not needed in admin settings (handled by theme embed)

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const productsFetcher = useFetcher();

  // Default color constants - avoid green fallbacks
  const DEFAULT_SHIPPING_COLOR = '#121212'; // Dark neutral instead of blue
  const DEFAULT_BACKGROUND_COLOR = '#ecebe3';

  // Theme color detection function - defined first to avoid hoisting issues
  const detectThemeColors = () => {
    const themeColors = {
      primary: DEFAULT_SHIPPING_COLOR,
      background: DEFAULT_BACKGROUND_COLOR
    };

    try {
      // Try to detect Shopify theme colors from CSS variables or DOM
      if (typeof window !== 'undefined') {
        const computedStyle = getComputedStyle(document.documentElement);
        
        // Common Shopify theme CSS variable names
        const primaryColorVars = [
          '--color-primary',
          '--color-accent', 
          '--color-brand',
          '--color-button',
          '--color-theme',
          '--primary-color',
          '--accent-color'
        ];
        
        for (const varName of primaryColorVars) {
          const color = computedStyle.getPropertyValue(varName).trim();
          if (color && color !== '' && !color.includes('4CAF50') && color !== 'green') {
            themeColors.primary = color;
            break;
          }
        }
        
        // Look for button colors in the DOM as fallback
        const buttons = document.querySelectorAll('button, .btn, .button, [type="submit"]');
        for (const button of Array.from(buttons).slice(0, 5)) { // Check first 5 buttons
          const buttonStyle = getComputedStyle(button);
          const bgColor = buttonStyle.backgroundColor;
          
          // Skip if it's transparent, white, black, or green
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' && 
              !bgColor.includes('255, 255, 255') && !bgColor.includes('0, 0, 0') &&
              !bgColor.includes('76, 175, 80')) { // Avoid the green
            themeColors.primary = bgColor;
            break;
          }
        }
      }
    } catch (error) {
      console.log('Theme color detection failed, using defaults:', error);
    }
    
    return themeColors;
  };

  // Validate and set proper defaults for critical settings
  const validateSettings = (settings: any) => {
    const validated = { ...settings };
    const themeColors = detectThemeColors();
    
    // Ensure critical color settings have proper defaults, never green fallbacks
    if (!validated.shippingBarColor || validated.shippingBarColor === '#4CAF50') {
      validated.shippingBarColor = themeColors.primary;
    }
    if (!validated.recommendationsBackgroundColor) {
      validated.recommendationsBackgroundColor = themeColors.background;
    }
    
    return validated;
  };

  const [formSettings, setFormSettings] = useState(validateSettings(settings));

  const mlDataRetentionRaw = (formSettings as any).mlDataRetentionDays ?? settings.mlDataRetentionDays ?? "90";
  const parsedRetention = Number.parseInt(String(mlDataRetentionRaw), 10);
  const mlRetentionDays = Number.isFinite(parsedRetention) && parsedRetention > 0 ? Math.round(parsedRetention) : 90;

  const mlOrdersAnalyzedValue = Number((formSettings as any).mlTrainingOrderCount ?? 0);
  const mlOrdersAnalyzed = Number.isFinite(mlOrdersAnalyzedValue) && mlOrdersAnalyzedValue > 0
    ? Math.round(mlOrdersAnalyzedValue)
    : 0;

  const ordersBadgeText = mlOrdersAnalyzed > 0
    ? `~${mlOrdersAnalyzed} orders analyzed`
    : `Using last ${mlRetentionDays} days of orders`;

  const dataQualityTone = formSettings.enableBehaviorTracking
    ? "success"
    : formSettings.enableAdvancedPersonalization
    ? "info"
    : "attention";

  const dataQualityLabel = formSettings.enableBehaviorTracking
    ? "Behavior tracking enabled"
    : formSettings.enableAdvancedPersonalization
    ? "Advanced personalization ready"
    : "Order-only insights";

  // Theme colors handled by CSS variables and merchant color picker

  // Helper function to resolve CSS custom properties with fallbacks for preview
  const resolveColor = (colorValue: string | undefined | null, fallback = '#000000') => {
    // Handle null/undefined values
    if (!colorValue) {
      return fallback;
    }
    
    // If it's a CSS custom property, extract the fallback value
    if (colorValue.startsWith('var(')) {
      const fallbackMatch = colorValue.match(/var\([^,]+,\s*([^)]+)\)/);
      return fallbackMatch ? fallbackMatch[1].trim() : fallback;
    }
    return colorValue || fallback;
  };

  // Cart icon rendering handled by theme embed

  // Manual recommendation product selection state
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    settings.manualRecommendationProducts ? settings.manualRecommendationProducts.split(',').filter(Boolean) : []
  );
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  
  // Enhanced manual selection with variants
  // Variant selector not implemented in basic admin settings
  
  // Gift product selection state



  
  // Success banner auto-hide state
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // Initialize form settings with defaults if needed
  useEffect(() => {
    // Settings initialization handled by validateSettings function
    
    // Monitor network requests for debugging
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      console.log('🌐 [NETWORK] Fetch called:', args[0]);
      return originalFetch.apply(this, args)
        .then(response => {
          console.log('🌐 [NETWORK] Response received:', response.status, response.statusText, 'for', args[0]);
          return response;
        })
        .catch(error => {
          console.error('🌐 [NETWORK] Fetch error:', error, 'for', args[0]);
          throw error;
        });
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Auto-hide banners and handle all outcomes, including session expiry
  useEffect(() => {
    console.log('📊 [FETCHER STATE] State changed to:', fetcher.state, 'Data:', fetcher.data);
    
    // Track transitions to detect silent failures
    if (fetcher.state === 'submitting') {
      console.log('📊 [FETCHER STATE] Form is submitting...');
      submittingRef.current = true;
    }
    if (fetcher.state === 'idle' && submittingRef.current && !fetcher.data) {
      submittingRef.current = false;
      setShowSuccessBanner(false);
      setErrorMessage('We could not confirm if settings were saved. Please try again.');
      setShowErrorBanner(true);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_error) { /* noop */ }
      const timer = setTimeout(() => setShowErrorBanner(false), 6000);
      return () => clearTimeout(timer);
    }

    if (fetcher.state === 'idle' && fetcher.data) {
      const data: any = fetcher.data;
      // Session expiry path from auth wrapper
      if (data?.needsRefresh) {
        submittingRef.current = false;
        setShowSuccessBanner(false);
        setErrorMessage('Your session has expired. Please refresh the page and sign in again.');
        setShowErrorBanner(true);
        const timer = setTimeout(() => setShowErrorBanner(false), 6000);
        return () => clearTimeout(timer);
      }
      if (data?.success) {
        submittingRef.current = false;
        setShowErrorBanner(false);
        setErrorMessage(null);
        setShowSuccessBanner(true);
        // Make sure the user sees the banner
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_error) { /* noop */ }
        const timer = setTimeout(() => setShowSuccessBanner(false), 3000);
        return () => clearTimeout(timer);
      }
      if (data?.success === false) {
        submittingRef.current = false;
        setShowSuccessBanner(false);
        setErrorMessage(typeof data?.message === 'string' ? data.message : 'Failed to save settings');
        setShowErrorBanner(true);
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_error) { /* noop */ }
        const timer = setTimeout(() => setShowErrorBanner(false), 6000);
        return () => clearTimeout(timer);
      }
      // Generic fallback if data is present but has no success flag
      submittingRef.current = false;
      setShowSuccessBanner(false);
      setErrorMessage('Unable to confirm save status. Please refresh and try again.');
      setShowErrorBanner(true);
      const timer = setTimeout(() => setShowErrorBanner(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.state, fetcher.data]);



  const handleSubmit = () => {
    console.log('🚀 [FORM SUBMIT v2.0] Starting form submission...');
    console.log('🚀 [FORM SUBMIT v2.0] Current URL:', window.location.href);
    console.log('🚀 [FORM SUBMIT v2.0] Fetcher state:', fetcher.state);
    
    const formData = new FormData();
    Object.entries(formSettings).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    
    const firstEntry = Array.from(formData.entries())[0];
    console.log('🚀 [FORM SUBMIT v2.0] FormData entries count:', Array.from(formData.entries()).length);
    console.log('🚀 [FORM SUBMIT v2.0] First entry:', firstEntry);
    console.log('🚀 [FORM SUBMIT v2.0] Sample entries:', Array.from(formData.entries()).slice(0, 3));
    
    // For new embedded auth strategy, don't specify action - let Remix figure it out
    try {
      fetcher.submit(formData, { method: "post" });
      console.log('🚀 [FORM SUBMIT v2.0] Fetcher.submit called successfully');
    } catch (error) {
      console.error('🚀 [FORM SUBMIT v2.0] ERROR during submit:', error);
    }
  };

  const updateSetting = (key: string, value: any) => {
    console.log(`Updating ${key} to:`, value); // Debug log
    setFormSettings((prev: any) => ({ ...prev, [key]: value }));
  };





  const cartIconOptions = [
    { label: "Shopping Cart", value: "cart" },
    { label: "Shopping Bag", value: "bag" },
    { label: "Basket", value: "basket" },
  ];





  // Fetch products when selector opens or search changes (debounced)
  useEffect(() => {
    if (!showProductSelector) return;
    setProductsError(null);
    setProductsLoading(true);
    const timeout = setTimeout(() => {
      const qs = new URLSearchParams();
      if (productSearchQuery) qs.set('query', productSearchQuery);
      qs.set('limit', '25');
      productsFetcher.load(`/api/products?${qs.toString()}`);
    }, 250);
    return () => {
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProductSelector, productSearchQuery]);



  useEffect(() => {
    if (productsFetcher.state === 'loading') {
      if (showProductSelector) {
        setProductsLoading(true);
        setProductsError(null);
      }
    }
    if (productsFetcher.state === 'idle') {
      const data: any = productsFetcher.data;
      if (data?.error) {
        if (showProductSelector) {
          setProducts([]);
          setProductsError(typeof data.error === 'string' ? data.error : 'Failed to load products');
        }
      } else {
        if (showProductSelector) {
          setProducts(Array.isArray(data?.products) ? data.products : []);
        }
      }
      if (showProductSelector) setProductsLoading(false);
    }
  }, [productsFetcher.state, productsFetcher.data, showProductSelector]);



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
          /* Full Width Layout Styles */
          .cartuplift-settings-layout {
            width: 100%;
            max-width: 1400px;
            margin: 0 auto;
            position: relative;
            padding: 0 20px;
            min-height: 100vh;
          }
          
          .cartuplift-settings-column {
            width: 100%;
            max-width: none;
          }
          
          /* Enhanced card layouts for full width */
          @media (min-width: 1200px) {
            .cartuplift-settings-layout {
              padding: 0 40px;
            }
          }
          
          /* Improve form layout spacing for full width */
          .Polaris-FormLayout > .Polaris-FormLayout__Item {
            margin-bottom: 1rem;
          }
          
          /* Enhanced card styling for full width layout */
          .Polaris-Card {
            transition: box-shadow 0.2s ease;
          }
          
          .Polaris-Card:hover {
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
          }
          
          /* Better spacing for nested content */
          .Polaris-BlockStack--gap400 > * + * {
            margin-top: 1rem;
          }
          
          .cartuplift-success-banner {
            margin-bottom: 20px;
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
            gap: 0;
          }

          .cartuplift-item {
            display: flex;
            gap: 8px;
            padding: 12px;
            border-radius: 4px;
            background: ${formSettings.backgroundColor || '#ffffff'};
            min-height: 120px;
            align-items: center;
            margin-bottom: 8px;
          }

          .cartuplift-item-first {
            border-bottom: none;
            margin-bottom: 8px;
            padding-bottom: 0;
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
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 4px 0;
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
            background: ${formSettings.backgroundColor || '#ffffff'};
            height: 36px;
            width: 100px;
            overflow: hidden;
            justify-content: space-around;
            flex-shrink: 0;
            box-sizing: border-box;
            margin-bottom: 8px;
          }

          .cartuplift-qty-minus,
          .cartuplift-qty-plus {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0;
            font-size: 12px;
            font-weight: 600;
            color: #333;
            height: 36px !important;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s ease;
            width: 13px !important;
            max-width: 13px !important;
            min-width: 13px !important;
            flex-shrink: 0;
            box-sizing: border-box;
          }

          .cartuplift-qty-minus:hover,
          .cartuplift-qty-plus:hover {
            background: #f5f5f5;
          }

          .cartuplift-qty-display {
            padding: 0;
            font-size: 11px;
            font-weight: 600;
            color: #000;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 36px !important;
            width: 26px !important;
            max-width: 26px !important;
            min-width: 26px !important;
            max-height: 36px !important;
            min-height: 36px !important;
            flex-shrink: 0;
            box-sizing: border-box;
          }

          .cartuplift-item-price-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
            flex-shrink: 0;
            padding: 2px 0;
          }

          .cartuplift-item-price {
            font-size: 10px;
            font-weight: 600;
            color: #333;
          }

          .cartuplift-item-remove {
            width: 24px;
            height: 24px;
            border: none;
            background: #f5f5f5;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #666;
            align-self: flex-end;
          }

          .cartuplift-recommendations {
            padding-top: 0; /* remove gap above section */
            background: ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
          }
          .cartuplift-selected-products { margin-top: 8px; }
          .cartuplift-selected-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }

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
            background: ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
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



          /* Gift Product Selector Styles */
          .cartuplift-selected-gift-product {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #f9fafb;
          }

          .cartuplift-product-info {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .cartuplift-product-image {
            flex-shrink: 0;
          }

          .cartuplift-gift-product-image {
            width: 50px;
            height: 50px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid #e0e0e0;
          }

          /* Text Row Layout - Enhanced for full width */
          .cartuplift-text-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          
          @media (min-width: 1200px) {
            .cartuplift-text-row {
              gap: 24px;
            }
          }
          
          @media (max-width: 768px) {
            .cartuplift-text-row {
              grid-template-columns: 1fr;
              gap: 16px;
            }
          }

          /* Sticky cart settings are handled by the theme embed (app-embed.liquid) */

          .cartuplift-footer {
            padding: 12px 16px;
            background: ${formSettings.backgroundColor || '#ffffff'};
            border-top: 1px solid #e1e3e5;
            flex-shrink: 0;
          }

          .cartuplift-subtotal {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            font-size: 14px;
            font-weight: 500;
            color: ${formSettings.textColor || '#333'};
          }

          .cartuplift-checkout-btn {
            width: 100%;
            padding: 14px 16px;
            background: ${resolveColor(formSettings.buttonColor, '#333')};
            color: ${resolveColor(formSettings.buttonTextColor, 'white')};
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: background 0.2s ease;
            margin-bottom: 12px;
          }

          .cartuplift-checkout-btn:hover {
            opacity: 0.9;
          }

          .cartuplift-express-checkout {
            display: flex;
            gap: 8px;
            margin-top: 8px;
          }

          .cartuplift-paypal-btn,
          .cartuplift-shoppay-btn {
            flex: 1;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: background 0.2s ease;
          }

          .cartuplift-paypal-btn:hover,
          .cartuplift-shoppay-btn:hover {
            background: #f5f5f5;
          }

          .cartuplift-paypal-logo {
            height: 16px;
          }
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
            background: ${resolveColor(formSettings.shippingBarColor, '#121212')};
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
            padding: 8px 0;
            border-bottom: none;
            position: relative;
            min-height: 112px;
            padding-bottom: 12px;
          }

          .cartuplift-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

            padding: 8px 0 4px 0;
            border-top: 1px solid #e5e5e5;
            width: 100%;
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
          /* Ensure parent container exists at 100% width for full-bleed action button */
          .cartuplift-action-container { width: 100%; }
          }

          .cartuplift-item-variant {
            font-size: 12px;
            color: #666;
            line-height: 1.2;
            margin: 0;
          }

            padding: 8px 0; /* remove side padding so the action button can span edge-to-edge */
            margin-top: 0; /* sit flush under previous section */
            width: 100%;
            margin-left: -16px; /* fullwidth inside padded container */
            margin-right: -16px;
            background: ${formSettings.backgroundColor || '#ffffff'};
            height: 36px;
            width: 100px;
            overflow: hidden;
            justify-content: space-around;
            margin-bottom: 8px;
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
          .cartuplift-action-button {
            display: block;
            width: 100% !important;
            box-sizing: border-box;
            margin: 0;
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
            background: ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
            padding: 2px 0;
            margin-top: 0;
            flex-shrink: 0;
            /* Keep within padded container */
            margin-left: 0;
            margin-right: 0;
          }

          .cartuplift-recommendations-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 16px 0 16px;
            min-height: 26px;
          }

          .cartuplift-recommendations-title {
            margin: 0;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.05em;
            color: #1a1a1a;
          }

          .cartuplift-recommendations-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border: 1px solid #111;
            border-radius: 50%;
            background: transparent;
            cursor: pointer;
          }

          .cartuplift-recommendations-content {
            padding: 6px 16px 10px;
            max-height: 128px; /* show ~2 items + hint of next */
            overflow-y: auto;
          }

          /* Disable vertical scrolling inside horizontal recommendations */
          .cartuplift-recommendations.is-horizontal {
            margin-top: 0 !important;
            margin-left: 0;
            margin-right: 0;
            padding: 0; /* remove any vertical padding */
          }
          .cartuplift-recommendations.is-horizontal .cartuplift-recommendations-content {
            max-height: none;
            overflow-y: visible;
            padding: 0;
          }

          .cartuplift-recommendation-item {
            display: grid;
            grid-template-columns: 48px 1fr 24px;
            gap: 10px;
            padding: 8px;
            border: 1px solid #f0f0f0;
            border-radius: 8px;
            margin-bottom: 8px;
            align-items: center;
            background: white;
          }

          .cartuplift-recommendation-item img {
            width: 48px;
            height: 48px;
            object-fit: cover;
            border-radius: 6px;
          }

          .cartuplift-recommendation-info h4 {
            font-size: 13px;
            font-weight: 500;
            color: #000;
            margin: 0 0 4px 0;
          }

          .cartuplift-recommendation-price {
            font-size: 13px;
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
            padding: 8px 16px;
            margin-top: 0; /* sit flush under previous section */
            width: 100%;
            margin-left: 0; /* stay within padded container */
            margin-right: 0;
            background: ${formSettings.backgroundColor || '#ffffff'};
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
            /* Keep within container; do not overflow horizontally */
            margin-top: 0;
            margin-left: 0;
            margin-right: 0;
            border-radius: 0;
          }
          .cartuplift-selected-products { margin-top: 8px; }
          .cartuplift-selected-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
          .cartuplift-product-selector-list { max-height: 360px; overflow: auto; display: grid; gap: 8px; }
          .cartuplift-product-row { display: grid; grid-template-columns: auto 40px 1fr; align-items: center; gap: 10px; padding: 8px; border: 1px solid #ececef; border-radius: 6px; background: #fff; }
          .cartuplift-product-thumb { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; background: #f4f5f6; }
          .cartuplift-product-meta { display: flex; flex-direction: column; gap: 2px; }
          .cartuplift-product-title { font-size: 12px; font-weight: 600; color: #1a1a1a; margin: 0; }
          .cartuplift-product-sub { font-size: 11px; color: #737373; margin: 0; }
          
          .cartuplift-recommendations-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
            border-radius: 0;
          }
          
          .cartuplift-recommendations-title {
            font-size: 12px;
            font-weight: 600;
            margin: 0;
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
            gap: 8px;
            overflow-x: hidden; /* disable manual swipe */
            padding: 8px 0;
            scroll-behavior: smooth;
            touch-action: none; /* disallow vertical and horizontal panning */
            overscroll-behavior: contain; /* prevent scroll chaining/bounce */
          }

          .cartuplift-recommendations-row,
          .cartuplift-horizontal-card {
            overscroll-behavior: contain;
            touch-action: none; /* keep this section from moving on drag */
          }
          
          .cartuplift-recommendations-track::-webkit-scrollbar {
            display: none;
          }
          
          .cartuplift-recommendation-card {
            flex: 0 0 232px;
            background: white;
            border-radius: 8px;
            padding: 10px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
            border: 1px solid #e0e0e0;
            display: flex;
            align-items: center;
          }
          
          .cartuplift-card-content {
            display: flex;
            gap: 8px;
            align-items: center;
            height: 64px;
          }
          
          .cartuplift-product-image {
            width: 64px;
            height: 64px;
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
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 64px;
          }
          
          .cartuplift-product-info h4 {
            font-size: 12px;
            font-weight: 500;
            margin: 0 0 4px 0;
            line-height: 1.2;
            color: #000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .cartuplift-product-variation {
            margin-top: auto;
          }
          
          .cartuplift-size-dropdown {
            padding: 3px 12px 3px 6px;
            border: 1px solid #ddd;
            border-radius: 10px;
            background: white;
            font-size: 9px;
            font-weight: 500;
            appearance: none;
            cursor: pointer;
            max-width: 70px;
          }
          
          .cartuplift-product-actions {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: space-between;
            height: 64px;
            flex-shrink: 0;
            min-width: 60px;
          }
          
          .cartuplift-recommendation-price {
            font-size: 11px;
            font-weight: 600;
            color: #000;
            margin-bottom: 4px;
            line-height: 1;
          }

          /* Horizontal wrapper card to include title and controls */
          .cartuplift-horizontal-card {
            background: ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
            border: 1px solid ${formSettings.recommendationsBackgroundColor || '#ecebe3'};
            /* Make this section truly full width inside a 16px padded container */
            margin-left: -16px;
            margin-right: -16px;
            border-radius: 0;
            padding: 0 16px 10px; /* add left/right padding, no top padding */
          }
          .cartuplift-horizontal-card .cartuplift-recommendations-header {
            padding: 6px 0 6px 0; /* nudge header down slightly inside the card */
            background: transparent;
            border-radius: 0;
          }
          
          .cartuplift-add-recommendation {
            padding: 6px 10px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            border: 1px solid ${resolveColor(formSettings.buttonColor, '#000000')};
            border-radius: 10px;
            font-size: 9px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            text-transform: none;
            letter-spacing: 0.3px;
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
            text-transform: none;
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
            padding: 8px 0 100px;
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
            height: 36px;
            width: 100px;
            overflow: hidden;
            justify-content: space-around;
            margin-bottom: 8px;
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
            /* In-container band; full-bleed handled by button itself */
            padding: 8px 16px;
            background: ${formSettings.backgroundColor || '#ffffff'};
            width: 100%;
            margin-top: 0;
            margin-left: 0;
            margin-right: 0;
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

          /* Container spacing: keep 16px side padding so full-bleed bands can offset with -16px */
          .cartuplift-content-wrapper {
            padding: 0 16px !important;
            gap: 0 !important;
          }

          /* Ensure these sections span the full drawer width inside 16px padded container */
          .cartuplift-horizontal-card {
            margin-left: -16px !important;
            margin-right: -16px !important;
            border-radius: 0 !important;
          }

          /* Keep recommendations in-view with normal horizontal padding */
          .cartuplift-recommendations {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }

          /* Ensure discount band has zero horizontal padding so the card can reach edges */
          .cartuplift-discount-section { padding-left: 0 !important; padding-right: 0 !important; }

          /* Make the action button truly edge-to-edge */
          .cartuplift-action-button {
            border-radius: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }

          /* Full-bleed discount card button using selected button color */
          .cartuplift-rainbow-card-button {
            display: block;
            width: 100% !important;
            box-sizing: border-box;
            margin: 0;
            padding: 12px 16px;
            background: ${resolveColor(formSettings.buttonColor, '#000000')};
            border: none;
            border-radius: 0;
            color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')};
            font-size: 12px;
            font-weight: 700;
            text-align: center;
            cursor: pointer;
          }

          /* Debug: full-width bar to visualize edge-to-edge span */
          .cartuplift-debug-bar {
            height: 6px;
            background: repeating-linear-gradient(90deg,
              #ff2d55 0 16px,
              #ffd60a 16px 32px,
              #34c759 32px 48px,
              #007aff 48px 64px,
              #5856d6 64px 80px
            );
            margin: 0;
            margin-left: -16px !important;
            margin-right: -16px !important;
          }

          /* Keep discount band within container; extend the button to full-bleed like debug bar */
          .cartuplift-discount-section {
            margin: 0 !important;
            padding: 0 !important;
          }

          .cartuplift-discount-section .cartuplift-rainbow-card-button {
            width: calc(100% + 32px) !important;
            margin-left: -16px !important;
            margin-right: -16px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          /* Gift Progress Bars Styles */
          .cartuplift-gift-progress-container {
            padding: 0 16px 8px;
            background: #ffffff;
            flex-shrink: 0;
          }

          .cartuplift-stacked-progress {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .cartuplift-gift-threshold {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .cartuplift-gift-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
          }

          .cartuplift-gift-title {
            color: #333;
            font-weight: 500;
          }

          .cartuplift-gift-progress-text {
            color: #666;
            font-size: 11px;
          }

          .cartuplift-gift-bar {
            width: 100%;
            height: 4px;
            background: #f0f0f0;
            border-radius: 2px;
            overflow: hidden;
          }

          .cartuplift-gift-fill {
            height: 100%;
            border-radius: 2px;
            transition: width 0.5s ease;
            min-width: 1px;
          }

          .cartuplift-single-multi-progress {
            position: relative;
            padding: 8px 0;
          }

          .cartuplift-milestone-bar {
            width: 100%;
            height: 6px;
            background: #f0f0f0;
            border-radius: 3px;
            position: relative;
            overflow: visible;
          }

          .cartuplift-milestone-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.5s ease;
            min-width: 2px;
          }

          .cartuplift-milestone-marker {
            position: absolute;
            top: -8px;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 2;
          }

          .cartuplift-milestone-dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #f0f0f0;
            border: 2px solid #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            margin-bottom: 4px;
          }

          .cartuplift-milestone-dot.unlocked {
            background: #4CAF50;
            border-color: #4CAF50;
            color: white;
          }

          .cartuplift-milestone-label {
            font-size: 10px;
            color: #666;
            white-space: nowrap;
            text-align: center;
            max-width: 80px;
            line-height: 1.2;
          }

          .cartuplift-next-goal-progress {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .cartuplift-unlocked-gifts {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .cartuplift-unlocked-item {
            font-size: 11px;
            color: #4CAF50;
            font-weight: 500;
            padding: 2px 0;
          }

          .cartuplift-next-goal {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .cartuplift-next-info {
            font-size: 12px;
            color: #333;
            font-weight: 500;
          }

          .cartuplift-next-bar {
            width: 100%;
            height: 6px;
            background: #f0f0f0;
            border-radius: 3px;
            overflow: hidden;
          }

          .cartuplift-next-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.5s ease;
            min-width: 2px;
          }

          .cartuplift-progress-text {
            font-size: 10px;
            color: #666;
            text-align: right;
          }

          /* New Gift Progress Preview Styles */
          .cartuplift-stacked-bar {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 12px;
            border: 1px solid #f0f0f0;
            border-radius: 8px;
            background: #fff;
          }

          .cartuplift-threshold-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
          }

          .cartuplift-threshold-title {
            font-size: 12px;
            font-weight: 500;
            color: #333;
          }

          .cartuplift-threshold-amount {
            font-size: 12px;
            font-weight: 600;
            color: #666;
          }

          .cartuplift-threshold-description {
            font-size: 11px;
            color: #666;
            margin-top: 4px;
          }

          .cartuplift-progress-bar {
            width: 100%;
            height: 6px;
            background: #f0f0f0;
            border-radius: 3px;
            overflow: hidden;
          }

          .cartuplift-progress-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 0.5s ease;
            min-width: 2px;
          }

          .cartuplift-progress-fill.achieved {
            background: #4CAF50 !important;
          }

          .cartuplift-single-multi-progress {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .cartuplift-milestones-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: 500;
            color: #333;
          }

          .cartuplift-progress-bar-container {
            position: relative;
            margin: 8px 0;
          }

          .cartuplift-multi-milestone {
            position: relative;
          }

          .cartuplift-milestone-marker {
            position: absolute;
            top: -2px;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 2;
          }

          .cartuplift-milestone-marker.achieved .cartuplift-milestone-dot {
            background: #4CAF50;
            border-color: #4CAF50;
          }

          .cartuplift-milestone-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #f0f0f0;
            border: 2px solid #ddd;
            margin-bottom: 4px;
          }

          .cartuplift-milestone-label {
            display: flex;
            flex-direction: column;
            align-items: center;
            font-size: 9px;
            color: #666;
            white-space: nowrap;
            text-align: center;
            position: absolute;
            top: 14px;
          }

          .cartuplift-milestone-icon {
            margin-bottom: 2px;
          }

          .cartuplift-milestones-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .cartuplift-milestone-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 8px;
            background: #f8f9fa;
            border-radius: 6px;
            font-size: 11px;
          }

          .cartuplift-milestone-item.achieved {
            background: #e8f5e8;
            color: #2e7d32;
          }

          .cartuplift-milestone-status {
            font-weight: 500;
          }

          .cartuplift-milestone-reward {
            color: #666;
          }

          .cartuplift-milestone-item.achieved .cartuplift-milestone-reward {
            color: #2e7d32;
          }

          .cartuplift-single-next-progress {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .cartuplift-next-goal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: 500;
            color: #333;
          }

          .cartuplift-goal-description {
            font-size: 11px;
            color: #666;
            margin-top: 4px;
          }

          .cartuplift-achieved-rewards {
            padding: 6px 8px;
            background: #e8f5e8;
            border-radius: 6px;
            font-size: 10px;
            color: #2e7d32;
            margin-top: 4px;
          }

          .cartuplift-combined-progress-container {
            padding: 0 16px 8px;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .cartuplift-shipping-section,
          .cartuplift-gifts-section {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .cartuplift-section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            font-weight: 500;
            color: #333;
          }

          .cartuplift-section-description {
            font-size: 11px;
            color: #666;
          }

          .cartuplift-achieved-section {
            padding: 4px 8px;
            background: #e8f5e8;
            border-radius: 4px;
            font-size: 10px;
            color: #2e7d32;
            margin-top: 4px;
          }

          @media (max-width: 768px) {
            .cartuplift-gift-progress-container {
              padding: 0 12px 6px;
            }
            .cartuplift-stacked-progress {
              gap: 8px;
            }
            .cartuplift-gift-info {
              font-size: 11px;
            }
            .cartuplift-gift-title {
              font-size: 11px;
            }
            .cartuplift-milestone-marker {
              top: -6px;
            }
            .cartuplift-milestone-dot {
              width: 16px;
              height: 16px;
              font-size: 8px;
            }
            .cartuplift-milestone-label {
              font-size: 9px;
              max-width: 60px;
            }
            .cartuplift-next-info {
              font-size: 11px;
            }
          }
        `
      }} />

      <div className="cartuplift-settings-layout">
        {(showSuccessBanner || showErrorBanner) && (
          <div className="cartuplift-success-banner">
            {showSuccessBanner && (
              <Banner tone="success">Settings saved successfully!</Banner>
            )}
            {showErrorBanner && (
              <Banner tone="critical">{errorMessage || 'Failed to save settings'}</Banner>
            )}
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
                    label="Enable Analytics Tracking"
                    checked={formSettings.enableAnalytics}
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
                    checked={formSettings.enableAddons}
                    onChange={(value) => updateSetting("enableAddons", value)}
                    helpText="Display product add-ons and upsell opportunities"
                  />

                  <Checkbox
                    label="Enable Express Checkout Buttons"
                    checked={formSettings.enableExpressCheckout}
                    onChange={(value) => updateSetting("enableExpressCheckout", value)}
                    helpText="Show PayPal, Shop Pay, and other express checkout options"
                  />

                  <Checkbox
                    label="Enable Analytics Tracking"
                    checked={formSettings.enableAnalytics}
                    onChange={(value) => updateSetting("enableAnalytics", value)}
                    helpText="Track cart performance and conversion metrics"
                  />


                </FormLayout>
              </BlockStack>
            </Card>

            {/* AI-Powered Recommendations - PROMINENT PLACEMENT */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">� AI-Powered Recommendations</Text>
                <Text as="p" variant="bodyMd">Configure machine learning and intelligent product recommendations to boost conversions.</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable ML Recommendations"
                    checked={(formSettings as any).enableMLRecommendations}
                    onChange={(value) => updateSetting("enableMLRecommendations", value)}
                    helpText="Use machine learning to personalize product recommendations"
                  />

                  {(formSettings as any).enableMLRecommendations && (
                    <BlockStack gap="400">
                      <Select
                        label="ML Personalization Mode"
                        options={[
                          { label: 'Basic', value: 'basic' },
                          { label: 'Advanced', value: 'advanced' },
                          { label: 'Custom', value: 'custom' }
                        ]}
                        value={(formSettings as any).mlPersonalizationMode || "basic"}
                        onChange={(value) => updateSetting("mlPersonalizationMode", value)}
                        helpText="Choose the level of personalization for recommendations"
                      />

                      <Select
                        label="Privacy Level"
                        options={[
                          { label: 'Basic (Anonymous)', value: 'basic' },
                          { label: 'Standard (Session-based)', value: 'standard' },
                          { label: 'Advanced (User tracking)', value: 'advanced' }
                        ]}
                        value={(formSettings as any).mlPrivacyLevel || "basic"}
                        onChange={(value) => updateSetting("mlPrivacyLevel", value)}
                        helpText="Balance between personalization and privacy"
                      />

                      <Checkbox
                        label="Advanced Personalization"
                        checked={(formSettings as any).enableAdvancedPersonalization}
                        onChange={(value) => updateSetting("enableAdvancedPersonalization", value)}
                        helpText="Enable cross-session learning and behavioral analysis"
                      />

                      <Checkbox
                        label="Behavior Tracking"
                        checked={(formSettings as any).enableBehaviorTracking}
                        onChange={(value) => updateSetting("enableBehaviorTracking", value)}
                        helpText="Track user behavior for improved recommendations (requires privacy disclosure)"
                      />

                      <TextField
                        label="Data Retention (Days)"
                        value={(formSettings as any).mlDataRetentionDays || "90"}
                        onChange={(value) => updateSetting("mlDataRetentionDays", value)}
                        helpText="How long to keep ML training data (affects recommendation accuracy)"
                        type="number"
                        autoComplete="off"
                      />

                      {/* 📊 REAL DATA TRANSPARENCY */}
                      <Card background="bg-surface-secondary">
                        <BlockStack gap="200">
                          <Text variant="headingSm" as="h3">📊 Your ML Data Status</Text>
                          <Text as="p" variant="bodyMd" tone="subdued">
                            <strong>More data = Better recommendations.</strong> Here's what we're using:
                          </Text>
                          
                          <InlineStack gap="300">
                            <Badge tone="info">{ordersBadgeText}</Badge>
                            <Badge tone={dataQualityTone}>
                              {dataQualityLabel}
                            </Badge>
                          </InlineStack>
                          
                          <Text as="p" variant="bodyMd" tone="subdued">
                            • <strong>Basic Mode:</strong> Uses order patterns (anonymous)<br/>
                            • <strong>Advanced Mode:</strong> Adds customer behavior tracking<br/>  
                            • <strong>Privacy:</strong> All data stays in your Shopify store<br/>
                            • <strong>Performance:</strong> Recommendations improve over time
                          </Text>

                          {(formSettings as any).enableBehaviorTracking && (
                            <Banner title="Customer Privacy Notice" tone="warning">
                              <Text as="p">With behavior tracking enabled, inform customers about data collection in your privacy policy. We recommend: "We analyze shopping patterns to improve product recommendations."</Text>
                            </Banner>
                          )}
                        </BlockStack>
                      </Card>

                      <Divider />

                      <Text variant="headingSm" as="h3">📦 Advanced Recommendation Controls</Text>
                      
                      <TextField
                        label="Maximum Products to Show"
                        value={String(formSettings.maxRecommendationProducts || 3)}
                        onChange={(value) => updateSetting("maxRecommendationProducts", parseInt(value) || 3)}
                        helpText="Number of recommendation products to display (1-12)"
                        type="number"
                        min="1"
                        max="12"
                        autoComplete="off"
                      />

                      <Checkbox
                        label="Hide Recommendations After All Thresholds Met"
                        checked={formSettings.hideRecommendationsAfterThreshold}
                        onChange={(value) => updateSetting("hideRecommendationsAfterThreshold", value)}
                        helpText="Collapse recommendation section when customer reaches all available gift/shipping thresholds"
                      />

                      <Checkbox
                        label="Enable Threshold-Based Product Suggestions"
                        checked={formSettings.enableThresholdBasedSuggestions}
                        onChange={(value) => updateSetting("enableThresholdBasedSuggestions", value)}
                        helpText="Smart product suggestions to help customers reach thresholds (e.g., suggest $20+ items when customer has $80 and threshold is $100)"
                      />

                      {formSettings.enableThresholdBasedSuggestions && (
                        <Select
                          label="Threshold Suggestion Strategy"
                          options={[
                            { label: '🤖 Smart AI Selection', value: 'smart' },
                            { label: '💰 Price-Based Only', value: 'price' },
                            { label: '🎯 Category Match + Price', value: 'category_price' },
                            { label: '🔥 Popular + Price', value: 'popular_price' }
                          ]}
                          value={formSettings.thresholdSuggestionMode}
                          onChange={(value) => updateSetting("thresholdSuggestionMode", value)}
                          helpText="How to select products that help customers reach thresholds"
                        />
                      )}

                      <Checkbox
                        label="Enable Manual Product Selection"
                        checked={formSettings.enableManualRecommendations}
                        onChange={(value) => updateSetting("enableManualRecommendations", value)}
                        helpText="Allow manual selection of products to include in recommendations"
                      />

                      {formSettings.enableManualRecommendations && (
                        <div className="cartuplift-manual-rec-section">
                          <Text variant="headingSm" as="h3">🛠️ Manual Product Selection</Text>
                          <div className="cartuplift-manual-rec-info">
                            <Text variant="bodyMd" as="p" tone="subdued">
                              Select specific products to always include in recommendations
                            </Text>
                            <InlineStack gap="200" align="start">
                              <Button onClick={() => setShowProductSelector(true)}>Select Products</Button>
                              {selectedProducts.length > 0 && (
                                <Badge tone="success">{`${selectedProducts.length} selected`}</Badge>
                              )}
                            </InlineStack>
                          </div>
                        </div>
                      )}
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
                    checked={(formSettings as any).enableSmartBundles}
                    onChange={(value) => updateSetting("enableSmartBundles", value)}
                    helpText="Enable AI-powered product bundling on your store"
                  />

                  {(formSettings as any).enableSmartBundles && (
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">Bundle Placement & Display</Text>
                      
                      <Checkbox
                        label="Show bundles on product pages"
                        checked={(formSettings as any).bundlesOnProductPages}
                        onChange={(value) => updateSetting("bundlesOnProductPages", value)}
                        helpText="Display smart bundles on individual product pages"
                      />
                      
                      <Checkbox
                        label="Show bundles in cart drawer"
                        checked={(formSettings as any).bundlesInCartDrawer}
                        onChange={(value) => updateSetting("bundlesInCartDrawer", value)}
                        helpText="Show bundle suggestions inside the cart drawer"
                      />

                      <Checkbox
                        label="Show bundles on collection pages"
                        checked={(formSettings as any).bundlesOnCollectionPages}
                        onChange={(value) => updateSetting("bundlesOnCollectionPages", value)}
                        helpText="Display relevant bundles on category/collection pages"
                      />

                      <TextField
                        label="Default Bundle Discount (%)"
                        value={String((formSettings as any).defaultBundleDiscount || 10)}
                        onChange={(value) => updateSetting("defaultBundleDiscount", value)}
                        helpText="Default discount percentage for smart bundles"
                        type="number"
                        min="0"
                        max="50"
                        autoComplete="off"
                      />
                    </BlockStack>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Cart Icon Selection (colors handled by theme embed) */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🎨 Cart Icon Style</Text>
                <Text as="p" variant="bodyMd">Choose your cart icon style. Colors and styling are configured in the theme editor.</Text>
                <FormLayout>
                  <Select
                    label="Cart Icon Style"
                    options={cartIconOptions}
                    value={formSettings.cartIcon}
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
                  <Text variant="headingSm" as="h3">🛍️ Advanced Text Customization</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">Basic cart text (recommendations title, discount/notes links) is configured in theme editor.</Text>

                  <Divider />

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

                    <TextField
                      label="Apply Button"
                      value={formSettings.applyButtonText || "Apply"}
                      onChange={(value) => updateSetting("applyButtonText", value)}
                      helpText="Apply discount code button"
                      autoComplete="off"
                    />

                    <TextField
                      label="Action Text"
                      value={formSettings.actionText || "Add discount code"}
                      onChange={(value) => updateSetting("actionText", value)}
                      helpText="General action text placeholder"
                      autoComplete="off"
                    />
                  </InlineStack>
                </FormLayout>
              </BlockStack>
            </Card>






          </BlockStack>
        </div>
      </div>

      {/* Product Selector Modal for Manual Recommendations */}
      {showProductSelector && (
        <Modal
          open
          onClose={() => setShowProductSelector(false)}
          title="Select Products for Manual Recommendations"
          primaryAction={{
            content: 'Done',
            onAction: () => {
              setShowProductSelector(false);
            }
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setShowProductSelector(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <TextField
                label="Search products"
                value={productSearchQuery}
                onChange={(v: string) => setProductSearchQuery(v)}
                autoComplete="off"
                placeholder="Search by title, vendor, or tag"
              />
              {productsLoading ? (
                <InlineStack align="center">
                  <Spinner accessibilityLabel="Loading products" />
                </InlineStack>
              ) : (
                <div className="cartuplift-product-selector-list">
                  {productsError && (
                    <Banner tone="critical">{productsError}</Banner>
                  )}
                  {products.length === 0 && (
                    <Text as="p" tone="subdued">No products found.</Text>
                  )}
                  {products.map((p: any) => {
                    const isSelected = selectedProducts.includes(p.id);
                    return (
                      <div key={p.id} className="cartuplift-product-row">
                        <Checkbox
                          label=""
                          checked={isSelected}
                          onChange={(val: boolean) => {
                            if (val) {
                              const updated = [...selectedProducts, p.id];
                              setSelectedProducts(updated);
                              updateSetting('manualRecommendationProducts', updated.join(','));
                            } else {
                              const updated = selectedProducts.filter(id => id !== p.id);
                              setSelectedProducts(updated);
                              updateSetting('manualRecommendationProducts', updated.join(','));
                            }
                          }}
                        />
                        <img className="cartuplift-product-thumb" src={p.image || ''} alt={p.imageAlt || p.title} />
                        <div className="cartuplift-product-meta">
                          <p className="cartuplift-product-title">{p.title}</p>
                          <p className="cartuplift-product-sub">{p.handle}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

    </Page>
  );
}