import db from "../db.server";

export interface SettingsData {
  // Core Features
  enableApp: boolean;
  enableStickyCart: boolean;
  showOnlyOnCartPage: boolean;
  enableFreeShipping: boolean;
  freeShippingThreshold: number;
  
  // Advanced Features
  enableRecommendations: boolean;
  enableAddons: boolean;
  enableDiscountCode: boolean;
  enableNotes: boolean;
  enableExpressCheckout: boolean;
  enableAnalytics: boolean;
  
  // Cart Behavior & Position
  cartPosition: string;
  cartIcon: string;
  
  // Messages & Text
  freeShippingText: string;
  freeShippingAchievedText: string;
  recommendationsTitle: string;
  actionText: string;
  
  // Appearance
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  
  // Recommendation Settings
  recommendationLayout: string;
  maxRecommendations: number;
}

export async function getSettings(shop: string): Promise<SettingsData> {
  try {
    const settings = await db.settings.findUnique({
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
      enableFreeShipping: settings.enableFreeShipping,
      freeShippingThreshold: settings.freeShippingThreshold,
      enableRecommendations: settings.enableRecommendations,
      enableAddons: settings.enableAddons,
      enableDiscountCode: settings.enableDiscountCode,
      enableNotes: settings.enableNotes,
      enableExpressCheckout: settings.enableExpressCheckout,
      enableAnalytics: settings.enableAnalytics,
      cartPosition: settings.cartPosition,
      cartIcon: settings.cartIcon,
      freeShippingText: settings.freeShippingText,
      freeShippingAchievedText: settings.freeShippingAchievedText,
      recommendationsTitle: settings.recommendationsTitle,
      actionText: settings.actionText || "Add discount code",
      backgroundColor: settings.backgroundColor,
      textColor: settings.textColor,
      buttonColor: settings.buttonColor,
      recommendationLayout: settings.recommendationLayout,
      maxRecommendations: settings.maxRecommendations,
    };
  } catch (error) {
    console.error("Error fetching settings:", error);
    return getDefaultSettings();
  }
}

export async function saveSettings(shop: string, settingsData: Partial<SettingsData>): Promise<SettingsData> {
  try {
    // Filter to only include valid SettingsData fields
    const validFields: (keyof SettingsData)[] = [
      'enableApp', 'enableStickyCart', 'showOnlyOnCartPage', 'enableFreeShipping', 'freeShippingThreshold',
      'enableRecommendations', 'enableAddons', 'enableDiscountCode', 'enableNotes', 'enableExpressCheckout', 'enableAnalytics',
      'cartPosition', 'cartIcon', 'freeShippingText', 'freeShippingAchievedText', 'recommendationsTitle', 'actionText',
      'backgroundColor', 'textColor', 'buttonColor', 'recommendationLayout', 'maxRecommendations'
    ];
    
    const filteredData: Partial<SettingsData> = {};
    for (const field of validFields) {
      if (field in settingsData && settingsData[field] !== undefined) {
        (filteredData as any)[field] = settingsData[field];
      }
    }
    
    const settings = await db.settings.upsert({
      where: { shop },
      create: {
        shop,
        ...filteredData,
      },
      update: filteredData,
    });

    return {
      enableApp: settings.enableApp,
      enableStickyCart: settings.enableStickyCart,
      showOnlyOnCartPage: settings.showOnlyOnCartPage,
      enableFreeShipping: settings.enableFreeShipping,
      freeShippingThreshold: settings.freeShippingThreshold,
      enableRecommendations: settings.enableRecommendations,
      enableAddons: settings.enableAddons,
      enableDiscountCode: settings.enableDiscountCode,
      enableNotes: settings.enableNotes,
      enableExpressCheckout: settings.enableExpressCheckout,
      enableAnalytics: settings.enableAnalytics,
      cartPosition: settings.cartPosition,
      cartIcon: settings.cartIcon,
      freeShippingText: settings.freeShippingText,
      freeShippingAchievedText: settings.freeShippingAchievedText,
      recommendationsTitle: settings.recommendationsTitle,
      actionText: settings.actionText || "Add discount code",
      backgroundColor: settings.backgroundColor,
      textColor: settings.textColor,
      buttonColor: settings.buttonColor,
      recommendationLayout: settings.recommendationLayout,
      maxRecommendations: settings.maxRecommendations,
    };
  } catch (error) {
    console.error("Error saving settings:", error);
    throw new Error("Failed to save settings");
  }
}

function getDefaultSettings(): SettingsData {
  return {
    // Core Features
    enableApp: true,
    enableStickyCart: true,
    showOnlyOnCartPage: false,
    enableFreeShipping: true,
    freeShippingThreshold: 100,
    
    // Advanced Features
    enableRecommendations: true,
    enableAddons: false,
    enableDiscountCode: true,
    enableNotes: false,
    enableExpressCheckout: true,
    enableAnalytics: true,
    
    // Cart Behavior & Position
    cartPosition: "bottom-right",
    cartIcon: "cart",
    
    // Messages & Text
    freeShippingText: "You're {amount} away from free shipping!",
    freeShippingAchievedText: "🎉 Congratulations! You've unlocked free shipping!",
    recommendationsTitle: "You might also like",
    actionText: "Add discount code",
    
    // Appearance
    backgroundColor: "#ffffff",
    textColor: "#1A1A1A",
    buttonColor: "#000000",
    
    // Recommendation Settings
    recommendationLayout: "horizontal",
    maxRecommendations: 6,
  };
}
