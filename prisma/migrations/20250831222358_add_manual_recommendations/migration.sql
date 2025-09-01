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
    "enableFreeShipping" BOOLEAN NOT NULL DEFAULT true,
    "freeShippingThreshold" REAL NOT NULL DEFAULT 100,
    "enableRecommendations" BOOLEAN NOT NULL DEFAULT true,
    "enableAddons" BOOLEAN NOT NULL DEFAULT false,
    "enableDiscountCode" BOOLEAN NOT NULL DEFAULT true,
    "enableNotes" BOOLEAN NOT NULL DEFAULT false,
    "enableExpressCheckout" BOOLEAN NOT NULL DEFAULT true,
    "enableAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "cartPosition" TEXT NOT NULL DEFAULT 'bottom-right',
    "cartIcon" TEXT NOT NULL DEFAULT 'cart',
    "freeShippingText" TEXT NOT NULL DEFAULT 'You''re {amount} away from free shipping!',
    "freeShippingAchievedText" TEXT NOT NULL DEFAULT '🎉 Congratulations! You''ve unlocked free shipping!',
    "recommendationsTitle" TEXT NOT NULL DEFAULT 'You might also like',
    "actionText" TEXT NOT NULL DEFAULT 'Add discount code',
    "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
    "textColor" TEXT NOT NULL DEFAULT '#1A1A1A',
    "buttonColor" TEXT NOT NULL DEFAULT '#000000',
    "recommendationsBackgroundColor" TEXT NOT NULL DEFAULT '#ecebe3',
    "recommendationLayout" TEXT NOT NULL DEFAULT 'horizontal',
    "maxRecommendations" INTEGER NOT NULL DEFAULT 6,
    "complementDetectionMode" TEXT NOT NULL DEFAULT 'automatic',
    "manualRecommendationProducts" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("actionText", "autoOpenCart", "backgroundColor", "buttonColor", "cartIcon", "cartPosition", "createdAt", "enableAddons", "enableAnalytics", "enableApp", "enableDiscountCode", "enableExpressCheckout", "enableFreeShipping", "enableNotes", "enableRecommendations", "enableStickyCart", "freeShippingAchievedText", "freeShippingText", "freeShippingThreshold", "id", "maxRecommendations", "recommendationLayout", "recommendationsBackgroundColor", "recommendationsTitle", "shop", "showOnlyOnCartPage", "textColor", "updatedAt") SELECT "actionText", "autoOpenCart", "backgroundColor", "buttonColor", "cartIcon", "cartPosition", "createdAt", "enableAddons", "enableAnalytics", "enableApp", "enableDiscountCode", "enableExpressCheckout", "enableFreeShipping", "enableNotes", "enableRecommendations", "enableStickyCart", "freeShippingAchievedText", "freeShippingText", "freeShippingThreshold", "id", "maxRecommendations", "recommendationLayout", "recommendationsBackgroundColor", "recommendationsTitle", "shop", "showOnlyOnCartPage", "textColor", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_shop_key" ON "Settings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
