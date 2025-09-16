/**
 * Cart Uplift - Modular Architecture
 * Version: 2.0.0 - Clean Rewrite
 * 
 * This modular rewrite maintains 100% compatibility with your existing app
 * while organizing 6000+ lines into maintainable modules.
 */

(function() {
  'use strict';

  // ============================================================================
  // MODULE 1: Version Control and Utilities
  // ============================================================================
  const Utils = {
    version: 'grid-2025-09-15-modular',
    
    escapeHtml(str) {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    normalizePriceToCents(val) {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return Math.round(val);
      const s = String(val).trim();
      if (!s) return 0;
      if (s.includes('.')) {
        const n = parseFloat(s);
        return isNaN(n) ? 0 : Math.round(n * 100);
      }
      const cents = parseInt(s, 10);
      return isNaN(cents) ? 0 : cents;
    },

    formatMoney(cents) {
      // Ensure we have a valid number, default to 0 if not
      const validCents = (typeof cents === 'number' && !isNaN(cents)) ? cents : 0;
      const amount = (validCents / 100).toFixed(2);
      
      if (window.CartUpliftMoneyFormat) {
        try {
          return window.CartUpliftMoneyFormat.replace(/\{\{\s*amount\s*\}\}/g, amount);
        } catch {
          // Fallback
        }
      }
      
      return '$' + amount;
    },

    beacon(payload) {
      try {
        const shop = window.CartUpliftShop || window.Shopify?.shop || '';
        const data = Object.assign({ shop }, payload || {});
        const url = '/apps/cart-uplift/api/cart-tracking';
        const body = JSON.stringify(data);
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } else {
          fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
        }
      } catch(_) {}
    }
  };

  // ============================================================================
  // MODULE 2: Version Control and Self-Healing
  // ============================================================================
  const VersionControl = {
    init() {
      const v = Utils.version;
      if (window.CART_UPLIFT_ASSET_VERSION !== v) {
        window.CART_UPLIFT_ASSET_VERSION = v;
        console.log('[CartUplift] Loaded asset version ' + v);
      }
      
      this.selfHealGrid();
      document.addEventListener('DOMContentLoaded', () => setTimeout(this.selfHealGrid, 800));
      document.addEventListener('cartuplift:opened', this.selfHealGrid);
    },

    selfHealGrid() {
      try {
        const layout = (window.CartUpliftSettings && window.CartUpliftSettings.recommendationLayout) || '';
        if (layout === 'grid') {
          const stale = document.querySelectorAll('.cartuplift-grid-overlay');
          if (stale.length) {
            console.warn('[CartUplift] Removing stale grid overlay nodes:', stale.length);
            stale.forEach(n => n.remove());
          }
        }
      } catch(_) {}
    }
  };

  // ============================================================================
  // MODULE 3: Analytics and Tracking
  // ============================================================================
  const Analytics = (window.CartAnalytics && typeof window.CartAnalytics.trackEvent === 'function')
    ? window.CartAnalytics
    : { trackEvent: () => {} };

  // ============================================================================
  // MODULE 4: Theme Detection and Color Management
  // ============================================================================
  const ThemeDetector = {
    detectColors() {
      let primaryColor = null;
      let backgroundColor = '#ffffff';
      
      // Try to get from CSS custom properties first
      const colorSchemeElements = document.querySelectorAll('[data-color-scheme], [style*="--color"], [class*="color-scheme"]');
      if (colorSchemeElements.length > 0) {
        for (const element of colorSchemeElements) {
          const computedStyle = window.getComputedStyle(element);
          const buttonColor = computedStyle.getPropertyValue('--color-button') || 
                            computedStyle.getPropertyValue('--color-primary') ||
                            computedStyle.getPropertyValue('--button-color');
          
          if (buttonColor && buttonColor.includes(',')) {
            const rgbValues = buttonColor.split(',').map(v => parseInt(v.trim()));
            if (rgbValues.length >= 3 && rgbValues.every(v => !isNaN(v) && v >= 0 && v <= 255)) {
              primaryColor = this.rgbToHex(`rgb(${rgbValues.join(',')})`);
              break;
            }
          }
        }
      }

      // Fallback to button detection
      if (!primaryColor) {
        const shopifyButtonSelectors = [
          '.btn--primary', '.button--primary', '.btn-primary',
          '[class*="primary"]', '[class*="button"]', '.shopify-payment-button'
        ];
        
        for (const selector of shopifyButtonSelectors) {
          const buttons = document.querySelectorAll(selector);
          for (const button of buttons) {
            if (button && button.offsetParent !== null) {
              const computedStyle = window.getComputedStyle(button);
              const bgColor = computedStyle.backgroundColor;
              if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                const hexColor = this.rgbToHex(bgColor);
                if (hexColor && hexColor !== '#ffffff' && hexColor !== '#000000') {
                  primaryColor = hexColor;
                  break;
                }
              }
            }
          }
          if (primaryColor) break;
        }
      }

      // Default fallback
      if (!primaryColor) {
        primaryColor = '#000000';
      }

      // Detect background color
      const bodyStyle = window.getComputedStyle(document.body);
      const bodyBgColor = bodyStyle.backgroundColor;
      if (bodyBgColor && bodyBgColor !== 'rgba(0, 0, 0, 0)' && bodyBgColor !== 'transparent') {
        backgroundColor = this.rgbToHex(bodyBgColor) || backgroundColor;
      }

      return { primary: primaryColor, background: backgroundColor };
    },

    isGreenColor(color) {
      if (!color || typeof color !== 'string') return false;
      
      const greenColors = [
        '#4caf50', '#8bc34a', '#cddc39', '#81c784',
        '#a5d6a7', '#c8e6c9', '#dcedc8', '#f1f8e9'
      ];
      
      const hex = color.toLowerCase();
      if (greenColors.includes(hex)) return true;
      
      // Check RGB values for greenish colors
      try {
        if (hex.startsWith('#')) {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return g > r && g > b && g > 100;
          }
        }
      } catch (_) {}
      
      return false;
    },

    rgbToHex(rgb) {
      if (!rgb || !rgb.includes('rgb')) return null;
      const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return null;
      
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      
      const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  };

  // ============================================================================
  // MODULE 5: Settings Manager
  // ============================================================================
  const SettingsManager = {
    normalize(settings) {
      const normalized = Object.assign({}, settings);
      
      // Layout normalization
      if (normalized.recommendationLayout) {
        const map = { 
          horizontal: 'row', row: 'row', carousel: 'row', 
          vertical: 'column', column: 'column', list: 'column', 
          grid: 'grid' 
        };
        normalized.recommendationLayout = map[normalized.recommendationLayout] || normalized.recommendationLayout;
      }
      
      // Boolean settings normalization
      normalized.enableStickyCart = Boolean(normalized.enableStickyCart);
      normalized.enableFreeShipping = Boolean(normalized.enableFreeShipping);
      normalized.enableGiftGating = Boolean(normalized.enableGiftGating);
      normalized.enableApp = normalized.enableApp !== false;
      normalized.enableRecommendations = normalized.enableRecommendations !== false;
      normalized.enableAddons = Boolean(normalized.enableAddons);
      normalized.enableNotes = Boolean(normalized.enableNotes);
      normalized.enableDiscountCode = Boolean(normalized.enableDiscountCode);
      normalized.enableExpressCheckout = Boolean(normalized.enableExpressCheckout);
      normalized.enableQuantitySelectors = Boolean(normalized.enableQuantitySelectors);
      normalized.enableItemRemoval = Boolean(normalized.enableItemRemoval);
      normalized.enableAnalytics = Boolean(normalized.enableAnalytics);
  // Default to true so our drawer opens unless explicitly disabled
  normalized.autoOpenCart = normalized.autoOpenCart !== false;
      normalized.enableTitleCaps = Boolean(normalized.enableTitleCaps);
      normalized.enableRecommendationTitleCaps = Boolean(normalized.enableRecommendationTitleCaps);
      
      return normalized;
    },

    async refresh(shop) {
      try {
        const shopDomain = shop || window.CartUpliftShop || window.Shopify?.shop || window.location.hostname;
        const apiUrl = `/apps/cart-uplift/api/settings?shop=${encodeURIComponent(shopDomain)}`;
        
        const response = await fetch(apiUrl);
        if (response.ok) {
          const newSettings = await response.json();
          window.CartUpliftSettings = Object.assign(window.CartUpliftSettings || {}, newSettings);
          
          // Dispatch event for listeners
          const event = new CustomEvent('cartuplift:settings:updated', { detail: newSettings });
          document.dispatchEvent(event);
          
          return newSettings;
        }
      } catch (error) {
        console.warn('🔧 Settings refresh failed:', error);
      }
      return window.CartUpliftSettings || {};
    }
  };

  // ============================================================================
  // MODULE 6: DOM Manager
  // ============================================================================
  const DOMManager = {
    createElement(tag, attributes = {}) {
      const el = document.createElement(tag);
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
          el.className = value;
        } else if (key === 'innerHTML') {
          el.innerHTML = value;
        } else {
          el.setAttribute(key, value);
        }
      });
      return el;
    },

    injectStyles(css) {
      let style = document.getElementById('cartuplift-dynamic-styles');
      if (!style) {
        style = document.createElement('style');
        style.id = 'cartuplift-dynamic-styles';
        style.type = 'text/css';
        document.head.appendChild(style);
      }
      style.textContent = css;
    },

    showToast(message, type = 'info') {
      const toast = this.createElement('div', {
        className: `cartuplift-toast cartuplift-toast-${type}`,
        innerHTML: message
      });
      
      Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 16px',
        borderRadius: '4px',
        color: 'white',
        backgroundColor: type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      });
      
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  };

  // ============================================================================
  // MODULE 7: API Client
  // ============================================================================
  const APIClient = {
    async fetchCart() {
      try {
        const response = await fetch('/cart.js');
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('🛒 Error fetching cart:', error);
      }
      return { items: [], item_count: 0, total_price: 0, attributes: {} };
    },

    async addToCart(variantId, quantity = 1) {
      try {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: variantId,
            quantity: quantity
          })
        });
        
        if (response.ok) {
          return await response.json();
        } else {
          const error = await response.text();
          throw new Error(error.includes('variant') ? 'VARIANT_NOT_FOUND' : 'ADD_TO_CART_FAILED');
        }
      } catch (error) {
        console.error('🛒 Add to cart error:', error);
        throw error;
      }
    },

    async updateQuantity(line, quantity) {
      try {
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line: line,
            quantity: quantity
          })
        });
        
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('🛒 Update quantity error:', error);
      }
      return await this.fetchCart();
    },

    async updateCartAttributes(attributes) {
      try {
        const response = await fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attributes })
        });
        
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('🛒 Update attributes error:', error);
      }
    },

    async applyDiscountCode(code) {
      try {
        const response = await fetch(`/apps/cart-uplift/api/discount`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        
        if (response.ok) {
          return await response.json();
        } else {
          return { success: false, error: 'Invalid discount code' };
        }
      } catch (error) {
        console.error('🛒 Discount validation error:', error);
        return { success: false, error: 'Validation failed' };
      }
    }
  };

  // ============================================================================
  // MODULE 8: Main Cart Drawer Controller
  // ============================================================================
  class CartUpliftDrawer {
    constructor(settings) {
      // Initialize core properties
      this.settings = SettingsManager.normalize(Object.assign({}, window.CartUpliftSettings || {}, settings || {}));
      this.themeColors = ThemeDetector.detectColors();
      this.cart = null;
      this.isOpen = false;
      this._isAnimating = false;
      this._quantityBusy = false;
      this._recommendationsLoaded = false;
      this._rebuildInProgress = false;
      this._recommendationsLocked = false;
      this._updateDebounceTimer = null;
      this.recommendations = [];
      this._allRecommendations = [];
      
      // Apply theme color overrides
      if (!this.settings.shippingBarColor || this.settings.shippingBarColor === '#4CAF50') {
        this.settings.shippingBarColor = '#121212';
      }
      if (!this.settings.backgroundColor) {
        this.settings.backgroundColor = this.themeColors.background;
      }
      
      // Install interceptors early if app is enabled
      if (this.settings.enableApp) {
        this.installEarlyInterceptors();
      }
      
      // Initialize
      this.initPromise = this.init();
    }

    async init() {
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      await this.setup();
    }

    async setup() {
      // Refresh settings from API
      await SettingsManager.refresh(this.cart?.shop);
      
      // Fetch initial cart data
      this.cart = await APIClient.fetchCart();
      
      // Create drawer
      this.createDrawer();
      
      // Update drawer content
      this.updateDrawerContent();
      
      // Handle sticky cart
      console.log('🛒 Cart Uplift: Checking sticky cart settings...', {
        enableStickyCart: this.settings.enableStickyCart,
        allSettings: this.settings
      });
      
      if (this.settings.enableStickyCart) {
        console.log('🛒 Cart Uplift: Creating sticky cart...');
        this.createStickyCart();
      } else {
        console.log('🛒 Cart Uplift: Sticky cart disabled in settings');
      }
      
      // Set up interceptors
      this.setupCartInterception();
      this.installAddToCartMonitoring();
      
      // Apply custom colors
      this.applyCustomColors();
      
      // Set up notification blocker
      if (this.settings.enableApp) {
        this.setupNotificationBlocker();
      };
      
      // Load recommendations if enabled
      if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
        await this.loadRecommendations();
        this._recommendationsLoaded = true;
        this.updateDrawerContent();
      }
    }

    installEarlyInterceptors() {
      this.setupCartInterception();
      this.installAddToCartMonitoring();
    this.installXHRMonitoring();
    this.installFormSubmitInterception();
    }

    setupCartInterception() {
      document.addEventListener('click', (e) => {
        const cartTriggers = [
          'a[href="/cart"]',
          '.cart-icon',
          '.cart-link',
          '.cart-toggle',
          '[data-cart-drawer-toggle]'
        ];
        
        const target = e.target.closest(cartTriggers.join(','));
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          this.openDrawer();
        }
      }, true);
    }

    installAddToCartMonitoring() {
      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await origFetch(...args);
        const url = args[0] ? args[0].toString() : '';

        const isCartAdd = url.includes('/cart/add');
        
        if (isCartAdd && response.ok) {
          setTimeout(async () => {
            await this.fetchCart();
            this.updateDrawerContent();
            
            if (this.settings.autoOpenCart && this.settings.enableApp) {
              this.hideThemeNotifications();
              this.openDrawer();
            }
          }, 100);
        }
        
        return response;
      };
    }

    hideThemeNotifications() {
      const notificationSelectors = [
        '.product-form__notification',
        '.cart-notification',
        'cart-notification',
        '.notification',
        '[data-notification]',
        '.cart__notification',
        '#CartNotification',
        '.cart-popup',
        '.ajax-cart',
        '.added-to-cart-notification'
      ];
      
      notificationSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (!el.id || !el.id.includes('cartuplift')) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
          }
        });
      });
    }

    createDrawer() {
      let container = document.getElementById('cartuplift-app-container');
      
      if (!container) {
        container = document.createElement('div');
        container.id = 'cartuplift-app-container';
        container.innerHTML = `
          <div id="cartuplift-backdrop"></div>
          <div id="cartuplift-cart-popup"></div>
        `;
        document.body.appendChild(container);
      }
      
      this.renderDrawerContent();
      this.attachDrawerEvents();
    }

    getDrawerHTML() {
      const cart = this.cart;
      const settings = this.settings;
      const itemCount = cart?.item_count || 0;
      
      // Determine what progress bars to show based on settings
      const showFreeShipping = settings.enableFreeShipping && settings.freeShippingThreshold > 0;
      
      // Parse giftThresholds safely for checking
      let giftThresholds = [];
      try {
        giftThresholds = typeof settings.giftThresholds === 'string' ? 
          JSON.parse(settings.giftThresholds) : (settings.giftThresholds || []);
      } catch (e) {
        console.warn('Failed to parse giftThresholds:', e);
        giftThresholds = [];
      }
      const showGiftGating = settings.enableGiftGating && giftThresholds.length > 0;
      
      // For recommendations: only show if enabled and has items or recommendations loaded
      const shouldShowRecommendations = settings.enableRecommendations && 
        (cart?.items?.length > 0 || this._recommendationsLoaded);
      
      const hasDiscount = cart && cart.total_discount > 0;
      const finalTotal = this.getDisplayedTotalCents();
      
      return `
        <div class="cartuplift-drawer">
          ${this.getHeaderHTML(itemCount)}
          
          ${showFreeShipping ? this.getFreeShippingProgressHTML() : ''}
          ${showGiftGating ? this.getGiftProgressHTML() : ''}
          
          <div class="cartuplift-content-wrapper">
            ${settings.urgencyPlacement === 'header' ? this._getUrgencyHTML() : ''}
            <div class="cartuplift-items">
              ${this.getCartItemsHTML()}
            </div>
            
            <div class="cartuplift-scrollable-content">
              ${settings.enableAddons ? this.getAddonsHTML() : ''}
              ${settings.quantitySuggestionPlacement === 'recommendations' ? this._getQuantitySuggestionsHTML() : ''}
              ${shouldShowRecommendations ? this.getRecommendationsHTML() : ''}
              ${(() => {
                if (!(settings.enableDiscountCode || settings.enableNotes)) return '';
                return this.getInlineLinksHTML();
              })()}
            </div>
          </div>
          
          <div class="cartuplift-footer">
            <div class="cartuplift-subtotal">
              <span>Subtotal${hasDiscount ? ' (after discount)' : ''}</span>
              <span class="cartuplift-subtotal-amount">${this.formatMoney(finalTotal)}</span>
            </div>
            
            ${settings.urgencyPlacement === 'footer' ? this._getUrgencyHTML() : ''}
            
            <button class="cartuplift-checkout-btn" onclick="window.cartUpliftDrawer.proceedToCheckout()">
              ${settings.checkoutButtonText || 'Checkout'}
            </button>
            
            ${(() => {
              return settings.enableExpressCheckout ? this.getExpressCheckoutHTML() : '';
            })()}
          </div>
        </div>
      `;
    }

    renderDrawerContent() {
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup) return;
      
      popup.innerHTML = this.getDrawerHTML();
    }

    getHeaderHTML(itemCount) {
      const messages = [];
      
      // Add shipping progress to header subtitle
      if (this.settings.enableFreeShipping && this.settings.freeShippingThreshold > 0) {
        const currentTotal = this.cart ? this.cart.total_price / 100 : 0;
        const threshold = this.settings.freeShippingThreshold;
        const remaining = Math.max(threshold - currentTotal, 0);
        
        if (remaining > 0) {
          const message = (this.settings.progressMessage || 'You\'re {amount} away from free shipping!')
            .replace(/\{amount\}/g, this.formatMoney(remaining * 100))
            .replace(/\{\{amount\}\}/g, this.formatMoney(remaining * 100));
          messages.push(message);
        } else {
          messages.push(this.settings.successMessage || '🎉 Congratulations! You\'ve unlocked free shipping!');
        }
      }

      // Add gift progress to header subtitle  
      if (this.settings.enableGiftGating && this.settings.giftThresholds) {
        const currentTotal = this.cart ? this.cart.total_price / 100 : 0;
        // Parse giftThresholds if it's a string
        const giftThresholds = typeof this.settings.giftThresholds === 'string' ? 
          JSON.parse(this.settings.giftThresholds) : this.settings.giftThresholds;
        
        if (giftThresholds?.length > 0) {
          const nextThreshold = giftThresholds.find(t => currentTotal < t.threshold);
        
          if (nextThreshold) {
            const remaining = nextThreshold.threshold - currentTotal;
            messages.push(`Add ${this.formatMoney(remaining * 100)} for ${nextThreshold.gift}`);
          }
        }
      }

      let progressMessage = '';
      if (messages.length > 0) {
        progressMessage = messages.join(' • ');
      }
      
      return `
        <div class="cartuplift-header">
          <h2 class="cartuplift-cart-title">Cart (${itemCount})</h2>
          ${this.settings.urgencyPlacement === 'subtitle' ? this._getUrgencyHTML() : ''}
          ${progressMessage ? `
            <div class="cartuplift-shipping-info">
              <p class="cartuplift-shipping-message">${progressMessage}</p>
            </div>
          ` : ''}
          <button class="cartuplift-close" aria-label="Close cart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        ${progressMessage ? `
          <div class="cartuplift-shipping-info-mobile">
            <p class="cartuplift-shipping-message">${progressMessage}</p>
          </div>
        ` : ''}
      `;
    }

    getFreeShippingProgressHTML() {
      const currentTotal = this.cart ? this.cart.total_price / 100 : 0;
      const threshold = this.settings.freeShippingThreshold || 100;
      const progress = Math.min((currentTotal / threshold) * 100, 100);
      
      // Use shippingBarColor (default black) consistently for the fill
      const safeShippingColor = this.settings.shippingBarColor || '#121212';
      
      console.log('🛒 Cart Uplift: Free shipping progress:', {
        progress: progress,
        shippingColor: safeShippingColor,
        progressBarHTML: `width: ${progress}%; background: ${safeShippingColor} !important;`
      });
      
      return `
        <div class="cartuplift-shipping-bar">
          <div class="cartuplift-shipping-progress">
            <div class="cartuplift-shipping-progress-fill" style="width: ${progress}%; background: ${safeShippingColor} !important; display: block;"></div>
          </div>
        </div>
      `;
    }

    getGiftProgressHTML() {
      // Parse giftThresholds safely
      let giftThresholds = [];
      try {
        giftThresholds = typeof this.settings.giftThresholds === 'string' ? 
          JSON.parse(this.settings.giftThresholds) : (this.settings.giftThresholds || []);
      } catch (e) {
        console.warn('Failed to parse giftThresholds in getGiftProgressHTML:', e);
        return '';
      }
      
      if (!this.settings.enableGiftGating || !giftThresholds.length) return '';
      
      const currentTotal = this.cart ? this.cart.total_price / 100 : 0;
      const thresholds = giftThresholds.sort((a, b) => a.threshold - b.threshold);
      
      if (this.settings.giftDisplayMode === 'stacked') {
        return this.renderStackedProgress(thresholds, currentTotal);
      } else {
        return this.renderSingleProgress(thresholds, currentTotal);
      }
    }

    renderStackedProgress(thresholds, currentTotal) {
      const stackedHTML = thresholds.map((threshold, index) => {
        const isUnlocked = currentTotal >= threshold.threshold;
        const progress = Math.min((currentTotal / threshold.threshold) * 100, 100);
        
        return `
          <div class="cartuplift-gift-threshold">
            <div class="cartuplift-gift-info">
              <span class="cartuplift-gift-title">${isUnlocked ? '✓' : ''} ${threshold.gift}</span>
              <span class="cartuplift-gift-progress-text">${this.formatMoney(threshold.threshold * 100)}</span>
            </div>
            <div class="cartuplift-gift-bar">
              <div class="cartuplift-gift-fill" style="width: ${progress}%; background: ${isUnlocked ? (this.themeColors.primary || '#121212') : '#121212'};"></div>
            </div>
          </div>
        `;
      }).join('');
      
      return `
        <div class="cartuplift-gift-progress-container">
          <div class="cartuplift-stacked-progress">
            ${stackedHTML}
          </div>
        </div>
      `;
    }

    renderSingleProgress(thresholds, currentTotal) {
      // Find next unattained threshold
      const nextThreshold = thresholds.find(t => currentTotal < t.threshold);
      const unlockedThresholds = thresholds.filter(t => currentTotal >= t.threshold);
      
      if (!nextThreshold && unlockedThresholds.length === 0) return '';
      
      let html = '';
      
      // Show unlocked gifts
      if (unlockedThresholds.length > 0) {
        const unlockedHTML = unlockedThresholds.map(t => 
          `<div class="cartuplift-unlocked-item">✓ ${t.gift}</div>`
        ).join('');
        
        html += `
          <div class="cartuplift-unlocked-gifts">
            ${unlockedHTML}
          </div>
        `;
      }
      
      // Show next goal
      if (nextThreshold) {
        const progress = Math.min((currentTotal / nextThreshold.threshold) * 100, 100);
        const remaining = nextThreshold.threshold - currentTotal;
        
        html += `
          <div class="cartuplift-next-goal">
            <div class="cartuplift-next-info">
              ${this.formatMoney(remaining * 100)} away from ${nextThreshold.gift}
            </div>
            <div class="cartuplift-next-bar">
              <div class="cartuplift-next-fill" style="width: ${progress}%;"></div>
            </div>
          </div>
        `;
      }
      
      return html ? `
        <div class="cartuplift-gift-progress-container">
          ${html}
        </div>
      ` : '';
    }

    getRecommendationsHTML() {
      if (!this.recommendations?.length) return '';

      const layout = this.settings.recommendationLayout || 'column';
      const title = this.settings.recommendationsTitle || 'You might also like';
      const capsEnabled = !!(this.settings.enableTitleCaps || this.settings.enableRecommendationTitleCaps);

      // For row layout, render controls outside the scroll container so they don't scroll
      const controlsHTML = layout === 'row' ? `
        <div class="cartuplift-carousel-controls">
          <button class="cartuplift-carousel-nav prev" data-nav="prev" aria-label="Previous">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 12l-4-4 4-4"/>
            </svg>
          </button>
          <button class="cartuplift-carousel-nav next" data-nav="next" aria-label="Next">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 4l4 4-4 4"/>
            </svg>
          </button>
        </div>
      ` : '';

      return `
        <div class="cartuplift-recommendations cartuplift-recommendations-${layout}">
          <div class="cartuplift-recommendations-header">
            <h3 class="cartuplift-recommendations-title">${capsEnabled ? title.toUpperCase() : title}</h3>
            ${layout === 'row' ? `
              <button class="cartuplift-recommendations-toggle" aria-label="Toggle recommendations">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 1v10M1 6h10"/>
                </svg>
              </button>
            ` : ''}
          </div>
          <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content">
            ${this.getRecommendationItems()}
          </div>
          ${controlsHTML}
        </div>
      `;
    }

    getRecommendationItems() {
      if (!this.recommendations?.length) return '';

      const layout = this.settings.recommendationLayout || 'column';
      
      if (layout === 'row') {
        // Horizontal carousel layout with detailed cards
        return `
          <div class="cartuplift-recommendations-track">
            ${this.recommendations.map(rec => `
              <div class="cartuplift-recommendation-card" data-variant-id="${rec.variant_id}">
                <div class="cartuplift-card-content">
                  <div class="cartuplift-product-image">
                    <img src="${rec.image}" alt="${Utils.escapeHtml(rec.title)}" loading="lazy">
                  </div>
                  <div class="cartuplift-product-info">
                    <h4>${Utils.escapeHtml(rec.title)}</h4>
                    ${this.generateVariantSelector(rec)}
                  </div>
                  <div class="cartuplift-product-actions">
                    <div class="cartuplift-recommendation-price" data-price="${rec.priceCents}">${Utils.formatMoney(rec.priceCents)}</div>
                    <button class="cartuplift-add-recommendation" data-variant-id="${rec.variant_id}" aria-label="Add ${Utils.escapeHtml(rec.title)} to cart">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else if (layout === 'grid') {
        // Grid layout
        return `
          <div class="cartuplift-grid-container">
            ${this.recommendations.map(rec => `
              <div class="cartuplift-grid-item" data-variant-id="${rec.variant_id}">
                <img src="${rec.image}" alt="${Utils.escapeHtml(rec.title)}" loading="lazy">
                <div class="cartuplift-grid-overlay">
                  <div class="cartuplift-grid-title">${Utils.escapeHtml(rec.title)}</div>
                  <div class="cartuplift-grid-price">${Utils.formatMoney(rec.priceCents)}</div>
                  <button class="cartuplift-grid-add-btn" data-variant-id="${rec.variant_id}">+</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        // Column layout (vertical list)
        return this.recommendations.map(rec => `
          <div class="cartuplift-recommendation-item">
            <div class="cartuplift-recommendation-image">
              <img src="${rec.image}" alt="${Utils.escapeHtml(rec.title)}" loading="lazy">
            </div>
            <div class="cartuplift-recommendation-details">
              <div class="cartuplift-recommendation-title">${Utils.escapeHtml(rec.title)}</div>
              <div class="cartuplift-recommendation-price">${Utils.formatMoney(rec.priceCents)}</div>
            </div>
            <button class="cartuplift-add-recommendation-circle" data-variant-id="${rec.variant_id}" aria-label="Add ${Utils.escapeHtml(rec.title)} to cart">
              +
            </button>
          </div>
        `).join('');
      }
    }

    getDisplayedTotalCents() {
      if (!this.cart) return 0;
      
      // Start with Shopify's calculated total
      let total = this.cart.total_price || 0;
      
      // Handle discounts (they reduce the total)
      if (this.cart.total_discount) {
        // Shopify already includes discounts in total_price, so don't double-subtract
      }
      
      return total;
    }

    formatMoney(cents) {
      return Utils.formatMoney(cents);
    }

    _getUrgencyHTML() {
      if (!this.settings.urgencyMessage) return '';
      return `<div class="cartuplift-urgency">${this.settings.urgencyMessage}</div>`;
    }

    _getQuantitySuggestionsHTML() {
      // Add quantity suggestions if enabled
      return '';
    }

    getAddonsHTML() {
      // Add any product addons/upsells
      return '';
    }

    getInlineLinksHTML() {
      const links = [];
      
      if (this.settings.enableDiscountCode) {
        const linkText = this.settings.promotionLinkText || '+ Got a promotion code?';
        links.push(`<a href="#" class="cartuplift-inline-link" onclick="window.cartUpliftDrawer.showDiscountModal(); return false;">${linkText}</a>`);
      }
      
      if (this.settings.enableNotes) {
        const linkText = this.settings.notesLinkText || '+ Add order notes';
        links.push(`<a href="#" class="cartuplift-inline-link" onclick="window.cartUpliftDrawer.showNotesModal(); return false;">${linkText}</a>`);
      }
      
      if (links.length === 0) return '';
      
      return `
        <div class="cartuplift-inline-links">
          ${links.join('<span class="cartuplift-inline-sep"> • </span>')}
        </div>
      `;
    }

    getExpressCheckoutHTML() {
      return `
        <div class="cartuplift-express-checkout">
          <button class="cartuplift-paypal-btn" onclick="window.cartUpliftDrawer.expressCheckout('paypal')">
            <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" alt="PayPal" loading="lazy">
          </button>
          <button class="cartuplift-shoppay-btn" onclick="window.cartUpliftDrawer.expressCheckout('shoppay')">
            <span>Shop Pay</span>
          </button>
        </div>
      `;
    }

    showDiscountModal() {
      console.log('Show discount modal');
      // TODO: Implement discount modal
    }

    showNotesModal() {
      console.log('Show notes modal');
      // TODO: Implement notes modal  
    }

    expressCheckout(method) {
      console.log('Express checkout with:', method);
      // TODO: Implement express checkout
    }

    getFooterHTML(cart, settings) {
      const total = this.calculateDisplayTotal(cart);
      
      return `
        <div class="cartuplift-total">
          <span class="cartuplift-total-label">Total:</span>
          <span class="cartuplift-total-amount">${Utils.formatMoney(total)}</span>
        </div>
        
        <button class="cartuplift-checkout-btn" onclick="window.cartUpliftDrawer.proceedToCheckout()">
          ${settings.checkoutButtonText || 'Checkout'}
        </button>
        
        ${settings.enableExpressCheckout ? this.getExpressCheckoutHTML() : ''}
      `;
    }

    calculateDisplayTotal(cart) {
      if (!cart) return 0;
      
      const giftItems = (cart.items || []).filter(item => 
        item.properties && item.properties._is_gift === 'true'
      );
      
      const giftItemsTotal = giftItems.reduce((sum, item) => sum + (item.line_price || 0), 0);
      return cart.total_price - giftItemsTotal;
    }

    createStickyCart() {
      console.log('🛒 Cart Uplift: createStickyCart called');
      
      const existing = document.getElementById('cartuplift-sticky');
      if (existing) {
        console.log('🛒 Cart Uplift: Removing existing sticky cart');
        existing.remove();
      }

      const stickyCart = DOMManager.createElement('div', {
        id: 'cartuplift-sticky',
        className: `cartuplift-sticky ${this.settings.cartPosition || 'bottom-right'}`
      });
      
      console.log('🛒 Cart Uplift: Created sticky cart element with class:', stickyCart.className);
      
      let buttonContent = '';
      
      if (this.settings.stickyCartShowIcon !== false) {
        buttonContent += this.getCartIcon(this.settings.cartIcon);
      }
      
      if (this.settings.stickyCartShowCount !== false) {
        buttonContent += `<span class="cartuplift-sticky-count">${this.cart?.item_count || 0}</span>`;
      }
      
      if (this.settings.stickyCartShowTotal !== false) {
        const total = this.calculateDisplayTotal(this.cart);
        buttonContent += `<span class="cartuplift-sticky-total">${Utils.formatMoney(total)}</span>`;
      }
      
      stickyCart.innerHTML = `
        <button class="cartuplift-sticky-btn" aria-label="Open cart">
          ${buttonContent}
        </button>
      `;
      
      console.log('🛒 Cart Uplift: Adding sticky cart to body');
      document.body.appendChild(stickyCart);
      
      console.log('🛒 Cart Uplift: Sticky cart added to DOM:', document.getElementById('cartuplift-sticky'));
      
      const btn = stickyCart.querySelector('.cartuplift-sticky-btn');
      btn.addEventListener('click', () => this.openDrawer());
      
      console.log('🛒 Cart Uplift: Sticky cart setup complete');
    }

    getCartIcon(type = 'cart') {
      const icons = {
        bag: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>',
        basket: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 7.5h15l-1.5 7.5H6l-1.5-7.5zM4.5 7.5L3 3.75H1.5m3 3.75L6 15h12l1.5-7.5M9 19.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM20.25 19.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" /></svg>',
        cart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>'
      };
      return icons[type] || icons.cart;
    }

    applyCustomColors() {
      const themeColors = this.themeColors || ThemeDetector.detectColors();
      
      const safeThemeColor = ThemeDetector.isGreenColor(themeColors.primary) ? '#121212' : themeColors.primary;
      const safeButtonColor = this.settings.buttonColor && !ThemeDetector.isGreenColor(this.settings.buttonColor) 
        ? this.settings.buttonColor 
        : safeThemeColor;
      const safeShippingColor = this.settings.shippingBarColor && !ThemeDetector.isGreenColor(this.settings.shippingBarColor)
        ? this.settings.shippingBarColor 
        : safeThemeColor;
      
      let css = `
        :root {
          --cartuplift-success-color: ${safeThemeColor} !important;
          --cartuplift-button-color: ${safeButtonColor} !important;
          --cartuplift-shipping-fill: ${safeShippingColor} !important;
          ${this.settings.buttonTextColor ? `--cartuplift-button-text-color: ${this.settings.buttonTextColor} !important;` : ''}
          ${this.settings.backgroundColor ? `--cartuplift-background: ${this.settings.backgroundColor} !important;` : ''}
          ${this.settings.textColor ? `--cartuplift-primary: ${this.settings.textColor} !important;` : ''}
        }
        
        .cartuplift-progress-fill,
        .cartuplift-shipping-progress-fill {
          background: ${safeShippingColor} !important;
        }
        
        .cartuplift-checkout-btn,
        .cartuplift-add-recommendation {
          background: ${safeButtonColor} !important;
          ${this.settings.buttonTextColor ? `color: ${this.settings.buttonTextColor} !important;` : ''}
        }
        
        ${this.settings.enableApp ? `
        .cart-notification,
        cart-notification,
        .cart__notification,
        #CartNotification,
        .cart-popup:not(#cartuplift-cart-popup),
        .cart-drawer:not(#cartuplift-cart-popup) {
          display: none !important;
        }` : ''}
      `;
      
      DOMManager.injectStyles(css);
    }

    attachDrawerEvents() {
      const container = document.getElementById('cartuplift-app-container');
      if (!container) return;
      
      // Close button
      const closeBtn = container.querySelector('.cartuplift-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeDrawer());
      }
      
      // Backdrop click
      const backdrop = container.querySelector('#cartuplift-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) {
            this.closeDrawer();
          }
        });
      }
      
      // Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeDrawer();
        }
      });
      
      // Delegated event handlers
      container.addEventListener('click', (e) => {
        // Quantity controls
        if (e.target.classList.contains('cartuplift-qty-plus')) {
          const line = e.target.dataset.line;
          const display = container.querySelector(`[data-line="${line}"] .cartuplift-qty-display`);
          if (display) {
            const currentValue = parseInt(display.textContent) || 0;
            this.updateQuantity(line, currentValue + 1);
          }
        } else if (e.target.classList.contains('cartuplift-qty-minus')) {
          const line = e.target.dataset.line;
          const display = container.querySelector(`[data-line="${line}"] .cartuplift-qty-display`);
          if (display) {
            const currentValue = parseInt(display.textContent) || 0;
            this.updateQuantity(line, Math.max(0, currentValue - 1));
          }
        } else if (e.target.classList.contains('cartuplift-item-remove-x') || 
                   e.target.closest('.cartuplift-item-remove-x')) {
          const button = e.target.classList.contains('cartuplift-item-remove-x') 
            ? e.target 
            : e.target.closest('.cartuplift-item-remove-x');
          const line = button.dataset.line;
          this.updateQuantity(line, 0);
        } 
        // Recommendation add buttons (all layouts)
        else if (e.target.classList.contains('cartuplift-add-recommendation-circle') ||
                 e.target.classList.contains('cartuplift-add-recommendation') ||
                 e.target.classList.contains('cartuplift-grid-add-btn')) {
          const variantId = e.target.dataset.variantId;
          if (variantId) {
            this.addToCart(variantId);
          }
        }
        // Carousel navigation
        else if (e.target.classList.contains('cartuplift-carousel-nav') || e.target.closest('.cartuplift-carousel-nav')) {
          const navButton = e.target.classList.contains('cartuplift-carousel-nav') ? e.target : e.target.closest('.cartuplift-carousel-nav');
          const direction = navButton.dataset.nav;
          this.handleCarouselNavigation(direction);
        }
        // Recommendations toggle
        else if (e.target.classList.contains('cartuplift-recommendations-toggle') || e.target.closest('.cartuplift-recommendations-toggle')) {
          this.toggleRecommendations();
        }
      });

      // Handle variant selector changes
      container.addEventListener('change', (e) => {
        if (e.target.classList.contains('cartuplift-size-dropdown')) {
          this.handleVariantChange(e.target);
        }
      });
    }

    async fetchCart() {
      this.cart = await APIClient.fetchCart();
    }

    async updateQuantity(line, quantity) {
      if (this._quantityBusy) return;
      this._quantityBusy = true;
      
      try {
        this.cart = await APIClient.updateQuantity(line, quantity);
        this.updateDrawerContent();
      } catch (error) {
        console.error('🛒 Error updating quantity:', error);
      } finally {
        this._quantityBusy = false;
      }
    }

    async addToCart(variantId, quantity = 1) {
      if (this._addToCartBusy) return;
      this._addToCartBusy = true;
      
      const buttons = document.querySelectorAll(`[data-variant-id="${variantId}"]`);
      buttons.forEach(button => {
        button.disabled = true;
        button.style.opacity = '0.6';
      });
      
      try {
        await APIClient.addToCart(variantId, quantity);
        await this.fetchCart();
        this.updateDrawerContent();
      } catch (error) {
        console.error('🛒 Error adding to cart:', error);
        if (error.message === 'VARIANT_NOT_FOUND') {
          this.removeInvalidRecommendation(variantId);
        }
      } finally {
        buttons.forEach(button => {
          button.disabled = false;
          button.style.opacity = '1';
        });
        setTimeout(() => { this._addToCartBusy = false; }, 300);
      }
    }

    async loadRecommendations() {
      try {
        const desired = Number(this.settings.maxRecommendations);
        const limit = Math.max(isFinite(desired) && desired > 0 ? desired : 4, 4);
        
        if (this.cart && this.cart.items && this.cart.items.length > 0) {
          const productId = this.cart.items[0].product_id;
          const response = await fetch(`/recommendations/products.json?product_id=${productId}&limit=${limit}`);
          if (response.ok) {
            const data = await response.json();
            this.recommendations = (data.products || []).map(p => this.formatProduct(p)).filter(Boolean);
          }
        }
        
        if (this.recommendations.length === 0) {
          const response = await fetch(`/products.json?limit=${limit}`);
          if (response.ok) {
            const data = await response.json();
            this.recommendations = (data.products || []).map(p => this.formatProduct(p)).filter(Boolean);
          }
        }
      } catch (error) {
        console.error('🛒 Error loading recommendations:', error);
        this.recommendations = [];
      }
    }

    formatProduct(product) {
      let basePrice = product?.variants?.[0]?.price || product?.price || 0;
      let variantId = null;

      if (product && Array.isArray(product.variants) && product.variants.length > 0) {
        const firstVariant = product.variants[0];
        if (firstVariant && firstVariant.id) {
          variantId = firstVariant.id;
        }
      }

      if (!variantId) {
        return null;
      }

      return {
        id: product.id,
        title: product.title || 'Untitled',
        priceCents: Utils.normalizePriceToCents(basePrice),
        image: product.featured_image?.src || product.featured_image || product.image || 
               product.images?.[0]?.src || 'https://via.placeholder.com/150',
        variant_id: variantId,
        url: product.url || (product.handle ? `/products/${product.handle}` : '#'),
        variants: (product.variants || []).map(v => ({
          ...v,
          price_cents: Utils.normalizePriceToCents(v.price)
        })),
        options: product.options || []
      };
    }

    generateVariantSelector(product) {
      if (!product.variants || product.variants.length <= 1) {
        return '<div class="cartuplift-product-variation hidden"></div>';
      }

      // Simple single dropdown for multiple variants
      const options = product.variants.map(variant => 
        `<option value="${variant.id}" data-price="${variant.price_cents || Utils.normalizePriceToCents(variant.price)}">${variant.title || 'Option'}</option>`
      ).join('');

      return `
        <div class="cartuplift-product-variation">
          <select class="cartuplift-size-dropdown" data-product-id="${product.id}">
            ${options}
          </select>
        </div>
      `;
    }

    removeInvalidRecommendation(variantId) {
      if (this.recommendations && Array.isArray(this.recommendations)) {
        this.recommendations = this.recommendations.filter(rec => {
          const recVariantId = rec.variant_id || rec.variantId || rec.id;
          return recVariantId.toString() !== variantId.toString();
        });
        
        if (this.isOpen) {
          this.updateDrawerContent();
        }
      }
    }

    updateDrawerContent() {
      // Update sticky cart
      try {
        const countEl = document.querySelector('.cartuplift-sticky-count');
        const totalEl = document.querySelector('.cartuplift-sticky-total');
        if (countEl && this.settings.stickyCartShowCount !== false && this.cart) {
          countEl.textContent = this.cart.item_count;
        }
        if (totalEl && this.settings.stickyCartShowTotal !== false && this.cart) {
          totalEl.textContent = Utils.formatMoney(this.calculateDisplayTotal(this.cart));
        }
      } catch {}
      
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup) return;
      
      const contentWrapper = popup.querySelector('.cartuplift-content-wrapper');
      const currentScrollTop = contentWrapper ? contentWrapper.scrollTop : 0;
      
      this.renderDrawerContent();
      this.attachDrawerEvents();
      
      const newContentWrapper = popup.querySelector('.cartuplift-content-wrapper');
      if (newContentWrapper && currentScrollTop > 0) {
        requestAnimationFrame(() => {
          newContentWrapper.scrollTop = currentScrollTop;
        });
      }
    }

    async openDrawer() {
      if (this._isAnimating || this.isOpen) return;
      
      if (this.settings.enableAnalytics) {
        Analytics.trackEvent('cart_open');
      }
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        this._isAnimating = false;
        return;
      }
      
      await this.fetchCart();
      
      if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
        await this.loadRecommendations();
        this._recommendationsLoaded = true;
      }
      
      this.updateDrawerContent();
      
      container.style.display = 'block';
      void container.offsetHeight;
      container.classList.add('active');
      document.documentElement.classList.add('cartuplift-no-scroll');
      document.body.classList.add('cartuplift-no-scroll');
      
      setTimeout(() => {
        this._isAnimating = false;
        this.isOpen = true;
      }, 300);
    }

    closeDrawer() {
      if (this._isAnimating || !this.isOpen) return;
      
      if (this.settings.enableAnalytics) {
        Analytics.trackEvent('cart_close');
      }
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        this._isAnimating = false;
        return;
      }
      
      container.classList.remove('active');
      document.documentElement.classList.remove('cartuplift-no-scroll');
      document.body.classList.remove('cartuplift-no-scroll');
      
      setTimeout(() => {
        container.style.display = 'none';
        this._isAnimating = false;
        this.isOpen = false;
      }, 300);
    }

    proceedToCheckout() {
      if (this.settings.enableAnalytics) {
        Analytics.trackEvent('checkout_initiated');
      }
      window.location.href = '/checkout';
    }

    proceedToPayPal() {
      if (this.settings.enableAnalytics) {
        Analytics.trackEvent('paypal_checkout');
      }
      window.location.href = '/checkout';
    }

    proceedToShopPay() {
      if (this.settings.enableAnalytics) {
        Analytics.trackEvent('shoppay_checkout');
      }
      window.location.href = '/checkout';
    }

    // Modal functionality for discount codes, notes, and gift messages
    openDiscountModal() {
      const prev = { 
        enableDiscountCode: this.settings.enableDiscountCode, 
        enableNotes: this.settings.enableNotes, 
        enableGiftMessage: this.settings.enableGiftMessage 
      };
      this.settings.enableDiscountCode = true;
      this.settings.enableNotes = false;
      this.settings.enableGiftMessage = false;
      this.openCustomModal();
      this.settings = Object.assign(this.settings, prev);
    }

    openNotesModal() {
      const prev = { 
        enableDiscountCode: this.settings.enableDiscountCode, 
        enableNotes: this.settings.enableNotes, 
        enableGiftMessage: this.settings.enableGiftMessage 
      };
      this.settings.enableDiscountCode = false;
      this.settings.enableNotes = true;
      this.settings.enableGiftMessage = false;
      this.openCustomModal();
      this.settings = Object.assign(this.settings, prev);
    }

    openGiftMessageModal() {
      const prev = { 
        enableDiscountCode: this.settings.enableDiscountCode, 
        enableNotes: this.settings.enableNotes, 
        enableGiftMessage: this.settings.enableGiftMessage 
      };
      this.settings.enableDiscountCode = false;
      this.settings.enableNotes = false;
      this.settings.enableGiftMessage = true;
      this.openCustomModal();
      this.settings = Object.assign(this.settings, prev);
    }

    openCustomModal() {
      let modal = document.getElementById('cartuplift-custom-modal');
      if (modal) {
        modal.remove();
      }
      
      modal = document.createElement('div');
      modal.id = 'cartuplift-custom-modal';
      modal.className = 'cartuplift-custom-modal';
      
      let modalContent = `
        <div class="cartuplift-modal-content">
          <div class="cartuplift-modal-header">
            <h3 class="cartuplift-modal-title">Add to Order</h3>
            <button class="cartuplift-modal-close" onclick="window.cartUpliftDrawer.closeCustomModal()">×</button>
          </div>
          <div class="cartuplift-modal-body">
      `;
      
      if (this.settings.enableDiscountCode) {
        const currentCode = (this.cart && this.cart.attributes && this.cart.attributes['discount_code']) ? String(this.cart.attributes['discount_code']) : '';
        const currentSummary = (this.cart && this.cart.attributes && this.cart.attributes['discount_summary']) ? String(this.cart.attributes['discount_summary']) : '';
        const discountTitle = this.settings.discountSectionTitle || 'Discount Code';
        const discountPlaceholder = this.settings.discountPlaceholder || 'Enter your voucher code';
        
        modalContent += `
          <div class="cartuplift-modal-section">
            <label class="cartuplift-modal-label">${discountTitle}</label>
            <div class="cartuplift-modal-input-group">
              <input type="text" id="modal-discount-code" class="cartuplift-modal-input" 
                     placeholder="${discountPlaceholder}" 
                     ${currentCode ? `value="${currentCode}" disabled` : ''}
                     onkeyup="window.cartUpliftDrawer.handleDiscountInput(event)">
              ${currentCode ? `
                <button type="button" class="cartuplift-modal-apply-btn" 
                        onclick="window.cartUpliftDrawer.removeDiscountCode()">Remove</button>
              ` : `
                <button type="button" class="cartuplift-modal-apply-btn" 
                        onclick="window.cartUpliftDrawer.applyModalDiscount()">${this.settings.applyButtonText || 'Apply'}</button>
              `}
            </div>
            <div id="modal-discount-message" class="cartuplift-modal-message">${currentCode ? `<span class="success">${currentSummary || `✓ Discount code "${currentCode}" saved! Will be applied at checkout.`}</span>` : ''}</div>
          </div>
        `;
      }
      
      if (this.settings.enableNotes) {
        const notesTitle = this.settings.notesSectionTitle || 'Order Notes';
        const notesPlaceholder = this.settings.notesPlaceholder || 'Add special instructions for your order...';
        modalContent += `
          <div class="cartuplift-modal-section">
            <label class="cartuplift-modal-label">${notesTitle}</label>
            <textarea id="modal-order-notes" class="cartuplift-modal-textarea" 
                      placeholder="${notesPlaceholder}" rows="3" maxlength="500"
                      onkeyup="window.cartUpliftDrawer.updateCharCount(this, 'notes-char-count', 500)"></textarea>
            <div class="cartuplift-modal-char-count">
              <span id="notes-char-count">500</span> characters remaining
            </div>
          </div>
        `;
      }
      
      if (this.settings.enableGiftMessage) {
        const giftTitle = this.settings.giftSectionTitle || 'Gift Message';
        const giftPlaceholder = this.settings.giftPlaceholder || 'Write a personal message for this gift...';
        modalContent += `
          <div class="cartuplift-modal-section">
            <label class="cartuplift-modal-label">${giftTitle}</label>
            <textarea id="modal-gift-message" class="cartuplift-modal-textarea" 
                      placeholder="${giftPlaceholder}" rows="2" maxlength="200"
                      onkeyup="window.cartUpliftDrawer.updateCharCount(this, 'gift-char-count', 200)"></textarea>
            <div class="cartuplift-modal-char-count">
              <span id="gift-char-count">200</span> characters remaining
            </div>
          </div>
        `;
      }
      
      modalContent += `
          </div>
          <div class="cartuplift-modal-footer">
            <button class="cartuplift-modal-btn secondary" onclick="window.cartUpliftDrawer.closeCustomModal()">Cancel</button>
            <button class="cartuplift-modal-btn primary" onclick="window.cartUpliftDrawer.saveModalOptions()">Save Changes</button>
          </div>
        </div>
      `;
      
      modal.innerHTML = modalContent;
      document.body.appendChild(modal);
      
      modal.classList.add('active');
      
      const firstInput = modal.querySelector('input, textarea');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }

    closeCustomModal() {
      const modal = document.getElementById('cartuplift-custom-modal');
      if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
      }
    }

    updateCharCount(textarea, counterId, maxLength) {
      const counter = document.getElementById(counterId);
      if (counter) {
        const remaining = maxLength - textarea.value.length;
        counter.textContent = remaining;
        counter.style.color = remaining < 50 ? '#e74c3c' : '#666';
      }
    }

    handleDiscountInput(event) {
      if (event.key === 'Enter') {
        this.applyModalDiscount();
      }
    }

    async applyModalDiscount() {
      const modal = document.getElementById('cartuplift-custom-modal');
      const input = modal?.querySelector('#modal-discount-code');
      const messageEl = modal?.querySelector('#modal-discount-message');
      const button = modal?.querySelector('.cartuplift-modal-apply-btn');
      
      if (!input || !input.value.trim()) {
        if (messageEl) messageEl.innerHTML = '<span class="error">Please enter a discount code</span>';
        return;
      }
      
      const discountCode = input.value.trim().toUpperCase();
      const existingCode = (this.cart && this.cart.attributes) ? String(this.cart.attributes['discount_code'] || '').toUpperCase() : '';
      
      if (existingCode && existingCode === discountCode) {
        if (messageEl) messageEl.innerHTML = `<span class="success">Code "${discountCode}" is already applied.</span>`;
        return;
      }
      
      if (button) {
        button.disabled = true;
        button.textContent = 'Applying...';
      }
      
      try {
        const result = await APIClient.applyDiscountCode(discountCode);
        
        if (result.success) {
          const cartData = await APIClient.fetchCart();
          
          const updateData = {
            attributes: {
              ...cartData.attributes,
              'discount_code': discountCode,
              'discount_summary': result.discount.summary || `Discount: ${discountCode}`,
              'discount_kind': result.discount.kind,
              'discount_percent': result.discount.percent ? String(result.discount.percent) : '',
              'discount_amount_cents': result.discount.amountCents ? String(result.discount.amountCents) : ''
            }
          };
          
          await APIClient.updateCartAttributes(updateData.attributes);
          await this.fetchCart();
          this.updateDrawerContent();
          
          if (messageEl) messageEl.innerHTML = `<span class="success">✓ Discount code "${discountCode}" validated! Previewed below and will apply at checkout.</span>`;
          if (input) input.value = '';
          DOMManager.showToast('Discount code validated!', 'success');
          this.openCustomModal();
        } else {
          if (messageEl) messageEl.innerHTML = `<span class="error">${result.error || 'Invalid discount code'}</span>`;
          DOMManager.showToast('Invalid discount code', 'error');
        }
      } catch (error) {
        console.error('Error validating discount:', error);
        if (messageEl) messageEl.innerHTML = '<span class="error">Unable to validate discount code. Please check the code and try again.</span>';
        DOMManager.showToast('Discount validation failed', 'error');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'Apply';
        }
      }
    }

    async removeDiscountCode() {
      try {
        const cartData = await APIClient.fetchCart();
        const attrs = { ...(cartData.attributes || {}) };
        attrs['discount_code'] = null;
        attrs['discount_summary'] = null;
        attrs['discount_kind'] = null;
        attrs['discount_percent'] = null;
        attrs['discount_amount_cents'] = null;

        await APIClient.updateCartAttributes(attrs);
        await this.fetchCart();
        this.updateDrawerContent();
        DOMManager.showToast('Discount removed', 'success');
        
        this.openCustomModal();
      } catch (e) {
        console.error('Error removing discount:', e);
        DOMManager.showToast('Could not remove discount', 'error');
      }
    }

    async saveModalOptions() {
      const modal = document.getElementById('cartuplift-custom-modal');
      if (!modal) return;
      
      const options = {};
      
      const notesInput = modal.querySelector('#modal-order-notes');
      if (notesInput && notesInput.value.trim()) {
        options['Order Notes'] = notesInput.value.trim();
      }
      
      const giftInput = modal.querySelector('#modal-gift-message');
      if (giftInput && giftInput.value.trim()) {
        options['Gift Message'] = giftInput.value.trim();
      }
      
      await APIClient.updateCartAttributes(options);
      await this.fetchCart();
      
      this.closeCustomModal();
      DOMManager.showToast('Your preferences have been saved!', 'success');
    }

    // Advanced recommendation methods
    async prewarmRecommendations() {
      try {
        if (this._prewarmingRecs) return;
        this._prewarmingRecs = true;
        
        if (!this._settingsPrewarmed) {
          await SettingsManager.refresh(this.cart?.shop);
          this._settingsPrewarmed = true;
        }
        
        if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
          await this.loadRecommendations();
          this._recommendationsLoaded = true;
          
          // Prefetch images
          const prefetchImages = () => {
            try {
              (this.recommendations || []).slice(0, 8).forEach(p => {
                if (p.image) {
                  const img = new Image();
                  img.src = p.image;
                }
              });
            } catch(_) {}
          };
          
          if ('requestIdleCallback' in window) {
            requestIdleCallback(prefetchImages, { timeout: 1500 });
          } else {
            setTimeout(prefetchImages, 300);
          }
        }
      } catch (_) {
      } finally {
        this._prewarmingRecs = false;
      }
    }

    async loadRecommendationsFallback() {
      try {
        let apiUrl = '';
        let products = [];
        const desiredSetting = Number(this.settings.maxRecommendations);
        const desiredMax = isFinite(desiredSetting) && desiredSetting > 0 ? desiredSetting : 4;
        
        if (this.cart && this.cart.items && this.cart.items.length > 0) {
          const productId = this.cart.items[0].product_id;
          apiUrl = `/recommendations/products.json?product_id=${productId}&limit=${desiredMax}`;
        } else {
          apiUrl = `/products.json?limit=${desiredMax}`;
        }
        
        const response = await fetch(apiUrl);
        
        if (response.ok) {
          const data = await response.json();
          products = data.products || [];
        }
        
        this.recommendations = products.map(product => this.formatProduct(product)).filter(Boolean);
        this._recommendationsLoaded = true;
      } catch (error) {
        console.error('🛒 Error loading fallback recommendations:', error);
        this.recommendations = [];
        this._recommendationsLoaded = true;
      }
    }

    rebuildRecommendationsFromMaster() {
      if (!this._allRecommendations || !this._allRecommendations.length) return;
      
      if (this._rebuildInProgress) return;
      this._rebuildInProgress = true;
      
      requestAnimationFrame(() => {
        const cartProductIds = (this.cart?.items || []).map(i => i.product_id);
        
        const desired = Number(this.settings.maxRecommendations);
        const max = isFinite(desired) && desired > 0 ? desired : 4;
        const newRecommendations = [];
        
        for (const p of this._allRecommendations) {
          const isInCartStrict = cartProductIds.includes(p.id);
          const isInCartLoose = cartProductIds.some(cartId => cartId == p.id);
          if (isInCartStrict || isInCartLoose) continue;
          newRecommendations.push(p);
          if (newRecommendations.length >= max) break;
        }
        
        const currentIds = (this.recommendations || []).map(r => r.id).sort();
        const newIds = newRecommendations.map(r => r.id).sort();
        
        if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
          this.recommendations = newRecommendations;
        }
        
        this._rebuildInProgress = false;
      });
    }

    handleCarouselNavigation(direction) {
      const track = document.querySelector('.cartuplift-recommendations-track');
      if (!track) return;

      const cardWidth = 280; // Card width + gap
      const currentScroll = track.scrollLeft;
      const targetScroll = direction === 'next' 
        ? currentScroll + cardWidth 
        : currentScroll - cardWidth;

      track.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }

    toggleRecommendations() {
      const recommendations = document.querySelector('.cartuplift-recommendations');
      if (!recommendations) return;

      recommendations.classList.toggle('collapsed');
      
      const toggle = recommendations.querySelector('.cartuplift-recommendations-toggle svg');
      if (toggle) {
        const isCollapsed = recommendations.classList.contains('collapsed');
        toggle.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(45deg)';
      }
    }

    handleVariantChange(select) {
      const selectedOption = select.options[select.selectedIndex];
      const variantId = selectedOption.value;
      const priceCents = parseInt(selectedOption.dataset.price) || 0;
      
      // Update the variant ID on the add button
      const card = select.closest('.cartuplift-recommendation-card');
      if (card) {
        const addBtn = card.querySelector('.cartuplift-add-recommendation');
        if (addBtn) {
          addBtn.dataset.variantId = variantId;
        }
        
        // Update price display
        const priceEl = card.querySelector('.cartuplift-recommendation-price');
        if (priceEl) {
          priceEl.textContent = Utils.formatMoney(priceCents);
          priceEl.dataset.price = priceCents;
        }
      }
    }

    setupNotificationBlocker() {
      // Block theme notifications when app is enabled
      const hideNotifications = () => {
        const notificationSelectors = [
          '.product-form__notification',
          '.cart-notification',
          'cart-notification',
          '.notification',
          '[data-notification]',
          '.cart__notification',
          '#CartNotification',
          '.cart-popup:not(#cartuplift-cart-popup)',
          '.cart-drawer:not(#cartuplift-cart-popup)',
          '.ajax-cart',
          '.added-to-cart-notification'
        ];
        
        notificationSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (!el.id || !el.id.includes('cartuplift')) {
              el.style.setProperty('display', 'none', 'important');
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('opacity', '0', 'important');
            }
          });
        });
      };
      
      hideNotifications();
      setInterval(hideNotifications, 1000);
    }

    // Some themes use XMLHttpRequest for cart add/change; monitor these as well
    installXHRMonitoring() {
      try {
        const OrigXHR = window.XMLHttpRequest;
        const self = this;
        function WrappedXHR() {
          const xhr = new OrigXHR();
          let _url = '';
          const origOpen = xhr.open;
          const origSend = xhr.send;
          xhr.open = function(method, url, ...rest) {
            try { _url = (url || '').toString(); } catch(_) {}
            return origOpen.call(xhr, method, url, ...rest);
          };
          xhr.send = function(body) {
            try {
              xhr.addEventListener('load', async function() {
                const ok = (xhr.status >= 200 && xhr.status < 300);
                const isCartAdd = (_url || '').includes('/cart/add');
                if (ok && isCartAdd) {
                  try {
                    await self.fetchCart();
                    self.updateDrawerContent();
                    if (self.settings.enableApp) {
                      self.hideThemeNotifications();
                      if (self.settings.autoOpenCart) {
                        self.openDrawer();
                      }
                    }
                  } catch (e) {
                    console.warn('[CartUplift] XHR monitor error', e);
                  }
                }
              }, { once: true });
            } catch(_) {}
            return origSend.call(xhr, body);
          };
          return xhr;
        }
        window.XMLHttpRequest = WrappedXHR;
      } catch (e) {
        console.warn('[CartUplift] Failed to install XHR monitoring', e);
      }
    }
  }

  // Intercept native form submissions to /cart/add and route through our flow
  installFormSubmitInterception() {
    document.addEventListener('submit', async (e) => {
      try {
        const form = e.target;
        if (!(form instanceof HTMLFormElement)) return;
        const action = (form.getAttribute('action') || form.action || '').toString();
        if (!action.includes('/cart/add')) return;

        // Only intercept when our app is enabled
        if (!this.settings.enableApp) return;

        e.preventDefault();
        e.stopPropagation();

        const formData = new FormData(form);
        // Submit to Shopify cart add endpoint
        await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: formData
        });

        await this.fetchCart();
        this.updateDrawerContent();
        this.hideThemeNotifications();
        if (this.settings.autoOpenCart) {
          this.openDrawer();
        }
      } catch (err) {
        console.warn('[CartUplift] submit interception failed', err);
      }
    }, true);
  }

  // ============================================================================
  // MODULE 9: Initialization
  // ============================================================================
  
  // Initialize version control
  VersionControl.init();
  
  // Expose globally
  window.CartUpliftDrawer = CartUpliftDrawer;
  window.Utils = Utils;
  window.Analytics = Analytics;
  
  // Global CartUplift object for theme integration
  window.CartUplift = {
    initSmartBundles: function(productId, container) {
      if (window.cartUpliftBundleRenderer) {
        window.cartUpliftBundleRenderer.initProductPage(productId, container);
      } else {
        console.log('[CartUplift] Bundle renderer not yet loaded, retrying...');
        setTimeout(() => this.initSmartBundles(productId, container), 500);
      }
    },
    
    openCart: function() {
      if (window.cartUpliftDrawer) {
        window.cartUpliftDrawer.openDrawer();
      }
    }
  };

  // Auto-initialize if settings exist
  if (window.CartUpliftSettings) {
    window.cartUpliftDrawer = new CartUpliftDrawer(window.CartUpliftSettings);
    
    // Initialize bundle renderer if bundles are enabled
    if (window.CartUpliftSettings.enableSmartBundles) {
      // Check if bundle renderer is already loaded
      if (window.BundleRenderer) {
        window.cartUpliftBundleRenderer = new window.BundleRenderer(window.CartUpliftSettings);
      } else if (!document.querySelector('script[src*="bundle-renderer"]')) {
        // Load bundle renderer script
        const script = document.createElement('script');
        script.src = window.location.origin + '/apps/cart-uplift/assets/bundle-renderer.js';
        script.onload = function() {
          if (window.BundleRenderer) {
            window.cartUpliftBundleRenderer = new window.BundleRenderer(window.CartUpliftSettings);
          }
        };
        script.onerror = function() {
          console.warn('[CartUplift] Failed to load bundle renderer');
        };
        document.head.appendChild(script);
      }
    }
  }

})();
