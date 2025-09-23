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
      if (typeof cents !== 'number' || isNaN(cents)) return '$0.00';
      const dollars = (cents / 100).toFixed(2);
      return `$${dollars}`;
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
      normalized.autoOpenCart = Boolean(normalized.autoOpenCart);
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
      if (this.settings.enableStickyCart) {
        this.createStickyCart();
      }
      
      // Set up interceptors
      this.setupCartInterception();
      this.installAddToCartMonitoring();
      
      // Apply custom colors
      this.applyCustomColors();
      
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

    renderDrawerContent() {
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup) return;
      
      const cart = this.cart;
      const settings = this.settings;
      const itemCount = cart?.item_count || 0;
      
      popup.innerHTML = `
        <div class="cartuplift-drawer">
          <div class="cartuplift-header">
            <h2 class="cartuplift-title">${settings.cartTitle || 'Your Cart'} (${itemCount})</h2>
            <button class="cartuplift-close" aria-label="Close cart">×</button>
          </div>
          
          <div class="cartuplift-content-wrapper">
            <div class="cartuplift-items">
              ${this.getCartItemsHTML(cart, settings)}
            </div>
            
            <div class="cartuplift-scrollable-content">
              ${settings.enableRecommendations ? this.getRecommendationsHTML() : ''}
            </div>
          </div>
          
          <div class="cartuplift-footer">
            ${this.getFooterHTML(cart, settings)}
          </div>
        </div>
      `;
    }

    getCartItemsHTML(cart, settings) {
      if (!cart?.items?.length) {
        return `
          <div class="cartuplift-empty">
            <p>Your cart is empty</p>
          </div>
        `;
      }

      return cart.items.map((item, index) => {
        const isGift = item.properties && item.properties._is_gift === 'true';
        const giftIcon = isGift ? '🎁' : '';
        
        return `
          <div class="cartuplift-item" data-line="${index + 1}">
            <div class="cartuplift-item-image">
              <img src="${item.featured_image?.url || item.image || 'https://via.placeholder.com/80'}" alt="${Utils.escapeHtml(item.product_title)}" loading="lazy">
            </div>
            <div class="cartuplift-item-details">
              <div class="cartuplift-item-title">
                ${giftIcon}${Utils.escapeHtml(item.product_title)}
              </div>
              ${item.variant_title && item.variant_title !== 'Default Title' ? `
                <div class="cartuplift-item-variant">${Utils.escapeHtml(item.variant_title)}</div>
              ` : ''}
              <div class="cartuplift-item-price">${Utils.formatMoney(item.final_line_price || item.line_price || 0)}</div>
            </div>
            <div class="cartuplift-item-controls">
              ${settings.enableQuantitySelectors ? `
                <div class="cartuplift-qty-controls">
                  <button class="cartuplift-qty-minus" data-line="${index + 1}">−</button>
                  <span class="cartuplift-qty-display">${item.quantity}</span>
                  <button class="cartuplift-qty-plus" data-line="${index + 1}">+</button>
                </div>
              ` : `<span class="cartuplift-qty-display">Qty: ${item.quantity}</span>`}
              ${settings.enableItemRemoval ? `
                <button class="cartuplift-item-remove-x" data-line="${index + 1}" aria-label="Remove item">×</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    getRecommendationsHTML() {
      if (!this.recommendations?.length) return '';

      const layout = this.settings.recommendationLayout || 'column';
      const title = this.settings.recommendationsTitle || 'You might also like';
      const capsEnabled = !!(this.settings.enableTitleCaps || this.settings.enableRecommendationTitleCaps);

      return `
        <div class="cartuplift-recommendations cartuplift-recommendations-${layout}">
          <div class="cartuplift-recommendations-header">
            <h3 class="cartuplift-recommendations-title">${capsEnabled ? title.toUpperCase() : title}</h3>
          </div>
          <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content">
            ${this.getRecommendationItems()}
          </div>
        </div>
      `;
    }

    getRecommendationItems() {
      if (!this.recommendations?.length) return '';

      return this.recommendations.map(rec => `
        <div class="cartuplift-recommendation-card">
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

    getExpressCheckoutHTML() {
      return `
        <div class="cartuplift-express-checkout">
          <button class="cartuplift-paypal-btn" onclick="window.cartUpliftDrawer.proceedToPayPal()" title="Pay with PayPal">
            PayPal
          </button>
          <button class="cartuplift-shoppay-btn" onclick="window.cartUpliftDrawer.proceedToShopPay()" title="Pay with Shop Pay">
            Shop Pay
          </button>
        </div>
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
      const existing = document.getElementById('cartuplift-sticky');
      if (existing) existing.remove();

      const stickyCart = DOMManager.createElement('div', {
        id: 'cartuplift-sticky',
        className: `cartuplift-sticky ${this.settings.cartPosition || 'bottom-right'}`
      });
      
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
      
      document.body.appendChild(stickyCart);
      
      const btn = stickyCart.querySelector('.cartuplift-sticky-btn');
      btn.addEventListener('click', () => this.openDrawer());
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
        } else if (e.target.classList.contains('cartuplift-add-recommendation-circle')) {
          const variantId = e.target.dataset.variantId;
          if (variantId) {
            this.addToCart(variantId);
          }
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

    refreshFromSmartCart() {
      // Sync settings from Smart Cart block
      const smartCartSection = document.querySelector('.smart-cart-section');
      if (!smartCartSection) return;

      try {
        const smartCartSettings = JSON.parse(smartCartSection.dataset.settings || '{}');
        
        // Essential settings mapping for Smart Cart block
        const settingsMap = {
          'enable_app': 'enableApp',
          'enable_sticky_cart': 'enableStickyCart', 
          'auto_open_cart': 'autoOpenCart',
          'enable_free_shipping': 'enableFreeShipping',
          'free_shipping_threshold': 'freeShippingThreshold',
          'enable_recommendations': 'enableRecommendations',
          'cart_position': 'cartPosition',
          'cart_title': 'cartTitle',
          'recommendations_title': 'recommendationsTitle',
          'button_color': 'buttonColor',
          'button_text_color': 'buttonTextColor',
          'background_color': 'backgroundColor'
        };

        // Apply settings from Smart Cart to cart drawer
        Object.keys(settingsMap).forEach(smartCartKey => {
          const cartDrawerKey = settingsMap[smartCartKey];
          if (smartCartSettings[smartCartKey] !== undefined) {
            this.settings[cartDrawerKey] = smartCartSettings[smartCartKey];
          }
        });

        console.log('[CartUplift] Settings refreshed from Smart Cart:', this.settings);
        
        // Store current state before updates
        const wasOpen = this.isOpen;
        const isPreviewMode = this.isSmartCartPreviewMode();
        
        // Update drawer if open
        if (this.isOpen) {
          this.updateDrawerContent();
        }
        
        // Update sticky cart
        if (this.settings.enableStickyCart) {
          this.createStickyCart();
        } else {
          const stickyCart = document.getElementById('cartuplift-sticky');
          if (stickyCart) stickyCart.remove();
        }
        
        // Apply color changes
        this.applyCustomColors();
        
        // Ensure drawer stays open during preview mode
        if (isPreviewMode && (wasOpen || !this.isOpen)) {
          setTimeout(() => {
            if (!this.isOpen) {
              console.log('[CartUplift] Re-opening drawer for Smart Cart preview mode');
              this.openDrawer();
            }
          }, 150);
        }
        
      } catch (error) {
        console.warn('[CartUplift] Error refreshing from Smart Cart:', error);
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
      
      // Check if Smart Cart preview mode is active - prevent closing if so
      if (window.SmartCartActive && this.isSmartCartPreviewMode()) {
        console.log('[CartUplift] Prevented close - Smart Cart preview mode active');
        return;
      }
      
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

    isSmartCartPreviewMode() {
      // Check for Smart Cart block preview mode
      const toggle = document.getElementById('smart-cart-preview-toggle');
      const section = document.querySelector('.smart-cart-section');
      const blockPreview = toggle?.checked || section?.getAttribute('data-preview-active') === 'true';
      
      // Check for Smart Cart app embed preview mode
      const appEmbedPreview = window.smartCartAppManager?.previewModeActive === true;
      
      // Return true if either block or app embed preview is active
      return blockPreview || appEmbedPreview;
    }

    forceCloseDrawer() {
      // Force close drawer even in preview mode (for Smart Cart disable)
      if (this._isAnimating || !this.isOpen) return;
      
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
  
  // Global refresh function for Smart Cart preview
  window.refreshFromSmartCart = function() {
    if (window.cartUpliftDrawer && typeof window.cartUpliftDrawer.refreshFromSmartCart === 'function') {
      window.cartUpliftDrawer.refreshFromSmartCart();
    } else {
      console.warn('🛒 Cart Uplift: refreshFromSmartCart called but drawer not ready');
    }
  };
  
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
      const script = document.createElement('script');
      const assetUrl = (window.CartUpliftAssets && window.CartUpliftAssets.bundleRenderer) || 
                       '/apps/cart-uplift/assets/bundle-renderer.js';
      script.src = assetUrl;
      script.onload = function() {
        if (window.BundleRenderer) {
          window.cartUpliftBundleRenderer = new window.BundleRenderer(window.CartUpliftSettings);
        }
      };
      document.head.appendChild(script);
    }
  }

})();
