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
  
  // Get shop currency information
  let shopCurrency = { currencyCode: 'USD', moneyFormat: undefined as undefined | string };
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
        moneyFormat: undefined,
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
    discountLinkText: String((settings as any).discountLinkText || '+ Got a promotion code?'),
    notesLinkText: String((settings as any).notesLinkText || '+ Add order notes'),
    backgroundColor: String(settings.backgroundColor) || "#ffffff",
    textColor: String(settings.textColor) || "#1A1A1A",
    buttonColor: String(settings.buttonColor) || "#000000",
    buttonTextColor: String(settings.buttonTextColor) || "#ffffff",
    recommendationsBackgroundColor: String(settings.recommendationsBackgroundColor) || "#ecebe3",
    shippingBarBackgroundColor: String(settings.shippingBarBackgroundColor) || "#f0f0f0",
    shippingBarColor: String(settings.shippingBarColor) || "#121212",
    recommendationLayout: String(settings.recommendationLayout) || "carousel",
    complementDetectionMode: String(settings.complementDetectionMode) || "automatic",
    manualRecommendationProducts: String(settings.manualRecommendationProducts) || "",
    progressBarMode: String(settings.progressBarMode) || "free-shipping",
    enableGiftGating: settings.enableGiftGating === 'true',
    giftProgressStyle: String(settings.giftProgressStyle) || "single-next",
    giftThresholds: String(settings.giftThresholds) || "[]",
    giftNoticeText: String((settings as any).giftNoticeText) || "Free gift added: {{product}} (worth {{amount}})",
    giftPriceText: String((settings as any).giftPriceText) || "FREE",
    enableTitleCaps: settings.enableTitleCaps === 'true',
  } as any;
  
  try {
    await saveSettings(shop, processedSettings);
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
    return moneyFormat.replace(/\{\{\s*amount\s*\}\}/g, numAmount.toFixed(2));
  }
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
    }).format(numAmount);
  } catch {
    return `${currencyCode} ${numAmount.toFixed(2)}`;
  }
}

export default function SettingsPage() {
  const { settings, shopCurrency } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const productsFetcher = useFetcher();

  const DEFAULT_SHIPPING_COLOR = '#121212';
  const DEFAULT_BACKGROUND_COLOR = '#ecebe3';

  const detectThemeColors = () => {
    const themeColors = {
      primary: DEFAULT_SHIPPING_COLOR,
      background: DEFAULT_BACKGROUND_COLOR,
    };
    try {
      if (typeof window !== 'undefined') {
        const computedStyle = getComputedStyle(document.documentElement);
        const primaryColorVars = [
          '--color-primary',
          '--color-accent',
          '--color-brand',
          '--color-button',
          '--color-theme',
          '--primary-color',
          '--accent-color',
        ];
        for (const varName of primaryColorVars) {
          const color = computedStyle.getPropertyValue(varName).trim();
          if (color && color !== '' && !color.includes('4CAF50') && color !== 'green') {
            themeColors.primary = color;
            break;
          }
        }
        const buttons = document.querySelectorAll('button, .btn, .button, [type="submit"]');
        for (const button of Array.from(buttons).slice(0, 5)) {
          const buttonStyle = getComputedStyle(button as Element);
          const bgColor = (buttonStyle as any).backgroundColor;
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent' &&
              !bgColor.includes('255, 255, 255') && !bgColor.includes('0, 0, 0') &&
              !bgColor.includes('76, 175, 80')) {
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

  const validateSettings = (settings: any) => {
    const validated = { ...settings };
    const themeColors = detectThemeColors();
    if (!validated.shippingBarColor || validated.shippingBarColor === '#4CAF50') {
      validated.shippingBarColor = themeColors.primary;
    }
    if (!validated.recommendationsBackgroundColor) {
      validated.recommendationsBackgroundColor = themeColors.background;
    }
    return validated;
  };

  const [formSettings, setFormSettings] = useState(validateSettings(settings));
  const themeColors = detectThemeColors();

  const resolveColor = (colorValue: string | undefined | null, fallback: string = '#000000'): string => {
    if (!colorValue) return fallback;
    if (colorValue.startsWith('var(')) {
      const fallbackMatch = colorValue.match(/var\([^,]+,\s*([^)]+)\)/);
      return fallbackMatch ? fallbackMatch[1].trim() : fallback;
    }
    return colorValue || fallback;
  };

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

  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    settings.manualRecommendationProducts ? settings.manualRecommendationProducts.split(',').filter(Boolean) : []
  );
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<any>(null);
  const [showVariantSelector, setShowVariantSelector] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);
  const [showGiftProductSelector, setShowGiftProductSelector] = useState(false);
  const [giftProductSearchQuery, setGiftProductSearchQuery] = useState("");
  const [giftProductsLoading, setGiftProductsLoading] = useState(false);
  const [giftProductsError, setGiftProductsError] = useState<string | null>(null);
  const [giftProducts, setGiftProducts] = useState<any[]>([]);
  const [currentGiftThreshold, setCurrentGiftThreshold] = useState<any>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

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
      progressBarMode: prev.progressBarMode || 'free-shipping',
      enableGiftGating: prev.enableGiftGating || false,
      giftProgressStyle: prev.giftProgressStyle || 'single-next',
      giftThresholds: prev.giftThresholds || '[]',
      giftNoticeText: prev.giftNoticeText || 'Free gift added: {{product}} (worth {{amount}})',
      giftPriceText: prev.giftPriceText || 'FREE',
    }));
  }, []);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && (fetcher.data as any)?.success) {
      setShowSuccessBanner(true);
      const timer = setTimeout(() => setShowSuccessBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    const handleScroll = () => {
      if (previewRef.current) {
        const scrollTop = window.scrollY;
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
    setFormSettings((prev: any) => ({ ...prev, [key]: value }));
  };

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
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProductSelector, productSearchQuery]);

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
    return () => clearTimeout(timeout);
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
        if (showProductSelector) setProducts(Array.isArray(data?.products) ? data.products : []);
        if (showGiftProductSelector) setGiftProducts(Array.isArray(data?.products) ? data.products : []);
      }
      if (showProductSelector) setProductsLoading(false);
      if (showGiftProductSelector) setGiftProductsLoading(false);
    }
  }, [productsFetcher.state, productsFetcher.data, showProductSelector, showGiftProductSelector]);

  const threshold = (formSettings.freeShippingThreshold || 100) * 100;
  const currentTotal = 1500;
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
/* Layout */
.cartuplift-settings-layout { display: grid; grid-template-columns: 1fr 420px; gap: 24px; align-items: start; }
.cartuplift-settings-column { min-width: 0; }
.cartuplift-preview-column { position: sticky; top: 100px; align-self: start; }

