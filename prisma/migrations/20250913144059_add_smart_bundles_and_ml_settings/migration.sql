-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "productId" TEXT,
    "productTitle" TEXT,
    "priceCents" INTEGER,
    "revenueCents" INTEGER,
    "sessionId" TEXT,
    "reason" TEXT,
    "slot" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enableApp" BOOLEAN NOT NULL DEFAULT true,
    "enableStickyCart" BOOLEAN NOT NULL DEFAULT true,
    "showOnlyOnCartPage" BOOLEAN NOT NULL DEFAULT false,
    "autoOpenCart" BOOLEAN NOT NULL DEFAULT true,
    "enableFreeShipping" BOOLEAN NOT NULL DEFAULT false,
    "freeShippingThreshold" REAL NOT NULL DEFAULT 0,
    "enableRecommendations" BOOLEAN NOT NULL DEFAULT false,
    "enableAddons" BOOLEAN NOT NULL DEFAULT false,
    "enableDiscountCode" BOOLEAN NOT NULL DEFAULT true,
    "enableNotes" BOOLEAN NOT NULL DEFAULT false,
    "enableExpressCheckout" BOOLEAN NOT NULL DEFAULT true,
    "enableAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "enableTitleCaps" BOOLEAN NOT NULL DEFAULT false,
    "enableRecommendationTitleCaps" BOOLEAN NOT NULL DEFAULT false,
    "cartPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "cartIcon" TEXT NOT NULL DEFAULT 'cart',
    "freeShippingText" TEXT NOT NULL DEFAULT 'You''re {{ amount }} away from free shipping!',
    "freeShippingAchievedText" TEXT NOT NULL DEFAULT '🎉 Congratulations! You''ve unlocked free shipping!',
    "recommendationsTitle" TEXT NOT NULL DEFAULT 'You might also like',
    "actionText" TEXT NOT NULL DEFAULT 'Add discount code',
    "addButtonText" TEXT NOT NULL DEFAULT 'Add',
    "checkoutButtonText" TEXT NOT NULL DEFAULT 'CHECKOUT',
    "applyButtonText" TEXT NOT NULL DEFAULT 'Apply',
    "discountLinkText" TEXT NOT NULL DEFAULT '+ Got a promotion code?',
    "notesLinkText" TEXT NOT NULL DEFAULT '+ Add order notes',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#1A1A1A',
    "buttonColor" TEXT NOT NULL DEFAULT '#000000',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "recommendationsBackgroundColor" TEXT NOT NULL DEFAULT '#ecebe3',
    "shippingBarBackgroundColor" TEXT NOT NULL DEFAULT '#f0f0f0',
    "shippingBarColor" TEXT NOT NULL DEFAULT '#121212',
    "recommendationLayout" TEXT NOT NULL DEFAULT 'carousel',
    "maxRecommendations" INTEGER NOT NULL DEFAULT 3,
    "complementDetectionMode" TEXT NOT NULL DEFAULT 'automatic',
    "manualRecommendationProducts" TEXT NOT NULL DEFAULT '',
    "progressBarMode" TEXT NOT NULL DEFAULT 'free-shipping',
    "enableGiftGating" BOOLEAN NOT NULL DEFAULT false,
    "giftProgressStyle" TEXT NOT NULL DEFAULT 'single-next',
    "giftThresholds" TEXT NOT NULL DEFAULT '[]',
    "stickyCartShowIcon" BOOLEAN NOT NULL DEFAULT true,
    "stickyCartShowCount" BOOLEAN NOT NULL DEFAULT true,
    "stickyCartShowTotal" BOOLEAN NOT NULL DEFAULT true,
    "stickyCartBackgroundColor" TEXT NOT NULL DEFAULT '#000000',
    "stickyCartTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "stickyCartCountBadgeColor" TEXT NOT NULL DEFAULT '#ff4444',
    "stickyCartCountBadgeTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "stickyCartBorderRadius" INTEGER NOT NULL DEFAULT 25,
    "giftNoticeText" TEXT NOT NULL DEFAULT 'Free gift added: {{product}} (worth {{amount}})',
    "giftPriceText" TEXT NOT NULL DEFAULT 'FREE',
    "mlPersonalizationMode" TEXT NOT NULL DEFAULT 'basic',
    "enableMLRecommendations" BOOLEAN NOT NULL DEFAULT false,
    "mlPrivacyLevel" TEXT NOT NULL DEFAULT 'basic',
    "enableAdvancedPersonalization" BOOLEAN NOT NULL DEFAULT false,
    "enableBehaviorTracking" BOOLEAN NOT NULL DEFAULT false,
    "mlDataRetentionDays" TEXT NOT NULL DEFAULT '30',
    "enableSmartBundles" BOOLEAN NOT NULL DEFAULT false,
    "bundlesOnProductPages" BOOLEAN NOT NULL DEFAULT true,
    "bundlesOnCollectionPages" BOOLEAN NOT NULL DEFAULT false,
    "bundlesOnCartPage" BOOLEAN NOT NULL DEFAULT false,
    "bundlesOnCheckoutPage" BOOLEAN NOT NULL DEFAULT false,
    "defaultBundleDiscount" TEXT NOT NULL DEFAULT '15',
    "bundleTitleTemplate" TEXT NOT NULL DEFAULT 'Complete your setup',
    "bundleDiscountPrefix" TEXT NOT NULL DEFAULT 'BUNDLE',
    "bundleConfidenceThreshold" TEXT NOT NULL DEFAULT 'medium',
    "bundleSavingsFormat" TEXT NOT NULL DEFAULT 'both',
    "showIndividualPricesInBundle" BOOLEAN NOT NULL DEFAULT true,
    "autoApplyBundleDiscounts" BOOLEAN NOT NULL DEFAULT true,
    "themeEmbedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "themeEmbedLastSeen" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("actionText", "addButtonText", "applyButtonText", "autoOpenCart", "backgroundColor", "buttonColor", "buttonTextColor", "cartIcon", "cartPosition", "checkoutButtonText", "complementDetectionMode", "createdAt", "discountLinkText", "enableAddons", "enableAnalytics", "enableApp", "enableDiscountCode", "enableExpressCheckout", "enableFreeShipping", "enableGiftGating", "enableNotes", "enableRecommendationTitleCaps", "enableRecommendations", "enableStickyCart", "enableTitleCaps", "freeShippingAchievedText", "freeShippingText", "freeShippingThreshold", "giftNoticeText", "giftPriceText", "giftProgressStyle", "giftThresholds", "id", "manualRecommendationProducts", "maxRecommendations", "notesLinkText", "progressBarMode", "recommendationLayout", "recommendationsBackgroundColor", "recommendationsTitle", "shippingBarBackgroundColor", "shippingBarColor", "shop", "showOnlyOnCartPage", "stickyCartBackgroundColor", "stickyCartBorderRadius", "stickyCartCountBadgeColor", "stickyCartCountBadgeTextColor", "stickyCartShowCount", "stickyCartShowIcon", "stickyCartShowTotal", "stickyCartTextColor", "textColor", "themeEmbedEnabled", "themeEmbedLastSeen", "updatedAt") SELECT "actionText", "addButtonText", "applyButtonText", "autoOpenCart", "backgroundColor", "buttonColor", "buttonTextColor", "cartIcon", "cartPosition", "checkoutButtonText", "complementDetectionMode", "createdAt", "discountLinkText", "enableAddons", "enableAnalytics", "enableApp", "enableDiscountCode", "enableExpressCheckout", "enableFreeShipping", "enableGiftGating", "enableNotes", "enableRecommendationTitleCaps", "enableRecommendations", "enableStickyCart", "enableTitleCaps", "freeShippingAchievedText", "freeShippingText", "freeShippingThreshold", "giftNoticeText", "giftPriceText", "giftProgressStyle", "giftThresholds", "id", "manualRecommendationProducts", "maxRecommendations", "notesLinkText", "progressBarMode", "recommendationLayout", "recommendationsBackgroundColor", "recommendationsTitle", "shippingBarBackgroundColor", "shippingBarColor", "shop", "showOnlyOnCartPage", "stickyCartBackgroundColor", "stickyCartBorderRadius", "stickyCartCountBadgeColor", "stickyCartCountBadgeTextColor", "stickyCartShowCount", "stickyCartShowIcon", "stickyCartShowTotal", "stickyCartTextColor", "textColor", "themeEmbedEnabled", "themeEmbedLastSeen", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TrackingEvent_shop_event_createdAt_idx" ON "TrackingEvent"("shop", "event", "createdAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_shop_productId_createdAt_idx" ON "TrackingEvent"("shop", "productId", "createdAt");
