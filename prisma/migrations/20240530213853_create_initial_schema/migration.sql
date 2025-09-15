-- Initial schema for SQLite dev
PRAGMA foreign_keys=OFF;

-- CreateTable Session
CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "shop" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "isOnline" INTEGER NOT NULL DEFAULT 0,
  "scope" TEXT,
  "expires" DATETIME,
  "accessToken" TEXT NOT NULL,
  "userId" BIGINT,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "accountOwner" INTEGER NOT NULL DEFAULT 0,
  "locale" TEXT,
  "collaborator" INTEGER DEFAULT 0,
  "emailVerified" INTEGER DEFAULT 0
);

-- CreateTable Settings
CREATE TABLE "Settings" (
  "id" TEXT PRIMARY KEY,
  "shop" TEXT NOT NULL UNIQUE,

  -- Core Features
  "enableApp" INTEGER NOT NULL DEFAULT 1,
  "enableStickyCart" INTEGER NOT NULL DEFAULT 1,
  "showOnlyOnCartPage" INTEGER NOT NULL DEFAULT 0,
  "autoOpenCart" INTEGER NOT NULL DEFAULT 1,
  "enableFreeShipping" INTEGER NOT NULL DEFAULT 0,
  "freeShippingThreshold" REAL NOT NULL DEFAULT 100,

  -- Advanced Features
  "enableRecommendations" INTEGER NOT NULL DEFAULT 0,
  "enableAddons" INTEGER NOT NULL DEFAULT 0,
  "enableDiscountCode" INTEGER NOT NULL DEFAULT 1,
  "enableNotes" INTEGER NOT NULL DEFAULT 0,
  "enableExpressCheckout" INTEGER NOT NULL DEFAULT 1,
  "enableAnalytics" INTEGER NOT NULL DEFAULT 0,

  -- Cart Behavior & Position
  "cartPosition" TEXT NOT NULL DEFAULT 'bottom-right',
  "cartIcon" TEXT NOT NULL DEFAULT 'cart',

  -- Messages & Text
  "freeShippingText" TEXT NOT NULL DEFAULT 'You''re {{ amount }} away from free shipping!',
  "freeShippingAchievedText" TEXT NOT NULL DEFAULT '🎉 Congratulations! You''ve unlocked free shipping!',
  "recommendationsTitle" TEXT NOT NULL DEFAULT 'You might also like',
  "actionText" TEXT NOT NULL DEFAULT 'Add discount code',
  "addButtonText" TEXT NOT NULL DEFAULT 'Add',
  "checkoutButtonText" TEXT NOT NULL DEFAULT 'CHECKOUT',
  "applyButtonText" TEXT NOT NULL DEFAULT 'Apply',
  "discountLinkText" TEXT NOT NULL DEFAULT '+ Got a promotion code?',
  "notesLinkText" TEXT NOT NULL DEFAULT '+ Add order notes',

  -- Appearance
  "backgroundColor" TEXT NOT NULL DEFAULT '#ffffff',
  "textColor" TEXT NOT NULL DEFAULT '#1A1A1A',
  "buttonColor" TEXT NOT NULL DEFAULT '#000000',
  "buttonTextColor" TEXT NOT NULL DEFAULT '#ffffff',
  "recommendationsBackgroundColor" TEXT NOT NULL DEFAULT '#ecebe3',
  "shippingBarBackgroundColor" TEXT NOT NULL DEFAULT '#f0f0f0',
  "shippingBarColor" TEXT NOT NULL DEFAULT '#121212',

  -- Recommendation Settings
  "recommendationLayout" TEXT NOT NULL DEFAULT 'carousel',
  "maxRecommendations" INTEGER NOT NULL DEFAULT 4,
  "complementDetectionMode" TEXT NOT NULL DEFAULT 'automatic',
  "manualRecommendationProducts" TEXT NOT NULL DEFAULT '',

  -- Sticky Cart Settings
  "stickyCartShowIcon" INTEGER NOT NULL DEFAULT 1,
  "stickyCartShowCount" INTEGER NOT NULL DEFAULT 1,
  "stickyCartShowTotal" INTEGER NOT NULL DEFAULT 1,
  "stickyCartBackgroundColor" TEXT NOT NULL DEFAULT '#000000',
  "stickyCartTextColor" TEXT NOT NULL DEFAULT '#ffffff',
  "stickyCartCountBadgeColor" TEXT NOT NULL DEFAULT '#ff4444',
  "stickyCartCountBadgeTextColor" TEXT NOT NULL DEFAULT '#ffffff',
  "stickyCartBorderRadius" INTEGER NOT NULL DEFAULT 25,

  -- Progress Bar System
  "progressBarMode" TEXT NOT NULL DEFAULT 'free-shipping',
  "enableGiftGating" INTEGER NOT NULL DEFAULT 0,
  "giftProgressStyle" TEXT NOT NULL DEFAULT 'single-next',
  "giftThresholds" TEXT NOT NULL DEFAULT '[]',
  "giftNoticeText" TEXT NOT NULL DEFAULT 'Free gift added: {{product}} (worth {{amount}})',
  "giftPriceText" TEXT NOT NULL DEFAULT 'FREE',

  -- Theme App Embed Status
  "themeEmbedEnabled" INTEGER NOT NULL DEFAULT 0,
  "themeEmbedLastSeen" DATETIME,

  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

PRAGMA foreign_keys=ON;
