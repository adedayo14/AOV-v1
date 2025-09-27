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
  Modal,
  Spinner,
  InlineStack,
  Badge,
  RadioButton,
} from "@shopify/polaris";
import { withAuth, withAuthAction } from "../utils/auth.server";
import { getSettings, saveSettings } from "../models/settings.server";

const { useState, useEffect, useRef } = React;

export const loader = withAuth(async ({ auth }) => {
  const shop = auth.session.shop;
  const settings = await getSettings(shop);
  
  // DEBUG: Log the actual settings to see what's being returned
  console.log('🔍 SETTINGS DEBUG - Loader returning:', {
    recommendationLayout: settings.recommendationLayout,
    enableRecommendations: settings.enableRecommendations,
    shop: shop
  });
  
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
    // New sticky cart settings
    stickyCartShowIcon: settings.stickyCartShowIcon !== 'false',
    stickyCartShowCount: settings.stickyCartShowCount !== 'false',
    stickyCartShowTotal: settings.stickyCartShowTotal !== 'false',
    stickyCartBackgroundColor: String(settings.stickyCartBackgroundColor) || "#000000",
    stickyCartTextColor: String(settings.stickyCartTextColor) || "#ffffff",
    stickyCartCountBadgeColor: String(settings.stickyCartCountBadgeColor) || "#ff4444",
    stickyCartCountBadgeTextColor: String(settings.stickyCartCountBadgeTextColor) || "#ffffff",
    stickyCartBorderRadius: Number(settings.stickyCartBorderRadius) || 25,
    freeShippingText: String(settings.freeShippingText) || "You're {{ amount }} away from free shipping!",
    freeShippingAchievedText: String(settings.freeShippingAchievedText) || "🎉 Congratulations! You've unlocked free shipping!",
    recommendationsTitle: String(settings.recommendationsTitle) || "You might also like",
    actionText: String(settings.actionText) || "Add discount code",
    addButtonText: String(settings.addButtonText) || "Add",
    checkoutButtonText: String(settings.checkoutButtonText) || "CHECKOUT",
    applyButtonText: String(settings.applyButtonText) || "Apply",
  discountLinkText: String(settings.discountLinkText || '+ Got a promotion code?'),
  notesLinkText: String(settings.notesLinkText || '+ Add order notes'),
    backgroundColor: String(settings.backgroundColor) || "#ffffff",
    textColor: String(settings.textColor) || "#1A1A1A",
    buttonColor: String(settings.buttonColor) || "#000000",
    buttonTextColor: String(settings.buttonTextColor) || "#ffffff",
    recommendationsBackgroundColor: String(settings.recommendationsBackgroundColor) || "#ecebe3",
    shippingBarBackgroundColor: String(settings.shippingBarBackgroundColor) || "#f0f0f0",
    shippingBarColor: String(settings.shippingBarColor) || "#121212", // Dark neutral default
    recommendationLayout: String(settings.recommendationLayout) || "carousel",
    complementDetectionMode: String(settings.complementDetectionMode) || "automatic",
    manualRecommendationProducts: String(settings.manualRecommendationProducts) || "",
    // Progress Bar System
    progressBarMode: String(settings.progressBarMode) || "free-shipping",
    enableGiftGating: settings.enableGiftGating === 'true',
    giftProgressStyle: String(settings.giftProgressStyle) || "single-next",
    giftThresholds: String(settings.giftThresholds) || "[]",
    giftNoticeText: String(settings.giftNoticeText) || "Free gift added: {{product}} (worth {{amount}})",
    giftPriceText: String(settings.giftPriceText) || "FREE",
    // ML/Privacy Settings
    mlPersonalizationMode: String(settings.mlPersonalizationMode) || "basic",
    enableMLRecommendations: settings.enableMLRecommendations === 'true',
    mlPrivacyLevel: String(settings.mlPrivacyLevel) || "basic",
    enableAdvancedPersonalization: settings.enableAdvancedPersonalization === 'true',
    enableBehaviorTracking: settings.enableBehaviorTracking === 'true',
    mlDataRetentionDays: String(settings.mlDataRetentionDays) || "30",
    enableSmartBundles: settings.enableSmartBundles === 'true',
    // Smart Bundle Settings
    bundlesOnProductPages: settings.bundlesOnProductPages !== 'false',
    bundlesOnCollectionPages: settings.bundlesOnCollectionPages === 'true',
    bundlesOnCartPage: settings.bundlesOnCartPage === 'true',
    bundlesOnCheckoutPage: settings.bundlesOnCheckoutPage === 'true',
    defaultBundleDiscount: String(settings.defaultBundleDiscount) || "15",
    bundleTitleTemplate: String(settings.bundleTitleTemplate) || "Complete your setup",
    bundleDiscountPrefix: String(settings.bundleDiscountPrefix) || "BUNDLE",
    bundleConfidenceThreshold: String(settings.bundleConfidenceThreshold) || "0.7",
    bundleSavingsFormat: String(settings.bundleSavingsFormat) || "both",
    showIndividualPricesInBundle: settings.showIndividualPricesInBundle !== 'false',
    autoApplyBundleDiscounts: settings.autoApplyBundleDiscounts !== 'false',
    // Enhanced Bundle Display Badge Text Settings
    badgeHighValueText: String(settings.badgeHighValueText) || "HIGH VALUE",
    badgePopularText: String(settings.badgePopularText) || "POPULAR",
    badgeTrendingText: String(settings.badgeTrendingText) || "TRENDING",
  };
  
  try {
    await saveSettings(shop, processedSettings);
    console.log('🔄 SETTINGS DEBUG - Action saved:', {
      recommendationLayout: processedSettings.recommendationLayout,
      enableRecommendations: processedSettings.enableRecommendations,
      shop: shop
    });
    return json({ success: true, message: "Settings saved successfully!" });
  } catch (error) {
    console.error("Error saving settings:", error);
    return json({ success: false, message: "Failed to save settings" }, { status: 500 });
  }
});

// Currency formatting helper function
function formatCurrency(amount: number | string, currencyCode: string = 'USD', moneyFormat?: string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (moneyFormat) {
    // Use Shopify's money format if available
    return moneyFormat.replace(/\{\{\s*amount\s*\}\}/g, numAmount.toFixed(2));
  }
  
  // Fallback to Intl.NumberFormat
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
    }).format(numAmount);
  } catch (error) {
    // Ultimate fallback
    return `${currencyCode} ${numAmount.toFixed(2)}`;
  }
}