@media (max-width: 1200px) {
  .cartuplift-settings-layout { grid-template-columns: 1fr 380px; gap: 20px; }
}
@media (max-width: 992px) {
  .cartuplift-settings-layout { grid-template-columns: 1fr; }
  .cartuplift-preview-column { position: relative; top: 0; }
}

/* Preview container */
.cartuplift-preview-container { background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
.cartuplift-preview-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #eee; }
.cartuplift-cart-title { margin: 0; font-size: 14px; letter-spacing: 0.08em; font-weight: 700; }
.cartuplift-close { background: transparent; border: 0; padding: 6px; cursor: not-allowed; color: #999; }
.cartuplift-icon-large { width: 22px; height: 22px; }

/* Shipping bar */
.cartuplift-shipping-bar { padding: 12px 16px; }
.cartuplift-shipping-progress { height: 8px; width: 100%; background: #f1f1f1; border-radius: 999px; overflow: hidden; }
.cartuplift-shipping-progress-fill { height: 100%; background: var(--cartuplift-shipping-color, #121212); border-radius: 999px; transition: width 200ms ease; }

/* Content */
.cartuplift-content-wrapper { padding: 12px 16px 16px; }
.cartuplift-items { display: flex; flex-direction: column; gap: 12px; }
.cartuplift-item { display: grid; grid-template-columns: 64px 1fr auto; gap: 12px; align-items: start; }
.cartuplift-item-first { padding-top: 4px; }
.cartuplift-item-image img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; background: #fafafa; border: 1px solid #eee; }
.cartuplift-item-info { display: flex; flex-direction: column; gap: 6px; }
.cartuplift-item-title { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.3; }
.cartuplift-item-variant { font-size: 12px; color: #666; }
.cartuplift-quantity { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #e5e5e5; border-radius: 8px; padding: 2px 6px; width: fit-content; }
.cartuplift-qty-minus, .cartuplift-qty-plus { background: #f6f6f6; border: 0; border-radius: 6px; width: 22px; height: 22px; line-height: 22px; text-align: center; cursor: not-allowed; color: #888; }
.cartuplift-qty-display { min-width: 14px; text-align: center; font-size: 13px; }
.cartuplift-item-price-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.cartuplift-item-price { font-weight: 700; font-size: 14px; }
.cartuplift-item-remove { background: transparent; border: 0; padding: 6px; cursor: not-allowed; color: #999; }
.cartuplift-icon-medium { width: 18px; height: 18px; }

/* Recommendations */
.cartuplift-recommendations { margin-top: 10px; border-top: 1px dashed #eee; padding-top: 12px; }
.cartuplift-recommendations-header { display: flex; align-items: center; justify-content: space-between; }
.cartuplift-recommendations-title { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; }
.cartuplift-recommendations-toggle { background: transparent; border: 0; padding: 6px; cursor: not-allowed; color: #999; }
.cartuplift-icon-small { width: 16px; height: 16px; }
.cartuplift-recommendations.is-horizontal { overflow: hidden; }

/* Footer */
.cartuplift-footer { border-top: 1px solid #eee; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
.cartuplift-subtotal { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 600; }
.cartuplift-checkout-btn { width: 100%; background: #111; color: #fff; border: 0; border-radius: 8px; font-weight: 700; height: 44px; cursor: not-allowed; }
.cartuplift-express-checkout { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cartuplift-paypal-btn { background: #FFC439; border: 0; border-radius: 8px; height: 40px; cursor: not-allowed; display: flex; align-items: center; justify-content: center; }
.cartuplift-paypal-logo { height: 18px; }
.cartuplift-shoppay-btn { background: #5a31f4; color: #fff; border: 0; border-radius: 8px; height: 40px; font-weight: 700; cursor: not-allowed; }

/* Sticky cart preview */
.cartuplift-sticky-preview { position: fixed; z-index: 5; }
.cartuplift-sticky-preview.bottom-right { bottom: 20px; right: 20px; }
.cartuplift-sticky-preview.bottom-left { bottom: 20px; left: 20px; }
.cartuplift-sticky-preview.bottom-center { bottom: 20px; left: 50%; transform: translateX(-50%); }
.cartuplift-sticky-preview.top-right { top: 20px; right: 20px; }
.cartuplift-sticky-preview.top-left { top: 20px; left: 20px; }
.cartuplift-sticky-preview.right-middle { top: 50%; right: 20px; transform: translateY(-50%); }
.cartuplift-sticky-preview.left-middle { top: 50%; left: 20px; transform: translateY(-50%); }
.cartuplift-sticky-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--cartuplift-sticky-bg, #000); color: var(--cartuplift-sticky-fg, #fff); border: 0; height: 44px; padding: 0 14px; border-radius: 999px; box-shadow: 0 4px 18px rgba(0,0,0,0.15); cursor: not-allowed; }
.cartuplift-sticky-icon { width: 20px; height: 20px; }
.cartuplift-sticky-count { background: #ff4444; color: #fff; font-weight: 700; min-width: 18px; height: 18px; border-radius: 999px; text-align: center; font-size: 12px; line-height: 18px; padding: 0 6px; }
.cartuplift-sticky-total { font-weight: 700; }

/* Product selector modal */
.cartuplift-product-selector-list { display: flex; flex-direction: column; gap: 8px; max-height: 55vh; overflow: auto; }
.cartuplift-product-row { display: grid; grid-template-columns: auto 48px 1fr; align-items: center; gap: 12px; padding: 8px; border: 1px solid #eee; border-radius: 8px; }
.cartuplift-product-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; background: #fafafa; border: 1px solid #eee; }
.cartuplift-product-title { margin: 0; font-weight: 600; }
.cartuplift-product-sub { margin: 0; color: #666; font-size: 12px; }
`
        }}
      />

      <div className="cartuplift-settings-layout">
        {showSuccessBanner && (
          <div className="cartuplift-success-banner">
            <Banner tone="success">Settings saved successfully!</Banner>
          </div>
        )}

        <div className="cartuplift-settings-column">
          <BlockStack gap="500">
            <Card padding="300">
              <Text as="p" variant="bodyMd" tone="subdued" fontWeight="bold">
                Settings • Configure your cart optimization features
              </Text>
            </Card>

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

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🎯 Customer Incentives</Text>
                <FormLayout>
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h3">Incentive Type</Text>
                    <Text variant="bodySm" as="p" tone="subdued">Choose what motivates your customers to spend more</Text>
                    <BlockStack gap="300">
                      <BlockStack gap="100">
                        <RadioButton
                          label="Free Shipping Only"
                          helpText="Show progress towards free shipping threshold"
                          name="progressBarMode"
                          checked={(formSettings.progressBarMode || 'free-shipping') === 'free-shipping'}
                          onChange={() => updateSetting('progressBarMode', 'free-shipping')}
                        />
                        <Text variant="bodySm" as="p" tone="subdued">
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
                        <Text variant="bodySm" as="p" tone="subdued">
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
                        <Text variant="bodySm" as="p" tone="subdued">
                          Unified progress bar combining free shipping and gift thresholds
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </BlockStack>
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
                                <Text variant="bodySm" as="p" tone="subdued">Show separate progress bars for each threshold</Text>
                              </BlockStack>
                              <BlockStack gap="100">
                                <RadioButton
                                  label="Single Bar with All Milestones"
                                  id="single-multi"
                                  name="giftProgressStyle"
                                  checked={(formSettings.giftProgressStyle || 'single-next') === 'single-multi'}
                                  onChange={() => updateSetting('giftProgressStyle', 'single-multi')}
                                />
                                <Text variant="bodySm" as="p" tone="subdued">One progress bar showing all reward milestones</Text>
                              </BlockStack>
                              <BlockStack gap="100">
                                <RadioButton
                                  label="Single Bar with Next Goal Focus"
                                  id="single-next"
                                  name="giftProgressStyle"
                                  checked={(formSettings.giftProgressStyle || 'single-next') === 'single-next'}
                                  onChange={() => updateSetting('giftProgressStyle', 'single-next')}
                                />
                                <Text variant="bodySm" as="p" tone="subdued">Focus on the next achievable reward</Text>
                              </BlockStack>
                            </BlockStack>
                          </BlockStack>
                          <BlockStack gap="200">
                            <Text variant="headingSm" as="h3">Gift Thresholds</Text>
                            <Text variant="bodySm" as="p" tone="subdued">Set spending thresholds to unlock gifts, discounts, or free products</Text>
                            <BlockStack gap="200" align="center">
                              <Button onClick={addGiftThreshold} variant="secondary">Add Gift Threshold</Button>
                            </BlockStack>
                            <BlockStack gap="300">
                              {(() => {
                                const giftThresholds = formSettings.giftThresholds ? JSON.parse(formSettings.giftThresholds) : [];
                                if (giftThresholds.length === 0) {
                                  return (
                                    <Text variant="bodySm" as="p" tone="subdued" alignment="center">
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
                                            <Button onClick={() => removeGiftThreshold(threshold.id)} variant="tertiary" tone="critical" size="micro">Remove</Button>
                                          </InlineStack>
                                          <InlineStack gap="300">
                                            <TextField
                                              label="Spending Amount"
                                              type="number"
                                              value={threshold.amount?.toString() || ''}
                                              onChange={(value) => {
                                                const updated = giftThresholds.map((t: any) => t.id === threshold.id ? { ...t, amount: parseInt(value) || 0 } : t);
                                                updateSetting('giftThresholds', JSON.stringify(updated));
                                              }}
                                              prefix={shopCurrency?.currencyCode === 'GBP' ? '£' : shopCurrency?.currencyCode === 'EUR' ? '€' : '$'}
                                              autoComplete="off"
                                            />
                                            <Select
                                              label="Reward Type"
                                              options={[{ label: 'Free Product', value: 'product' }, { label: 'Percentage Discount', value: 'discount_percentage' }, { label: 'Discount Code', value: 'discount_store' }]}
                                              value={threshold.type || 'product'}
                                              onChange={(value) => {
                                                const updated = giftThresholds.map((t: any) => t.id === threshold.id ? { ...t, type: value } : t);
                                                updateSetting('giftThresholds', JSON.stringify(updated));
                                              }}
                                            />
                                          </InlineStack>
                                          <TextField
                                            label="Gift Title"
                                            value={threshold.title || ''}
                                            onChange={(value) => {
                                              const updated = giftThresholds.map((t: any) => t.id === threshold.id ? { ...t, title: value } : t);
                                              updateSetting('giftThresholds', JSON.stringify(updated));
                                            }}
                                            placeholder="e.g., Free Sample Pack"
                                            autoComplete="off"
                                          />
                                          <TextField
                                            label="Description"
                                            value={threshold.description || ''}
                                            onChange={(value) => {
                                              const updated = giftThresholds.map((t: any) => t.id === threshold.id ? { ...t, description: value } : t);
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
                                                      <img src={threshold.productImage} alt={threshold.productImageAlt || threshold.productTitle} className="cartuplift-gift-product-image" />
                                                    </div>
                                                  )}
                                                  <div className="cartuplift-product-info">
                                                    <Text variant="bodyMd" as="p" fontWeight="medium">{threshold.productTitle}</Text>
                                                  </div>
                                                  <Button variant="plain" onClick={() => { setCurrentGiftThreshold(threshold); setShowGiftProductSelector(true); }}>Change Product</Button>
                                                </div>
                                              ) : (
                                                <Button onClick={() => { setCurrentGiftThreshold(threshold); setShowGiftProductSelector(true); }}>Select Gift Product</Button>
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
                                                  const updated = giftThresholds.map((t: any) => t.id === threshold.id ? { ...t, discountAmount: parseFloat(value) || 0 } : t);
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
                                                const updated = giftThresholds.map((t: any) => t.id === threshold.id ? { ...t, discountCode: value } : t);
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
                              <Text variant="bodySm" as="p" tone="subdued">
                                <strong>You can use:</strong><br/>
                                • <code>{'{{amount}}'}</code> – total savings (e.g. "£115.00")<br/>
                                • <code>{'{{product}}'}</code> – gift product names (comma-separated if multiple)
                              </Text>
                              <Text variant="bodySm" as="p" tone="subdued"><strong>Fallback (if left blank):</strong> "Free gift included"</Text>
                            </BlockStack>
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
                              <Text variant="bodySm" as="p" tone="subdued"><strong>Default:</strong> "FREE" | <strong>Fallback (if left blank):</strong> "Gift"</Text>
                            </BlockStack>
                          </BlockStack>
                        </BlockStack>
                      )}
                    </BlockStack>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🎨 Appearance & Style</Text>
                <FormLayout>
                  <Select label="Cart Icon Style" options={cartIconOptions} value={formSettings.cartIcon} onChange={(value) => updateSetting("cartIcon", value)} helpText="Choose the icon style for your cart" />
                  <div className="cartuplift-appearance-row">
                    <div>
                      <Text variant="headingMd" as="h3">Button Color</Text>
                      <input type="color" value={resolveColor(formSettings.buttonColor, '#000000')} onChange={(e) => updateSetting("buttonColor", e.target.value)} className="cartuplift-color-input-full-width" title={resolveColor(formSettings.buttonColor, '#000000')} aria-label={`Button color: ${resolveColor(formSettings.buttonColor, '#000000')}`} />
                    </div>
                    <div>
                      <Text variant="headingMd" as="h3">Button Text</Text>
                      <input type="color" value={resolveColor(formSettings.buttonTextColor, '#ffffff')} onChange={(e) => updateSetting("buttonTextColor", e.target.value)} className="cartuplift-color-input-full-width" title={resolveColor(formSettings.buttonTextColor, '#ffffff')} aria-label={`Button text color: ${resolveColor(formSettings.buttonTextColor, '#ffffff')}`} />
                    </div>
                    <div>
                      <Text variant="headingMd" as="h3">Text Color</Text>
                      <input type="color" value={formSettings.textColor || '#1A1A1A'} onChange={(e) => updateSetting("textColor", e.target.value)} className="cartuplift-color-input-full-width" title={formSettings.textColor || '#1A1A1A'} aria-label={`Text color: ${formSettings.textColor || '#1A1A1A'}`} />
                    </div>
                  </div>
                  <Checkbox label="Show only on cart page" checked={formSettings.showOnlyOnCartPage} onChange={(value) => updateSetting("showOnlyOnCartPage", value)} helpText="Limit cart uplift features to cart page only (disables recommendations and upsells on other pages)" />
                  <Checkbox label="Show Product Titles in Caps" checked={formSettings.enableTitleCaps || false} onChange={(value) => updateSetting("enableTitleCaps", value)} helpText="Display product titles in UPPERCASE for both cart items and recommendations" />
                </FormLayout>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">🛒 Sticky Cart</Text>
                <FormLayout>
                  <Checkbox label="Enable Sticky Cart" checked={formSettings.enableStickyCart} onChange={(checked) => updateSetting("enableStickyCart", checked)} helpText="Keep the cart accessible as users browse your store" />
                  {formSettings.enableStickyCart && (
                    <>
                      <InlineStack gap="400">
                        <Select label="Cart Position" options={cartPositionOptions} value={formSettings.cartPosition} onChange={(value) => updateSetting("cartPosition", value)} helpText="Where the cart button appears on your store" />
                        <TextField label="Border Radius (px)" type="number" value={String(formSettings.stickyCartBorderRadius || 25)} onChange={(value) => updateSetting("stickyCartBorderRadius", parseInt(value) || 25)} helpText="Controls how rounded the sticky cart button appears (0 = square, 25 = rounded)" suffix="px" autoComplete="off" />
                      </InlineStack>
                      <div style={{ marginTop: '16px' }}>
                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h3">Display Options</Text>
                          <InlineStack gap="400">
                            <Checkbox label="Show Cart Icon" checked={formSettings.stickyCartShowIcon !== false} onChange={(checked) => updateSetting("stickyCartShowIcon", checked)} />
                            <Checkbox label="Show Item Count" checked={formSettings.stickyCartShowCount !== false} onChange={(checked) => updateSetting("stickyCartShowCount", checked)} />
                            <Checkbox label="Show Total Price" checked={formSettings.stickyCartShowTotal !== false} onChange={(checked) => updateSetting("stickyCartShowTotal", checked)} />
                          </InlineStack>
                        </BlockStack>
                      </div>
                      <div style={{ marginTop: '16px' }}>
                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h3">Colors & Styling</Text>
                          <InlineStack gap="300">
                            <div className="cartuplift-color-field">
                              <Text variant="bodyMd" as="p">Background Color</Text>
                              <input type="color" value={resolveColor(formSettings.stickyCartBackgroundColor, '#000000')} onChange={(e) => updateSetting("stickyCartBackgroundColor", e.target.value)} className="cartuplift-color-input" title="Sticky cart background color" aria-label="Choose sticky cart background color" />
                            </div>
                            <div className="cartuplift-color-field">
                              <Text variant="bodyMd" as="p">Text Color</Text>
                              <input type="color" value={resolveColor(formSettings.stickyCartTextColor, '#ffffff')} onChange={(e) => updateSetting("stickyCartTextColor", e.target.value)} className="cartuplift-color-input" title="Sticky cart text color" aria-label="Choose sticky cart text color" />
                            </div>
                            <div className="cartuplift-color-field">
                              <Text variant="bodyMd" as="p">Count Badge Color</Text>
                              <input type="color" value={resolveColor(formSettings.stickyCartCountBadgeColor, '#ff4444')} onChange={(e) => updateSetting("stickyCartCountBadgeColor", e.target.value)} className="cartuplift-color-input" title="Count badge color" aria-label="Choose count badge color" />
                            </div>
                            <div className="cartuplift-color-field">
                              <Text variant="bodyMd" as="p">Count Badge Text</Text>
                              <input type="color" value={resolveColor(formSettings.stickyCartCountBadgeTextColor, '#ffffff')} onChange={(e) => updateSetting("stickyCartCountBadgeTextColor", e.target.value)} className="cartuplift-color-input" title="Count badge text color" aria-label="Choose count badge text color" />
                            </div>
                          </InlineStack>
                        </BlockStack>
                      </div>
                    </>
                  )}
                </FormLayout>
              </BlockStack>
            </Card>

            {formSettings.enableRecommendations && (
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">🎯 Smart Recommendations</Text>
                  <FormLayout>
                    <Select label="Layout Style" options={recommendationLayoutOptions} value={formSettings.recommendationLayout} onChange={(value) => updateSetting("recommendationLayout", value)} helpText="How recommendations are displayed in the cart" />
                    <TextField label="Maximum Products to Show" type="number" value={String(formSettings.maxRecommendations)} onChange={(value) => updateSetting("maxRecommendations", parseInt(value) || 4)} helpText="We recommend 2–4 cards to keep it focused. You can choose any number." autoComplete="off" />
                    <TextField label="Section Title" value={formSettings.recommendationsTitle} onChange={(value) => updateSetting("recommendationsTitle", value)} helpText="Header text for the recommendations section" placeholder="You might also like" autoComplete="off" />
                    <div>
                      <Text variant="headingMd" as="h3">Background Color</Text>
                      <input type="color" value={(formSettings as any).recommendationsBackgroundColor || '#ecebe3'} onChange={(e) => updateSetting("recommendationsBackgroundColor", e.target.value)} className="cartuplift-color-input-full-width" title={(formSettings as any).recommendationsBackgroundColor || '#ecebe3'} aria-label={`Recommendations background: ${(formSettings as any).recommendationsBackgroundColor || '#ecebe3'}`} />
                    </div>
                    <TextField label="Add Button Text" value={formSettings.addButtonText || 'Add'} onChange={(value) => updateSetting("addButtonText", value)} helpText="Text for recommendation Add buttons" placeholder="Add" autoComplete="off" />
                    <Select label="Recommendation Mode (AI vs. Manual)" options={complementDetectionModeOptions} value={formSettings.complementDetectionMode} onChange={(value) => updateSetting("complementDetectionMode", value)} helpText="Choose how products are picked. AI analyzes sales patterns; Manual lets you hand-pick." />
                    {(formSettings.complementDetectionMode === 'manual' || formSettings.complementDetectionMode === 'hybrid') && (
                      <div className="cartuplift-manual-rec-section">
                        <Text variant="headingSm" as="h3">{formSettings.complementDetectionMode === 'hybrid' ? '🔀 Manual Product Selection (for Hybrid)' : '🛠️ Manual Product Selection'}</Text>
                        <div className="cartuplift-manual-rec-info">
                          {formSettings.complementDetectionMode === 'hybrid' && (<Text variant="bodyMd" as="p" tone="subdued">Select products to mix with AI recommendations</Text>)}
                          <InlineStack gap="200" align="start">
                            <Button onClick={() => setShowProductSelector(true)}>Select products</Button>
                            {selectedProducts.length > 0 && (<Badge tone="success">{`${selectedProducts.length} selected`}</Badge>)}
                          </InlineStack>
                        </div>
                      </div>
                    )}
                  </FormLayout>
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">⚡ Additional Features</Text>
                <Text as="p" tone="subdued">Admin Settings UI version: links-2025-09-10-2</Text>
                <FormLayout>
                  <Checkbox label="Enable Discount Code Field" checked={formSettings.enableDiscountCode} onChange={(value) => updateSetting("enableDiscountCode", value)} helpText="Allow customers to apply discount codes in cart" />
                  {formSettings.enableDiscountCode && (
                    <TextField label="Promotion Link Text" value={formSettings.discountLinkText || '+ Got a promotion code?'} onChange={(value) => updateSetting('discountLinkText', value)} helpText="Inline link label shown on your online store to open the discount code modal" autoComplete="off" />
                  )}
                  <Checkbox label="Enable Order Notes" checked={formSettings.enableNotes} onChange={(value) => updateSetting("enableNotes", value)} helpText="Let customers add special instructions" />
                  {formSettings.enableNotes && (
                    <TextField label="Notes Link Text" value={formSettings.notesLinkText || '+ Add order notes'} onChange={(value) => updateSetting('notesLinkText', value)} helpText="Inline link label shown on your online store to open the order notes modal" autoComplete="off" />
                  )}
                  {(formSettings.enableDiscountCode || formSettings.enableNotes) && (<Text as="p" tone="subdued">Inline links are used on the online store. The old full-width button is deprecated.</Text>)}
                </FormLayout>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>

        <div className="cartuplift-preview-column" ref={previewRef}>
          <div className="cartuplift-preview-container">
            <div className="cartuplift-preview-header">
              <h2 className="cartuplift-cart-title">CART (5)</h2>
              <button className="cartuplift-close" aria-label="Close cart">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-large">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {(formSettings.progressBarMode === 'free-shipping' || !formSettings.progressBarMode) && (
              <div key="free-shipping-preview" className="cartuplift-shipping-bar">
                <div className="cartuplift-shipping-progress">
                  <div className="cartuplift-shipping-progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <div className="cartuplift-content-wrapper">
              <div className="cartuplift-items">
                <div className="cartuplift-item cartuplift-item-first">
                  <div className="cartuplift-item-image"><img src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png" alt="Example Product Title" /></div>
                  <div className="cartuplift-item-info">
                    <h4 className="cartuplift-item-title">Example Product Title</h4>
                    <div className="cartuplift-item-variant">Color: Blue</div>
                    <div className="cartuplift-item-variant">Size: L</div>
                    <div className="cartuplift-quantity"><button className="cartuplift-qty-minus">−</button><span className="cartuplift-qty-display">1</span><button className="cartuplift-qty-plus">+</button></div>
                  </div>
                  <div className="cartuplift-item-price-actions">
                    <div className="cartuplift-item-price">{formatCurrency(19.99, shopCurrency?.currencyCode || 'USD')}</div>
                    <button className="cartuplift-item-remove" title="Remove item">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-medium">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.111 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              {formSettings.enableRecommendations && (
                <div className={`cartuplift-recommendations ${formSettings.recommendationLayout === 'carousel' ? 'is-horizontal' : ''}`}>
                  <div className="cartuplift-recommendations-header">
                    <h3 className="cartuplift-recommendations-title">{formSettings.recommendationsTitle || 'RECOMMENDED FOR YOU'}</h3>
                    <button className="cartuplift-recommendations-toggle" title="Toggle recommendations">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cartuplift-icon-small">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="cartuplift-footer">
              <div className="cartuplift-subtotal"><span>Subtotal</span><span>{formatCurrency(474.00, shopCurrency?.currencyCode || 'USD')}</span></div>
              <button className="cartuplift-checkout-btn">{formSettings.checkoutButtonText || 'CHECKOUT'}</button>
              {formSettings.enableExpressCheckout && (
                <div className="cartuplift-express-checkout">
                  <button className="cartuplift-paypal-btn"><img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" alt="PayPal" className="cartuplift-paypal-logo" /></button>
                  <button className="cartuplift-shoppay-btn">Shop Pay</button>
                </div>
              )}
            </div>
          </div>
          <div className={`cartuplift-sticky-preview ${formSettings.cartPosition || 'bottom-right'}`}>
            <button className="cartuplift-sticky-btn">
              {formSettings.stickyCartShowIcon !== false && renderCartIcon(formSettings.cartIcon)}
              {formSettings.stickyCartShowCount !== false && (<span className="cartuplift-sticky-count">5</span>)}
              {formSettings.stickyCartShowTotal !== false && (<span className="cartuplift-sticky-total">{formatCurrency(474.00, shopCurrency?.currencyCode || 'USD')}</span>)}
            </button>
          </div>
        </div>
      </div>

      {showProductSelector && (
        <Modal open onClose={() => setShowProductSelector(false)} title="Select products to recommend" primaryAction={{ content: 'Save selection', onAction: () => { updateSetting('manualRecommendationProducts', selectedProducts.join(',')); setShowProductSelector(false); }, }} secondaryActions={[{ content: 'Cancel', onAction: () => setShowProductSelector(false) }]}>
          <Modal.Section>
            <BlockStack gap="300">
              <TextField label="Search products" value={productSearchQuery} onChange={(v: string) => setProductSearchQuery(v)} autoComplete="off" placeholder="Search by title, vendor, or tag" />
              {productsLoading ? (
                <InlineStack align="center"><Spinner accessibilityLabel="Loading products" /></InlineStack>
              ) : (
                <div className="cartuplift-product-selector-list">
                  {productsError && (<Banner tone="critical">{productsError}</Banner>)}
                  {products.length === 0 && (<Text as="p" tone="subdued">No products found.</Text>)}
                  {products.map((p: any) => {
                    const checked = selectedProducts.includes(p.id);
                    return (
                      <div key={p.id} className="cartuplift-product-row">
                        <Checkbox label="" checked={checked} onChange={(val: boolean) => {
                          if (val) {
                            const next = Array.from(new Set([...selectedProducts, p.id]));
                            setSelectedProducts(next);
                            if (p.variants && p.variants.length > 1) { setSelectedProductForVariants(p); setShowVariantSelector(true); }
                          } else {
                            const next = selectedProducts.filter((id: string) => id !== p.id);
                            setSelectedProducts(next);
                          }
                        }} />
                        <img className="cartuplift-product-thumb" src={p.image || ''} alt={p.imageAlt || p.title} />
                        <div className="cartuplift-product-meta">
                          <p className="cartuplift-product-title">{p.title}</p>
                          <p className="cartuplift-product-sub">{p.handle}</p>
                          {checked && p.variants && p.variants.length > 1 && (
                            <div style={{ marginTop: '8px' }}>
                              <Button size="micro" onClick={() => { setSelectedProductForVariants(p); setShowVariantSelector(true); }}>Select Variants ({p.variants.length} available)</Button>
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

      {showVariantSelector && selectedProductForVariants && (
        <Modal open onClose={() => { setShowVariantSelector(false); setSelectedProductForVariants(null); }} title={`Select variants for ${selectedProductForVariants.title}`} primaryAction={{ content: 'Done', onAction: () => { setShowVariantSelector(false); setSelectedProductForVariants(null); } }}>
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p">Choose which variants of this product to recommend:</Text>
              {selectedProductForVariants.variants?.map((variant: any) => (
                <Card key={variant.id}>
                  <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Checkbox label="" checked={selectedProducts.includes(variant.id)} onChange={(checked: boolean) => {
                      if (checked) {
                        const next = Array.from(new Set([...selectedProducts, variant.id]));
                        setSelectedProducts(next);
                      } else {
                        const next = selectedProducts.filter((id: string) => id !== variant.id);
                        setSelectedProducts(next);
                      }
                    }} />
                    <div style={{ flex: 1 }}>
                      <Text as="p" fontWeight="semibold">{variant.title !== 'Default Title' ? variant.title : 'Default'}</Text>
                      <Text as="p" tone="subdued">${variant.price} • SKU: {variant.sku || 'N/A'} • Stock: {variant.inventoryQuantity || 0}</Text>
                    </div>
                    {variant.image && (<img src={variant.image} alt={variant.title} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />)}
                  </div>
                </Card>
              ))}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

      {showGiftProductSelector && (
        <Modal open onClose={() => setShowGiftProductSelector(false)} title="Select Gift Product" primaryAction={{ content: 'Done', onAction: () => { setShowGiftProductSelector(false); } }} secondaryActions={[{ content: 'Cancel', onAction: () => setShowGiftProductSelector(false) }]}>
          <Modal.Section>
            <BlockStack gap="300">
              <TextField label="Search products" value={giftProductSearchQuery} onChange={(v: string) => setGiftProductSearchQuery(v)} autoComplete="off" placeholder="Search by title, vendor, or tag" />
              {giftProductsLoading ? (
                <InlineStack align="center"><Spinner accessibilityLabel="Loading products" /></InlineStack>
              ) : (
                <div className="cartuplift-product-selector-list">
                  {giftProductsError && (<Banner tone="critical">{giftProductsError}</Banner>)}
                  {giftProducts.length === 0 && (<Text as="p" tone="subdued">No products found.</Text>)}
                  {giftProducts.map((p: any) => {
                    const isSelected = currentGiftThreshold?.productId === p.id;
                    return (
                      <div key={p.id} className="cartuplift-product-row">
                        <Checkbox label="" checked={isSelected} onChange={(val: boolean) => {
                          if (val && currentGiftThreshold) {
                            const giftThresholds = formSettings.giftThresholds ? JSON.parse(formSettings.giftThresholds) : [];
                            const updated = giftThresholds.map((t: any) => t.id === currentGiftThreshold.id ? { ...t, productId: p.id, productHandle: p.handle, productTitle: p.title, productImage: p.image, productImageAlt: p.imageAlt || p.title } : t);
                            updateSetting('giftThresholds', JSON.stringify(updated));
                            setShowGiftProductSelector(false);
                          }
                        }} />
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