import db from "../db.server";

// Migration helper to convert old layout values to new ones
function migrateRecommendationLayout(oldLayout: string): string {
  const migrationMap: { [key: string]: string } = {
    'horizontal': 'carousel',
    'vertical': 'list',
    'row': 'carousel',
    'column': 'list',
  };
  
  return migrationMap[oldLayout] || oldLayout;
}

export interface SettingsData {
  // Core Features
  enableApp: boolean;
  enableStickyCart: boolean;
  showOnlyOnCartPage: boolean;
  autoOpenCart: boolean;
  enableFreeShipping: boolean;
  freeShippingThreshold: number;
  
  // Advanced Features
  enableRecommendations: boolean;
  enableAddons: boolean;
  enableDiscountCode: boolean;
  enableNotes: boolean;
  enableExpressCheckout: boolean;
  enableAnalytics: boolean;
  enableTitleCaps: boolean;
  
  // Cart Behavior & Position
  cartPosition: string;
  cartIcon: string;
  
  // Messages & Text
  freeShippingText: string;
  freeShippingAchievedText: string;
  recommendationsTitle: string;
  actionText: string;
  addButtonText: string;
  checkoutButtonText: string;
  applyButtonText: string;
  discountLinkText: string;
  notesLinkText: string;
  
  
  // Appearance
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  recommendationsBackgroundColor: string;
  shippingBarBackgroundColor: string;
  shippingBarColor: string;
  
  // Recommendation Settings
  recommendationLayout: string;
  maxRecommendations: number;
  complementDetectionMode: string;
  manualRecommendationProducts: string;
  
  // Gift Gating Settings
  enableGiftGating: boolean;
  progressBarMode: string;
  giftProgressStyle: string;
  giftThresholds: string;

  // Theme embed status (updated by storefront heartbeat)
  themeEmbedEnabled?: boolean;
  themeEmbedLastSeen?: string; // ISO string
}

export async function getSettings(shop: string): Promise<SettingsData> {
  try {
  const settings = await (db as any).settings.findUnique({
      where: { shop }
    });

    if (!settings) {
      // Return default settings if none exist
      return getDefaultSettings();
    }

    return {
      enableApp: settings.enableApp,
      enableStickyCart: settings.enableStickyCart,
      showOnlyOnCartPage: settings.showOnlyOnCartPage,
      autoOpenCart: (settings as any).autoOpenCart ?? true,
      enableFreeShipping: settings.enableFreeShipping,
      freeShippingThreshold: settings.freeShippingThreshold,
      enableRecommendations: settings.enableRecommendations,
      enableAddons: settings.enableAddons,
      enableDiscountCode: settings.enableDiscountCode,
      enableNotes: settings.enableNotes,
      enableExpressCheckout: settings.enableExpressCheckout,
      enableAnalytics: settings.enableAnalytics,
      enableTitleCaps: (settings as any).enableTitleCaps ?? false,
      cartPosition: settings.cartPosition,
      cartIcon: settings.cartIcon,
      freeShippingText: settings.freeShippingText,
      freeShippingAchievedText: settings.freeShippingAchievedText,
      recommendationsTitle: settings.recommendationsTitle,
      actionText: settings.actionText || "Add discount code",
      addButtonText: (settings as any).addButtonText ?? "Add",
      checkoutButtonText: (settings as any).checkoutButtonText ?? "CHECKOUT",
      applyButtonText: (settings as any).applyButtonText ?? "Apply",
  discountLinkText: (settings as any).discountLinkText ?? "+ Got a promotion code?",
  notesLinkText: (settings as any).notesLinkText ?? "+ Add order notes",
      
      backgroundColor: settings.backgroundColor,
      textColor: settings.textColor,
      buttonColor: settings.buttonColor,
      buttonTextColor: (settings as any).buttonTextColor ?? "#ffffff",
      recommendationsBackgroundColor: (settings as any).recommendationsBackgroundColor ?? "#ecebe3",
      shippingBarBackgroundColor: (settings as any).shippingBarBackgroundColor ?? "#f0f0f0",
      shippingBarColor: (settings as any).shippingBarColor ?? "#121212",
      recommendationLayout: migrateRecommendationLayout(settings.recommendationLayout),
      maxRecommendations: settings.maxRecommendations,
      complementDetectionMode: (settings as any).complementDetectionMode ?? "automatic",
      manualRecommendationProducts: (settings as any).manualRecommendationProducts ?? "",
      enableGiftGating: (settings as any).enableGiftGating ?? false,
      progressBarMode: (settings as any).progressBarMode ?? "free-shipping",
      giftProgressStyle: (settings as any).giftProgressStyle ?? "single-next",
  giftThresholds: (settings as any).giftThresholds ?? "[]",
  themeEmbedEnabled: (settings as any).themeEmbedEnabled ?? false,
  themeEmbedLastSeen: (settings as any).themeEmbedLastSeen ? new Date((settings as any).themeEmbedLastSeen).toISOString() : undefined,
    };
  } catch (error) {
    console.error("Error fetching settings:", error);
    return getDefaultSettings();
  }
}

