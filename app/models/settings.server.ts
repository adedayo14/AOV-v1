import db from "../db.server";

// Migration helper to convert old layout values to new ones
function migrateRecommendationLayout(oldLayout: string): string {
  const migrationMap: { [key: string]: string } = {
    'horizontal': 'carousel',
    'vertical': 'list',
    'row': 'carousel',
    'column': 'list',
  };
  
  const newLayout = migrationMap[oldLayout] || oldLayout;

  return newLayout;
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
  enableRecommendationTitleCaps: boolean;
  
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

  // Legacy fields (preserved for compatibility)
  stickyCartShowIcon?: boolean;
  stickyCartShowCount?: boolean;
  stickyCartShowTotal?: boolean;
  stickyCartBackgroundColor?: string;
  stickyCartTextColor?: string;
  stickyCartCountBadgeColor?: string;
  stickyCartCountBadgeTextColor?: string;
  stickyCartBorderRadius?: number;
  giftNoticeText?: string;
  giftPriceText?: string;

  // ML/Privacy Settings
  mlPersonalizationMode: string;
  enableMLRecommendations: boolean;
  mlPrivacyLevel: string;
  enableAdvancedPersonalization: boolean;
  enableBehaviorTracking: boolean;
  mlDataRetentionDays: string;

  // Smart Bundle Settings
  enableSmartBundles: boolean;
  bundlesOnProductPages: boolean;
  bundlesOnCollectionPages: boolean;
  bundlesOnCartPage: boolean;
  bundlesOnCheckoutPage: boolean;
  defaultBundleDiscount: string;
  bundleTitleTemplate: string;
  bundleDiscountPrefix: string;
  bundleConfidenceThreshold: string;
  bundleSavingsFormat: string;
  showIndividualPricesInBundle: boolean;
  autoApplyBundleDiscounts: boolean;

  // Enhanced Bundle Display Settings
  enableEnhancedBundles: boolean;
  showPurchaseCounts: boolean;
  showRecentlyViewed: boolean;
  showTestimonials: boolean;
  showTrustBadges: boolean;
  highlightHighValue: boolean;
  enhancedImages: boolean;
  animatedSavings: boolean;
  highValueThreshold: number;
  bundlePriority: string;
  badgeHighValueText: string;
  badgePopularText: string;
  badgeTrendingText: string;
  testimonialsList: string;

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

    // Determine environment (dev uses SQLite)
    const isDevelopment = process.env.DATABASE_URL?.includes('sqlite') || !process.env.DATABASE_DATABASE_URL;

    // In production, mirror grid-caps to global caps (DB lacks a separate column)
    const enableTitleCapsVal = (settings as any).enableTitleCaps ?? false;
    const enableRecommendationTitleCapsVal = isDevelopment
      ? (settings as any).enableRecommendationTitleCaps ?? false
      : enableTitleCapsVal;

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
  enableTitleCaps: enableTitleCapsVal,
  enableRecommendationTitleCaps: enableRecommendationTitleCapsVal,
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
      
      // ML/Privacy Settings
      mlPersonalizationMode: (settings as any).mlPersonalizationMode ?? "basic",
      enableMLRecommendations: (settings as any).enableMLRecommendations ?? false,
      mlPrivacyLevel: (settings as any).mlPrivacyLevel ?? "basic",
      enableAdvancedPersonalization: (settings as any).enableAdvancedPersonalization ?? false,
      enableBehaviorTracking: (settings as any).enableBehaviorTracking ?? false,
      mlDataRetentionDays: (settings as any).mlDataRetentionDays ?? "30",
      
      // Smart Bundle Settings
      enableSmartBundles: (settings as any).enableSmartBundles ?? false,
      bundlesOnProductPages: (settings as any).bundlesOnProductPages ?? true,
      bundlesOnCollectionPages: (settings as any).bundlesOnCollectionPages ?? false,
      bundlesOnCartPage: (settings as any).bundlesOnCartPage ?? false,
      bundlesOnCheckoutPage: (settings as any).bundlesOnCheckoutPage ?? false,
      defaultBundleDiscount: (settings as any).defaultBundleDiscount ?? "15",
      bundleTitleTemplate: (settings as any).bundleTitleTemplate ?? "Complete your setup",
      bundleDiscountPrefix: (settings as any).bundleDiscountPrefix ?? "BUNDLE",
      bundleConfidenceThreshold: (settings as any).bundleConfidenceThreshold ?? "medium",
      bundleSavingsFormat: (settings as any).bundleSavingsFormat ?? "both",
      showIndividualPricesInBundle: (settings as any).showIndividualPricesInBundle ?? true,
      autoApplyBundleDiscounts: (settings as any).autoApplyBundleDiscounts ?? true,
      
      // Enhanced Bundle Display Settings
      enableEnhancedBundles: (settings as any).enableEnhancedBundles ?? false,
      showPurchaseCounts: (settings as any).showPurchaseCounts ?? false,
      showRecentlyViewed: (settings as any).showRecentlyViewed ?? false,
      showTestimonials: (settings as any).showTestimonials ?? false,
      showTrustBadges: (settings as any).showTrustBadges ?? false,
      highlightHighValue: (settings as any).highlightHighValue ?? false,
      enhancedImages: (settings as any).enhancedImages ?? false,
      animatedSavings: (settings as any).animatedSavings ?? false,
      highValueThreshold: (settings as any).highValueThreshold ?? 150,
      bundlePriority: (settings as any).bundlePriority ?? "value",
      badgeHighValueText: (settings as any).badgeHighValueText ?? "Best Value",
      badgePopularText: (settings as any).badgePopularText ?? "Most Popular",
      badgeTrendingText: (settings as any).badgeTrendingText ?? "Trending",
      testimonialsList: (settings as any).testimonialsList ?? JSON.stringify([
        { text: "Love this combo!", author: "Sarah M." },
        { text: "Perfect together!", author: "Mike R." },
        { text: "Great value bundle", author: "Emma K." },
        { text: "Exactly what I needed", author: "Alex T." },
        { text: "Highly recommend", author: "Lisa P." },
        { text: "Amazing quality", author: "James W." }
      ]),
      
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
    
    // Test database connection first
    try {
      await (db as any).$connect();
      console.log('🔧 Database connection successful');
    } catch (connectError: any) {
      console.error('💥 Database connection failed:', connectError.message);
      throw new Error('Database connection failed: ' + connectError.message);
    }
    
    // Filter to only include valid SettingsData fields that exist in BOTH dev and production schemas
    const validFields: (keyof SettingsData)[] = [
      'enableApp', 'enableStickyCart', 'showOnlyOnCartPage', 'autoOpenCart', 'enableFreeShipping', 'freeShippingThreshold',
      'enableRecommendations', 'enableAddons', 'enableDiscountCode', 'enableNotes', 'enableExpressCheckout', 'enableAnalytics', 'enableGiftGating',
      'cartPosition', 'cartIcon', 'freeShippingText', 'freeShippingAchievedText', 'recommendationsTitle', 'actionText',
      'addButtonText', 'checkoutButtonText', 'applyButtonText',
      'backgroundColor', 'textColor', 'buttonColor', 'buttonTextColor', 'recommendationsBackgroundColor', 'shippingBarBackgroundColor', 'shippingBarColor', 'recommendationLayout', 'maxRecommendations',
      'complementDetectionMode', 'manualRecommendationProducts', 'progressBarMode', 'giftProgressStyle', 'giftThresholds',
      'themeEmbedEnabled', 'themeEmbedLastSeen',
      // ML/Privacy Settings
      'mlPersonalizationMode', 'enableMLRecommendations', 'mlPrivacyLevel', 'enableAdvancedPersonalization', 'enableBehaviorTracking', 'mlDataRetentionDays',
      // Smart Bundle Settings
      'enableSmartBundles', 'bundlesOnProductPages', 'bundlesOnCollectionPages', 'bundlesOnCartPage', 'bundlesOnCheckoutPage', 
      'defaultBundleDiscount', 'bundleTitleTemplate', 'bundleDiscountPrefix', 'bundleConfidenceThreshold', 'bundleSavingsFormat', 
      'showIndividualPricesInBundle', 'autoApplyBundleDiscounts',
      // Enhanced Bundle Display Settings
      'enableEnhancedBundles', 'showPurchaseCounts', 'showRecentlyViewed', 'showTestimonials', 'showTrustBadges', 
      'highlightHighValue', 'enhancedImages', 'animatedSavings', 'highValueThreshold', 'bundlePriority',
      'badgeHighValueText', 'badgePopularText', 'badgeTrendingText', 'testimonialsList'
    ];
    
  // Production-only fields (exclude in production environment)
  const devOnlyFields: (keyof SettingsData)[] = ['enableTitleCaps', 'enableRecommendationTitleCaps', 'discountLinkText', 'notesLinkText'];
    
    const filteredData: Partial<SettingsData> = {};
    for (const field of validFields) {
      const key = field as keyof SettingsData;
      const val = settingsData[key];
      if (val !== undefined) {
        (filteredData as any)[key] = val;
      }
    }
    
    // Only include dev-only fields if we're in development (detect by database URL)
    const isDevelopment = process.env.DATABASE_URL?.includes('sqlite') || !process.env.DATABASE_DATABASE_URL;
    
    if (isDevelopment) {
      for (const field of devOnlyFields) {
        const key = field as keyof SettingsData;
        const val = settingsData[key as keyof SettingsData];
        if (val !== undefined) {
          console.log(`🔧 Including dev-only field ${String(field)} in save operation`);
          (filteredData as any)[key] = val;
        }
      }
    } else {
      console.log('🔧 Production mode: excluding dev-only fields:', devOnlyFields);
      // Mirror grid caps into global caps if provided via UI toggle
      if (settingsData.enableRecommendationTitleCaps !== undefined) {
        (filteredData as any).enableTitleCaps = Boolean(settingsData.enableRecommendationTitleCaps);
      }
    }
    
    console.log('🔧 filteredData after processing:', filteredData);
    
    // Migrate recommendation layout values if present
    if (filteredData.recommendationLayout) {
      filteredData.recommendationLayout = migrateRecommendationLayout(filteredData.recommendationLayout);
    }
    
    // Try saving, stripping unknown fields reported by Prisma and retrying up to 3 times
    let settings;
    let attempt = 0;
    let dataForSave: any = { ...filteredData };
    const maxAttempts = Math.max(10, Object.keys(filteredData).length + 2);

    const baselineSave = async () => {
      console.warn('🔧 Falling back to baseline core fields save');
      const baselineFields: (keyof SettingsData)[] = [
        'enableApp','enableStickyCart','showOnlyOnCartPage','autoOpenCart','enableFreeShipping','freeShippingThreshold',
        'enableRecommendations','enableAddons','enableDiscountCode','enableNotes','enableExpressCheckout','enableAnalytics',
        'cartPosition','cartIcon','freeShippingText','freeShippingAchievedText','recommendationsTitle','actionText',
        'addButtonText','checkoutButtonText','applyButtonText','backgroundColor','textColor','buttonColor','buttonTextColor',
        'recommendationsBackgroundColor','shippingBarBackgroundColor','shippingBarColor','recommendationLayout','maxRecommendations',
        'complementDetectionMode','manualRecommendationProducts','progressBarMode','giftProgressStyle','giftThresholds'
      ];
      const fallbackData: any = {};
      for (const key of baselineFields) {
        if ((filteredData as any)[key] !== undefined) fallbackData[key] = (filteredData as any)[key];
      }
      settings = await (db as any).settings.upsert({
        where: { shop },
        create: { shop, ...fallbackData },
        update: fallbackData,
      });
      console.log('🔧 Baseline save successful');
    };

  while (attempt < maxAttempts) {
      try {
        if (attempt > 0) console.log(`🔧 Retry save attempt #${attempt} with fields:`, Object.keys(dataForSave));
        console.log('🔧 Attempting save...');
        settings = await (db as any).settings.upsert({
          where: { shop },
          create: { shop, ...dataForSave },
          update: dataForSave,
        });
        console.log('🔧 Save successful');
        break;
      } catch (dbError: any) {
        console.error('💥 Save failed:', dbError?.message || dbError);
        // Parse Prisma error messages to detect unknown/invalid fields
        const msg = String(dbError?.message || '');
        const unknownFieldMatches: string[] = [];

        // Prisma (JS) often reports: Unknown arg `fieldName` in data.update
        const unknownArgRegex = /Unknown arg `([^`]+)` in data\.(?:create|update)/g;
        let m;
        while ((m = unknownArgRegex.exec(msg)) !== null) {
          unknownFieldMatches.push(m[1]);
        }

        // Postgres column errors might mention column name in quotes
        const columnRegex = /column\s+"([^"]+)"\s+of\s+relation\s+"settings"/gi;
        while ((m = columnRegex.exec(msg)) !== null) {
          unknownFieldMatches.push(m[1]);
        }

        // Generic fallback: specifically remove fields we know differ in prod
        const likelyOffenders = ['discountLinkText', 'notesLinkText'];
        for (const f of likelyOffenders) {
          if (msg.includes(f)) unknownFieldMatches.push(f);
        }

        // De-duplicate
        const fieldsToRemove = Array.from(new Set(unknownFieldMatches));

        if (fieldsToRemove.length === 0) {
          // As a last safety, if error mentions 'column' but we couldn't extract, remove enableTitleCaps once
          if (msg.includes('column') && 'enableTitleCaps' in dataForSave) {
            delete dataForSave.enableTitleCaps;
            attempt++;
            continue;
          }
          // Also try removing enableRecommendationTitleCaps if that's the issue
          if (msg.includes('column') && 'enableRecommendationTitleCaps' in dataForSave) {
            delete dataForSave.enableRecommendationTitleCaps;
            attempt++;
            continue;
          }
          try {
            await baselineSave();
            break;
          } catch (fallbackError: any) {
            console.error('💥 Baseline save failed:', fallbackError?.message || fallbackError);
            throw new Error('Database save failed: ' + msg);
          }
        }

        console.warn('🔧 Stripping unknown fields and retrying:', fieldsToRemove);
        for (const field of fieldsToRemove) {
          delete dataForSave[field];
        }

        attempt++;
        if (attempt >= maxAttempts - 1) {
          try {
            await baselineSave();
            break;
          } catch (fallbackError: any) {
            console.error('💥 Final baseline save failed:', fallbackError?.message || fallbackError);
            throw new Error('Database save failed: ' + msg);
          }
        }
      }
    }

    if (!settings) {
      throw new Error('Database save failed after retries');
    }
    
    console.log('🔧 settings saved successfully:', { shop, id: settings?.id });

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
      enableRecommendationTitleCaps: (settings as any).enableRecommendationTitleCaps ?? false,
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
      
      // ML/Privacy Settings
      mlPersonalizationMode: (settings as any).mlPersonalizationMode ?? "basic",
      enableMLRecommendations: (settings as any).enableMLRecommendations ?? false,
      mlPrivacyLevel: (settings as any).mlPrivacyLevel ?? "basic",
      enableAdvancedPersonalization: (settings as any).enableAdvancedPersonalization ?? false,
      enableBehaviorTracking: (settings as any).enableBehaviorTracking ?? false,
      mlDataRetentionDays: (settings as any).mlDataRetentionDays ?? "30",
      
      // Smart Bundle Settings
      enableSmartBundles: (settings as any).enableSmartBundles ?? false,
      bundlesOnProductPages: (settings as any).bundlesOnProductPages ?? true,
      bundlesOnCollectionPages: (settings as any).bundlesOnCollectionPages ?? false,
      bundlesOnCartPage: (settings as any).bundlesOnCartPage ?? false,
      bundlesOnCheckoutPage: (settings as any).bundlesOnCheckoutPage ?? false,
      defaultBundleDiscount: (settings as any).defaultBundleDiscount ?? "15",
      bundleTitleTemplate: (settings as any).bundleTitleTemplate ?? "Complete your setup",
      bundleDiscountPrefix: (settings as any).bundleDiscountPrefix ?? "BUNDLE",
      bundleConfidenceThreshold: (settings as any).bundleConfidenceThreshold ?? "medium",
      bundleSavingsFormat: (settings as any).bundleSavingsFormat ?? "both",
      showIndividualPricesInBundle: (settings as any).showIndividualPricesInBundle ?? true,
      autoApplyBundleDiscounts: (settings as any).autoApplyBundleDiscounts ?? true,
      
      // Enhanced Bundle Display Settings
      enableEnhancedBundles: (settings as any).enableEnhancedBundles ?? false,
      showPurchaseCounts: (settings as any).showPurchaseCounts ?? false,
      showRecentlyViewed: (settings as any).showRecentlyViewed ?? false,
      showTestimonials: (settings as any).showTestimonials ?? false,
      showTrustBadges: (settings as any).showTrustBadges ?? false,
      highlightHighValue: (settings as any).highlightHighValue ?? false,
      enhancedImages: (settings as any).enhancedImages ?? false,
      animatedSavings: (settings as any).animatedSavings ?? false,
      highValueThreshold: (settings as any).highValueThreshold ?? 150,
      bundlePriority: (settings as any).bundlePriority ?? "value",
      badgeHighValueText: (settings as any).badgeHighValueText ?? "Best Value",
      badgePopularText: (settings as any).badgePopularText ?? "Most Popular",
      badgeTrendingText: (settings as any).badgeTrendingText ?? "Trending",
      testimonialsList: (settings as any).testimonialsList ?? JSON.stringify([
        { text: "Love this combo!", author: "Sarah M." },
        { text: "Perfect together!", author: "Mike R." },
        { text: "Great value bundle", author: "Emma K." },
        { text: "Exactly what I needed", author: "Alex T." },
        { text: "Highly recommend", author: "Lisa P." },
        { text: "Amazing quality", author: "James W." }
      ]),
      
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
    enableRecommendationTitleCaps: false,
    
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
    
    // ML/Privacy Settings
    mlPersonalizationMode: "basic",
    enableMLRecommendations: false,
    mlPrivacyLevel: "basic",
    enableAdvancedPersonalization: false,
    enableBehaviorTracking: false,
    mlDataRetentionDays: "30",
    
    // Smart Bundle Settings
    enableSmartBundles: false,
    bundlesOnProductPages: true,
    bundlesOnCollectionPages: false,
    bundlesOnCartPage: false,
    bundlesOnCheckoutPage: false,
    defaultBundleDiscount: "15",
    bundleTitleTemplate: "Complete your setup",
    bundleDiscountPrefix: "BUNDLE",
    bundleConfidenceThreshold: "medium",
    bundleSavingsFormat: "both",
    showIndividualPricesInBundle: true,
    autoApplyBundleDiscounts: true,
    
    // Enhanced Bundle Display Settings
    enableEnhancedBundles: false,
    showPurchaseCounts: false,
    showRecentlyViewed: false,
    showTestimonials: false,
    showTrustBadges: false,
    highlightHighValue: false,
    enhancedImages: false,
    animatedSavings: false,
    highValueThreshold: 150,
    bundlePriority: "value",
    badgeHighValueText: "Best Value",
    badgePopularText: "Most Popular",
    badgeTrendingText: "Trending",
    testimonialsList: JSON.stringify([
      { text: "Love this combo!", author: "Sarah M." },
      { text: "Perfect together!", author: "Mike R." },
      { text: "Great value bundle", author: "Emma K." },
      { text: "Exactly what I needed", author: "Alex T." },
      { text: "Highly recommend", author: "Lisa P." },
      { text: "Amazing quality", author: "James W." }
    ]),
    
    themeEmbedEnabled: false,
    themeEmbedLastSeen: undefined,
  };
}