export default function SettingsPage() {
  const { settings, shopCurrency } = useLoaderData<typeof loader>();
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

  // DEBUG: Log form settings to see if ML settings are present
  console.log('🔍 Admin Settings Debug - formSettings:', {
    enableMLRecommendations: formSettings.enableMLRecommendations,
    enableSmartBundles: formSettings.enableSmartBundles,
    mlPersonalizationMode: formSettings.mlPersonalizationMode,
    hasAllMLSettings: !!(formSettings.enableMLRecommendations !== undefined && formSettings.enableSmartBundles !== undefined)
  });

  // Use theme colors for better defaults  
  const themeColors = detectThemeColors();

  // Helper function to resolve CSS custom properties with fallbacks for preview
  const resolveColor = (colorValue: string | undefined | null, fallback: string = '#000000'): string => {
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

  // Helper function to render cart icons based on selected style
  const renderCartIcon = (iconStyle: string = 'cart') => {
    switch (iconStyle) {
      case 'bag':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-sticky-icon">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        );
      case 'basket':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-sticky-icon">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15l-1.5 7.5H6l-1.5-7.5zM4.5 7.5L3 3.75H1.5m3 3.75L6 15h12l1.5-7.5M9 19.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM20.25 19.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
          </svg>
        );
      case 'cart':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-sticky-icon">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
        );
    }
  };

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
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<any>(null);
  const [showVariantSelector, setShowVariantSelector] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);
  
  // Gift product selection state
  const [showGiftProductSelector, setShowGiftProductSelector] = useState(false);
  const [giftProductSearchQuery, setGiftProductSearchQuery] = useState("");
  const [giftProductsLoading, setGiftProductsLoading] = useState(false);
  const [giftProductsError, setGiftProductsError] = useState<string | null>(null);
  const [giftProducts, setGiftProducts] = useState<any[]>([]);
  const [currentGiftThreshold, setCurrentGiftThreshold] = useState<any>(null);
  
  // Success banner auto-hide state
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Ensure new sticky cart settings have defaults
  useEffect(() => {
    setFormSettings((prev: any) => ({
      ...prev,
      stickyCartShowIcon: prev.stickyCartShowIcon !== false,
      stickyCartShowCount: prev.stickyCartShowCount !== false,
      stickyCartShowTotal: prev.stickyCartShowTotal !== false,
      stickyCartBackgroundColor: prev.stickyCartBackgroundColor || "#000000",
      stickyCartTextColor: prev.stickyCartTextColor || "#ffffff",
      stickyCartCountBadgeColor: prev.stickyCartCountBadgeColor || "#ff4444",
      stickyCartCountBadgeTextColor: prev.stickyCartCountBadgeTextColor || "#ffffff",
      stickyCartBorderRadius: prev.stickyCartBorderRadius || 25,
      // Progress bar and gift gating defaults
      progressBarMode: prev.progressBarMode || 'free-shipping',
      enableGiftGating: prev.enableGiftGating || false,
      giftProgressStyle: prev.giftProgressStyle || 'single-next',
      giftThresholds: prev.giftThresholds || '[]',
      giftNoticeText: prev.giftNoticeText || 'Free gift added: {{product}} (worth {{amount}})',
      giftPriceText: prev.giftPriceText || 'FREE',
    }));
  }, []);

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
    console.log(`Updating ${key} to:`, value); // Debug log
    setFormSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  // Gift threshold helper functions
  const addGiftThreshold = () => {
    const currentThresholds = formSettings.giftThresholds ? JSON.parse(formSettings.giftThresholds) : [];
    const newThreshold = {
      id: Date.now().toString(),
      amount: 100,
      title: '',
      description: '',
      type: 'product',
      productHandle: '',
      discountAmount: 0,
      discountCode: ''
    };
    const updatedThresholds = [...currentThresholds, newThreshold];
    updateSetting('giftThresholds', JSON.stringify(updatedThresholds));
  };

  const removeGiftThreshold = (thresholdId: string) => {
    const currentThresholds = formSettings.giftThresholds ? JSON.parse(formSettings.giftThresholds) : [];
    const updatedThresholds = currentThresholds.filter((threshold: any) => threshold.id !== thresholdId);
    updateSetting('giftThresholds', JSON.stringify(updatedThresholds));
  };

  const cartPositionOptions = [
    { label: "Bottom Right", value: "bottom-right" },
    { label: "Bottom Center", value: "bottom-center" },
    { label: "Bottom Left", value: "bottom-left" },
    { label: "Top Right", value: "top-right" },
    { label: "Top Left", value: "top-left" },
    { label: "Right Middle", value: "right-middle" },
    { label: "Left Middle", value: "left-middle" },
  ];

  const cartIconOptions = [
    { label: "Shopping Cart", value: "cart" },
    { label: "Shopping Bag", value: "bag" },
    { label: "Basket", value: "basket" },
  ];

  const recommendationLayoutOptions = [
    { label: "🚀 NEW Carousel", value: "carousel" },
    { label: "📋 NEW List", value: "list" },
    { label: "⚡ NEW Grid (Premium)", value: "grid" },
  ];

  const complementDetectionModeOptions = [
    { label: "🤖 AI‑Powered (Recommended)", value: "automatic" },
    { label: "🛠️ Manual Selection", value: "manual" },
    { label: "🔀 AI + Manual (Hybrid)", value: "hybrid" },
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

  // Fetch gift products when selector opens or search changes (debounced)
  useEffect(() => {
    if (!showGiftProductSelector) return;
    setGiftProductsError(null);
    setGiftProductsLoading(true);
    const timeout = setTimeout(() => {
      const qs = new URLSearchParams();
      if (giftProductSearchQuery) qs.set('query', giftProductSearchQuery);
      qs.set('limit', '25');
      productsFetcher.load(`/api/products?${qs.toString()}`);
    }, 250);
    return () => {
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGiftProductSelector, giftProductSearchQuery]);

  useEffect(() => {
    if (productsFetcher.state === 'loading') {
      if (showProductSelector) {
        setProductsLoading(true);
        setProductsError(null);
      }
      if (showGiftProductSelector) {
        setGiftProductsLoading(true);
        setGiftProductsError(null);
      }
    }
    if (productsFetcher.state === 'idle') {
      const data: any = productsFetcher.data;
      if (data?.error) {
        if (showProductSelector) {
          setProducts([]);
          setProductsError(typeof data.error === 'string' ? data.error : 'Failed to load products');
        }
        if (showGiftProductSelector) {
          setGiftProducts([]);
          setGiftProductsError(typeof data.error === 'string' ? data.error : 'Failed to load products');
        }
      } else {
        if (showProductSelector) {
          setProducts(Array.isArray(data?.products) ? data.products : []);
        }
        if (showGiftProductSelector) {
          setGiftProducts(Array.isArray(data?.products) ? data.products : []);
        }
      }
      if (showProductSelector) setProductsLoading(false);
      if (showGiftProductSelector) setGiftProductsLoading(false);
    }
  }, [productsFetcher.state, productsFetcher.data, showProductSelector, showGiftProductSelector]);

  // Calculate free shipping progress
  const threshold = (formSettings.freeShippingThreshold || 100) * 100;
  const currentTotal = 1500; // £15.00 in pence for demo - shows progress needed
  // const remaining = Math.max(0, threshold - currentTotal);
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
            padding-bottom: 24px;
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

          .cartuplift-sticky-preview.right-middle {
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
          }

          .cartuplift-sticky-preview.left-middle {
            top: 50%;
            left: 20px;
            transform: translateY(-50%);
          }

          .cartuplift-sticky-preview .cartuplift-sticky-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            background: ${resolveColor(formSettings.stickyCartBackgroundColor || formSettings.buttonColor, '#000000')};
            color: ${resolveColor(formSettings.stickyCartTextColor || formSettings.buttonTextColor, '#ffffff')};
            border: none;
            border-radius: ${formSettings.stickyCartBorderRadius || 25}px;
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
            background: ${resolveColor(formSettings.stickyCartCountBadgeColor, '#ff4444')};
            color: ${resolveColor(formSettings.stickyCartCountBadgeTextColor, '#ffffff')};
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
          
          .cartuplift-color-field {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .cartuplift-color-field .cartuplift-color-input {
            width: 100%;
            height: 36px;
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
          
          /* Grid Layout (2x4) */
          .cartuplift-grid-layout {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 8px;
            background: #f5f5f5;
            padding: 12px;
            border-radius: 8px;
          }
          
          .cartuplift-grid-item {
            position: relative;
            aspect-ratio: 1;
            border-radius: 6px;
            overflow: hidden;
            background: white;
            cursor: pointer;
          }
          
          .cartuplift-grid-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .cartuplift-grid-item h5 {
            position: absolute;
            top: 8px;
            left: 8px;
            font-size: 9px;
            font-weight: 600;
            margin: 0;
            color: white;
            text-shadow: 0 1px 3px rgba(0,0,0,0.7);
            line-height: 1.2;
            opacity: 0;
            transition: opacity 0.3s ease;
            background: rgba(0,0,0,0.1);
            padding: 2px 4px;
            border-radius: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .cartuplift-grid-item span {
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 9px;
            font-weight: 600;
            color: white;
            text-shadow: 0 1px 3px rgba(0,0,0,0.7);
            opacity: 0;
            transition: opacity 0.3s ease;
            background: rgba(0,0,0,0.1);
            padding: 2px 4px;
            border-radius: 3px;
          }
          
          .cartuplift-grid-item button {
            position: absolute;
            bottom: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 28px;
            height: 28px;
            border-radius: 4px;
            border: none;
            background: white;
            color: #333;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            opacity: 0;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .cartuplift-grid-item:hover h5,
          .cartuplift-grid-item:hover span,
          .cartuplift-grid-item:hover button {
            opacity: 1;
          }
          
          .cartuplift-grid-item button:hover {
            background: #f0f0f0;
            transform: translateX(-50%) translateY(-1px);
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
        {/* DEVELOPMENT VERSION BANNER - Always visible for testing */}
        <div className="cartuplift-success-banner">
          <Banner tone="info">🔥 DEVELOPMENT VERSION LOADED - NEW LAYOUT OPTIONS AVAILABLE 🔥</Banner>
        </div>

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

            {/* ML & Smart Bundles Settings - PROMINENT PLACEMENT */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  🧠 Machine Learning & Smart Bundles
                </Text>
                <Text as="p" variant="bodyMd">
                  Configure AI-powered recommendations and smart bundle features to boost conversions.
                </Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Smart Bundles"
                    checked={formSettings.enableSmartBundles}
                    onChange={(value) => updateSetting("enableSmartBundles", value)}
                    helpText="Enable AI-powered product bundling on your store"
                  />

                  <Checkbox
                    label="Enable ML Recommendations"
                    checked={formSettings.enableMLRecommendations}
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

                      <Select
                        label="Privacy Level"
                        options={[
                          { label: 'Basic (Anonymous)', value: 'basic' },
                          { label: 'Standard (Session-based)', value: 'standard' },
                          { label: 'Advanced (User tracking)', value: 'advanced' }
                        ]}
                        value={formSettings.mlPrivacyLevel || "basic"}
                        onChange={(value) => updateSetting("mlPrivacyLevel", value)}
                        helpText="Balance between personalization and privacy"
                      />

                      <Checkbox
                        label="Advanced Personalization"
                        checked={formSettings.enableAdvancedPersonalization}
                        onChange={(value) => updateSetting("enableAdvancedPersonalization", value)}
                        helpText="Enable cross-session learning and behavioral analysis"
                      />

                      <Checkbox
                        label="Behavior Tracking"
                        checked={formSettings.enableBehaviorTracking}
                        onChange={(value) => updateSetting("enableBehaviorTracking", value)}
                        helpText="Track user behavior for improved recommendations (requires privacy disclosure)"
                      />

                      <TextField
                        label="Data Retention (Days)"
                        value={formSettings.mlDataRetentionDays || "30"}
                        onChange={(value) => updateSetting("mlDataRetentionDays", value)}
                        helpText="How long to keep ML training data (affects recommendation accuracy)"
                        type="number"
                        min={1}
                        max={365}
                        autoComplete="off"
                      />
                    </BlockStack>
                  )}

                  {/* Smart Bundle Configuration */}
                  {formSettings.enableSmartBundles && (
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingSm">Bundle Placement & Display</Text>
                      
                      <Checkbox
                        label="Show bundles on product pages"
                        checked={formSettings.bundlesOnProductPages}
                        onChange={(value) => updateSetting("bundlesOnProductPages", value)}
                        helpText="Display smart bundles on individual product pages"
                      />

                      <Checkbox
                        label="Show bundles on collection pages"
                        checked={formSettings.bundlesOnCollectionPages}
                        onChange={(value) => updateSetting("bundlesOnCollectionPages", value)}
                        helpText="Display smart bundles on collection and category pages"
                      />

                      <Checkbox
                        label="Show bundles on cart page"
                        checked={formSettings.bundlesOnCartPage}
                        onChange={(value) => updateSetting("bundlesOnCartPage", value)}
                        helpText="Display smart bundles in the cart page"
                      />

                      <Checkbox
                        label="Show bundles on checkout page"
                        checked={formSettings.bundlesOnCheckoutPage}
                        onChange={(value) => updateSetting("bundlesOnCheckoutPage", value)}
                        helpText="Display smart bundles during checkout process"
                      />

                      <TextField
                        label="Default Bundle Discount (%)"
                        value={formSettings.defaultBundleDiscount || "15"}
                        onChange={(value) => updateSetting("defaultBundleDiscount", value)}
                        helpText="Default discount percentage for smart bundles"
                        type="number"
                        min="0"
                        max="50"
                        autoComplete="off"
                      />

                      <TextField
                        label="Bundle Title Template"
                        value={formSettings.bundleTitleTemplate || "Complete your setup"}
                        onChange={(value) => updateSetting("bundleTitleTemplate", value)}
                        helpText="Template for bundle titles (use {{products}} for product names)"
                        autoComplete="off"
                      />

                      <TextField
                        label="Bundle Discount Code Prefix"
                        value={formSettings.bundleDiscountPrefix || "BUNDLE"}
                        onChange={(value) => updateSetting("bundleDiscountPrefix", value)}
                        helpText="Prefix for auto-generated bundle discount codes"
                        autoComplete="off"
                      />

                      <TextField
                        label="Bundle Confidence Threshold"
                        value={formSettings.bundleConfidenceThreshold || "0.7"}
                        onChange={(value) => updateSetting("bundleConfidenceThreshold", value)}
                        helpText="Minimum AI confidence score to show a bundle (0.0 - 1.0)"
                        type="number"
                        min="0"
                        max="1"
                        step={0.1}
                        autoComplete="off"
                      />

                      <Select
                        label="Savings Display Format"
                        options={[
                          { label: 'Show both amount and percentage', value: 'both' },
                          { label: 'Show amount only', value: 'amount' },
                          { label: 'Show percentage only', value: 'percentage' }
                        ]}
                        value={formSettings.bundleSavingsFormat || "both"}
                        onChange={(value) => updateSetting("bundleSavingsFormat", value)}
                        helpText="How to display savings information on bundles"
                      />

                      <Checkbox
                        label="Show individual prices in bundles"
                        checked={formSettings.showIndividualPricesInBundle}
                        onChange={(value) => updateSetting("showIndividualPricesInBundle", value)}
                        helpText="Display the original price of each product in the bundle"
                      />

                      <Checkbox
                        label="Auto-apply bundle discounts"
                        checked={formSettings.autoApplyBundleDiscounts}
                        onChange={(value) => updateSetting("autoApplyBundleDiscounts", value)}
                        helpText="Automatically apply discount codes when bundles are added to cart"
                      />
                    </BlockStack>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Customer Incentives */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🎯 Customer Incentives</Text>
                <FormLayout>
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">Incentive Type</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Choose what motivates your customers to spend more</Text>
                    
                    <BlockStack gap="300">
                      <BlockStack gap="100">
                        <RadioButton
                          label="Free Shipping Only"
                          helpText="Show progress towards free shipping threshold"
                          name="progressBarMode"
                          checked={(formSettings.progressBarMode || 'free-shipping') === 'free-shipping'}
                          onChange={() => updateSetting('progressBarMode', 'free-shipping')}
                        />
                        <Text as="p" variant="bodySm" tone="subdued">
                          Simple progress bar showing how close customers are to free shipping
                        </Text>
                      </BlockStack>
                      
                      <BlockStack gap="100">
                        <RadioButton
                          label="Gift & Rewards System"
                          helpText="Show progress towards gift thresholds and rewards"
                          name="progressBarMode"
                          checked={formSettings.progressBarMode === 'gift-gating'}
                          onChange={() => updateSetting('progressBarMode', 'gift-gating')}
                        />
                        <Text as="p" variant="bodySm" tone="subdued">
                          Advanced progress system with multiple gift thresholds and rewards
                        </Text>
                      </BlockStack>
                      
                      <BlockStack gap="100">
                        <RadioButton
                          label="Combined (Free Shipping + Gifts)"
                          helpText="Show both free shipping and gift thresholds together"
                          name="progressBarMode"
                          checked={formSettings.progressBarMode === 'combined'}
                          onChange={() => updateSetting('progressBarMode', 'combined')}
                        />
                        <Text as="p" variant="bodySm" tone="subdued">
                          Unified progress bar combining free shipping and gift thresholds
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </BlockStack>
                  
                  {/* Free Shipping Settings - shown when Free Shipping Only is selected */}
                  {(formSettings.progressBarMode || 'free-shipping') === 'free-shipping' && (
                    <BlockStack key="free-shipping-settings" gap="400">
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
                                value={resolveColor(formSettings.shippingBarColor, themeColors.primary)}
                                onChange={(e) => updateSetting("shippingBarColor", e.target.value)}
                                className="cartuplift-color-input-full-width"
                                title={resolveColor(formSettings.shippingBarColor, themeColors.primary)}
                                aria-label={`Shipping bar color: ${resolveColor(formSettings.shippingBarColor, themeColors.primary)}`}
                              />
                            </div>
                          </div>
                        </BlockStack>
                      )}
                    </BlockStack>
                  )}
                  
                  {/* Gift Gating Settings - shown when Gift & Rewards or Combined is selected */}
                  {(formSettings.progressBarMode === 'gift-gating' || formSettings.progressBarMode === 'combined') && (
                    <BlockStack key="gift-gating-settings" gap="400">
                      <Checkbox
                        label="Enable Gift Gating"
                        checked={formSettings.enableGiftGating || false}
                        onChange={(value) => updateSetting("enableGiftGating", value)}
                        helpText="Unlock gifts, discounts, or free products when customers reach spending thresholds"
                      />
                      
                      {formSettings.enableGiftGating && (
                        <BlockStack gap="400">
                          <BlockStack gap="200">
                            <Text variant="headingSm" as="h3">Progress Bar Display Style</Text>
                            <BlockStack gap="300">
                              <BlockStack gap="100">
                                <RadioButton
                                  label="Stacked Progress Bars"
                                  id="stacked"
                                  name="giftProgressStyle"
                                  checked={(formSettings.giftProgressStyle || 'single-next') === 'stacked'}
                                  onChange={() => updateSetting('giftProgressStyle', 'stacked')}
                                />
                                <Text as="p" variant="bodySm" tone="subdued">
                                  Show separate progress bars for each threshold
                                </Text>
                              </BlockStack>
                              
                              <BlockStack gap="100">
                                <RadioButton
                                  label="Single Bar with All Milestones"
                                  id="single-multi"
                                  name="giftProgressStyle"
                                  checked={(formSettings.giftProgressStyle || 'single-next') === 'single-multi'}
                                  onChange={() => updateSetting('giftProgressStyle', 'single-multi')}
                                />
                                <Text as="p" variant="bodySm" tone="subdued">
                                  One progress bar showing all reward milestones
                                </Text>
                              </BlockStack>
                              
                              <BlockStack gap="100">
                                <RadioButton
                                  label="Single Bar with Next Goal Focus"
                                  id="single-next"
                                  name="giftProgressStyle"
                                  checked={(formSettings.giftProgressStyle || 'single-next') === 'single-next'}
                                  onChange={() => updateSetting('giftProgressStyle', 'single-next')}
                                />
                                <Text as="p" variant="bodySm" tone="subdued">
                                  Focus on the next achievable reward
                                </Text>
                              </BlockStack>
                            </BlockStack>
                          </BlockStack>
                          
                          <BlockStack gap="200">
                            <Text variant="headingSm" as="h3">Gift Thresholds</Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Set spending thresholds to unlock gifts, discounts, or free products
                            </Text>
                            
                            <BlockStack gap="200" align="center">
                              <Button onClick={addGiftThreshold} variant="secondary">Add Gift Threshold</Button>
                            </BlockStack>
                            
                            <BlockStack gap="300">
                              {(() => {
                                const giftThresholds = formSettings.giftThresholds ? JSON.parse(formSettings.giftThresholds) : [];
                                
                                if (giftThresholds.length === 0) {
                                  return (
                                    <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                                      No gift thresholds added yet. Click "Add Gift Threshold" to get started.
                                    </Text>
                                  );
                                }
                                
                                return (
                                  <BlockStack gap="300">
                                    {giftThresholds.map((threshold: any, index: number) => (
                                      <Card key={threshold.id} padding="400">
                                        <BlockStack gap="300">
                                          <InlineStack align="space-between">
                                            <Text variant="headingSm" as="h4">Threshold #{index + 1}</Text>
                                            <Button 
                                              onClick={() => removeGiftThreshold(threshold.id)} 
                                              variant="tertiary" 
                                              tone="critical"
                                              size="micro"
                                            >
                                              Remove
                                            </Button>
                                          </InlineStack>
                                          
                                          <InlineStack gap="300">
                                            <TextField
                                              label="Spending Amount"
                                              type="number"
                                              value={threshold.amount?.toString() || ''}
                                              onChange={(value) => {
                                                const updated = giftThresholds.map((t: any) => 
                                                  t.id === threshold.id ? { ...t, amount: parseInt(value) || 0 } : t
                                                );
                                                updateSetting('giftThresholds', JSON.stringify(updated));
                                              }}
                                              prefix={shopCurrency?.currencyCode === 'GBP' ? '£' : shopCurrency?.currencyCode === 'EUR' ? '€' : '$'}
                                              autoComplete="off"
                                            />
                                            
                                            <Select
                                              label="Reward Type"
                                              options={[
                                                { label: 'Free Product', value: 'product' },
                                                { label: 'Percentage Discount', value: 'discount_percentage' },
                                                { label: 'Discount Code', value: 'discount_store' }
                                              ]}
                                              value={threshold.type || 'product'}
                                              onChange={(value) => {
                                                const updated = giftThresholds.map((t: any) => 
                                                  t.id === threshold.id ? { ...t, type: value } : t
                                                );
                                                updateSetting('giftThresholds', JSON.stringify(updated));
                                              }}
                                            />
                                          </InlineStack>
                                          
                                          <TextField
                                            label="Gift Title"
                                            value={threshold.title || ''}
                                            onChange={(value) => {
                                              const updated = giftThresholds.map((t: any) => 
                                                t.id === threshold.id ? { ...t, title: value } : t
                                              );
                                              updateSetting('giftThresholds', JSON.stringify(updated));
                                            }}
                                            placeholder="e.g., Free Sample Pack"
                                            autoComplete="off"
                                          />
                                          
                                          <TextField
                                            label="Description"
                                            value={threshold.description || ''}
                                            onChange={(value) => {
                                              const updated = giftThresholds.map((t: any) => 
                                                t.id === threshold.id ? { ...t, description: value } : t
                                              );
                                              updateSetting('giftThresholds', JSON.stringify(updated));
                                            }}
                                            placeholder="Optional description for customers"
                                            autoComplete="off"
                                          />
                                          
                                          {threshold.type === 'product' && (
                                            <BlockStack gap="200">
                                              <Text variant="headingSm" as="h4">Gift Product</Text>
                                              {threshold.productId ? (
                                                <div className="cartuplift-selected-gift-product">
                                                  {threshold.productImage && (
                                                    <div className="cartuplift-product-image">
                                                      <img 
                                                        src={threshold.productImage} 
                                                        alt={threshold.productImageAlt || threshold.productTitle}
                                                        className="cartuplift-gift-product-image"
                                                      />
                                                    </div>
                                                  )}
                                                  <div className="cartuplift-product-info">
                                                    <Text as="p" variant="bodyMd" fontWeight="medium">
                                                      {threshold.productTitle}
                                                    </Text>
                                                  </div>
                                                  <Button
                                                    variant="plain"
                                                    onClick={() => {
                                                      setCurrentGiftThreshold(threshold);
                                                      setShowGiftProductSelector(true);
                                                    }}
                                                  >
                                                    Change Product
                                                  </Button>
                                                </div>
                                              ) : (
                                                <Button
                                                  onClick={() => {
                                                    setCurrentGiftThreshold(threshold);
                                                    setShowGiftProductSelector(true);
                                                  }}
                                                >
                                                  Select Gift Product
                                                </Button>
                                              )}
                                            </BlockStack>
                                          )}
                                          
                                          {threshold.type === 'discount_percentage' && (
                                            <InlineStack gap="200">
                                              <TextField
                                                label="Discount Amount (%)"
                                                type="number"
                                                value={threshold.discountAmount?.toString() || ''}
                                                onChange={(value) => {
                                                  const updated = giftThresholds.map((t: any) => 
                                                    t.id === threshold.id ? { ...t, discountAmount: parseFloat(value) || 0 } : t
                                                  );
                                                  updateSetting('giftThresholds', JSON.stringify(updated));
                                                }}
                                                suffix="%"
                                                autoComplete="off"
                                              />
                                            </InlineStack>
                                          )}
                                          
                                          {threshold.type === 'discount_store' && (
                                            <TextField
                                              label="Discount Code (from Shopify)"
                                              value={threshold.discountCode || ''}
                                              onChange={(value) => {
                                                const updated = giftThresholds.map((t: any) => 
                                                  t.id === threshold.id ? { ...t, discountCode: value } : t
                                                );
                                                updateSetting('giftThresholds', JSON.stringify(updated));
                                              }}
                                              placeholder="e.g., SAVE20"
                                              helpText="Store-wide discount code created in Shopify"
                                              autoComplete="off"
                                            />
                                          )}
                                        </BlockStack>
                                      </Card>
                                    ))}
                                  </BlockStack>
                                );
                              })()}
                            </BlockStack>
                            
                            {/* Gift Notice Text Customization */}
                            <BlockStack gap="200">
                              <Text variant="headingSm" as="h3">Gift Notice Text</Text>
                              <TextField
                                label="Cart Gift Notice Message"
                                value={formSettings.giftNoticeText || 'Free gift added: {{product}} (worth {{amount}})'}
                                onChange={(value) => updateSetting("giftNoticeText", value)}
                                helpText="Default message: 'Free gift added: {{product}} (worth {{amount}})'"
                                placeholder="Free gift added: {{product}} (worth {{amount}})"
                                autoComplete="off"
                                multiline={2}
                              />
                              <Text as="p" variant="bodySm" tone="subdued">
                                <strong>You can use:</strong><br/>
                                • <code>{'{{amount}}'}</code> – total savings (e.g. "£115.00")<br/>
                                • <code>{'{{product}}'}</code> – gift product names (comma-separated if multiple)
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                <strong>Fallback (if left blank):</strong> "Free gift included"
                              </Text>
                            </BlockStack>

                            {/* Gift Price Text Customization */}
                            <BlockStack gap="200">
                              <Text variant="headingSm" as="h3">Gift Price Display</Text>
                              <TextField
                                label="Gift Price Text"
                                value={formSettings.giftPriceText || 'FREE'}
                                onChange={(value) => updateSetting("giftPriceText", value)}
                                helpText="Text shown instead of price for gift items"
                                placeholder="FREE"
                                autoComplete="off"
                              />
                              <Text as="p" variant="bodySm" tone="subdued">
                                <strong>Default:</strong> "FREE" | <strong>Fallback (if left blank):</strong> "Gift"
                              </Text>
                            </BlockStack>
                          </BlockStack>
                        </BlockStack>
                      )}
                    </BlockStack>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Appearance & Style */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🎨 Appearance & Style</Text>
                <FormLayout>
                  <Select
                    label="Cart Icon Style"
                    options={cartIconOptions}
                    value={formSettings.cartIcon}
                    onChange={(value) => updateSetting("cartIcon", value)}
                    helpText="Choose the icon style for your cart"
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
                    label="Show only on cart page"
                    checked={formSettings.showOnlyOnCartPage}
                    onChange={(value) => updateSetting("showOnlyOnCartPage", value)}
                    helpText="Limit cart uplift features to cart page only (disables recommendations and upsells on other pages)"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Dedicated Sticky Cart Section */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🛒 Sticky Cart</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Sticky Cart"
                    checked={formSettings.enableStickyCart}
                    onChange={(checked) => updateSetting("enableStickyCart", checked)}
                    helpText="Keep the cart accessible as users browse your store"
                  />

                  {formSettings.enableStickyCart && (
                    <>
                      <InlineStack gap="400">
                        <Select
                          label="Cart Position"
                          options={cartPositionOptions}
                          value={formSettings.cartPosition}
                          onChange={(value) => updateSetting("cartPosition", value)}
                          helpText="Where the cart button appears on your store"
                        />
                        <TextField
                          label="Border Radius (px)"
                          type="number"
                          value={String(formSettings.stickyCartBorderRadius || 25)}
                          onChange={(value) => updateSetting("stickyCartBorderRadius", parseInt(value) || 25)}
                          helpText="Controls how rounded the sticky cart button appears (0 = square, 25 = rounded)"
                          suffix="px"
                          autoComplete="off"
                        />
                      </InlineStack>

                      <div style={{ marginTop: '16px' }}>
                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h3">Display Options</Text>
                          <InlineStack gap="400">
                            <Checkbox
                              label="Show Cart Icon"
                              checked={formSettings.stickyCartShowIcon !== false}
                              onChange={(checked) => updateSetting("stickyCartShowIcon", checked)}
                            />
                            <Checkbox
                              label="Show Item Count"
                              checked={formSettings.stickyCartShowCount !== false}
                              onChange={(checked) => updateSetting("stickyCartShowCount", checked)}
                            />
                            <Checkbox
                              label="Show Total Price"
                              checked={formSettings.stickyCartShowTotal !== false}
                              onChange={(checked) => updateSetting("stickyCartShowTotal", checked)}
                            />
                          </InlineStack>
                        </BlockStack>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h3">Colors & Styling</Text>
                          <InlineStack gap="300">
                            <div className="cartuplift-color-field">
                              <Text variant="bodyMd" as="p">Background Color</Text>
                              <input
                                type="color"
                                value={resolveColor(formSettings.stickyCartBackgroundColor, '#000000')}
                                onChange={(e) => updateSetting("stickyCartBackgroundColor", e.target.value)}
                                className="cartuplift-color-input"
                                title="Sticky cart background color"
                                aria-label="Choose sticky cart background color"
                              />
                            </div>
                            <div className="cartuplift-color-field">
                              <Text variant="bodyMd" as="p">Text Color</Text>
                              <input
                                type="color"
                                value={resolveColor(formSettings.stickyCartTextColor, '#ffffff')}
                                onChange={(e) => updateSetting("stickyCartTextColor", e.target.value)}
                                className="cartuplift-color-input"
                                title="Sticky cart text color"
                                aria-label="Choose sticky cart text color"
                              />
                            </div>
                            <div className="cartuplift-color-field">
                              <Text variant="bodyMd" as="p">Count Badge Color</Text>
                              <input
                                type="color"
                                value={resolveColor(formSettings.stickyCartCountBadgeColor, '#ff4444')}
                                onChange={(e) => updateSetting("stickyCartCountBadgeColor", e.target.value)}
                                className="cartuplift-color-input"
                                title="Count badge color"
                                aria-label="Choose count badge color"
                              />
                            </div>
                            <div className="cartuplift-color-field">
                              <Text variant="bodyMd" as="p">Count Badge Text</Text>
                              <input
                                type="color"
                                value={resolveColor(formSettings.stickyCartCountBadgeTextColor, '#ffffff')}
                                onChange={(e) => updateSetting("stickyCartCountBadgeTextColor", e.target.value)}
                                className="cartuplift-color-input"
                                title="Count badge text color"
                                aria-label="Choose count badge text color"
                              />
                            </div>
                          </InlineStack>
                        </BlockStack>
                      </div>
                    </>
                  )}
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
                      onChange={(value) => {
                        console.log('🎯 Dropdown onChange - received value:', value);
                        console.log('🎯 Available options:', recommendationLayoutOptions);
                        updateSetting("recommendationLayout", value);
                      }}
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
                      label="Recommendation Mode (AI vs. Manual)"
                      options={complementDetectionModeOptions}
                      value={formSettings.complementDetectionMode}
                      onChange={(value) => updateSetting("complementDetectionMode", value)}
                      helpText="Choose how products are picked. AI analyzes sales patterns; Manual lets you hand-pick."
                    />
                    
                    {(formSettings.complementDetectionMode === 'manual' || formSettings.complementDetectionMode === 'hybrid') && (
                      <div className="cartuplift-manual-rec-section">
                        <Text variant="headingSm" as="h3">
                          {formSettings.complementDetectionMode === 'hybrid' ? '🔀 Manual Product Selection (for Hybrid)' : '🛠️ Manual Product Selection'}
                        </Text>
                        <div className="cartuplift-manual-rec-info">
                          {formSettings.complementDetectionMode === 'hybrid' && (
                            <Text variant="bodyMd" as="p" tone="subdued">
                              Select products to mix with AI recommendations
                            </Text>
                          )}
                          <InlineStack gap="200" align="start">
                            <Button onClick={() => setShowProductSelector(true)}>Select products</Button>
                            {selectedProducts.length > 0 && (
                              <Badge tone="success">{`${selectedProducts.length} selected`}</Badge>
                            )}
                          </InlineStack>
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
                <Text as="p" tone="subdued">Admin Settings UI version: links-2025-09-10-2</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Discount Code Field"
                    checked={formSettings.enableDiscountCode}
                    onChange={(value) => updateSetting("enableDiscountCode", value)}
                    helpText="Allow customers to apply discount codes in cart"
                  />
                  {formSettings.enableDiscountCode && (
                    <TextField
                      label="Promotion Link Text"
                      value={formSettings.discountLinkText || '+ Got a promotion code?'}
                      onChange={(value) => updateSetting('discountLinkText', value)}
                      helpText="Inline link label shown on your online store to open the discount code modal"
                      autoComplete="off"
                    />
                  )}
                  
                  <Checkbox
                    label="Enable Order Notes"
                    checked={formSettings.enableNotes}
                    onChange={(value) => updateSetting("enableNotes", value)}
                    helpText="Let customers add special instructions"
                  />

                  {formSettings.enableNotes && (
                    <TextField
                      label="Notes Link Text"
                      value={formSettings.notesLinkText || '+ Add order notes'}
                      onChange={(value) => updateSetting('notesLinkText', value)}
                      helpText="Inline link label shown on your online store to open the order notes modal"
                      autoComplete="off"
                    />
                  )}

                  {(formSettings.enableDiscountCode || formSettings.enableNotes) && (
                    <Text as="p" tone="subdued">Inline links are used on the online store. The old full-width button is deprecated.</Text>
                  )}

                  <Checkbox
                    label="Enable Urgency Triggers"
                    checked={formSettings.enableUrgency}
                    onChange={(value) => updateSetting("enableUrgency", value)}
                    helpText="Add time-based and stock-based urgency messages to drive immediate purchases"
                  />

                  {formSettings.enableUrgency && (
                    <BlockStack gap="400">
                      <Text variant="headingSm" as="h3">⏰ Urgency Features</Text>
                      
                      <Checkbox
                        label="Time-based urgency (countdown timers)"
                        checked={formSettings.enableTimeUrgency}
                        onChange={(value) => updateSetting("enableTimeUrgency", value)}
                        helpText="Show countdown timers for limited-time offers"
                      />

                      {formSettings.enableTimeUrgency && (
                        <BlockStack gap="300">
                          <TextField
                            label="Timer Duration (hours)"
                            type="number"
                            value={String(formSettings.urgencyTimerHours || 2)}
                            onChange={(value) => updateSetting("urgencyTimerHours", parseInt(value) || 2)}
                            helpText="How many hours the countdown should run"
                            autoComplete="off"
                          />
                          <TextField
                            label="Timer Message"
                            value={formSettings.urgencyTimerMessage || "⏰ Limited time: Complete your order in {time}!"}
                            onChange={(value) => updateSetting("urgencyTimerMessage", value)}
                            helpText="Use {time} where you want the countdown to appear"
                            autoComplete="off"
                          />
                        </BlockStack>
                      )}

                      <Checkbox
                        label="Stock urgency (low inventory alerts)"
                        checked={formSettings.enableStockUrgency}
                        onChange={(value) => updateSetting("enableStockUrgency", value)}
                        helpText="Show low stock messages to create scarcity"
                      />

                      {formSettings.enableStockUrgency && (
                        <BlockStack gap="300">
                          <TextField
                            label="Low Stock Threshold"
                            type="number"
                            value={String(formSettings.stockUrgencyThreshold || 5)}
                            onChange={(value) => updateSetting("stockUrgencyThreshold", parseInt(value) || 5)}
                            helpText="Show urgency when inventory is below this number"
                            autoComplete="off"
                          />
                          <TextField
                            label="Low Stock Message"
                            value={formSettings.stockUrgencyMessage || "⚠️ Only {count} left in stock!"}
                            onChange={(value) => updateSetting("stockUrgencyMessage", value)}
                            helpText="Use {count} for the remaining stock number"
                            autoComplete="off"
                          />
                        </BlockStack>
                      )}

                      <Select
                        label="Urgency Message Placement"
                        options={[
                          { label: "Above cart items", value: "header" },
                          { label: "Below cart title", value: "subtitle" },
                          { label: "Above checkout button", value: "footer" }
                        ]}
                        value={formSettings.urgencyPlacement || "subtitle"}
                        onChange={(value) => updateSetting("urgencyPlacement", value)}
                        helpText="Where to display urgency messages in the cart"
                      />
                    </BlockStack>
                  )}

                  <Checkbox
                    label="Enable Smart Quantity Suggestions"
                    checked={formSettings.enableQuantitySuggestions}
                    onChange={(value) => updateSetting("enableQuantitySuggestions", value)}
                    helpText="Show intelligent quantity recommendations to increase average order value"
                  />

                  {formSettings.enableQuantitySuggestions && (
                    <BlockStack gap="400">
                      <Text variant="headingSm" as="h3">📊 Quantity Optimization</Text>
                      
                      <Checkbox
                        label="Free shipping quantity suggestions"
                        checked={formSettings.enableShippingQuantity}
                        onChange={(value) => updateSetting("enableShippingQuantity", value)}
                        helpText="Suggest adding more items to reach free shipping threshold"
                      />

                      <Checkbox
                        label="Bulk pricing recommendations"
                        checked={formSettings.enableBulkSuggestions}
                        onChange={(value) => updateSetting("enableBulkSuggestions", value)}
                        helpText="Recommend buying multiple quantities for better value"
                      />

                      {formSettings.enableBulkSuggestions && (
                        <BlockStack gap="300">
                          <TextField
                            label="Bulk Discount Threshold"
                            type="number"
                            value={String(formSettings.bulkDiscountThreshold || 3)}
                            onChange={(value) => updateSetting("bulkDiscountThreshold", parseInt(value) || 3)}
                            helpText="Minimum quantity to trigger bulk suggestions"
                            autoComplete="off"
                          />
                          <TextField
                            label="Bulk Suggestion Message"
                            value={formSettings.bulkSuggestionMessage || "💡 Buy {quantity} for {savings} total savings!"}
                            onChange={(value) => updateSetting("bulkSuggestionMessage", value)}
                            helpText="Use {quantity} and {savings} as placeholders"
                            autoComplete="off"
                          />
                        </BlockStack>
                      )}

                      <Select
                        label="Quantity Suggestion Display"
                        options={[
                          { label: "Inline with cart items", value: "inline" },
                          { label: "Below cart items", value: "bottom" },
                          { label: "Above recommendations", value: "recommendations" }
                        ]}
                        value={formSettings.quantitySuggestionPlacement || "inline"}
                        onChange={(value) => updateSetting("quantitySuggestionPlacement", value)}
                        helpText="Where to show quantity suggestions in the cart"
                      />
                    </BlockStack>
                  )}

                  <Checkbox
                    label="Enable Exit Intent Capture"
                    checked={formSettings.enableExitIntent}
                    onChange={(value) => updateSetting("enableExitIntent", value)}
                    helpText="Show retention offers when customers try to leave the website (not the cart)"
                  />

                  {formSettings.enableExitIntent && (
                    <BlockStack gap="400">
                      <Text variant="headingSm" as="h3">🚪 Exit Intent Recovery</Text>
                      
                      <TextField
                        label="Delay Before Detection (seconds)"
                        type="number"
                        value={String(formSettings.exitIntentDelay || 10)}
                        onChange={(value) => updateSetting("exitIntentDelay", parseInt(value) || 10)}
                        helpText="Wait this long before exit intent can trigger (prevents immediate annoyance)"
                        autoComplete="off"
                      />

                      <TextField
                        label="Exit Intent Discount (%)"
                        type="number"
                        value={String(formSettings.exitIntentDiscount || 10)}
                        onChange={(value) => updateSetting("exitIntentDiscount", parseInt(value) || 10)}
                        helpText="Discount percentage to offer for exit intent recovery"
                        autoComplete="off"
                      />

                      <TextField
                        label="Exit Intent Title"
                        value={formSettings.exitIntentTitle || "Wait! Don't leave empty-handed"}
                        onChange={(value) => updateSetting("exitIntentTitle", value)}
                        helpText="Headline for the exit intent modal"
                        autoComplete="off"
                      />

                      <TextField
                        label="Exit Intent Message"
                        value={formSettings.exitIntentMessage || "Get {discount}% off your order before you go!"}
                        onChange={(value) => updateSetting("exitIntentMessage", value)}
                        helpText="Use {discount} for the discount percentage"
                        autoComplete="off"
                        multiline={3}
                      />

                      <Checkbox
                        label="Show available bundles on exit"
                        checked={formSettings.exitIntentShowBundles}
                        onChange={(value) => updateSetting("exitIntentShowBundles", value)}
                        helpText="Display recommended bundles in the exit intent modal"
                      />

                      <Checkbox
                        label="Mobile exit detection"
                        checked={formSettings.exitIntentMobile}
                        onChange={(value) => updateSetting("exitIntentMobile", value)}
                        helpText="Enable exit intent on mobile devices (uses scroll and interaction patterns)"
                      />
                    </BlockStack>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Enhanced Bundle Display Settings */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Enhanced Bundle Display
                </Text>
                <Text as="p" variant="bodyMd">
                  Improve bundle presentation with social proof and visual enhancements to increase conversion rates.
                </Text>

                <FormLayout>
                  <Checkbox
                    label="Enable enhanced bundle display"
                    checked={formSettings.enableEnhancedBundles}
                    onChange={(value) => updateSetting("enableEnhancedBundles", value)}
                    helpText="Activate improved bundle presentation with social proof elements"
                  />

                  {formSettings.enableEnhancedBundles && (
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingMd">Social Proof Features</Text>
                      
                      <Checkbox
                        label="Show purchase counts"
                        checked={formSettings.showPurchaseCounts}
                        onChange={(value) => updateSetting("showPurchaseCounts", value)}
                        helpText="Display how many customers have purchased each bundle"
                      />

                      <Checkbox
                        label="Show recently viewed indicators"
                        checked={formSettings.showRecentlyViewed}
                        onChange={(value) => updateSetting("showRecentlyViewed", value)}
                        helpText="Highlight bundles that other customers recently viewed"
                      />

                      <Checkbox
                        label="Display customer testimonials"
                        checked={formSettings.showTestimonials}
                        onChange={(value) => updateSetting("showTestimonials", value)}
                        helpText="Show brief customer reviews for popular bundles"
                      />

                      <Checkbox
                        label="Show trust badges"
                        checked={formSettings.showTrustBadges}
                        onChange={(value) => updateSetting("showTrustBadges", value)}
                        helpText="Display badges like 'Most Popular', 'Best Value', 'Trending'"
                      />

                      <Text as="h3" variant="headingMd">Visual Hierarchy</Text>

                      <Checkbox
                        label="Highlight high-value bundles"
                        checked={formSettings.highlightHighValue}
                        onChange={(value) => updateSetting("highlightHighValue", value)}
                        helpText="Visually emphasize bundles with higher profit margins"
                      />

                      <Checkbox
                        label="Enhanced product images"
                        checked={formSettings.enhancedImages}
                        onChange={(value) => updateSetting("enhancedImages", value)}
                        helpText="Use larger, higher quality images with hover effects"
                      />

                      <Checkbox
                        label="Animated savings display"
                        checked={formSettings.animatedSavings}
                        onChange={(value) => updateSetting("animatedSavings", value)}
                        helpText="Animate savings amounts to draw attention"
                      />

                      <TextField
                        label="High-value threshold ($)"
                        value={formSettings.highValueThreshold?.toString() || "150"}
                        onChange={(value) => updateSetting("highValueThreshold", parseInt(value) || 150)}
                        helpText="Bundle value above which to apply high-value highlighting"
                        type="number"
                        autoComplete="off"
                      />

                      <Select
                        label="Bundle display priority"
                        options={[
                          { label: "Highest profit margin first", value: "profit" },
                          { label: "Most popular first", value: "popular" },
                          { label: "Highest value first", value: "value" },
                          { label: "Recently added first", value: "recent" }
                        ]}
                        value={formSettings.bundlePriority || "profit"}
                        onChange={(value) => updateSetting("bundlePriority", value)}
                        helpText="How to order bundle recommendations"
                      />

                      <Text variant="headingMd" as="h4">Badge Text Customization</Text>
                      
                      <TextField
                        label="High-value badge text"
                        value={formSettings.badgeHighValueText || "Best Value"}
                        onChange={(value) => updateSetting("badgeHighValueText", value)}
                        helpText="Text displayed on high-value bundle badges"
                        autoComplete="off"
                      />

                      <TextField
                        label="Popular badge text"
                        value={formSettings.badgePopularText || "Most Popular"}
                        onChange={(value) => updateSetting("badgePopularText", value)}
                        helpText="Text displayed on popular item badges"
                        autoComplete="off"
                      />

                      <TextField
                        label="Trending badge text"
                        value={formSettings.badgeTrendingText || "Trending"}
                        onChange={(value) => updateSetting("badgeTrendingText", value)}
                        helpText="Text displayed on trending item badges"
                        autoComplete="off"
                      />

                      <Text variant="headingMd" as="h4">Customer Testimonials</Text>
                      
                      <TextField
                        label="Testimonials (JSON format)"
                        value={formSettings.testimonialsList || JSON.stringify([
                          { text: "Love this combo!", author: "Sarah M." },
                          { text: "Perfect together!", author: "Mike R." },
                          { text: "Great value bundle", author: "Emma K." },
                          { text: "Exactly what I needed", author: "Alex T." },
                          { text: "Highly recommend", author: "Lisa P." },
                          { text: "Amazing quality", author: "James W." }
                        ], null, 2)}
                        onChange={(value) => updateSetting("testimonialsList", value)}
                        helpText="JSON array of testimonials with 'text' and 'author' fields"
                        multiline={6}
                        autoComplete="off"
                      />
                    </BlockStack>
                  )}
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
                  <button className="cartuplift-close" aria-label="Close cart">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-large">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Progress Bar Preview */}
                {(formSettings.progressBarMode === 'free-shipping' || !formSettings.progressBarMode) && (
                  <div key="free-shipping-preview" className="cartuplift-shipping-bar">
                    <div className="cartuplift-shipping-progress">
                      <div 
                        className="cartuplift-shipping-progress-fill" 
                        style={{
                          width: `${progress}%`,
                          background: resolveColor(formSettings.shippingBarColor, '#4CAF50')
                        }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {formSettings.progressBarMode === 'gift-gating' && (
                  <div key="gift-gating-preview" className="cartuplift-gift-progress-container">
                    {(() => {
                      const giftThresholds = formSettings.giftThresholds ? JSON.parse(formSettings.giftThresholds) : [];
                      const currentCartTotal = 474; // Demo cart total
                      const giftProgressStyle = formSettings.giftProgressStyle || 'single-next';
                      
                      // If no thresholds, show sample data for preview
                      const sampleThresholds = giftThresholds.length > 0 ? giftThresholds : [
                        { id: '1', amount: 250, title: 'Free Gift', description: 'Get a free sample pack', type: 'free_product' },
                        { id: '2', amount: 500, title: '20% Off', description: '20% off your entire order', type: 'discount_store' },
                        { id: '3', amount: 750, title: 'Premium Gift', description: 'Free premium product', type: 'free_product' }
                      ];
                      
                      const sortedThresholds = [...sampleThresholds].sort((a, b) => a.amount - b.amount);
                      
                      if (giftProgressStyle === 'stacked') {
                        return (
                          <div className="cartuplift-stacked-progress">
                            {sortedThresholds.map((threshold, index) => {
                              const progress = Math.min((currentCartTotal / threshold.amount) * 100, 100);
                              const isAchieved = currentCartTotal >= threshold.amount;
                              
                              return (
                                <div key={threshold.id} className="cartuplift-stacked-bar">
                                  <div className="cartuplift-threshold-info">
                                    <span className="cartuplift-threshold-title">
                                      {isAchieved ? '✓' : '🎁'} {threshold.title}
                                    </span>
                                    <span className="cartuplift-threshold-amount">£{threshold.amount}</span>
                                  </div>
                                  <div className="cartuplift-progress-bar">
                                    <div 
                                      className={`cartuplift-progress-fill ${isAchieved ? 'achieved' : ''}`}
                                      style={{ 
                                        width: `${progress}%`,
                                        background: isAchieved ? '#4CAF50' : resolveColor(formSettings.shippingBarColor, '#2196F3')
                                      }}
                                    ></div>
                                  </div>
                                  <div className="cartuplift-threshold-description">{threshold.description}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else if (giftProgressStyle === 'single-multi') {
                        const maxThreshold = Math.max(...sortedThresholds.map(t => t.amount));
                        const overallProgress = Math.min((currentCartTotal / maxThreshold) * 100, 100);
                        
                        return (
                          <div className="cartuplift-single-multi-progress">
                            <div className="cartuplift-milestones-header">
                              <span>🎯 Gift Milestones</span>
                              <span>£{currentCartTotal} / £{maxThreshold}</span>
                            </div>
                            <div className="cartuplift-progress-bar-container">
                              <div className="cartuplift-progress-bar cartuplift-multi-milestone">
                                <div 
                                  className="cartuplift-progress-fill"
                                  style={{ 
                                    width: `${overallProgress}%`,
                                    background: resolveColor(formSettings.shippingBarColor, '#2196F3')
                                  }}
                                ></div>
                                {sortedThresholds.map((threshold, index) => {
                                  const position = (threshold.amount / maxThreshold) * 100;
                                  const isAchieved = currentCartTotal >= threshold.amount;
                                  
                                  return (
                                    <div
                                      key={threshold.id}
                                      className={`cartuplift-milestone-marker ${isAchieved ? 'achieved' : ''}`}
                                      style={{ left: `${position}%` }}
                                      title={`${threshold.title} - £${threshold.amount}`}
                                    >
                                      <div className="cartuplift-milestone-dot"></div>
                                      <div className="cartuplift-milestone-label">
                                        <span className="cartuplift-milestone-icon">{isAchieved ? '✓' : '🎁'}</span>
                                        <span>£{threshold.amount}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="cartuplift-milestones-list">
                              {sortedThresholds.map((threshold, index) => {
                                const isAchieved = currentCartTotal >= threshold.amount;
                                const remaining = threshold.amount - currentCartTotal;
                                
                                return (
                                  <div key={threshold.id} className={`cartuplift-milestone-item ${isAchieved ? 'achieved' : ''}`}>
                                    <span className="cartuplift-milestone-status">
                                      {isAchieved ? '✅' : remaining > 0 ? `£${remaining.toFixed(2)} to go` : '🎁'}
                                    </span>
                                    <span className="cartuplift-milestone-reward">{threshold.title}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      } else {
                        // single-next style (default)
                        const nextThreshold = sortedThresholds.find(t => currentCartTotal < t.amount);
                        const achievedThresholds = sortedThresholds.filter(t => currentCartTotal >= t.amount);
                        
                        if (!nextThreshold) {
                          // All thresholds achieved
                          // const lastThreshold = sortedThresholds[sortedThresholds.length - 1];
                          return (
                            <div className="cartuplift-single-next-progress">
                              <div className="cartuplift-next-goal-header">
                                <span>🎉 All rewards unlocked!</span>
                              </div>
                              <div className="cartuplift-progress-bar">
                                <div 
                                  className="cartuplift-progress-fill achieved"
                                  style={{ 
                                    width: '100%',
                                    background: '#4CAF50'
                                  }}
                                ></div>
                              </div>
                              <div className="cartuplift-goal-description">
                                You've earned: {achievedThresholds.map(t => t.title).join(', ')}
                              </div>
                            </div>
                          );
                        }
                        
                        const progress = Math.min((currentCartTotal / nextThreshold.amount) * 100, 100);
                        const remaining = nextThreshold.amount - currentCartTotal;
                        
                        return (
                          <div className="cartuplift-single-next-progress">
                            <div className="cartuplift-next-goal-header">
                              <span>🎁 Next Reward: {nextThreshold.title}</span>
                              <span>£{remaining.toFixed(2)} to go</span>
                            </div>
                            <div className="cartuplift-progress-bar">
                              <div 
                                className="cartuplift-progress-fill"
                                style={{ 
                                  width: `${progress}%`,
                                  background: resolveColor(formSettings.shippingBarColor, '#2196F3')
                                }}
                              ></div>
                            </div>
                            <div className="cartuplift-goal-description">
                              {nextThreshold.description}
                            </div>
                            {achievedThresholds.length > 0 && (
                              <div className="cartuplift-achieved-rewards">
                                <span>✅ Already earned: {achievedThresholds.map(t => t.title).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
                
                {formSettings.progressBarMode === 'combined' && (
                  <div key="combined-preview" className="cartuplift-combined-progress-container">
                    <div className="cartuplift-shipping-section">
                      <div className="cartuplift-section-header">
                        <span>🚚 Free Shipping Progress</span>
                        <span>{formatCurrency((165 / 100), shopCurrency?.currencyCode || 'USD')} / {formatCurrency(((formSettings.freeShippingThreshold || 250) / 100), shopCurrency?.currencyCode || 'USD')}</span>
                      </div>
                      <div className="cartuplift-progress-bar">
                        <div 
                          className="cartuplift-progress-fill"
                          style={{
                            width: `${Math.min((165 / (formSettings.freeShippingThreshold || 250)) * 100, 100)}%`,
                            background: resolveColor(formSettings.shippingBarColor, '#4CAF50')
                          }}
                        ></div>
                      </div>
                      <div className="cartuplift-section-description">
                        {165 < (formSettings.freeShippingThreshold || 250) 
                          ? `${formatCurrency((((formSettings.freeShippingThreshold || 250) - 165) / 100), shopCurrency?.currencyCode || 'USD')} more for free shipping`
                          : "✅ Free shipping unlocked!"
                        }
                      </div>
                    </div>
                    
                    <div className="cartuplift-gifts-section">
                        {(() => {
                          const giftThresholds = formSettings.giftThresholds ? JSON.parse(formSettings.giftThresholds) : [];
                          const currentCartTotal = 474;
                          
                          // If no thresholds, show sample data
                          const sampleThresholds = giftThresholds.length > 0 ? giftThresholds : [
                            { id: '1', amount: 250, title: 'Free Gift', description: 'Get a free sample pack', type: 'free_product' },
                            { id: '2', amount: 500, title: '20% Off', description: '20% off your entire order', type: 'discount_store' }
                          ];
                          
                          const sortedThresholds = [...sampleThresholds].sort((a, b) => a.amount - b.amount);
                          const nextThreshold = sortedThresholds.find(t => currentCartTotal < t.amount);
                          const achievedThresholds = sortedThresholds.filter(t => currentCartTotal >= t.amount);
                          
                          if (!nextThreshold) {
                            return (
                              <div className="cartuplift-section-header">
                                <span>🎉 All gift rewards unlocked!</span>
                              </div>
                            );
                          }
                          
                          const progress = Math.min((currentCartTotal / nextThreshold.amount) * 100, 100);
                          const remaining = nextThreshold.amount - currentCartTotal;
                          
                          return (
                            <>
                              <div className="cartuplift-section-header">
                                <span>🎁 Next Gift: {nextThreshold.title}</span>
                                <span>£{remaining.toFixed(2)} to go</span>
                              </div>
                              <div className="cartuplift-progress-bar">
                                <div 
                                  className="cartuplift-progress-fill"
                                  style={{ 
                                    width: `${progress}%`,
                                    background: resolveColor(formSettings.shippingBarColor, '#FF9800')
                                  }}
                                ></div>
                              </div>
                              <div className="cartuplift-section-description">
                                {nextThreshold.description}
                              </div>
                              {achievedThresholds.length > 0 && (
                                <div className="cartuplift-achieved-section">
                                  <span>✅ Earned: {achievedThresholds.map(t => t.title).join(', ')}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                  </div>
                )}

                {/* Content */}
                <div className="cartuplift-content-wrapper">
                  <div className="cartuplift-items">
                    {/* Product 1 */}
                    <div className="cartuplift-item cartuplift-item-first">
                      <div className="cartuplift-item-image">
                        <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png" alt="Example Product Title" />
                      </div>
                      <div className="cartuplift-item-info">
                        <h4 className="cartuplift-item-title">Example Product Title</h4>
                        <div className="cartuplift-item-variant">Color: Blue</div>
                        <div className="cartuplift-item-variant">Size: L</div>
                        <div className="cartuplift-quantity">
                          <button className="cartuplift-qty-minus">−</button>
                          <span className="cartuplift-qty-display">1</span>
                          <button className="cartuplift-qty-plus">+</button>
                        </div>
                      </div>
                      <div className="cartuplift-item-price-actions">
                        <div className="cartuplift-item-price">{formatCurrency(19.99, shopCurrency?.currencyCode || 'USD')}</div>
                        <button className="cartuplift-item-remove" title="Remove item">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-medium">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Product 2 */}
                    <div className="cartuplift-item">
                      <div className="cartuplift-item-image">
                        <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png" alt="Example Product Title" />
                      </div>
                      <div className="cartuplift-item-info">
                        <h4 className="cartuplift-item-title">Example Product Title</h4>
                        <div className="cartuplift-item-variant">Color: Black</div>
                        <div className="cartuplift-item-variant">Shoe size: 10</div>
                        <div className="cartuplift-quantity">
                          <button className="cartuplift-qty-minus">−</button>
                          <span className="cartuplift-qty-display">4</span>
                          <button className="cartuplift-qty-plus">+</button>
                        </div>
                      </div>
                      <div className="cartuplift-item-price-actions">
                        <div className="cartuplift-item-price">{formatCurrency(89.99, shopCurrency?.currencyCode || 'USD')}</div>
                        <button className="cartuplift-item-remove" title="Remove item">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-medium">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Product 3 */}
                    <div className="cartuplift-item">
                      <div className="cartuplift-item-image">
                        <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-3_large.png" alt="Example Product Title" />
                      </div>
                      <div className="cartuplift-item-info">
                        <h4 className="cartuplift-item-title">Example Product Title</h4>
                        <div className="cartuplift-item-variant">Color: Red</div>
                        <div className="cartuplift-item-variant">Size: M</div>
                        <div className="cartuplift-quantity">
                          <button className="cartuplift-qty-minus">−</button>
                          <span className="cartuplift-qty-display">2</span>
                          <button className="cartuplift-qty-plus">+</button>
                        </div>
                      </div>
                      <div className="cartuplift-item-price-actions">
                        <div className="cartuplift-item-price">{formatCurrency(29.99, shopCurrency?.currencyCode || 'USD')}</div>
                        <button className="cartuplift-item-remove" title="Remove item">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-medium">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.111 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations Section */}
                  {formSettings.enableRecommendations && (
                    <div className={`cartuplift-recommendations ${formSettings.recommendationLayout === 'carousel' || formSettings.recommendationLayout === 'row' || formSettings.recommendationLayout === 'horizontal' ? 'is-horizontal' : ''}`}>
                      {(formSettings.recommendationLayout === 'list' || formSettings.recommendationLayout === 'column' || formSettings.recommendationLayout === 'fullwidth' || formSettings.recommendationLayout === 'grid') && (
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
                      )}
                      <div className="cartuplift-recommendations-content">
                        {formSettings.recommendationLayout === 'list' || formSettings.recommendationLayout === 'column' ? (
                          <>
                            <div className="cartuplift-recommendation-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-3_large.png" alt="Example Product Title" />
                              <div className="cartuplift-recommendation-info">
                                <h4>Example Product Title</h4>
                                <div className="cartuplift-recommendation-price">£49.99</div>
                              </div>
                              <button className="cartuplift-add-btn">+</button>
                            </div>
                            <div className="cartuplift-recommendation-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-4_large.png" alt="Example Product Title" />
                              <div className="cartuplift-recommendation-info">
                                <h4>Example Product Title</h4>
                                <div className="cartuplift-recommendation-price">£79.99</div>
                              </div>
                              <button className="cartuplift-add-btn">+</button>
                            </div>
                            <div className="cartuplift-recommendation-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png" alt="Example Product Title" />
                              <div className="cartuplift-recommendation-info">
                                <h4>Example Product Title</h4>
                                <div className="cartuplift-recommendation-price">£39.99</div>
                              </div>
                              <button className="cartuplift-add-btn">+</button>
                            </div>
                          </>
                        ) : formSettings.recommendationLayout === 'fullwidth' ? (
                          <div className="cartuplift-fullwidth-showcase">
                            <div className="cartuplift-fullwidth-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-5_large.png" alt="Example Product Title" />
                              <div className="cartuplift-fullwidth-info">
                                <h4>🔥 Top Seller: Example Product Title</h4>
                                <p>Best quality for your needs</p>
                                <div className="cartuplift-fullwidth-price">£199.99</div>
                                <button className="cartuplift-fullwidth-add">{formSettings.addButtonText || 'Add to Cart'}</button>
                              </div>
                            </div>
                          </div>
                        ) : formSettings.recommendationLayout === 'grid' ? (
                          <div className="cartuplift-grid-layout">
                            <div className="cartuplift-grid-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-6_large.png" alt="Example Product Title" />
                              <h5>QUILTED DOWN VEST</h5>
                              <span>£179.00</span>
                              <button>🛒</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png" alt="Example Product Title" />
                              <h5>PREMIUM HOODIE</h5>
                              <span>£89.99</span>
                              <button>🛒</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png" alt="Example Product Title" />
                              <h5>CLASSIC TEE</h5>
                              <span>£39.99</span>
                              <button>🛒</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-3_large.png" alt="Example Product Title" />
                              <h5>COTTON SHIRT</h5>
                              <span>£59.99</span>
                              <button>🛒</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-4_large.png" alt="Example Product Title" />
                              <h5>DENIM JACKET</h5>
                              <span>£129.99</span>
                              <button>🛒</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-5_large.png" alt="Example Product Title" />
                              <h5>WOOL SWEATER</h5>
                              <span>£99.99</span>
                              <button>🛒</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-6_large.png" alt="Example Product Title" />
                              <h5>LEATHER BOOTS</h5>
                              <span>£199.99</span>
                              <button>🛒</button>
                            </div>
                            <div className="cartuplift-grid-item">
                              <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png" alt="Example Product Title" />
                              <h5>CANVAS SNEAKERS</h5>
                              <span>£79.99</span>
                              <button>🛒</button>
                            </div>
                          </div>
                        ) : (formSettings.recommendationLayout === 'carousel' || formSettings.recommendationLayout === 'row' || formSettings.recommendationLayout === 'horizontal') ? (
                          <div className="cartuplift-horizontal-card">
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
                            <div className="cartuplift-recommendations-row">
                              <div className="cartuplift-recommendations-track" ref={horizontalTrackRef}>
                              <div className="cartuplift-recommendation-card">
                                <div className="cartuplift-card-content">
                                  <div className="cartuplift-product-image">
                                    <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-4_large.png" alt="Example Product Title" />
                                  </div>
                                  <div className="cartuplift-product-info">
                                    <h4>Example Product Title</h4>
                                    <div className="cartuplift-product-variation">
                                      <select className="cartuplift-size-dropdown" title="Select size">
                                        <option>Size: M</option>
                                        <option>Size: L</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="cartuplift-product-actions">
                                    <div className="cartuplift-recommendation-price">£79.99</div>
                                    <button className="cartuplift-add-recommendation">{formSettings.addButtonText || 'Add'}</button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="cartuplift-recommendation-card">
                                <div className="cartuplift-card-content">
                                  <div className="cartuplift-product-image">
                                    <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-5_large.png" alt="Example Product Title" />
                                  </div>
                                  <div className="cartuplift-product-info">
                                    <h4>Example Product Title</h4>
                                    <div className="cartuplift-product-variation">
                                      <select className="cartuplift-size-dropdown" title="Select size">
                                        <option>Size: S</option>
                                        <option>Size: M</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="cartuplift-product-actions">
                                    <div className="cartuplift-recommendation-price">£199.99</div>
                                    <button className="cartuplift-add-recommendation">{formSettings.addButtonText || 'Add'}</button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="cartuplift-recommendation-card">
                                <div className="cartuplift-card-content">
                                  <div className="cartuplift-product-image">
                                    <img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-6_large.png" alt="Example Product Title" />
                                  </div>
                                  <div className="cartuplift-product-info">
                                    <h4>Example Product Title</h4>
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
                            </div>
                            <div className="cartuplift-carousel-controls">
                              <button className="cartuplift-carousel-nav" title="Previous" onClick={() => horizontalTrackRef.current?.scrollBy({ left: -(232 + 8), behavior: 'smooth' })}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                </svg>
                              </button>
                              <button className="cartuplift-carousel-nav" title="Next" onClick={() => horizontalTrackRef.current?.scrollBy({ left: (232 + 8), behavior: 'smooth' })}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {showProductSelector && (
                    <Modal
                      open
                      onClose={() => setShowProductSelector(false)}
                      title="Select products to recommend"
                      primaryAction={{
                        content: 'Save selection',
                        onAction: () => {
                          updateSetting('manualRecommendationProducts', selectedProducts.join(','));
                          setShowProductSelector(false);
                        },
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
                                const checked = selectedProducts.includes(p.id);
                                return (
                                  <div key={p.id} className="cartuplift-product-row">
                                    <Checkbox
                                      label=""
                                      checked={checked}
                                      onChange={(val: boolean) => {
                                        if (val) {
                                          const next = Array.from(new Set([...selectedProducts, p.id]));
                                          setSelectedProducts(next);
                                          // If product has variants, show variant selector
                                          if (p.variants && p.variants.length > 1) {
                                            setSelectedProductForVariants(p);
                                            setShowVariantSelector(true);
                                          }
                                        } else {
                                          const next = selectedProducts.filter((id: string) => id !== p.id);
                                          setSelectedProducts(next);
                                        }
                                      }}
                                    />
                                    <img className="cartuplift-product-thumb" src={p.image || ''} alt={p.imageAlt || p.title} />
                                    <div className="cartuplift-product-meta">
                                      <p className="cartuplift-product-title">{p.title}</p>
                                      <p className="cartuplift-product-sub">{p.handle}</p>
                                      {checked && p.variants && p.variants.length > 1 && (
                                        <div style={{ marginTop: '8px' }}>
                                          <Button 
                                            size="micro" 
                                            onClick={() => {
                                              setSelectedProductForVariants(p);
                                              setShowVariantSelector(true);
                                            }}
                                          >
                                            Select Variants ({p.variants.length} available)
                                          </Button>
                                        </div>
                                      )}
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

                  {/* Variant Selector Modal */}
                  {showVariantSelector && selectedProductForVariants && (
                    <Modal
                      open
                      onClose={() => {
                        setShowVariantSelector(false);
                        setSelectedProductForVariants(null);
                      }}
                      title={`Select variants for ${selectedProductForVariants.title}`}
                      primaryAction={{
                        content: 'Done',
                        onAction: () => {
                          setShowVariantSelector(false);
                          setSelectedProductForVariants(null);
                        },
                      }}
                    >
                      <Modal.Section>
                        <BlockStack gap="300">
                          <Text as="p">Choose which variants of this product to recommend:</Text>
                          {selectedProductForVariants.variants?.map((variant: any) => (
                            <Card key={variant.id}>
                              <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Checkbox
                                  label=""
                                  checked={selectedProducts.includes(variant.id)}
                                  onChange={(checked: boolean) => {
                                    if (checked) {
                                      const next = Array.from(new Set([...selectedProducts, variant.id]));
                                      setSelectedProducts(next);
                                    } else {
                                      const next = selectedProducts.filter((id: string) => id !== variant.id);
                                      setSelectedProducts(next);
                                    }
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <Text as="p" fontWeight="semibold">
                                    {variant.title !== 'Default Title' ? variant.title : 'Default'}
                                  </Text>
                                  <Text as="p" tone="subdued">
                                    ${variant.price} • SKU: {variant.sku || 'N/A'} • Stock: {variant.inventoryQuantity || 0}
                                  </Text>
                                </div>
                                {variant.image && (
                                  <img 
                                    src={variant.image} 
                                    alt={variant.title}
                                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                                  />
                                )}
                              </div>
                            </Card>
                          ))}
                        </BlockStack>
                      </Modal.Section>
                    </Modal>
                  )}

                  {/* Discount & Notes Section - Collapsed Button Like Real Cart */}
                  {(formSettings.enableDiscountCode || formSettings.enableNotes) && (
                    <div className="cartuplift-discount-section">
                      <button className="cartuplift-rainbow-card-button" type="button">
                        {formSettings.actionText || 'Add discount codes and notes'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="cartuplift-footer">
                  <div className="cartuplift-subtotal">
                    <span>Subtotal</span>
                    <span>{formatCurrency(474.00, shopCurrency?.currencyCode || 'USD')}</span>
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
                  {formSettings.stickyCartShowIcon !== false && renderCartIcon(formSettings.cartIcon)}
                  {formSettings.stickyCartShowCount !== false && (
                    <span className="cartuplift-sticky-count">5</span>
                  )}
                  {formSettings.stickyCartShowTotal !== false && (
                    <span className="cartuplift-sticky-total">{formatCurrency(474.00, shopCurrency?.currencyCode || 'USD')}</span>
                  )}
                </button>
              </div>
        </div>
      </div>

      {/* Gift Product Selector Modal */}
      {showGiftProductSelector && (
        <Modal
          open
          onClose={() => setShowGiftProductSelector(false)}
          title="Select Gift Product"
          primaryAction={{
            content: 'Done',
            onAction: () => {
              setShowGiftProductSelector(false);
            }
          }}
          secondaryActions={[{ content: 'Cancel', onAction: () => setShowGiftProductSelector(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <TextField
                label="Search products"
                value={giftProductSearchQuery}
                onChange={(v: string) => setGiftProductSearchQuery(v)}
                autoComplete="off"
                placeholder="Search by title, vendor, or tag"
              />
              {giftProductsLoading ? (
                <InlineStack align="center">
                  <Spinner accessibilityLabel="Loading products" />
                </InlineStack>
              ) : (
                <div className="cartuplift-product-selector-list">
                  {giftProductsError && (
                    <Banner tone="critical">{giftProductsError}</Banner>
                  )}
                  {giftProducts.length === 0 && (
                    <Text as="p" tone="subdued">No products found.</Text>
                  )}
                  {giftProducts.map((p: any) => {
                    const isSelected = currentGiftThreshold?.productId === p.id;
                    return (
                      <div key={p.id} className="cartuplift-product-row">
                        <Checkbox
                          label=""
                          checked={isSelected}
                          onChange={(val: boolean) => {
                            if (val && currentGiftThreshold) {
                              const giftThresholds = formSettings.giftThresholds ? JSON.parse(formSettings.giftThresholds) : [];
                              const updated = giftThresholds.map((t: any) => 
                                t.id === currentGiftThreshold.id ? { 
                                  ...t, 
                                  productId: p.id,
                                  productHandle: p.handle,
                                  productTitle: p.title,
                                  productImage: p.image,
                                  productImageAlt: p.imageAlt || p.title
                                } : t
                              );
                              updateSetting('giftThresholds', JSON.stringify(updated));
                              setShowGiftProductSelector(false);
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