export async function saveSettings(shop: string, settingsData: Partial<SettingsData>): Promise<SettingsData> {
  try {
    console.log('🔧 saveSettings called for shop:', shop);
    console.log('🔧 settingsData received:', settingsData);
    
    // Filter to only include valid SettingsData fields
    const validFields: (keyof SettingsData)[] = [
      'enableApp', 'enableStickyCart', 'showOnlyOnCartPage', 'autoOpenCart', 'enableFreeShipping', 'freeShippingThreshold',
      'enableRecommendations', 'enableAddons', 'enableDiscountCode', 'enableNotes', 'enableExpressCheckout', 'enableAnalytics', 'enableGiftGating', 'enableTitleCaps',
      'cartPosition', 'cartIcon', 'freeShippingText', 'freeShippingAchievedText', 'recommendationsTitle', 'actionText',
  'addButtonText', 'checkoutButtonText', 'applyButtonText', 'discountLinkText', 'notesLinkText',
  'backgroundColor', 'textColor', 'buttonColor', 'buttonTextColor', 'recommendationsBackgroundColor', 'shippingBarBackgroundColor', 'shippingBarColor', 'recommendationLayout', 'maxRecommendations',
  'complementDetectionMode', 'manualRecommendationProducts', 'progressBarMode', 'giftProgressStyle', 'giftThresholds',
  'themeEmbedEnabled', 'themeEmbedLastSeen'
    ];
    
    const filteredData: Partial<SettingsData> = {};
    for (const field of validFields) {
      if (field in settingsData && settingsData[field] !== undefined) {
        (filteredData as any)[field] = settingsData[field];
      }
    }
    
    console.log('🔧 filteredData after processing:', filteredData);
    
    // Migrate recommendation layout values if present
    if (filteredData.recommendationLayout) {
      filteredData.recommendationLayout = migrateRecommendationLayout(filteredData.recommendationLayout);
    }
    
    // Try saving with enableTitleCaps field, fallback without it if column doesn't exist
    let settings;
    try {
      settings = await (db as any).settings.upsert({
        where: { shop },
        create: {
          shop,
          ...filteredData,
        },
        update: filteredData,
      });
    } catch (dbError: any) {
      // If error contains references to enableTitleCaps column, try without it
      if (dbError.message && dbError.message.includes('enableTitleCaps')) {
        console.log('🔧 enableTitleCaps column not found, saving without it...');
        const { enableTitleCaps, ...filteredDataWithoutTitleCaps } = filteredData;
        settings = await (db as any).settings.upsert({
          where: { shop },
          create: {
            shop,
            ...filteredDataWithoutTitleCaps,
          },
          update: filteredDataWithoutTitleCaps,
        });
      } else {
        throw dbError;
      }
    }
    
    console.log('🔧 settings saved successfully:', { shop, enableTitleCaps: settings.enableTitleCaps });

    return {
      enableApp: settings.enableApp,
      enableStickyCart: settings.enableStickyCart,
      showOnlyOnCartPage: settings.showOnlyOnCartPage,
      autoOpenCart: (settings as any).autoOpenCart ?? true,
      enableFreeShipping: settings.enableFreeShipping,
      freeShippingThreshold: settings.freeShippingThreshold,
      enableRecommendations: settings.enableRecommendations,
      enableAddons: settings.enableAddons,
      enableDiscountCode: settings.enableDiscountCode,
      enableNotes: settings.enableNotes,
      enableExpressCheckout: settings.enableExpressCheckout,
      enableAnalytics: settings.enableAnalytics,
      enableTitleCaps: (settings as any).enableTitleCaps ?? false,
      cartPosition: settings.cartPosition,
      cartIcon: settings.cartIcon,
      freeShippingText: settings.freeShippingText,
      freeShippingAchievedText: settings.freeShippingAchievedText,
      recommendationsTitle: settings.recommendationsTitle,
      actionText: settings.actionText || "Add discount code",
      addButtonText: (settings as any).addButtonText ?? "Add",
      checkoutButtonText: (settings as any).checkoutButtonText ?? "CHECKOUT",
      applyButtonText: (settings as any).applyButtonText ?? "Apply",
  discountLinkText: (settings as any).discountLinkText ?? "+ Got a promotion code?",
  notesLinkText: (settings as any).notesLinkText ?? "+ Add order notes",
      
      backgroundColor: settings.backgroundColor,
      textColor: settings.textColor,
      buttonColor: settings.buttonColor,
      buttonTextColor: (settings as any).buttonTextColor ?? "#ffffff",
      recommendationsBackgroundColor: (settings as any).recommendationsBackgroundColor ?? "#ecebe3",
      shippingBarBackgroundColor: (settings as any).shippingBarBackgroundColor ?? "#f0f0f0",
      shippingBarColor: (settings as any).shippingBarColor ?? "#121212",
      recommendationLayout: migrateRecommendationLayout(settings.recommendationLayout),
      maxRecommendations: settings.maxRecommendations,
      complementDetectionMode: (settings as any).complementDetectionMode ?? "automatic",
      manualRecommendationProducts: (settings as any).manualRecommendationProducts ?? "",
      enableGiftGating: (settings as any).enableGiftGating ?? false,
      progressBarMode: (settings as any).progressBarMode ?? "free-shipping",
      giftProgressStyle: (settings as any).giftProgressStyle ?? "single-next",
  giftThresholds: (settings as any).giftThresholds ?? "[]",
  themeEmbedEnabled: (settings as any).themeEmbedEnabled ?? false,
  themeEmbedLastSeen: (settings as any).themeEmbedLastSeen ? new Date((settings as any).themeEmbedLastSeen).toISOString() : undefined,
    };
  } catch (error) {
    console.error("💥 Error saving settings:", error);
    console.error("💥 Shop:", shop);
    console.error("💥 Settings data:", settingsData);
    throw new Error("Failed to save settings: " + (error as Error).message);
  }
}

export function getDefaultSettings(): SettingsData {
  return {
    // Core Features
    enableApp: true,
    enableStickyCart: true,
    showOnlyOnCartPage: false,
    autoOpenCart: true,
  enableFreeShipping: false,
    freeShippingThreshold: 0,
    
    // Advanced Features
  enableRecommendations: false,
    enableAddons: false,
    enableDiscountCode: true,
    enableNotes: false,
    enableExpressCheckout: true,
  enableAnalytics: false,
    enableTitleCaps: false,
    
    // Cart Behavior & Position
    cartPosition: "bottom-right",
    cartIcon: "cart",
    
    // Messages & Text
    freeShippingText: "You're {{ amount }} away from free shipping!",
    freeShippingAchievedText: "🎉 Congratulations! You've unlocked free shipping!",
    recommendationsTitle: "You might also like",
    actionText: "Add discount code",
    addButtonText: "Add",
    checkoutButtonText: "CHECKOUT",
    applyButtonText: "Apply",
  discountLinkText: "+ Got a promotion code?",
  notesLinkText: "+ Add order notes",
    
    
    // Appearance
    backgroundColor: "#ffffff",
    textColor: "#1A1A1A",
    buttonColor: "var(--button-background, #000000)", // Theme button color with black fallback
    buttonTextColor: "var(--button-text, #ffffff)", // Theme button text with white fallback
    recommendationsBackgroundColor: "#ecebe3",
    shippingBarBackgroundColor: "var(--background-secondary, #f0f0f0)", // Theme secondary background with light gray fallback
    shippingBarColor: "var(--accent, #121212)", // Theme accent with green fallback
    
    // Recommendation Settings
    recommendationLayout: "carousel",
    maxRecommendations: 3,
    complementDetectionMode: "automatic",
    manualRecommendationProducts: "",
    
    // Gift Gating Settings
    enableGiftGating: false,
    progressBarMode: "free-shipping",
    giftProgressStyle: "single-next",
  giftThresholds: "[]",
  themeEmbedEnabled: false,
  themeEmbedLastSeen: undefined,
  };
}
