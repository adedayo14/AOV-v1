(function() {
  'use strict';

  // Safe analytics shim (no-op if not provided by host)
  const CartAnalytics = (window.CartAnalytics && typeof window.CartAnalytics.trackEvent === 'function')
    ? window.CartAnalytics
    : { trackEvent: () => {} };

  // Main drawer controller
  class CartUpliftDrawer {
    constructor(settings) {
      // Merge defaults with provided settings and any globals
      this.settings = Object.assign({}, window.CartUpliftSettings || {}, settings || {});
      
      // Detect and apply theme colors to prevent green fallbacks
      this.themeColors = this.detectThemeColors();
      
      // Apply color fallback for progress bars: default to BLACK (never theme blue/green)
      if (!this.settings.shippingBarColor || this.settings.shippingBarColor === '#4CAF50') {
        this.settings.shippingBarColor = '#121212';
      }
      
      // Apply background color from theme detection if not explicitly set
      if (!this.settings.backgroundColor) {
        this.settings.backgroundColor = this.themeColors.background;
      }
      
      // Normalize layout setting if present
      if (this.settings && this.settings.recommendationLayout) {
        const map = { horizontal: 'row', vertical: 'column', grid: 'row' };
        this.settings.recommendationLayout = map[this.settings.recommendationLayout] || this.settings.recommendationLayout;
      }
      
      // Ensure boolean settings are properly set
      this.settings.enableStickyCart = Boolean(this.settings.enableStickyCart);
      this.settings.enableFreeShipping = Boolean(this.settings.enableFreeShipping);
      this.settings.enableGiftGating = Boolean(this.settings.enableGiftGating);
      this.settings.enableApp = this.settings.enableApp !== false;
      this.settings.enableRecommendations = this.settings.enableRecommendations !== false; // DEFAULT TO TRUE
      this.settings.enableAddons = Boolean(this.settings.enableAddons);
      this.settings.enableNotes = Boolean(this.settings.enableNotes);
      this.settings.enableDiscountCode = this.settings.enableDiscountCode !== false; // DEFAULT TO TRUE
      this.settings.enableExpressCheckout = this.settings.enableExpressCheckout !== false; // DEFAULT TO TRUE
      this.settings.autoOpenCart = this.settings.autoOpenCart !== false;
      
      // Set default gift notice text if not provided
      this.settings.giftNoticeText = this.settings.giftNoticeText || 'Free gift added: {{product}} (worth {{amount}})';
      
      // Set default gift price text if not provided
      this.settings.giftPriceText = this.settings.giftPriceText || 'FREE';
      
      this.cart = null;
      this.isOpen = false;
      this._isAnimating = false;
      this._quantityBusy = false;
      this._recommendationsLoaded = false;
  this._rebuildInProgress = false; // STABILITY: Prevent rapid rebuilds
  this._recommendationsLocked = false; // Keep master order stable; still recompute visible list on cart changes
      this._updateDebounceTimer = null; // STABILITY: Debounce rapid updates
      this.recommendations = [];
      this._allRecommendations = []; // Master list to allow re-show after removal from cart
  
      // Immediately intercept cart notifications if app is enabled
      if (this.settings.enableApp) {
        this.installEarlyInterceptors();
      }
  
      // CRITICAL FIX: Listen for settings updates BEFORE initialization
      this._settingsUpdateHandler = async (event) => {
        // Deep merge the settings
        this.settings = Object.assign({}, this.settings, window.CartUpliftSettings || {});
        
        // Normalize layout again after update
        if (this.settings.recommendationLayout) {
          const map = { horizontal: 'row', vertical: 'column', grid: 'row' };
          this.settings.recommendationLayout = map[this.settings.recommendationLayout] || this.settings.recommendationLayout;
        }
        
        // If recommendations were just enabled and not loaded yet
        if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
          await this.loadRecommendations();
          this._recommendationsLoaded = true;
        } else if (this._allRecommendations.length) {
          // Re-filter recommendations from master list
          this.rebuildRecommendationsFromMaster();
        }
        
        // Refresh sticky cart when settings change
        if (this.settings.enableStickyCart) {
          this.createStickyCart();
        }
        
        // Re-render drawer to apply new settings
        this.updateDrawerContent();
        
        // Update specific sections if they exist
        this.updateRecommendationsSection();
      };
      
      // Attach the listener BEFORE init
      document.addEventListener('cartuplift:settings:updated', this._settingsUpdateHandler);
      
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

    // Detect theme colors to avoid green fallbacks
    detectThemeColors() {
      
      let primaryColor = null;
      let detectionSource = '';

      // 1. PRIORITY: Direct access to Shopify color scheme objects (Dawn's approach)
      try {
        // Check for color scheme data in the DOM (as used in Dawn theme)
        const colorSchemeElements = document.querySelectorAll('[class*="color-scheme"], [class*="color-"]');
        for (const element of colorSchemeElements) {
          const styles = getComputedStyle(element);
          
          // Check Dawn's standard CSS custom properties
          const buttonColor = styles.getPropertyValue('--color-button').trim();
          const foregroundColor = styles.getPropertyValue('--color-foreground').trim();
          
          if (buttonColor && buttonColor.includes(',')) {
            // Dawn stores colors as RGB values: "255,255,255"
            const rgbValues = buttonColor.split(',').map(v => parseInt(v.trim()));
            if (rgbValues.length >= 3 && rgbValues.every(v => !isNaN(v) && v >= 0 && v <= 255)) {
              primaryColor = this.rgbToHex(`rgb(${rgbValues.join(',')})`);
              detectionSource = 'Dawn color scheme --color-button';
              break;
            }
          }
          
          if (!primaryColor && foregroundColor && foregroundColor.includes(',')) {
            const rgbValues = foregroundColor.split(',').map(v => parseInt(v.trim()));
            if (rgbValues.length >= 3 && rgbValues.every(v => !isNaN(v) && v >= 0 && v <= 255)) {
              primaryColor = this.rgbToHex(`rgb(${rgbValues.join(',')})`);
              detectionSource = 'Dawn color scheme --color-foreground';
              break;
            }
          }
        }
      } catch (error) {
      }

      // 2. Check root-level CSS custom properties (Shopify 2.0 standard)
      if (!primaryColor) {
        
        const rootStyle = getComputedStyle(document.documentElement);
        
        // Dawn and modern Shopify themes store colors as comma-separated RGB values
        const colorProperties = [
          '--color-button',           // Dawn's primary button color
          '--color-foreground',       // Dawn's text/foreground color
          '--color-accent',           // Legacy accent color
          '--color-primary'           // Legacy primary color
        ];

        for (const property of colorProperties) {
          try {
            const value = rootStyle.getPropertyValue(property).trim();
            if (value && value.includes(',')) {
              const rgbValues = value.split(',').map(v => parseInt(v.trim()));
              if (rgbValues.length >= 3 && rgbValues.every(v => !isNaN(v) && v >= 0 && v <= 255)) {
                primaryColor = this.rgbToHex(`rgb(${rgbValues.join(',')})`);
                detectionSource = `Root CSS property ${property}`;
                break;
              }
            } else if (value && value.startsWith('#')) {
              primaryColor = value;
              detectionSource = `Root CSS property ${property}`;
              break;
            } else if (value && value.startsWith('rgb')) {
              const hexColor = this.rgbToHex(value);
              if (hexColor) {
                primaryColor = hexColor;
                detectionSource = `Root CSS property ${property}`;
                break;
              }
            }
          } catch (error) {
            // Continue if property doesn't exist
          }
        }
      }

      // 3. Analyze Shopify standard button elements (as per Dawn)
      if (!primaryColor) {
        
        // Dawn and Shopify's recommended button selectors
        const shopifyButtonSelectors = [
          '.button:not(.button--secondary):not(.button--tertiary)',  // Dawn primary buttons
          '.product-form__cart-submit',                              // Dawn add to cart
          '.shopify-payment-button__button--unbranded',             // Shopify payment buttons
          'button[type="submit"]:not(.button--secondary)',          // Submit buttons
          '.btn--primary',                                          // Legacy primary buttons
          '[data-shopify*="button"]'                               // Shopify-specific buttons
        ];

        for (const selector of shopifyButtonSelectors) {
          try {
            const button = document.querySelector(selector);
            if (button && button.offsetParent !== null) {
              const styles = getComputedStyle(button);
              const bgColor = styles.backgroundColor;
              
              if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                const hexColor = this.rgbToHex(bgColor);
                if (hexColor) {
                  // Avoid pure white, black, or transparent
                  if (hexColor !== '#ffffff' && hexColor !== '#000000' && hexColor !== '#transparent') {
                    primaryColor = hexColor;
                    detectionSource = `Shopify button ${selector}`;
                    break;
                  }
                }
              }
            }
          } catch (error) {
            // Continue with next selector
          }
        }
      }

      // 4. Use Dawn's default dark neutral (never use green or fallbacks)
      if (!primaryColor) {
        primaryColor = '#121212'; // Dawn's standard dark color
        detectionSource = 'Dawn default (#121212)';
      }

      // CRITICAL: Prevent any green colors (paid app requirement)
      if (primaryColor && this.isGreenColor(primaryColor)) {
        console.warn('🚫 [CartUplift] Green color detected, using Dawn default:', primaryColor);
        primaryColor = '#121212';
        detectionSource = 'Dawn default (green prevention)';
      }

      
      // Detect background colors
      let backgroundColor = '#ffffff'; // Default white
      let bgDetectionSource = 'default';
      
      try {
        // Check for body background first
        const bodyStyles = getComputedStyle(document.body);
        let bodyBgColor = bodyStyles.backgroundColor;
        
        if (bodyBgColor && bodyBgColor !== 'rgba(0, 0, 0, 0)' && bodyBgColor !== 'transparent') {
          backgroundColor = this.rgbToHex(bodyBgColor);
          bgDetectionSource = 'body background';
        } else {
          // Check root/html background
          const rootStyles = getComputedStyle(document.documentElement);
          let rootBgColor = rootStyles.backgroundColor;
          
          if (rootBgColor && rootBgColor !== 'rgba(0, 0, 0, 0)' && rootBgColor !== 'transparent') {
            backgroundColor = this.rgbToHex(rootBgColor);
            bgDetectionSource = 'root/html background';
          } else {
            // Check for theme-specific background properties
            const backgroundProperties = [
              '--color-background',     // Dawn's background color
              '--color-body',          // Some themes use this
              '--background-color',    // Common property
              '--color-base-background'
            ];

            for (const property of backgroundProperties) {
              const value = rootStyles.getPropertyValue(property).trim();
              if (value) {
                if (value.includes(',')) {
                  // RGB values like "255,255,255"
                  const rgbValues = value.split(',').map(v => parseInt(v.trim()));
                  if (rgbValues.length >= 3 && rgbValues.every(v => !isNaN(v) && v >= 0 && v <= 255)) {
                    backgroundColor = this.rgbToHex(`rgb(${rgbValues.join(',')})`);
                    bgDetectionSource = `CSS property ${property}`;
                    break;
                  }
                } else if (value.startsWith('#') || value.startsWith('rgb')) {
                  backgroundColor = this.rgbToHex(value);
                  bgDetectionSource = `CSS property ${property}`;
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        backgroundColor = '#ffffff';
        bgDetectionSource = 'fallback to white';
      }
      
      
      return {
        primary: primaryColor,
        background: backgroundColor
      };
    }

    // Enhanced green color detection
    isGreenColor(color) {
      if (!color || typeof color !== 'string') return false;
      
      const hex = color.toLowerCase();
      
      // Explicit green color codes to avoid
      const greenColors = [
        '#4caf50', '#22c55e', '#10b981', '#059669', '#34d399', 
        '#6ee7b7', '#a7f3d0', '#d1fae5', '#ecfdf5', '#00ff00',
        '#008000', '#228b22', '#32cd32', '#7cfc00', '#adff2f',
        '#9acd32', '#98fb98', '#90ee90', '#00fa9a', '#00ff7f'
      ];
      
      if (greenColors.includes(hex)) return true;
      
      // Check RGB values for green-dominant colors
      try {
        let r, g, b;
        
        if (hex.startsWith('#')) {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          if (result) {
            r = parseInt(result[1], 16);
            g = parseInt(result[2], 16);
            b = parseInt(result[3], 16);
          }
        } else if (color.includes('rgb')) {
          const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) {
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
          }
        }
        
        if (r !== undefined && g !== undefined && b !== undefined) {
          // Green is dominant and significantly higher than red and blue
          return g > r + 30 && g > b + 30 && g > 100;
        }
      } catch (error) {
        // Continue with string check
      }
      
      return false;
    }

    // Helper function to convert RGB to hex
    rgbToHex(rgb) {
      if (!rgb || !rgb.includes('rgb')) return null;
      
      const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return null;
      
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    async setup() {
      
      // Fetch initial cart data FIRST
      await this.fetchCart();
      
      // Create cart uplift AFTER cart is fetched
      this.createDrawer();
      
      // Update drawer content with actual cart data
      this.updateDrawerContent();
      
      // Handle sticky cart
      if (this.settings.enableStickyCart) {
        this.createStickyCart();
      }
      
      // Set up cart replacement
      this.setupCartUpliftInterception();
      
  // Track last click to support fly-to-cart animation
  this.installClickTracker();

      // Install cart monitoring
      this.installAddToCartMonitoring();
      
      // Apply custom colors
      this.applyCustomColors();
      
      // SET UP MUTATION OBSERVER TO CATCH DYNAMIC NOTIFICATIONS
      if (this.settings.enableApp) {
        this.setupNotificationBlocker();
      }
      
      // Load recommendations if enabled (only once during setup)
      if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
        await this.loadRecommendations();
        this._recommendationsLoaded = true;
        // Update drawer content again with recommendations
        this.updateDrawerContent();
      }
      
      // IMPORTANT: Check if recommendations settings have arrived
      // Give a small delay to allow the upsell embed to load
      setTimeout(async () => {
        // Re-check settings from window
        if (window.CartUpliftSettings) {
          this.settings = Object.assign({}, this.settings, window.CartUpliftSettings);
        }
        
        // Load recommendations if enabled and not loaded
        if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
          await this.loadRecommendations();
          this._recommendationsLoaded = true;
          this.updateDrawerContent();
        }
      }, 500);
      

      // Listen for late settings injection (upsell embed) and refresh recommendations
      document.addEventListener('cartuplift:settings:updated', async () => {
        // Merge any new settings
        this.settings = Object.assign(this.settings, window.CartUpliftSettings || {});
        if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
          await this.loadRecommendations();
        }
        // Re-render to ensure changes are reflected immediately
        this.updateDrawerContent();
      });

      // Add method to refresh settings from API
      window.cartUpliftRefreshSettings = async () => {
        await this.refreshSettingsFromAPI();
      };
      
      // Add method to soft refresh recommendations (force cart re-sync)
      window.cartUpliftSoftRefresh = async () => {
        await this.fetchCart();
        if (this._recommendationsLoaded) {
          this.rebuildRecommendationsFromMaster();
        }
        this.updateDrawerContent();
      };
    }

    // Track last meaningful click to derive animation source
    installClickTracker() {
      this._lastClick = null;
      document.addEventListener('click', (e) => {
        const el = e.target.closest('button, [type="submit"], .product-form, form, a, .add-to-cart, [name="add"], [data-add-to-cart]');
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Use click point if available, else center of element
        const x = (typeof e.clientX === 'number' && e.clientX) ? e.clientX : rect.left + rect.width / 2;
        const y = (typeof e.clientY === 'number' && e.clientY) ? e.clientY : rect.top + rect.height / 2;
        this._lastClick = { x, y, time: Date.now(), rect };
      }, true);
    }

    // Compute target point: our sticky cart button or header cart as fallback
    getFlyTargetPoint() {
      // Prefer our sticky cart button when visible
      const stickyBtn = document.querySelector('#cartuplift-sticky .cartuplift-sticky-btn');
      if (stickyBtn && stickyBtn.offsetParent !== null) {
        const r = stickyBtn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: stickyBtn };
      }
  // Universal fallback: always animate to the right edge so direction is consistent across themes
  return { x: window.innerWidth - 24, y: window.innerHeight / 2, el: null };
    }

    // Animate a small ghost dot from source to target
    flyToCart(options = {}) {
      try {
        // Respect user reduced motion
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) return;
        const now = Date.now();
        const recent = this._lastClick && (now - this._lastClick.time < 2000) ? this._lastClick : null;
        const src = options.source || recent || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const tgt = this.getFlyTargetPoint();
        if (!src || !tgt) return;

        // Create ghost
        const ghost = document.createElement('div');
        ghost.style.position = 'fixed';
        ghost.style.left = `${src.x}px`;
        ghost.style.top = `${src.y}px`;
        ghost.style.width = '12px';
        ghost.style.height = '12px';
        ghost.style.borderRadius = '50%';
        ghost.style.zIndex = '2147483647';
        ghost.style.pointerEvents = 'none';
        ghost.style.background = this.themeColors?.primary || '#121212';
        ghost.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.08)';
        ghost.style.transform = 'translate(-50%, -50%)';
        ghost.style.opacity = '0.95';
        document.body.appendChild(ghost);

        const duration = 500; // ms
        const start = performance.now();
        const sx = src.x, sy = src.y, ex = tgt.x, ey = tgt.y;
        const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic

        const step = (ts) => {
          const t = Math.min(1, (ts - start) / duration);
          const e = ease(t);
          const cx = sx + (ex - sx) * e;
          const cy = sy + (ey - sy) * e;
          ghost.style.left = `${cx}px`;
          ghost.style.top = `${cy}px`;
          ghost.style.opacity = `${1 - 0.3 * t}`;
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            ghost.remove();
            // Pulse target on arrival
            if (tgt.el) {
              tgt.el.classList.add('cartuplift-pulse');
              setTimeout(() => tgt.el.classList.remove('cartuplift-pulse'), 450);
            }
          }
        };
        requestAnimationFrame(step);
      } catch (_) {
        // No-op on failure
      }
    }

    async refreshSettingsFromAPI() {
      try {
        const shopDomain = window.CartUpliftShop || window.Shopify?.shop;
        if (shopDomain) {
          const apiUrl = `/apps/cart-uplift/api/settings?shop=${encodeURIComponent(shopDomain)}`;
          const response = await fetch(apiUrl);
          if (response.ok) {
            const newSettings = await response.json();
            this.settings = Object.assign(this.settings, newSettings);
            window.CartUpliftSettings = Object.assign(window.CartUpliftSettings || {}, newSettings);
            this.updateDrawerContent();
          }
        }
      } catch (error) {
      }
    }

    applyCustomColors() {
      
      const style = document.getElementById('cartuplift-dynamic-styles') || document.createElement('style');
      style.id = 'cartuplift-dynamic-styles';
      
      // Get theme colors with enhanced detection
      const themeColors = this.themeColors || this.detectThemeColors();
      
      // Ensure we NEVER use green colors in production
      const safeThemeColor = this.isGreenColor(themeColors.primary) ? '#121212' : themeColors.primary;
      const safeButtonColor = this.settings.buttonColor && !this.isGreenColor(this.settings.buttonColor) 
        ? this.settings.buttonColor 
        : safeThemeColor;
      const safeShippingColor = this.settings.shippingBarColor && !this.isGreenColor(this.settings.shippingBarColor)
        ? this.settings.shippingBarColor 
        : safeThemeColor;

      // Append minimal animation CSS for pulse effect if not present
      const pulseCSS = `\n@keyframes cartupliftPulse {\n  0% { transform: scale(1); }\n  50% { transform: scale(1.08); }\n  100% { transform: scale(1); }\n}\n.cartuplift-sticky-btn.cartuplift-pulse {\n  animation: cartupliftPulse 450ms ease-out;\n}\n`;
      if (!style.textContent.includes('@keyframes cartupliftPulse')) {
        style.textContent += pulseCSS;
      }
      
      // Debug logging with safety checks
      console.log('🛒 Cart Uplift: Color application:', {
        originalTheme: themeColors.primary,
        safeTheme: safeThemeColor,
        originalButton: this.settings.buttonColor,
        safeButton: safeButtonColor,
        originalShipping: this.settings.shippingBarColor,
        safeShipping: safeShippingColor
      });
      
      // Build CSS with bulletproof color application
      let css = `
        :root {
          --cartuplift-success-color: ${safeThemeColor} !important;
          --cartuplift-success: ${safeThemeColor} !important;
          --cartuplift-button-color: ${safeButtonColor} !important;
          --cartuplift-shipping-fill: ${safeShippingColor} !important;
          ${this.settings.buttonTextColor ? `--cartuplift-button-text-color: ${this.settings.buttonTextColor} !important;` : ''}
          ${this.settings.backgroundColor ? `--cartuplift-background: ${this.settings.backgroundColor} !important; --cartuplift-cart-background: ${this.settings.backgroundColor} !important;` : ''}
          ${this.settings.textColor ? `--cartuplift-primary: ${this.settings.textColor} !important;` : ''}
          ${this.settings.recommendationsBackgroundColor ? `--cartuplift-recommendations-bg: ${this.settings.recommendationsBackgroundColor} !important;` : ''}
          ${this.settings.shippingBarBackgroundColor ? `--cartuplift-shipping-bg: ${this.settings.shippingBarBackgroundColor} !important;` : ''}
        }
        
        /* CRITICAL: Force override ALL green color possibilities with !important */
        .cartuplift-progress-fill,
        .cartuplift-milestone.completed .cartuplift-milestone-icon,
        .cartuplift-achievement-content,
        .cartuplift-shipping-progress-bar .cartuplift-progress-fill,
        .cartuplift-shipping-progress-fill {
          background: ${safeShippingColor} !important;
          background-color: ${safeShippingColor} !important;
        }
        
        .cartuplift-milestone.completed .cartuplift-milestone-label,
        .cartuplift-achievement-text {
          color: ${safeShippingColor} !important;
        }
        
        /* Prevent any green elements from CSS cascade */
        .cartuplift-drawer .cartuplift-progress-fill,
        .cartuplift-drawer .cartuplift-milestone-icon,
        .cartuplift-drawer .cartuplift-shipping-progress-fill,
        #cartuplift-cart-popup .cartuplift-progress-fill,
        .cartuplift-shipping-progress .cartuplift-progress-fill,
        .cartuplift-recommendations .cartuplift-progress-fill {
          background-color: ${safeShippingColor} !important;
        }
        
        .cartuplift-drawer [style*="#4CAF50"],
        .cartuplift-drawer [style*="#22c55e"],
        .cartuplift-drawer [style*="rgb(76, 175, 80)"],
        .cartuplift-drawer [style*="rgb(34, 197, 94)"] {
          background: ${safeThemeColor} !important;
          color: ${safeThemeColor} !important;
        }
        
        /* Apply background colors */
        ${this.settings.backgroundColor ? `
        .cartuplift-drawer,
        .cartuplift-header,
        .cartuplift-content-wrapper,
        .cartuplift-items,
        .cartuplift-scrollable-content,
        .cartuplift-footer {
          background: ${this.settings.backgroundColor} !important;
        }` : ''}
        
        /* Apply text colors */
        ${this.settings.textColor ? `
        .cartuplift-drawer,
        .cartuplift-item-title,
        .cartuplift-price,
        .cartuplift-total-label,
        .cartuplift-total-value {
          color: ${this.settings.textColor} !important;
        }` : ''}
        
        /* Apply recommendations background */
        ${this.settings.recommendationsBackgroundColor ? `
        .cartuplift-recommendations,
        .cartuplift-recommendations-container {
          background: ${this.settings.recommendationsBackgroundColor} !important;
        }` : ''}
        
        /* Apply button colors with green prevention */
        .cartuplift-checkout-btn,
        .cartuplift-discount-apply,
        .cartuplift-add-recommendation {
          background: ${safeButtonColor} !important;
          background-color: ${safeButtonColor} !important;
          ${this.settings.buttonTextColor ? `color: ${this.settings.buttonTextColor} !important;` : 'color: white !important;'}
        }
        
        .cartuplift-add-recommendation-circle {
          border-color: ${safeButtonColor} !important;
          color: ${safeButtonColor} !important;
        }
        
        .cartuplift-add-recommendation-circle:hover {
          background: ${safeButtonColor} !important;
          background-color: ${safeButtonColor} !important;
          color: ${this.settings.buttonTextColor || 'white'} !important;
        }
        
        /* Apply shipping bar colors with green prevention */
        .cartuplift-shipping-progress-fill {
          background: ${safeShippingColor} !important;
          background-color: ${safeShippingColor} !important;
        }
        
        ${this.settings.shippingBarBackgroundColor ? `
        .cartuplift-shipping-progress {
          background: ${this.settings.shippingBarBackgroundColor} !important;
          background-color: ${this.settings.shippingBarBackgroundColor} !important;
        }` : ''}
          
        /* Hide theme notifications when Cart Uplift is enabled */
        ${this.settings.enableApp ? `
        .cart-notification,
        cart-notification,
        .cart-notification-wrapper,
        .cart-notification-product,
        .cart__notification,
        #CartNotification,
        .cart-popup,
        .ajax-cart-popup,
        .cart-drawer:not(#cartuplift-cart-popup),
        #CartDrawer:not(#cartuplift-cart-popup),
        .cart-popup-wrapper,
        .ajax-cart__inner,
        .product__notification,
        .notification--cart,
        .product-form__notification,
        [data-cart-notification],
        [data-notification],
        .added-to-cart,
        .cart-success,
        .cart-added,
        .add-to-cart-notification,
        .modal.cart,
        .modal-cart,
        .cart-modal,
        .notification,
        .ajax-cart,
        .shopify-section .cart-notification {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          transform: translateY(-100%) !important;
          pointer-events: none !important;
        }` : ''}
        
        /* Professional CSS override for any missed green elements */
        [style*="color: rgb(76, 175, 80)"],
        [style*="background: rgb(76, 175, 80)"],
        [style*="background-color: rgb(76, 175, 80)"],
        [style*="color: #4CAF50"],
        [style*="background: #4CAF50"],
        [style*="background-color: #4CAF50"],
        [style*="color: #22c55e"],
        [style*="background: #22c55e"],
        [style*="background-color: #22c55e"] {
          color: ${safeThemeColor} !important;
          background: ${safeThemeColor} !important;
          background-color: ${safeThemeColor} !important;
        }
      `;
      
      style.textContent = css;
      if (!document.getElementById('cartuplift-dynamic-styles')) {
        document.head.appendChild(style);
      }
      
    }

    createStickyCart() {
      console.log('🛒 Cart Uplift: createStickyCart called, enableStickyCart:', this.settings.enableStickyCart);
      
      if (!this.settings.enableStickyCart) {
        console.log('🛒 Cart Uplift: Sticky cart disabled in settings');
        return;
      }
      
      console.log('🛒 Cart Uplift: Creating sticky cart...');
      
      const existing = document.getElementById('cartuplift-sticky');
      if (existing) {
        console.log('🛒 Cart Uplift: Removing existing sticky cart');
        existing.remove();
      }

      const stickyCart = document.createElement('div');
      stickyCart.id = 'cartuplift-sticky';
      stickyCart.className = `cartuplift-sticky ${this.settings.cartPosition || 'bottom-right'}`;
      
      console.log('🛒 Cart Uplift: Sticky cart element created with class:', stickyCart.className);
      
      // Build the button content based on settings
      let buttonContent = '';
      
      // Add icon if enabled
      if (this.settings.stickyCartShowIcon !== false) {
        buttonContent += this.getCartIcon();
      }
      
      // Add count if enabled
      if (this.settings.stickyCartShowCount !== false) {
        buttonContent += `<span class="cartuplift-sticky-count">${this.cart?.item_count || 0}</span>`;
      }
      
      // Add total if enabled
      if (this.settings.stickyCartShowTotal !== false) {
        buttonContent += `<span class="cartuplift-sticky-total">${this.formatMoney(this.getDisplayedTotalCents())}</span>`;
      }
      
      stickyCart.innerHTML = `
        <button class="cartuplift-sticky-btn" aria-label="Open cart">
          ${buttonContent}
        </button>
      `;
      
      console.log('🛒 Cart Uplift: Adding sticky cart to body');
      document.body.appendChild(stickyCart);
      
      console.log('🛒 Cart Uplift: Sticky cart added to DOM:', document.getElementById('cartuplift-sticky'));
      
      stickyCart.querySelector('.cartuplift-sticky-btn').addEventListener('click', () => {
        this.openDrawer();
      });
      
      console.log('🛒 Cart Uplift: Sticky cart setup complete');
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
      
      const popup = container.querySelector('#cartuplift-cart-popup');
      if (popup) {
        popup.innerHTML = this.getDrawerHTML();
      }
      
      this.attachDrawerEvents();
    }

    getDrawerHTML() {
      const itemCount = this.cart?.item_count || 0;
      
      // Calculate original cart total before any discounts
      let originalTotal = 0;
      let giftItemsTotal = 0;
      let giftItems = [];
      
      if (this.cart && this.cart.items) {
        this.cart.items.forEach(item => {
          const isGift = item.properties && item.properties._is_gift === 'true';
          if (isGift) {
            // Track gift items total for reference
            giftItemsTotal += item.original_line_price || item.line_price || (item.price * item.quantity);
            giftItems.push(item);
          } else {
            // Only include non-gift items in the payable total
            originalTotal += item.original_line_price || item.line_price || (item.price * item.quantity);
          }
        });
      }
      
        originalTotal: originalTotal,
        giftItemsTotal: giftItemsTotal,
        shopifyTotal: this.cart?.total_price || 0,
        note: 'Gift items excluded from payable total'
      });
      
      // Get discount information from Shopify's cart object if available
      const cartDiscounts = this.cart?.cart_level_discount_applications || [];
      const hasCartDiscount = cartDiscounts.length > 0;
      
      let totalDiscount = 0;
      let discountLabels = [];
      
      if (hasCartDiscount) {
        cartDiscounts.forEach(discount => {
          totalDiscount += Math.abs(discount.total_allocated_amount || 0);
          if (discount.title) discountLabels.push(discount.title);
        });
      }
      
      // Fallback to manual calculation if no cart discounts found but we have discount attributes
      let manualDiscount = null;
      if (!hasCartDiscount) {
        manualDiscount = this.computeEstimatedDiscount(originalTotal);
        if (manualDiscount.hasDiscount) {
          totalDiscount = manualDiscount.estimatedDiscountCents;
          discountLabels = [manualDiscount.discountLabel];
        }
      }
      
      const hasDiscount = totalDiscount > 0;
      const finalTotal = Math.max(0, originalTotal - totalDiscount);
      
      // Check if we should show recommendations - only show if:
      // 1. Recommendations are enabled
      // 2. Either we're still loading OR we have actual recommendations to show
      const shouldShowRecommendations = this.settings.enableRecommendations && 
        ((!this._recommendationsLoaded) || (this.recommendations && this.recommendations.length > 0));
      
        'enableRecommendations:', this.settings.enableRecommendations,
        'loaded:', this._recommendationsLoaded, 
        'count:', this.recommendations?.length || 0,
        'window width:', window.innerWidth);
      
        cartDiscounts, 
        hasCartDiscount, 
        totalDiscount, 
        discountLabels,
        originalTotal,
        finalTotal,
        hasDiscount
      });
      
      return `
        <div class="cartuplift-drawer${shouldShowRecommendations ? ' has-recommendations' : ''}">
          ${this.getHeaderHTML(itemCount)}
          
          <div class="cartuplift-content-wrapper">
            <div class="cartuplift-items">
              ${this.getCartItemsHTML()}
            </div>
            
            <div class="cartuplift-scrollable-content">
              ${this.settings.enableAddons ? this.getAddonsHTML() : ''}
              ${shouldShowRecommendations ? this.getRecommendationsHTML() : ''}
              ${(() => {
                return this.settings.enableDiscountCode || this.settings.enableNotes ? this.getDiscountHTML() : '';
              })()}
            </div>
          </div>
          
          <div class="cartuplift-footer">
            ${giftItemsTotal > 0 ? `
            <div class="cartuplift-gift-notice" style="margin-bottom:8px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #666;">
              🎁 ${this.processGiftNoticeTemplate(this.settings.giftNoticeText, giftItemsTotal, giftItems)}
            </div>
            ` : ''}
            ${hasDiscount ? `
            <div class="cartuplift-subtotal" style="margin-bottom:8px;">
              <span>Discount${discountLabels.length > 0 ? ` (${discountLabels.join(', ')})` : ''}</span>
              <span class="cartuplift-subtotal-amount">- ${this.formatMoney(totalDiscount)}</span>
            </div>
            ` : ''}
            <div class="cartuplift-subtotal">
              <span>Subtotal${hasDiscount ? ' (after discount)' : ''}</span>
              <span class="cartuplift-subtotal-amount">${this.formatMoney(finalTotal)}</span>
            </div>
            
            <button class="cartuplift-checkout-btn" onclick="window.cartUpliftDrawer.proceedToCheckout()">
              ${this.settings.checkoutButtonText || 'Checkout'}
            </button>
            
            ${(() => {
              return this.settings.enableExpressCheckout ? this.getExpressCheckoutHTML() : '';
            })()}
          </div>
        </div>
      `;
    }
      
    getHeaderHTML(itemCount) {
      const currentTotal = this.getDisplayedTotalCents();
      let progressMessage = '';
      
      // Check if we have gift thresholds
      let giftThresholds = [];
      let hasSingleGiftThreshold = false;
      
      if (this.settings.enableGiftGating && this.settings.giftThresholds) {
        try {
          giftThresholds = JSON.parse(this.settings.giftThresholds);
          hasSingleGiftThreshold = giftThresholds.length === 1;
        } catch (error) {
          console.error('🎁 Error parsing gift thresholds:', error);
        }
      }
      
      const progressBarMode = this.settings.progressBarMode || 'free-shipping';
      
      // Logic for message area (where free shipping message usually appears)
      if (progressBarMode === 'gift-gating' && hasSingleGiftThreshold) {
        // SINGLE GIFT THRESHOLD: Show gift message in the simple shipping message area
        const threshold = giftThresholds[0];
        const thresholdInCents = threshold.amount * 100;
        const currentTotalInMajorUnits = currentTotal / 100;
        
        if (currentTotalInMajorUnits < threshold.amount) {
          const remaining = thresholdInCents - currentTotal;
          progressMessage = `Spend ${this.formatMoney(remaining)} more to unlock ${threshold.title}!`;
        } else {
          progressMessage = `🎉 ${threshold.title} unlocked!`;
        }
      } else if (progressBarMode === 'free-shipping' && this.settings.enableFreeShipping) {
        // FREE SHIPPING: Use the existing free shipping logic
        let threshold = this.settings.freeShippingThreshold || 100;
        const thresholdInSmallestUnit = threshold * 100;
        const remaining = Math.max(0, thresholdInSmallestUnit - currentTotal);
        
        if (!this.cart || currentTotal === 0) {
          progressMessage = (this.settings.freeShippingText || "Spend {{ amount }} more for free shipping!")
            .replace(/\{\{\s*amount\s*\}\}/g, this.formatMoney(thresholdInSmallestUnit))
            .replace(/{amount}/g, this.formatMoney(thresholdInSmallestUnit));
        } else if (remaining > 0) {
          progressMessage = (this.settings.freeShippingText || "Spend {{ amount }} more for free shipping!")
            .replace(/\{\{\s*amount\s*\}\}/g, this.formatMoney(remaining))
            .replace(/{amount}/g, this.formatMoney(remaining));
        } else {
          progressMessage = this.settings.freeShippingAchievedText || "🎉 Free shipping unlocked!";
        }
      } else if (progressBarMode === 'combined') {
        // COMBINED: Show both messages
        let messages = [];
        
        // Free shipping message
        if (this.settings.enableFreeShipping) {
          let threshold = this.settings.freeShippingThreshold || 100;
          const thresholdInSmallestUnit = threshold * 100;
          const remaining = Math.max(0, thresholdInSmallestUnit - currentTotal);
          
          if (remaining > 0) {
            messages.push((this.settings.freeShippingText || "Spend {{ amount }} more for free shipping!")
              .replace(/\{\{\s*amount\s*\}\}/g, this.formatMoney(remaining))
              .replace(/{amount}/g, this.formatMoney(remaining)));
          } else {
            messages.push(this.settings.freeShippingAchievedText || "🎉 Free shipping unlocked!");
          }
        }
        
        // Single gift threshold message (if applicable)
        if (hasSingleGiftThreshold) {
          const threshold = giftThresholds[0];
          const thresholdInCents = threshold.amount * 100;
          const currentTotalInMajorUnits = currentTotal / 100;
          
          if (currentTotalInMajorUnits < threshold.amount) {
            const remaining = thresholdInCents - currentTotal;
            messages.push(`Spend ${this.formatMoney(remaining)} more to unlock ${threshold.title}!`);
          } else {
            messages.push(`🎉 ${threshold.title} unlocked!`);
          }
        }
        
        progressMessage = messages.join(' • ');
      }
      
      return `
        <div class="cartuplift-header">
          <h2 class="cartuplift-cart-title">Cart (${itemCount})</h2>
          ${progressMessage ? `
            <div class="cartuplift-shipping-info">
              <p class="cartuplift-shipping-message">${progressMessage}</p>
            </div>
          ` : ''}
          <button class="cartuplift-close" aria-label="Close cart">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        ${progressMessage ? `
          <div class="cartuplift-shipping-info-mobile">
            <p class="cartuplift-shipping-message">${progressMessage}</p>
          </div>
        ` : ''}
        ${this.getUnifiedProgressHTML()}
      `;
    }

    getCartItemsHTML() {
      if (!this.cart || !this.cart.items || this.cart.items.length === 0) {
        return `
          <div class="cartuplift-empty">
            <h4>Your cart is empty</h4>
            <p>Add some products to get started!</p>
          </div>
        `;
      }
      
      // Sort items to put gift items at the top
      const sortedItems = [...this.cart.items].sort((a, b) => {
        const aIsGift = a.properties && a.properties._is_gift === 'true';
        const bIsGift = b.properties && b.properties._is_gift === 'true';
        
        // Gift items go to top (return negative for a to put it first)
        if (aIsGift && !bIsGift) return -1;
        if (!aIsGift && bIsGift) return 1;
        return 0; // Keep original order for same type items
      });
      
      return sortedItems.map((item, displayIndex) => {
        const isGift = item.properties && item.properties._is_gift === 'true';
        // Gift icon: stroke uses currentColor. We'll color it with the button color via CSS.
  const giftIcon = '<span class="cartuplift-gift-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg></span>';
  const displayTitle = isGift ? (`<span class="cartuplift-title-text">${item.product_title}</span>` + giftIcon) : item.product_title;
        // Show gift label in price area: prefer the gift title saved on the line item; else try to resolve from matching gift threshold; else FREE
        let giftLabel = (item.properties && (item.properties._gift_title || item.properties._gift_label)) || '';
        if (!giftLabel) {
          try {
            const thresholds = this.settings.giftThresholds ? JSON.parse(this.settings.giftThresholds) : [];
            if (thresholds && thresholds.length) {
              const itemPid = (item.product_id || item.productId || '').toString();
              const url = item.url || '';
              const handleMatch = typeof url === 'string' ? url.match(/\/products\/([^/?#]+)/) : null;
              const itemHandle = handleMatch ? handleMatch[1] : '';
              const match = thresholds.find(t => {
                // Match by productId (GraphQL or numeric) or handle
                let tid = t.productId;
                if (typeof tid === 'string' && tid.includes('gid://shopify/Product/')) tid = tid.replace('gid://shopify/Product/', '');
                return (tid && tid.toString() === itemPid) || (t.productHandle && itemHandle && t.productHandle === itemHandle);
              });
              if (match && match.title) giftLabel = String(match.title);
            }
          } catch (_) {}
        }
        if (!giftLabel) giftLabel = this.settings.giftPriceText || 'FREE';
        const safeGiftLabel = (giftLabel ? String(giftLabel) : '')
          .replace(/🎁/g, '')
          .replace(/<[^>]*>/g, '')
          .trim() || 'FREE';
        const displayPrice = isGift ? safeGiftLabel : this.formatMoney(item.final_price);
        
        // Find the original line number from the unsorted cart
        const originalLineNumber = this.cart.items.findIndex(originalItem => 
          originalItem.id === item.id || 
          (originalItem.variant_id === item.variant_id && originalItem.key === item.key)
        ) + 1;
        
        return `
        <div class="cartuplift-item${isGift ? ' cartuplift-gift-item' : ''}" data-variant-id="${item.variant_id}" data-line="${originalLineNumber}">
          <div class="cartuplift-item-image">
            <img src="${item.image || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png'}" alt="${item.product_title}" loading="lazy" onerror="this.src='https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png'">
          </div>
          <div class="cartuplift-item-info">
            <h4 class="cartuplift-item-title">
              <a href="${item.url}" class="cartuplift-item-link">${displayTitle}</a>
            </h4>
            ${this.getVariantOptionsHTML(item)}
            <div class="cartuplift-item-quantity-wrapper">
              <div class="cartuplift-quantity">
                <button class="cartuplift-qty-minus" data-line="${originalLineNumber}"${isGift ? ' style="display:none;"' : ''}>−</button>
                <span class="cartuplift-qty-display">${item.quantity}</span>
                <button class="cartuplift-qty-plus" data-line="${originalLineNumber}"${isGift ? ' style="display:none;"' : ''}>+</button>
              </div>
            </div>
          </div>
          <div class="cartuplift-item-price-actions">
            <div class="cartuplift-item-price${isGift ? ' cartuplift-gift-price' : ''}">${displayPrice}</div>
            <button class="cartuplift-item-remove-x" data-line="${originalLineNumber}" aria-label="Remove item"${isGift ? ' style="display:none;"' : ''}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M9 6V4h6v2m-9 0 1 14h10l1-14H6z"/>
              </svg>
            </button>
          </div>
        </div>
      `;}).join('');
    }

  getGiftProgressHTML() {
      try {
        const giftThresholds = this.settings.giftThresholds ? JSON.parse(this.settings.giftThresholds) : [];
        if (giftThresholds.length === 0) return '';
        
        const sortedThresholds = giftThresholds.sort((a, b) => a.amount - b.amount);
        const currentTotal = this.cart ? (this.cart.total_price / 100) : 0; // Convert from cents
        const progressStyle = this.settings.giftProgressStyle || 'single-next';
        
          currentTotal,
          thresholds: sortedThresholds,
          style: progressStyle,
          count: sortedThresholds.length
        });

        // For single threshold, use the simple free shipping bar design
        if (sortedThresholds.length === 1) {
          const threshold = sortedThresholds[0];
          const progress = Math.min((currentTotal / threshold.amount) * 100, 100);
          // Use shippingBarColor for all progress fills; default to black
          const safeShippingColor = (this.settings.shippingBarColor || '#121212');
          
          return `
            <div class="cartuplift-shipping-bar">
              <div class="cartuplift-shipping-progress">
                <div class="cartuplift-shipping-progress-fill" style="width: ${progress}%; background: ${safeShippingColor} !important; display: block;"></div>
              </div>
            </div>
          `;
        }

        if (progressStyle === 'stacked') {
          return `
            <div class="cartuplift-gift-progress-container">
              <div class="cartuplift-stacked-progress">
                ${sortedThresholds.map(threshold => {
                  const progress = Math.min((currentTotal / threshold.amount) * 100, 100);
                  const isUnlocked = currentTotal >= threshold.amount;
                  const remaining = Math.max(threshold.amount - currentTotal, 0);
                  
                  return `
                    <div class="cartuplift-gift-threshold">
                      <div class="cartuplift-gift-info">
                        <span class="cartuplift-gift-title">
                          ${threshold.title} 
                          ${isUnlocked ? ' ✅' : ` ($${remaining.toFixed(0)} to go)`}
                        </span>
                        <span class="cartuplift-gift-progress-text">${Math.round(progress)}%</span>
                      </div>
                      <div class="cartuplift-gift-bar">
                        <div class="cartuplift-gift-fill" style="width: ${progress}%; background: ${(this.settings.shippingBarColor || '#121212')};"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }

        if (progressStyle === 'single-multi') {
          const maxThreshold = sortedThresholds[sortedThresholds.length - 1].amount;
          const totalProgress = Math.min((currentTotal / maxThreshold) * 100, 100);
          
          return `
            <div class="cartuplift-gift-progress-container">
              <div class="cartuplift-single-multi-progress">
                <div class="cartuplift-milestone-bar">
                  <div class="cartuplift-milestone-fill" style="width: ${totalProgress}%; background: ${(this.settings.shippingBarColor || '#121212')};"></div>
                  ${sortedThresholds.map(threshold => {
                    const position = (threshold.amount / maxThreshold) * 100;
                    const isUnlocked = currentTotal >= threshold.amount;
                    
                    return `
                      <div class="cartuplift-milestone-marker" style="left: ${position}%;">
                        <div class="cartuplift-milestone-dot ${isUnlocked ? 'unlocked' : ''}">
                          ${isUnlocked ? '✅' : '🎁'}
                        </div>
                        <div class="cartuplift-milestone-label">
                          $${threshold.amount} ${threshold.title}
                          ${!isUnlocked ? ` ($${(threshold.amount - currentTotal).toFixed(0)} to go)` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          `;
        }

        // Default: single-next style
        const nextThreshold = sortedThresholds.find(t => currentTotal < t.amount);
        const unlockedThresholds = sortedThresholds.filter(t => currentTotal >= t.amount);
        
        if (!nextThreshold && unlockedThresholds.length === 0) return '';
        
        return `
          <div class="cartuplift-gift-progress-container">
            <div class="cartuplift-next-goal-progress">
              ${unlockedThresholds.length > 0 ? `
                <div class="cartuplift-unlocked-gifts">
                  ${unlockedThresholds.map(threshold => `
                    <div class="cartuplift-unlocked-item">
                      ✅ ${threshold.title} UNLOCKED!
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              
              ${nextThreshold ? `
                <div class="cartuplift-next-goal">
                  <div class="cartuplift-next-info">
                    🎁 Next: ${nextThreshold.title} at $${nextThreshold.amount} 
                    (spend $${(nextThreshold.amount - currentTotal).toFixed(0)} more)
                  </div>
                  <div class="cartuplift-next-bar">
                    <div class="cartuplift-next-fill" style="width: ${Math.min((currentTotal / nextThreshold.amount) * 100, 100)}%; background: ${(this.settings.shippingBarColor || '#121212')};"></div>
                  </div>
                  <div class="cartuplift-progress-text">
                    ${Math.round((currentTotal / nextThreshold.amount) * 100)}% complete
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        `;
        
      } catch (error) {
        console.error('🎁 Gift Progress Error:', error);
        return '';
      }
    }

    getUnifiedProgressHTML() {
      try {
        const progressBarMode = this.settings.progressBarMode || 'free-shipping';
        const currentTotal = this.cart ? this.cart.total_price / 100 : 0;
        
          mode: progressBarMode,
          enableFreeShipping: this.settings.enableFreeShipping,
          enableGiftGating: this.settings.enableGiftGating,
          currentTotal: currentTotal
        });

        // Return empty if no progress bars are enabled
        if (!this.settings.enableFreeShipping && !this.settings.enableGiftGating) {
          return '';
        }

        switch (progressBarMode) {
          case 'free-shipping':
            return this.settings.enableFreeShipping ? this.getFreeShippingProgressHTML() : '';
          
          case 'gift-gating':
            return this.settings.enableGiftGating ? this.getGiftProgressHTML() : '';
          
          case 'combined':
            return this.getCombinedProgressHTML();
          
          default:
            return this.settings.enableFreeShipping ? this.getFreeShippingProgressHTML() : '';
        }
      } catch (error) {
        console.error('🛒 Unified Progress Error:', error);
        return '';
      }
    }

    getFreeShippingProgressHTML() {
      const currentTotal = this.cart ? this.cart.total_price / 100 : 0;
      const threshold = this.settings.freeShippingThreshold || 100;
      const progress = Math.min((currentTotal / threshold) * 100, 100);
      
  // Use shippingBarColor (default black) consistently for the fill
  const safeShippingColor = this.settings.shippingBarColor || '#121212';
      
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

    getCombinedProgressHTML() {
      const currentTotal = this.cart ? this.cart.total_price / 100 : 0;
      const giftThresholds = this.settings.giftThresholds ? JSON.parse(this.settings.giftThresholds) : [];
      const freeShippingThreshold = this.settings.freeShippingThreshold || 100;
      
      // Combine all thresholds (gifts + free shipping)
      const allThresholds = [...giftThresholds];
      if (this.settings.enableFreeShipping) {
        allThresholds.push({
          amount: freeShippingThreshold,
          title: 'Free Shipping',
          description: 'Get free shipping on your order'
        });
      }
      
      if (allThresholds.length === 0) return '';
      
      const sortedThresholds = allThresholds.sort((a, b) => a.amount - b.amount);
      const progressStyle = this.settings.giftProgressStyle || 'single-next';
      
      // Use the same rendering logic as gift progress but with combined thresholds
      if (progressStyle === 'stacked') {
        return this.renderStackedProgress(sortedThresholds, currentTotal);
      } else if (progressStyle === 'single-multi') {
        return this.renderSingleMultiProgress(sortedThresholds, currentTotal);
      } else {
        return this.renderSingleNextProgress(sortedThresholds, currentTotal);
      }
    }

    renderStackedProgress(thresholds, currentTotal) {
      const stackedHTML = thresholds.map(threshold => {
        const progress = Math.min((currentTotal / threshold.amount) * 100, 100);
        const isUnlocked = currentTotal >= threshold.amount;
        return `
          <div class="cartuplift-gift-threshold">
            <div class="cartuplift-gift-info">
              <span class="cartuplift-gift-title">
                ${threshold.title} ${isUnlocked ? '✓' : `($${threshold.amount})`}
              </span>
              <span class="cartuplift-gift-progress-text">${Math.round(progress)}%</span>
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

    renderSingleMultiProgress(thresholds, currentTotal) {
      const maxThreshold = Math.max(...thresholds.map(t => t.amount));
      const overallProgress = Math.min((currentTotal / maxThreshold) * 100, 100);
      
      const milestonesHTML = thresholds.map(threshold => {
        const position = (threshold.amount / maxThreshold) * 100;
        const isUnlocked = currentTotal >= threshold.amount;
        return `
          <div class="cartuplift-milestone-marker" style="left: ${position}%;">
            <div class="cartuplift-milestone-dot ${isUnlocked ? 'unlocked' : ''}">
              ${isUnlocked ? '✓' : '$'}
            </div>
            <div class="cartuplift-milestone-label">${threshold.title}</div>
          </div>
        `;
      }).join('');
      
      return `
        <div class="cartuplift-gift-progress-container">
          <div class="cartuplift-single-multi-progress">
            <div class="cartuplift-milestone-bar">
              <div class="cartuplift-milestone-fill" style="width: ${overallProgress}%; background: ${this.themeColors.primary || '#121212'};"></div>
              ${milestonesHTML}
            </div>
          </div>
        </div>
      `;
    }

    renderSingleNextProgress(thresholds, currentTotal) {
      const unlockedThresholds = thresholds.filter(t => currentTotal >= t.amount);
      const nextThreshold = thresholds.find(t => currentTotal < t.amount);
      
      let unlockedHTML = '';
      if (unlockedThresholds.length > 0) {
        unlockedHTML = `
          <div class="cartuplift-unlocked-gifts">
            ${unlockedThresholds.map(threshold => `
              <div class="cartuplift-unlocked-item">✓ ${threshold.title} unlocked!</div>
            `).join('')}
          </div>
        `;
      }
      
      return `
        <div class="cartuplift-gift-progress-container">
          <div class="cartuplift-next-goal-progress">
            ${unlockedHTML}
            ${nextThreshold ? `
              <div class="cartuplift-next-goal">
                <div class="cartuplift-next-info">
                  Next: ${nextThreshold.title} 
                  (spend $${(nextThreshold.amount - currentTotal).toFixed(0)} more)
                </div>
                <div class="cartuplift-next-bar">
                  <div class="cartuplift-next-fill" style="width: ${Math.min((currentTotal / nextThreshold.amount) * 100, 100)}%; background: ${this.themeColors.primary || '#121212'};"></div>
                </div>
                <div class="cartuplift-progress-text">
                  ${Math.round((currentTotal / nextThreshold.amount) * 100)}% complete
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    getRecommendationsHTML() {
      // Normalize again in case settings arrived late
      const layoutMap = { horizontal: 'row', vertical: 'column', grid: 'row' };
      const layoutRaw = this.settings.recommendationLayout || 'column';
      const layout = layoutMap[layoutRaw] || layoutRaw;
      const title = (this.settings.recommendationsTitle || 'You might also like');
          
      // For row layout, render controls outside the scroll container so they don't scroll
      const controlsHTML = `
        <div class="cartuplift-carousel-controls">
          <button class="cartuplift-carousel-nav prev" data-nav="prev" aria-label="Previous">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 12l-4-4 4-4"/>
            </svg>
          </button>
          <button class="cartuplift-carousel-nav next" data-nav="next" aria-label="Next">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 12l4-4-4-4"/>
            </svg>
          </button>
          <div class="cartuplift-carousel-dots">
            ${this.recommendations.map((_, index) => `
              <button type="button" class="cartuplift-carousel-dot${index === 0 ? ' active' : ''}"
                data-index="${index}"
                aria-label="Go to slide ${index + 1}"
                aria-current="${index === 0 ? 'true' : 'false'}"></button>
            `).join('')}
          </div>
        </div>`;

      const html = `
        <div class="cartuplift-recommendations cartuplift-recommendations-${layout}${layout === 'row' ? ' cartuplift-recommendations-row' : ''}">
          <div class="cartuplift-recommendations-header">
            <h3 class="cartuplift-recommendations-title">${title}</h3>
            <button class="cartuplift-recommendations-toggle" data-toggle="recommendations" aria-expanded="true" aria-controls="cartuplift-recommendations-content" aria-label="Toggle recommendations">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
              </svg>
            </button>
          </div>
          <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content" aria-hidden="false">
            ${this.getRecommendationItems()}
          </div>
          ${layout === 'row' ? controlsHTML : ''}
        </div>
      `;
      return html;
    }

    /** Update recommendations title & layout after settings injected later (e.g. upsell embed loads after main) */
    updateRecommendationsSection() {
      const section = document.querySelector('.cartuplift-recommendations');
      if (!section) {
        // If section doesn't exist but should, recreate the entire drawer
        if (this.settings.enableRecommendations && this._recommendationsLoaded && this.recommendations.length > 0) {
          this.updateDrawerContent();
          return;
        }
        return;
      }
      
  // Update layout class
      const layoutMap = { horizontal: 'row', vertical: 'column', grid: 'row' };
      const layoutRaw = this.settings.recommendationLayout || 'column';
      const layout = layoutMap[layoutRaw] || layoutRaw;
  section.className = `cartuplift-recommendations cartuplift-recommendations-${layout}${layout === 'row' ? ' cartuplift-recommendations-row' : ''}`;
      
      // Update title
      const titleEl = section.querySelector('.cartuplift-recommendations-title');
      if (titleEl) {
        titleEl.textContent = (this.settings.recommendationsTitle || 'You might also like');
      }
      
      // Update content
      const contentEl = section.querySelector('.cartuplift-recommendations-content');
      if (contentEl) {
        contentEl.innerHTML = this.getRecommendationItems();
        
        // Re-setup carousel controls if needed
        if (layout === 'row') {
          setTimeout(() => {
            this.setupScrollControls(contentEl);
            this.updateCarouselButtons(contentEl);
            this.updateDots(contentEl);
          }, 100);
        }
      }
    }

    // STABILITY: Debounced update to prevent rapid DOM manipulations
  debouncedUpdateRecommendations() {
      if (this._updateDebounceTimer) {
        clearTimeout(this._updateDebounceTimer);
      }
      
      this._updateDebounceTimer = setTimeout(() => {
        this.rebuildRecommendationsFromMaster();
        this._updateDebounceTimer = null;
      }, 150); // 150ms debounce to allow for smooth user interactions
    }

    rebuildRecommendationsFromMaster() {
      if (!this._allRecommendations.length) return;
      
      // STABILITY: Prevent rapid rebuilds that cause shaking
      if (this._rebuildInProgress) return;
      this._rebuildInProgress = true;
      
      requestAnimationFrame(() => {
        const cartProductIds = (this.cart?.items || []).map(i => i.product_id);
        
        // Build visible list by skipping any product in cart and taking next from master, preserving order
        const desired = Number(this.settings.maxRecommendations);
        const max = isFinite(desired) && desired > 0 ? desired : 4;
        const newRecommendations = [];
        for (const p of this._allRecommendations) {
          // Check both strict and loose equality for ID comparison
          const isInCartStrict = cartProductIds.includes(p.id);
          const isInCartLoose = cartProductIds.some(cartId => cartId == p.id);
          if (isInCartStrict || isInCartLoose) continue;
          newRecommendations.push(p);
          if (newRecommendations.length >= max) break;
        }
        
        // Only update if recommendations actually changed
        const currentIds = (this.recommendations || []).map(r => r.id).sort();
        const newIds = newRecommendations.map(r => r.id).sort();
        
        if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
          this.recommendations = newRecommendations;
        }
        
        this._rebuildInProgress = false;
      });
    }

    rebuildRecommendationsFromMasterSync() {
      if (!this._allRecommendations.length) return;
      
      // STABILITY: Prevent rapid rebuilds that cause shaking
      if (this._rebuildInProgress) return;
      
      const cartProductIds = (this.cart?.items || []).map(i => i.product_id);
      
      // Build visible list by skipping any product in cart and taking next from master, preserving order
      const desired = Number(this.settings.maxRecommendations);
      const max = isFinite(desired) && desired > 0 ? desired : 4;
      const newRecommendations = [];
      for (const p of this._allRecommendations) {
        // Check both strict and loose equality for ID comparison
        const isInCartStrict = cartProductIds.includes(p.id);
        const isInCartLoose = cartProductIds.some(cartId => cartId == p.id);
        if (isInCartStrict || isInCartLoose) continue;
        newRecommendations.push(p);
        if (newRecommendations.length >= max) break;
      }
      
      // Only update if recommendations actually changed
      const currentIds = (this.recommendations || []).map(r => r.id).sort();
      const newIds = newRecommendations.map(r => r.id).sort();
      
      if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
        this.recommendations = newRecommendations;
      } else {
      }
    }

  getRecommendationItems() {
      if (!this._recommendationsLoaded) {
        return '<div class="cartuplift-recommendations-loading">Loading recommendations...</div>';
      }
      
      if (!this.recommendations || this.recommendations.length === 0) {
        return '';
      }
      
      const layoutMap = { horizontal: 'row', vertical: 'column', grid: 'row' };
      const layoutRaw = this.settings.recommendationLayout || 'row';
      const layout = layoutMap[layoutRaw] || layoutRaw;
      
      if (layout === 'row') {
        // Only return the scroll track; controls are rendered outside the scroll container
        return `
          <div class="cartuplift-recommendations-track">
            ${this.recommendations.map(product => `
              <div class="cartuplift-recommendation-card">
                <div class="cartuplift-card-content">
                  <div class="cartuplift-product-image">
                    <img src="${product.image || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png'}" alt="${product.title}" loading="lazy" onerror="this.src='https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png'">
                  </div>
                  <div class="cartuplift-product-info">
                    <h4><a href="${product.url || '#'}" class="cartuplift-product-link">${product.title}</a></h4>
                    ${this.generateVariantSelector(product)}
                  </div>
                  <div class="cartuplift-product-actions">
                    <div class="cartuplift-recommendation-price">${this.formatMoney(product.priceCents || 0)}</div>
                    <button class="cartuplift-add-recommendation" data-product-id="${product.id}" data-variant-id="${product.variant_id}">
                      ${this.settings.addButtonText || 'Add+'}
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        return this.recommendations.map(product => `
          <div class="cartuplift-recommendation-item">
            <img src="${product.image || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png'}" alt="${product.title}" loading="lazy" onerror="this.src='https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png'">
            <div class="cartuplift-recommendation-info">
              <h4><a href="${product.url}" class="cartuplift-product-link">${product.title}</a></h4>
              <div class="cartuplift-recommendation-price">${this.formatMoney(product.priceCents || 0)}</div>
            </div>
            <button class="cartuplift-add-recommendation-circle" data-variant-id="${product.variant_id}">
              +
            </button>
          </div>
        `).join('');
      }
    }

  generateVariantSelector(product) {
      // If product has variants with multiple meaningful options, generate a proper selector
      if (product.variants && product.variants.length > 1) {
        // Find the first available variant to set as selected
        let firstAvailableIndex = -1;
        const availableVariants = product.variants.filter((variant, index) => {
          if (variant.available && firstAvailableIndex === -1) {
            firstAvailableIndex = index;
          }
          return variant.available;
        });
        
        return `
          <div class="cartuplift-product-variation">
            <select class="cartuplift-size-dropdown" data-product-id="${product.id}">
              ${availableVariants.map((variant, index) => `
                <option value="${variant.id}" data-price-cents="${variant.price_cents}" ${index === 0 ? 'selected' : ''}>
                  ${variant.title}
                </option>
              `).join('')}
            </select>
          </div>
        `;
      } else {
        // Simple product or single variant - hide selector completely
        return `<div class="cartuplift-product-variation hidden"></div>`;
      }
    }

  refreshRecommendationLayout() {
      // Reload settings to get latest changes
      const recommendationsContainer = document.querySelector('.cartuplift-recommendations-content');
      if (recommendationsContainer && this._recommendationsLoaded) {
        recommendationsContainer.innerHTML = this.getRecommendationItems();
        
        // Re-apply layout class to container  
        const recommendationsSection = document.querySelector('.cartuplift-recommendations');
        if (recommendationsSection) {
          const layoutMap = { horizontal: 'row', vertical: 'column', grid: 'row' };
          const layoutRaw = this.settings.recommendationLayout || 'column';
          const layout = layoutMap[layoutRaw] || layoutRaw;
          // Remove old layout classes and add new one
          recommendationsSection.classList.remove('cartuplift-recommendations-row', 'cartuplift-recommendations-column');
          recommendationsSection.classList.add(`cartuplift-recommendations-${layout}`);
          if (layout === 'row') {
            recommendationsSection.classList.add('cartuplift-recommendations-row');
          }
          
          // Ensure controls exist and setup navigation if horizontal layout
          if (layout === 'row') {
            const section = document.querySelector('.cartuplift-recommendations');
            if (section && !section.querySelector('.cartuplift-carousel-controls')) {
              const controls = document.createElement('div');
              controls.className = 'cartuplift-carousel-controls';
              controls.innerHTML = `
                <button class="cartuplift-carousel-nav prev" data-nav="prev" aria-label="Previous">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 12l-4-4 4-4"/>
                  </svg>
                </button>
                <button class="cartuplift-carousel-nav next" data-nav="next" aria-label="Next">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 12l4-4-4-4"/>
                  </svg>
                </button>
                <div class="cartuplift-carousel-dots">
                  ${this.recommendations.map((_, index) => `
                    <button type="button" class="cartuplift-carousel-dot${index === 0 ? ' active' : ''}"
                      data-index="${index}"
                      aria-label="Go to slide ${index + 1}"
                      aria-current="${index === 0 ? 'true' : 'false'}"></button>
                  `).join('')}
                </div>`;
              section.appendChild(controls);
            }
            setTimeout(() => {
              const scrollContainer = document.querySelector('.cartuplift-recommendations-content');
              if (scrollContainer) {
                this.setupScrollControls(scrollContainer);
                this.updateCarouselButtons(scrollContainer);
                scrollContainer.addEventListener('scroll', () => {
                  this.updateCarouselButtons(scrollContainer);
                  this.updateDots(scrollContainer);
                });
              }
            }, 100);
          }
        }
      }
    }

    setupScrollControls(scrollContainer) {
      // Check if we're on mobile
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Mobile: scroll by full container width for full card visibility
        this.scrollAmount = scrollContainer.clientWidth;
      } else {
        // Desktop: scroll by card width + margin for precise navigation
        // Card is 338px + 8px margin = 346px total
        this.scrollAmount = 346;
      }
      
      
      // Bind navigation events
      const prevBtn = document.querySelector('.cartuplift-carousel-nav.prev');
      const nextBtn = document.querySelector('.cartuplift-carousel-nav.next');
      
      if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => this.scrollPrev(scrollContainer));
        nextBtn.addEventListener('click', () => this.scrollNext(scrollContainer));
      }
      
      // Bind dot navigation
      const dots = document.querySelectorAll('.cartuplift-carousel-dot');
      dots.forEach((dot, index) => {
        dot.addEventListener('click', () => this.scrollToIndex(scrollContainer, index));
        dot.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.scrollToIndex(scrollContainer, index);
          }
        });
      });
      
      // Add touch support for mobile
      if (isMobile) {
        this.setupTouchEvents(scrollContainer);
      }
    }
    
    setupTouchEvents(scrollContainer) {
      let startX = 0;
      let scrollLeft = 0;
      let isDown = false;
      
      scrollContainer.addEventListener('touchstart', (e) => {
        isDown = true;
        startX = e.touches[0].pageX - scrollContainer.offsetLeft;
        scrollLeft = scrollContainer.scrollLeft;
      });
      
      scrollContainer.addEventListener('touchend', () => {
        isDown = false;
      });
      
      scrollContainer.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.touches[0].pageX - scrollContainer.offsetLeft;
        const walk = (x - startX) * 2;
        scrollContainer.scrollLeft = scrollLeft - walk;
      });
    }
    
  scrollToIndex(scrollContainer, index) {
      if (!scrollContainer) return;
      const targetScroll = index * this.scrollAmount;
      
      scrollContainer.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }

    scrollPrev(scrollContainer) {
      if (!scrollContainer) return;
      const currentScroll = scrollContainer.scrollLeft;
      const targetScroll = Math.max(0, currentScroll - this.scrollAmount);
      
      
      scrollContainer.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }

    scrollNext(scrollContainer) {
      if (!scrollContainer) return;
      const currentScroll = scrollContainer.scrollLeft;
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      let targetScroll = currentScroll + this.scrollAmount;
      
      // If we would overshoot, scroll to the end
      if (targetScroll >= maxScroll) {
        targetScroll = maxScroll;
      }
      
      
      scrollContainer.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }

    updateCarouselButtons(scrollContainer) {
      if (!scrollContainer) return;
      
      const prevBtn = document.querySelector('.cartuplift-carousel-nav.prev');
      const nextBtn = document.querySelector('.cartuplift-carousel-nav.next');
      
      if (!prevBtn || !nextBtn) return;
      
      const scrollLeft = scrollContainer.scrollLeft;
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      const scrollable = maxScroll > 5;

      // Show/hide controls based on content
      const controls = document.querySelector('.cartuplift-carousel-controls');
      if (controls) {
        if (!scrollable) {
          controls.style.display = 'none';
        } else {
          controls.style.display = 'flex';
        }
      }
      
      // Update button states
      prevBtn.disabled = scrollLeft <= 0;
      nextBtn.disabled = scrollLeft >= maxScroll - 1;
      
      // Add visual feedback
      if (prevBtn.disabled) {
        prevBtn.style.opacity = '0.3';
      } else {
        prevBtn.style.opacity = '1';
      }
      
      if (nextBtn.disabled) {
        nextBtn.style.opacity = '0.3';
      } else {
        nextBtn.style.opacity = '1';
      }
    }
    
    updateDots(scrollContainer) {
      if (!scrollContainer) return;
      
      const dots = document.querySelectorAll('.cartuplift-carousel-dot');
      if (dots.length === 0) return;
      
      const scrollLeft = scrollContainer.scrollLeft;
  const currentIndex = Math.round(scrollLeft / this.scrollAmount);
      
      dots.forEach((dot, index) => {
        const isActive = index === currentIndex;
        dot.classList.toggle('active', isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    }

    handleVariantChange(select) {
      const card = select.closest('.cartuplift-recommendation-card');
      if (!card) return;
      
      const variantId = select.value;
  const selectedOption = select.options[select.selectedIndex];
  const priceCents = selectedOption.dataset.priceCents;
      
      // Update add button with selected variant
      const addBtn = card.querySelector('.cartuplift-add-recommendation');
      if (addBtn && variantId) {
        addBtn.dataset.variantId = variantId;
      }
      
      // Update price display if available
    if (priceCents) {
        const priceElement = card.querySelector('.cartuplift-recommendation-price');
        if (priceElement) {
      priceElement.textContent = this.formatMoney(parseInt(priceCents));
        }
      }
    }

    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `cartuplift-toast cartuplift-toast-${type}`;
      toast.textContent = message;
      
      const bgColor = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6';
      
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${bgColor};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 99999;
        animation: cartupliftSlideUp 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 3000);
    }

    getAddonsHTML() {
      return `
        <div class="cartuplift-addons">
          <button class="cartuplift-addon-btn">
            Add Gift Note & Logo Free Packaging +
          </button>
        </div>
      `;
    }

    getDiscountHTML() {
      // Build action text based on enabled features
      const enabledFeatures = [];
      if (this.settings.enableDiscountCode) enabledFeatures.push('discount codes');
      if (this.settings.enableNotes) enabledFeatures.push('notes');
      if (this.settings.enableGiftMessage) enabledFeatures.push('gift messages');
      if (this.settings.enableSpecialRequests) enabledFeatures.push('special requests');
      if (this.settings.enableDeliveryInstructions) enabledFeatures.push('delivery instructions');
      if (this.settings.enableGiftWrapping) enabledFeatures.push('gift wrapping');
      
      let actionText = this.settings.actionText;
      if (!actionText && enabledFeatures.length > 0) {
        if (enabledFeatures.length === 1) {
          actionText = `Add ${enabledFeatures[0]}`;
        } else if (enabledFeatures.length === 2) {
          actionText = `Add ${enabledFeatures.join(' and ')}`;
        } else {
          actionText = `Add ${enabledFeatures.slice(0, -1).join(', ')} and ${enabledFeatures.slice(-1)}`;
        }
      } else if (!actionText) {
        actionText = 'Add extras to your order';
      }
      
      return `
        <div class="cartuplift-action-section">
          <button class="cartuplift-action-button" onclick="window.cartUpliftDrawer.openCustomModal()">
            ${actionText}
          </button>
        </div>
      `;
    }

    getNotesHTML() {
      return `
        <div class="cartuplift-notes">
          <textarea id="cartuplift-notes-input" class="cartuplift-notes-input" placeholder="Order notes..." rows="3"></textarea>
        </div>
      `;
    }

    openCustomModal() {
      // Always regenerate modal content to reflect current settings
      let modal = document.getElementById('cartuplift-custom-modal');
      if (modal) {
        modal.remove(); // Remove existing modal to regenerate with current settings
      }
      
      modal = document.createElement('div');
      modal.id = 'cartuplift-custom-modal';
      modal.className = 'cartuplift-custom-modal';
      
      // Build modal content based on enabled features
      let modalContent = '';
      
      modalContent += `
        <div class="cartuplift-modal-content">
          <div class="cartuplift-modal-header">
            <h3 class="cartuplift-modal-title">Add to Order</h3>
            <button class="cartuplift-modal-close" onclick="window.cartUpliftDrawer.closeCustomModal()">×</button>
          </div>
          <div class="cartuplift-modal-body">
      `;
      
      // Discount/Voucher Code Section - with immediate verification
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
      
      // Order Notes Section
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
      
      // Gift Message Section
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
      
      // Focus first input
      const firstInput = modal.querySelector('input, textarea');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
      
      // Debug log to check current settings
        enableDiscountCode: this.settings.enableDiscountCode,
        enableNotes: this.settings.enableNotes,
        enableGiftMessage: this.settings.enableGiftMessage
      });
    }

    closeCustomModal() {
      const modal = document.getElementById('cartuplift-custom-modal');
      if (modal) {
        modal.classList.remove('active');
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
      
      // Disable button and show loading
      if (button) {
        button.disabled = true;
        button.textContent = 'Applying...';
      }
      
      try {
        // First, validate the discount code using our API
        const validationResponse = await fetch(`/apps/cart-uplift/api/discount`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            discountCode: discountCode
          })
        });
        
  // If our app validation isn't available or lacks permission, fall back to Shopify's built-in validation
  if (!validationResponse.ok && (validationResponse.status === 404 || validationResponse.status === 401 || validationResponse.status === 403 || validationResponse.status >= 500)) {
          // API endpoint not found, use Shopify's built-in validation
          const shopifyResponse = await fetch('/cart/discounts/' + encodeURIComponent(discountCode), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (shopifyResponse.ok) {
            await this.fetchCart();
            this.updateDrawerContent();
            if (messageEl) messageEl.innerHTML = `<span class="success">✓ Discount code "${discountCode}" applied successfully!</span>`;
            if (input) input.value = '';
            this.showToast('Discount code applied!', 'success');
            this.openCustomModal();
          } else {
            const errorData = await shopifyResponse.json().catch(() => ({}));
            const errorMessage = errorData.description || 'Invalid discount code';
            if (messageEl) messageEl.innerHTML = `<span class="error">✗ ${errorMessage}</span>`;
            this.showToast('Invalid discount code', 'error');
          }
          return;
        }
        
        const validationData = await validationResponse.json().catch(() => ({}));

        // If server replied but couldn't validate (e.g., permission error), try Shopify fallback before failing
        if (!validationResponse.ok && validationData && validationData.error) {
          try {
            const shopifyResponse = await fetch('/cart/discounts/' + encodeURIComponent(discountCode), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            if (shopifyResponse.ok) {
              await this.fetchCart();
              this.updateDrawerContent();
              if (messageEl) messageEl.innerHTML = `<span class="success">✓ Discount code "${discountCode}" applied successfully!</span>`;
              if (input) input.value = '';
              this.showToast('Discount code applied!', 'success');
              this.openCustomModal();
              return;
            }
          } catch (e) {
            // ignore and proceed to error handling
          }
        }
        
  if (validationData.success) {
          // Discount is valid, save it as cart attribute for checkout
          const cartData = await fetch('/cart.js').then(r => r.json());
      // Normalize numeric fields (percent/amount) in case API returns strings
      const kind = validationData.discount.kind || '';
      const rawPercent = validationData.discount.percent;
      const rawAmountCents = validationData.discount.amountCents;
      const percentNum = typeof rawPercent === 'number' ? rawPercent : (typeof rawPercent === 'string' ? parseFloat(rawPercent) : undefined);
      const amountCentsNum = typeof rawAmountCents === 'number' ? rawAmountCents : (typeof rawAmountCents === 'string' ? Math.round(parseFloat(rawAmountCents)) : undefined);
          
          const updateData = {
            attributes: {
              ...cartData.attributes,
              'discount_code': discountCode,
      'discount_summary': validationData.discount.summary || `Discount: ${discountCode}`,
      // Store metadata for estimating savings in-cart
    'discount_kind': kind,
    'discount_percent': typeof percentNum === 'number' && !isNaN(percentNum) ? String(percentNum) : '',
    'discount_amount_cents': typeof amountCentsNum === 'number' && !isNaN(amountCentsNum) ? String(amountCentsNum) : ''
            }
          };

      // Optimistically update local state so subtotal reflects immediately
      this._lastDiscountCode = discountCode;
      this._lastDiscountKind = kind || undefined;
      this._lastDiscountPercent = typeof percentNum === 'number' && !isNaN(percentNum) ? percentNum : undefined;
      this._lastDiscountAmountCents = typeof amountCentsNum === 'number' && !isNaN(amountCentsNum) ? amountCentsNum : undefined;
      this.updateDrawerContent();
          
          const updateResponse = await fetch('/cart/update.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData)
          });
          
          if (updateResponse.ok) {
            await this.fetchCart();
            this.updateDrawerContent();
            if (messageEl) messageEl.innerHTML = `<span class="success">✓ Discount code "${discountCode}" validated! Previewed below and will apply at checkout.</span>`;
            if (input) input.value = '';
            this.showToast('Discount code validated!', 'success');
            // Regenerate modal UI to reflect applied state
            this.openCustomModal();
          } else {
            throw new Error('Failed to save discount to cart');
          }
          
  } else {
          // Discount validation failed
          if (messageEl) messageEl.innerHTML = `<span class="error">${validationData.error || 'Invalid discount code'}</span>`;
          this.showToast('Invalid discount code', 'error');
        }
        
      } catch (error) {
        console.error('Error validating discount:', error);
        
        // Show proper error message - no fallback saving of unvalidated codes
        if (messageEl) messageEl.innerHTML = '<span class="error">Unable to validate discount code. Please check the code and try again.</span>';
        this.showToast('Discount validation failed', 'error');
      } finally {
        // Reset button
        if (button) {
          button.disabled = false;
          button.textContent = 'Apply';
        }
      }
    }

    async removeDiscountCode() {
      try {
        const cartData = await fetch('/cart.js').then(r => r.json());
        const attrs = { ...(cartData.attributes || {}) };
        // Clear discount-related attributes
        attrs['discount_code'] = null;
        attrs['discount_summary'] = null;
        attrs['discount_kind'] = null;
        attrs['discount_percent'] = null;
        attrs['discount_amount_cents'] = null;

        const resp = await fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attributes: attrs })
        });
        if (resp.ok) {
          await this.fetchCart();
          this.updateDrawerContent();
          this.showToast('Discount removed', 'success');
          // Reopen modal with input enabled
          // Clear local discount cache
          this._lastDiscountCode = undefined;
          this._lastDiscountKind = undefined;
          this._lastDiscountPercent = undefined;
          this._lastDiscountAmountCents = undefined;
          this.openCustomModal();
        } else {
          this.showToast('Could not remove discount', 'error');
        }
      } catch (e) {
        console.error('Error removing discount:', e);
        this.showToast('Could not remove discount', 'error');
      }
    }

    async saveModalOptions() {
      const modal = document.getElementById('cartuplift-custom-modal');
      if (!modal) return;
      
      const options = {};
      
      // Collect order notes
      const notesInput = modal.querySelector('#modal-order-notes');
      if (notesInput && notesInput.value.trim()) {
        options.orderNotes = notesInput.value.trim();
      }
      
      // Collect gift message
      const giftInput = modal.querySelector('#modal-gift-message');
      if (giftInput && giftInput.value.trim()) {
        options.giftMessage = giftInput.value.trim();
      }
      
      // Save options to cart attributes
      await this.saveCartAttributes(options);
      
      this.closeCustomModal();
      this.showToast('Your preferences have been saved!', 'success');
    }

    async saveCartAttributes(attributes) {
      try {
        // Convert to cart attributes format
        const cartAttributes = {};
        if (attributes.orderNotes) cartAttributes['Order Notes'] = attributes.orderNotes;
        if (attributes.giftMessage) cartAttributes['Gift Message'] = attributes.giftMessage;
        if (attributes.specialRequests) cartAttributes['Special Requests'] = attributes.specialRequests;
        if (attributes.deliveryInstructions) cartAttributes['Delivery Instructions'] = attributes.deliveryInstructions;
        if (attributes.giftWrapping) cartAttributes['Gift Wrapping'] = 'Yes';
        
        // Update cart with attributes
        const response = await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attributes: cartAttributes
          })
        });
        
        if (response.ok) {
          await this.fetchCart();
        }
      } catch (error) {
        console.error('Error saving cart attributes:', error);
      }
    }

    async applyInlineDiscount() {
      const input = document.getElementById('cartuplift-discount-input');
      const messageEl = document.getElementById('cartuplift-discount-message');
      const button = document.querySelector('.cartuplift-discount-apply');
      
      if (!input || !input.value.trim()) {
        if (messageEl) messageEl.innerHTML = '<span class="error">Please enter a discount code</span>';
        return;
      }
      
      const discountCode = input.value.trim();
      
      // Disable button and show loading
      if (button) {
        button.disabled = true;
        button.textContent = 'Applying...';
      }
      
      try {
        // Use Shopify's cart/discounts.js endpoint
        const response = await fetch('/cart/discounts/' + encodeURIComponent(discountCode), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          await this.fetchCart();
          this.updateDrawerContent();
          if (messageEl) messageEl.innerHTML = '<span class="success">✓ Discount applied successfully!</span>';
          if (input) input.value = '';
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.description || 'Invalid discount code';
          if (messageEl) messageEl.innerHTML = `<span class="error">✗ ${errorMessage}</span>`;
        }
      } catch (error) {
        console.error('Error applying discount:', error);
        if (messageEl) messageEl.innerHTML = '<span class="error">✗ Error applying discount code</span>';
      } finally {
        // Re-enable button
        if (button) {
          button.disabled = false;
          button.textContent = 'Apply';
        }
      }
    }

    async applyDiscountCode(code = null) {
      const discountCode = code || document.getElementById('discount-code')?.value;
      if (!discountCode) return;
      
      try {
        const response = await fetch('/discount/' + encodeURIComponent(discountCode), {
          method: 'POST'
        });
        
        if (response.ok) {
          await this.fetchCart();
          this.updateDrawerContent();
          this.showToast('Discount applied!', 'success');
        } else {
          this.showToast('Invalid discount code', 'error');
        }
      } catch (error) {
        console.error('Error applying discount:', error);
        this.showToast('Error applying discount', 'error');
      }
    }

    getExpressCheckoutHTML() {
      return `
        <div class="cartuplift-express-checkout">
          <div class="cartuplift-express-slot"></div>
        </div>
      `;
    }

    attachDrawerEvents() {
      const container = document.getElementById('cartuplift-app-container');
      if (!container) return;

      // Close button
      const closeBtn = container.querySelector('.cartuplift-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeDrawer());
      }

      // Backdrop click to close
      const backdrop = container.querySelector('#cartuplift-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          // Don't close drawer if modal is active
          const modal = document.getElementById('cartuplift-custom-modal');
          if (modal && modal.classList.contains('active')) return;
          
          // Only close if the click is directly on the backdrop, not a child
          if (e.target === backdrop) {
            this.closeDrawer();
          }
        });
      }

      // Fallback: click outside the drawer closes it
      document.addEventListener('mousedown', (e) => {
        if (!this.isOpen) return;
        
        // Don't close drawer if modal is active
        const modal = document.getElementById('cartuplift-custom-modal');
        if (modal && modal.classList.contains('active')) return;
        
        const popup = document.getElementById('cartuplift-cart-popup');
        if (!popup) return;
        // If click is outside the popup and not on sticky cart button
        if (!popup.contains(e.target) && !e.target.closest('.cartuplift-sticky-btn')) {
          this.closeDrawer();
        }
      });

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          // If modal is active, close modal first
          const modal = document.getElementById('cartuplift-custom-modal');
          if (modal && modal.classList.contains('active')) {
            this.closeCustomModal();
          } else {
            this.closeDrawer();
          }
        }
      });

      // Quantity controls and recommendations toggle
      container.addEventListener('click', (e) => {
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
        } else if (e.target.classList.contains('cartuplift-add-recommendation')) {
          e.preventDefault();
          e.stopPropagation();
          
          const card = e.target.closest('.cartuplift-recommendation-card');
          if (!card) return;
          
          // Check if size needs to be selected
          const sizeSelect = card.querySelector('.cartuplift-size-dropdown:not([disabled])');
          let selectedVariantId = e.target.dataset.variantId;
          
          if (sizeSelect && !sizeSelect.value) {
            this.showToast('Please select an option', 'error');
            sizeSelect.focus();
            return;
          }
          
          // Use selected variant from dropdown if available
          if (sizeSelect && sizeSelect.value) {
            selectedVariantId = sizeSelect.value;
          }
          
          if (!selectedVariantId) {
            this.showToast('Please select options', 'error');
            return;
          }
          
          const productTitle = card.querySelector('h4')?.textContent || `Product ${selectedVariantId}`;
          
          // Track product click
          if (this.settings.enableAnalytics) CartAnalytics.trackEvent('product_click', {
            productId: selectedVariantId,
            productTitle: productTitle
          });
          
          this.addToCart(selectedVariantId, 1);
        } else if (e.target.classList.contains('cartuplift-size-dropdown')) {
          // Handle variant selection
          this.handleVariantChange(e.target);
        } else if (e.target.classList.contains('cartuplift-add-recommendation-circle')) {
          e.preventDefault();
          e.stopPropagation();
          const variantId = e.target.dataset.variantId;
          const productTitle = e.target.dataset.productTitle || `Product ${variantId}`;
          
          // Track product click
          if (this.settings.enableAnalytics) CartAnalytics.trackEvent('product_click', {
            productId: variantId,
            productTitle: productTitle
          });
          
          this.addToCart(variantId, 1);
        } else if (
          e.target.classList.contains('cartuplift-recommendations-toggle') ||
          e.target.closest('.cartuplift-recommendations-toggle')
        ) {
          e.preventDefault();
          e.stopPropagation();
          
          
          // Robustly find the toggle button and recommendations section
          const toggleButton = e.target.classList.contains('cartuplift-recommendations-toggle')
            ? e.target
            : e.target.closest('.cartuplift-recommendations-toggle');
            
          
          // Find the recommendations section relative to the toggle button
          let recommendations = toggleButton.closest('.cartuplift-recommendations');
          if (!recommendations) {
            recommendations = container.querySelector('.cartuplift-recommendations');
          }
          
          
          if (recommendations) {
            const isCollapsed = recommendations.classList.contains('collapsed');
            recommendations.classList.toggle('collapsed');
            // Update content aria-hidden
            const content = recommendations.querySelector('#cartuplift-recommendations-content');
            if (content) {
              const nowCollapsed = recommendations.classList.contains('collapsed');
              content.setAttribute('aria-hidden', nowCollapsed ? 'true' : 'false');
            }
            // Update arrow direction with your SVGs
            const arrow = toggleButton.querySelector('svg path');
            if (arrow) {
              if (isCollapsed) {
                // Was collapsed, now expanding - arrow points up
                arrow.setAttribute('d', 'm4.5 15.75 7.5-7.5 7.5 7.5');
              } else {
                // Was expanded, now collapsing - arrow points down
                arrow.setAttribute('d', 'm19.5 8.25-7.5 7.5-7.5-7.5');
              }
            }
            // Sync aria state
            const nowCollapsed = recommendations.classList.contains('collapsed');
            toggleButton.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
          }
        } else if (e.target.classList.contains('cartuplift-carousel-nav') || e.target.closest('.cartuplift-carousel-nav')) {
          // Handle carousel navigation
          const navButton = e.target.classList.contains('cartuplift-carousel-nav') 
            ? e.target 
            : e.target.closest('.cartuplift-carousel-nav');
          const direction = navButton.dataset.nav;
          const scrollContainer = container.querySelector('.cartuplift-recommendations-content');
          
          if (scrollContainer && direction) {
            // Ensure shared scroll config is set
            this.setupScrollControls(scrollContainer);
            if (direction === 'prev') {
              this.scrollPrev(scrollContainer);
            } else if (direction === 'next') {
              this.scrollNext(scrollContainer);
            }
            
            // Update button states and dots after scroll
            setTimeout(() => {
              this.updateCarouselButtons(scrollContainer);
              this.updateDots(scrollContainer);
            }, 100);
          }
        } else if (e.target.classList.contains('cartuplift-carousel-dot')) {
          // Handle dot navigation
          const dot = e.target;
          const index = parseInt(dot.dataset.index);
          const scrollContainer = container.querySelector('.cartuplift-recommendations-content');
          
          if (scrollContainer && !isNaN(index)) {
            this.setupScrollControls(scrollContainer);
            this.scrollToIndex(scrollContainer, index);
            
            // Update dots immediately for instant feedback
            const dots = document.querySelectorAll('.cartuplift-carousel-dot');
            dots.forEach((d, i) => {
              d.classList.toggle('active', i === index);
            });
          }
        }
      });

      // Variant dropdown change handler (ensure updates fire on change)
      container.addEventListener('change', (e) => {
        const select = e.target;
        if (select && select.classList && select.classList.contains('cartuplift-size-dropdown')) {
          this.handleVariantChange(select);
        }
      });

      // Mobile: ensure recommendations toggle responds on touch devices
      container.addEventListener('touchend', (e) => {
        const toggle = e.target.classList?.contains('cartuplift-recommendations-toggle')
          ? e.target
          : (e.target.closest && e.target.closest('.cartuplift-recommendations-toggle'));
        if (toggle) {
          e.preventDefault();
          e.stopPropagation();
          toggle.click();
        }
      }, { passive: false });
    }

    async fetchCart() {
      try {
        const response = await fetch('/cart.js');
        this.cart = await response.json();
  // Recompute visible recommendations against fixed master list whenever cart changes
  this.rebuildRecommendationsFromMaster();
      } catch (error) {
        console.error('🛒 Error fetching cart:', error);
        this.cart = { items: [], item_count: 0, total_price: 0 };
      }
    }

    async updateQuantity(line, quantity) {
      if (this._quantityBusy) return;
      this._quantityBusy = true;
      
      try {
        const formData = new FormData();
        formData.append('line', line);
        formData.append('quantity', quantity);

        const response = await fetch('/cart/change.js', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          this.cart = await response.json();
          // Ensure recommendations reflect cart mutations (remove added items, re-add removed ones)
          this.rebuildRecommendationsFromMaster();
          this.updateDrawerContent();
        }
      } catch (error) {
        console.error('🛒 Error updating quantity:', error);
      } finally {
        this._quantityBusy = false;
      }
    }

    async addToCart(variantId, quantity = 1) {
      // Prevent multiple rapid clicks
      if (this._addToCartBusy) {
        return;
      }
      
      this._addToCartBusy = true;
      
      try {
        // Validate variant ID first
        if (!variantId || variantId === 'undefined' || variantId === 'null') {
          console.error('🛒 Invalid variant ID:', variantId);
          this._addToCartBusy = false;
          return;
        }
        
        // Disable the button temporarily with better UX
        const buttons = document.querySelectorAll(`[data-variant-id="${variantId}"]`);
        buttons.forEach(button => {
          button.disabled = true;
          button.style.opacity = '0.6';
          button.style.transform = 'scale(0.95)';
          // Keep the + sign, just make it look pressed
        });
        
        // Add delay to prevent rate limiting (invisible to user)
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const formData = new FormData();
        formData.append('id', variantId);
        formData.append('quantity', quantity);

        const response = await fetch('/cart/add.js', {
          method: 'POST',
          body: formData
        });

        const responseData = response.ok ? await response.json() : await response.text();

        if (response.ok) {
          // Reset button state immediately on success with success animation
          buttons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.transform = 'scale(1)';
            button.style.background = '#22c55e'; // Green success flash
            setTimeout(() => {
              button.style.background = '';
            }, 300);
          });
          
          // Re-filter so added item disappears from recommendations
          this.debouncedUpdateRecommendations();
          
          await this.fetchCart();
          // Fetch will also recompute recommendations
          this.updateDrawerContent();
          
          // Update recommendations display if drawer is open
          if (this.isOpen) {
            const recommendationsContent = document.getElementById('cartuplift-recommendations-content');
            if (recommendationsContent) {
              recommendationsContent.innerHTML = this.getRecommendationItems();
            }
          }
        } else if (response.status === 429) {
          console.error('🛒 Rate limited, retrying with longer delay...');
          // Silently retry after longer delay - no user feedback
          buttons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.transform = 'scale(1)';
          });
          // Don't show rate limit message to user
        } else if (response.status === 422) {
          console.error('🛒 Variant not found (422 error) for variant ID:', variantId);
          // For 422 errors, remove the invalid recommendation to prevent future errors
          this.removeInvalidRecommendation(variantId);
          buttons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.transform = 'scale(1)';
            button.style.display = 'none'; // Hide invalid items
          });
        } else {
          console.error('🛒 Error adding to cart:', response.status, response.statusText);
          // Re-enable buttons on error with subtle shake
          buttons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.transform = 'scale(1)';
            button.style.animation = 'shake 0.3s ease-in-out';
            setTimeout(() => {
              button.style.animation = '';
            }, 300);
          });
        }
      } catch (error) {
        console.error('🛒 Error adding to cart:', error);
        // Re-enable buttons on error
        const buttons = document.querySelectorAll(`[data-variant-id="${variantId}"]`);
        buttons.forEach(button => {
          button.disabled = false;
          button.style.opacity = '1';
          button.style.transform = 'scale(1)';
        });
      } finally {
        // Always reset the busy flag after a shorter delay
        setTimeout(() => {
          this._addToCartBusy = false;
        }, 500);
      }
    }

    // Remove invalid recommendations to prevent future 422 errors
    removeInvalidRecommendation(variantId) {
      if (this.recommendations && Array.isArray(this.recommendations)) {
        this.recommendations = this.recommendations.filter(rec => {
          const recVariantId = rec.variant_id || rec.variantId || rec.id;
          return recVariantId.toString() !== variantId.toString();
        });
        
        // Update the display if drawer is open
        if (this.isOpen) {
          const recommendationsContent = document.getElementById('cartuplift-recommendations-content');
          if (recommendationsContent) {
            recommendationsContent.innerHTML = this.getRecommendationItems();
          }
        }
      }
    }

    async loadRecommendations() {
      try {
        
        // Initialize recommendation engine if not exists
        if (!this.recommendationEngine) {
          this.recommendationEngine = new SmartRecommendationEngine(this);
        }
        
        // Get smart recommendations
        const recommendations = await this.recommendationEngine.getRecommendations();
        
  // Store and display (master order fixed; visible list filtered by cart)
  this._allRecommendations = recommendations;
  this._recommendationsLocked = true; // prevent reshuffling master order; still compute visible each time
  this.rebuildRecommendationsFromMaster();
  this._recommendationsLoaded = true;
        
        
        // Update recommendations display if drawer is open
        if (this.isOpen) {
          const recommendationsContent = document.getElementById('cartuplift-recommendations-content');
          if (recommendationsContent) {
            recommendationsContent.innerHTML = this.getRecommendationItems();
          }
        }
        
      } catch (error) {
        console.error('🛒 Error loading smart recommendations:', error);
        // Fallback to original method
        await this.loadRecommendationsFallback();
      }
    }

    async loadRecommendationsFallback() {
      try {
        
  let apiUrl = '';
  let products = [];
  // Honor user setting; any positive number
  const desiredSetting = Number(this.settings.maxRecommendations);
  const desiredMax = isFinite(desiredSetting) && desiredSetting > 0 ? desiredSetting : 4;
        
        // Get product recommendations based on cart items, or popular products if cart is empty
        if (this.cart && this.cart.items && this.cart.items.length > 0) {
          const productId = this.cart.items[0].product_id;
          apiUrl = `/recommendations/products.json?product_id=${productId}&limit=${desiredMax}`;
        } else {
          // Load popular/featured products when cart is empty
          apiUrl = `/products.json?limit=${desiredMax}`;
        }
        
        const response = await fetch(apiUrl);
        
        if (response.ok) {
          const data = await response.json();
          products = data.products || [];
        } else {
        }
        
        // Always try to keep a buffer so we can fill visible list after filtering cart items
        const targetBuffer = Math.max(desiredMax * 3, desiredMax + 8); // Larger buffer for better selection
        if (products.length < targetBuffer) {
          try {
            const extraLimit = Math.max(targetBuffer * 2, 20); // load more for better filtering
            const fallbackResponse = await fetch(`/products.json?limit=${extraLimit}`); // Load more for better filtering
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              const fallbackProducts = fallbackData.products || [];
              
              // Filter out products already in the provisional list; allow items currently in cart to stay in master
              const existingProductIds = products.map(p => p.id);
              
              const filteredProducts = fallbackProducts.filter(product => 
                !existingProductIds.includes(product.id) &&
                product.variants && product.variants.length > 0 && 
                product.variants[0].available
              );
              
              // Add filtered products until we reach the buffer target
              const needed = targetBuffer - products.length;
              products = products.concat(filteredProducts.slice(0, needed));
              
            }
          } catch (fallbackError) {
            console.error('🛒 Error loading fallback products:', fallbackError);
          }
        }
        
  // Convert to our format
        this._allRecommendations = products.map(product => ({
          id: product.id,
          title: product.title,
          // Shopify /products.json returns price as a decimal string in major units (e.g., "14.00" for £14)
          // We need to convert to cents for consistent formatting
          priceCents: (product.variants && product.variants[0] && product.variants[0].price)
            ? Math.round(parseFloat(product.variants[0].price) * 100)
            : 0,
          image: product.images && product.images[0] ? product.images[0].src || product.images[0] : 
                 product.featured_image || 'https://via.placeholder.com/150x150?text=No+Image',
          variant_id: product.variants && product.variants[0] ? product.variants[0].id : null,
          url: product.handle ? `/products/${product.handle}` : (product.url || '#'),
          // Normalize variants with price in cents for UI handling
          variants: (product.variants || []).map(v => ({
            ...v,
            price_cents: v.price ? Math.round(parseFloat(v.price) * 100) : 0
          })),
          options: product.options || []
        })).filter(item => item.variant_id); // Only include products with valid variants
        
  // Build visible list from fixed master, filtered against cart
  this._recommendationsLocked = true;
  this.rebuildRecommendationsFromMaster();
        
        // Update recommendations display if drawer is open
        if (this.isOpen) {
          const recommendationsContent = document.getElementById('cartuplift-recommendations-content');
          if (recommendationsContent) {
            recommendationsContent.innerHTML = this.getRecommendationItems();
          }
        }
        
        // Mark recommendations as loaded regardless of success/failure
        this._recommendationsLoaded = true;
        
      } catch (error) {
        console.error('🛒 Error loading fallback recommendations:', error);
        this.recommendations = [];
        this._recommendationsLoaded = true;
      }
    }

    updateDrawerContent() {
      // Always update sticky cart counters even if the drawer isn't mounted
      try {
        const countEl = document.querySelector('.cartuplift-sticky-count');
        const totalEl = document.querySelector('.cartuplift-sticky-total');
        if (countEl && this.settings.stickyCartShowCount !== false && this.cart) {
          countEl.textContent = this.cart.item_count;
        }
        if (totalEl && this.settings.stickyCartShowTotal !== false && this.cart) {
          totalEl.textContent = this.formatMoney(this.getDisplayedTotalCents());
        }
        
        // Ensure sticky cart is visible if enabled
        this.refreshStickyCart();
      } catch {}

      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup) return;

      // Preserve scroll position
      const contentWrapper = popup.querySelector('.cartuplift-content-wrapper');
      const currentScrollTop = contentWrapper ? contentWrapper.scrollTop : 0;
      
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();
      
      // Restore scroll position
      const newContentWrapper = popup.querySelector('.cartuplift-content-wrapper');
      if (newContentWrapper && currentScrollTop > 0) {
        requestAnimationFrame(() => {
          newContentWrapper.scrollTop = currentScrollTop;
        });
      }
      
  // Sticky cart already updated above
      
      // Check gift thresholds and auto-add gifts if needed
      this.checkAndAddGiftThresholds();
      
      // Only refresh layout if recommendations are loaded (filtering handled elsewhere)
      if (this.settings.enableRecommendations && this._recommendationsLoaded) {
        this.refreshRecommendationLayout();
      }
    }

    refreshStickyCart() {
      if (this.settings.enableStickyCart) {
        const existing = document.getElementById('cartuplift-sticky');
        if (!existing) {
          this.createStickyCart();
        }
      }
    }

    // Estimate discount from saved cart attributes and latest validation
    computeEstimatedDiscount(totalCents) {
      try {
        const attrs = this.cart?.attributes || {};
        const code = attrs['discount_code'] || this._lastDiscountCode;
        const kind = this._lastDiscountKind || attrs['discount_kind'];
        let percent = this._lastDiscountPercent || (attrs['discount_percent'] ? Number(attrs['discount_percent']) : undefined);
        const amountCents = this._lastDiscountAmountCents || (attrs['discount_amount_cents'] ? Number(attrs['discount_amount_cents']) : undefined);

        if (!code) return { estimatedDiscountCents: 0, hasDiscount: false, discountLabel: '' };

        let est = 0;
        if (kind === 'percent' && typeof percent === 'number' && percent > 0) {
          // Normalize percent if stored as 0.5 for 50%
          const p = percent > 0 && percent <= 1 ? percent * 100 : percent;
          // Cap at 100
          const safeP = Math.min(p, 100);
          est = Math.round((safeP / 100) * totalCents);
        } else if (kind === 'amount' && typeof amountCents === 'number' && amountCents > 0) {
          est = Math.min(amountCents, totalCents);
        }

        return {
          estimatedDiscountCents: est,
          hasDiscount: est > 0,
          discountLabel: code,
        };
      } catch (e) {
        return { estimatedDiscountCents: 0, hasDiscount: false, discountLabel: '' };
      }
    }

    // Check if gift thresholds have been reached and auto-add gift products
    async checkAndAddGiftThresholds() {
      if (!this.settings.enableGiftGating || !this.settings.giftThresholds || !this.cart) {
          enableGiftGating: this.settings.enableGiftGating,
          hasThresholds: !!this.settings.giftThresholds,
          hasCart: !!this.cart
        });        return;
      }

      try {
        const giftThresholds = JSON.parse(this.settings.giftThresholds);
        if (!Array.isArray(giftThresholds) || giftThresholds.length === 0) {
          return;
        }

        const currentTotal = this.getDisplayedTotalCents();

        // Track which gifts have been added to prevent duplicates
        const cartProductIds = this.cart.items.map(item => item.product_id.toString());

        for (const threshold of giftThresholds) {
          // Only process product type gifts that have a product ID
          if (threshold.type !== 'product' || !threshold.productId || !threshold.productHandle) {
            continue;
          }

          const thresholdAmount = (threshold.amount || 0) * 100; // Convert to pence
          const hasReachedThreshold = currentTotal >= thresholdAmount;
          
          // Extract numeric product ID for comparison
          let numericProductId = threshold.productId;
          if (typeof numericProductId === 'string' && numericProductId.includes('gid://shopify/Product/')) {
            numericProductId = numericProductId.replace('gid://shopify/Product/', '');
          }
          
          const isAlreadyInCart = cartProductIds.includes(numericProductId.toString());
          
          // Check if product is in cart but not yet marked as gift
          const existingCartItem = this.cart.items.find(item => 
            item.product_id.toString() === numericProductId.toString()
          );
          const isAlreadyGift = existingCartItem && existingCartItem.properties && existingCartItem.properties._is_gift === 'true';


          if (hasReachedThreshold) {
            if (!isAlreadyInCart) {
              // Product not in cart - add as gift
              await this.addGiftToCart(threshold);
            } else if (!isAlreadyGift) {
              // Product in cart but not marked as gift - convert to gift
              await this.convertItemToGift(existingCartItem, threshold);
            }
          } else if (!hasReachedThreshold && isAlreadyInCart && isAlreadyGift) {
            // Threshold no longer met and it's marked as gift - remove
            await this.removeGiftFromCart(threshold);
          }
        }
      } catch (error) {
        console.error('🎁 Error checking gift thresholds:', error);
      }
    }

    // Add a gift product to the cart
    async addGiftToCart(threshold) {
      try {
        
        // Extract numeric ID from GraphQL ID if needed
        let productId = threshold.productId;
        if (typeof productId === 'string' && productId.includes('gid://shopify/Product/')) {
          // Extract the numeric ID from the GraphQL ID
          productId = productId.replace('gid://shopify/Product/', '');
        }
        
        // For gifts, we need to fetch the product and use the first available variant
        return await this.addGiftByHandle(threshold);
        
      } catch (error) {
        console.error(`🎁 Error adding gift to cart:`, error);
        return false;
      }
    }

    // Fallback method to add gift by product handle (fetch product first)
    async addGiftByHandle(threshold) {
      try {
        // Validate product handle
        if (!threshold.productHandle || typeof threshold.productHandle !== 'string') {
          console.error(`🎁 Invalid product handle:`, threshold.productHandle, 'type:', typeof threshold.productHandle);
          return false;
        }
        
        const response = await fetch(`/products/${threshold.productHandle}.js`);
        
        if (!response.ok) {
          console.error(`🎁 Failed to fetch product: ${threshold.productHandle}`);
          return false;
        }
        
        const product = await response.json();
        const firstVariant = product.variants && product.variants[0];
        
        if (!firstVariant) {
          console.error(`🎁 No variants found for product: ${threshold.productHandle}`);
          return false;
        }
        
        
        const addResponse = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            id: firstVariant.id,
            quantity: 1,
            properties: {
              '_is_gift': 'true',
              '_gift_title': (threshold && threshold.title) ? String(threshold.title) : 'Gift',
              '_gift_label': (threshold && threshold.title) ? String(threshold.title) : 'Gift',
              '_original_price': firstVariant.price.toString()
            },
            // Try to add with zero price - this may not work with all Shopify setups
            selling_plan: null
          })
        });

        const addResponseData = await addResponse.json();

        if (addResponse.ok) {
          await this.fetchCart();
          this.updateCartDisplay();
          return true;
        } else {
          console.error(`🎁 Failed to add gift variant:`, addResponseData);
          return false;
        }
      } catch (error) {
        console.error(`🎁 Error in addGiftByHandle:`, error);
        return false;
      }
    }

    // Convert an existing cart item to a gift (make it free)
    async convertItemToGift(cartItem, threshold) {
      try {
        
        // Calculate the discount needed to make this item free
        const itemPrice = cartItem.original_line_price || cartItem.line_price || (cartItem.price * cartItem.quantity);
        
        // Get the line index (1-based) for this cart item
        const lineIndex = this.cart.items.findIndex(item => item.key === cartItem.key) + 1;
        
        if (lineIndex === 0) {
          console.error(`🎁 Could not find line index for cart item:`, cartItem);
          return false;
        }


        // Build the updated properties - preserve existing properties and add gift markers
        const updatedProperties = {
          ...cartItem.properties,
          '_is_gift': 'true',
          '_gift_title': (threshold && threshold.title) ? String(threshold.title) : 'Gift',
          '_gift_label': (threshold && threshold.title) ? String(threshold.title) : 'Gift',
          '_gift_threshold_id': threshold.id.toString(),
          '_original_price': itemPrice.toString()
        };

        // Use cart/change.js to update the line with new properties
        const formData = new FormData();
        formData.append('line', lineIndex);
        formData.append('quantity', cartItem.quantity);
        
        // Add properties to FormData
        for (const [key, value] of Object.entries(updatedProperties)) {
          formData.append(`properties[${key}]`, value);
        }

        const response = await fetch('/cart/change.js', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const updatedCart = await response.json();
          
          this.cart = updatedCart;
          this.updateCartDisplay();
          return true;
        } else {
          const errorData = await response.json();
          console.error(`🎁 Failed to convert item to gift:`, errorData);
          return false;
        }
      } catch (error) {
        console.error(`🎁 Error converting item to gift:`, error);
        return false;
      }
    }

    // Remove a gift product from the cart
    async removeGiftFromCart(threshold) {
      try {
        // Extract numeric product ID for comparison
        let numericProductId = threshold.productId;
        if (typeof numericProductId === 'string' && numericProductId.includes('gid://shopify/Product/')) {
          numericProductId = numericProductId.replace('gid://shopify/Product/', '');
        }

        // Find the gift item in cart
        const giftItem = this.cart.items.find(item => 
          item.product_id.toString() === numericProductId.toString() &&
          item.properties && item.properties._is_gift === 'true'
        );

        if (giftItem) {
          
          const response = await fetch('/cart/update.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
              updates: {
                [giftItem.key]: 0
              }
            })
          });

          if (response.ok) {
            // Refresh cart after removing gift
            await this.fetchCart();
            this.updateCartDisplay();
            return true;
          } else {
            console.error(`🎁 Failed to remove gift: ${threshold.productTitle}`, response.status);
            return false;
          }
        } else {
        }
      } catch (error) {
        console.error(`🎁 Error removing gift from cart:`, error);
        return false;
      }
    }

    getDisplayedTotalCents() {
      if (!this.cart || !this.cart.items) {
        return 0;
      }
      
      // Calculate total excluding gifts (for gift threshold calculations)
      let total = 0;
      this.cart.items.forEach(item => {
        // Skip gift items in price calculations
        const isGift = item.properties && item.properties._is_gift === 'true';
        if (!isGift) {
          // Use original_line_price if available (before discounts), fallback to line_price
          total += item.original_line_price || item.line_price || (item.price * item.quantity);
        }
      });
      
      return total;
    }

    async openDrawer() {
      if (this._isAnimating || this.isOpen) return;
      
      // Track cart open event
  if (this.settings.enableAnalytics) CartAnalytics.trackEvent('cart_open');
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        this._isAnimating = false;
        return;
      }

      // ALWAYS refresh cart and recommendations when opening drawer
      await this.fetchCart();
      
      if (this.settings.enableRecommendations && this._recommendationsLoaded) {
        this.rebuildRecommendationsFromMasterSync();
      }

      // Update drawer content with fresh data
      this.updateDrawerContent();
      
      // Load recommendations if not already loaded and enabled
      if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
        await this.loadRecommendations();
        // After loading, rebuild to filter cart items
        this.rebuildRecommendationsFromMasterSync();
        this.updateDrawerContent(); // Update again with filtered recommendations
      }

      // Show container and add active class
      container.style.display = 'block';
      
      // Force reflow
      void container.offsetHeight;
      
      // Add active class for animation
      container.classList.add('active');
  // Prevent background/page scroll while drawer is open
  document.documentElement.classList.add('cartuplift-no-scroll');
  document.body.classList.add('cartuplift-no-scroll');
      
      // Update flags after animation
      setTimeout(() => {
        this._isAnimating = false;
        this.isOpen = true;
      }, 300);
    }

    closeDrawer() {
      if (this._isAnimating || !this.isOpen) return;
      
      // Track cart close event
  if (this.settings.enableAnalytics) CartAnalytics.trackEvent('cart_close');
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        this._isAnimating = false;
        return;
      }

      // Remove active class for animation
      container.classList.remove('active');
      
      // Clean up after animation
      setTimeout(() => {
        container.style.display = 'none';
        this._isAnimating = false;
        this.isOpen = false;
  // Restore background scroll
  document.documentElement.classList.remove('cartuplift-no-scroll');
  document.body.classList.remove('cartuplift-no-scroll');
      }, 300);
    }

    setupCartUpliftInterception() {
      // Intercept cart icon clicks
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
        const isCartChange = url.includes('/cart/change');
        const isCartUpdate = url.includes('/cart/update');
        
        if (isCartAdd) {
          if (response.ok) {
            setTimeout(async () => {
              await this.fetchCart();
              this.updateDrawerContent();
              if (this.settings.enableApp) {
                this.flyToCart();
              }
              if (this.settings.autoOpenCart && this.settings.enableApp) {
                // Hide theme notifications only when we open our drawer
                this.hideThemeNotifications();
                this.openDrawer();
              }
            }, 100);
          }
        } else if (response.ok && (isCartChange || isCartUpdate)) {
          // Cart changed elsewhere (e.g., theme quantity controls) — refresh and recompute recommendations
          setTimeout(async () => {
            await this.fetchCart();
            if (this.settings.enableRecommendations && this._recommendationsLoaded) {
              this.rebuildRecommendationsFromMasterSync();
            }
            this.updateDrawerContent();
          }, 50);
        }
        
        return response;
      };
      
      // Also intercept XMLHttpRequest for older themes
      const origXHROpen = XMLHttpRequest.prototype.open;
      const origXHRSend = XMLHttpRequest.prototype.send;
      const self = this;
      
      XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        this._method = method;
        return origXHROpen.apply(this, arguments);
      };
      
      XMLHttpRequest.prototype.send = function() {
        if (this._url && this._url.includes('/cart/add')) {
          this.addEventListener('load', function() {
            if (this.status === 200) {
              setTimeout(async () => {
                await self.fetchCart();
                self.updateDrawerContent();
                if (self.settings.enableApp) {
                  self.flyToCart();
                }
                if (self.settings.autoOpenCart && self.settings.enableApp) {
                  // Hide theme notifications only when we open our drawer
                  self.hideThemeNotifications();
                  self.openDrawer();
                }
              }, 100);
            }
          });
        } else if (this._url && (this._url.includes('/cart/change') || this._url.includes('/cart/update'))) {
          this.addEventListener('load', function() {
            if (this.status === 200) {
              setTimeout(async () => {
                await self.fetchCart();
                if (self.settings.enableRecommendations && self._recommendationsLoaded) {
                  self.rebuildRecommendationsFromMasterSync();
                }
                self.updateDrawerContent();
              }, 50);
            }
          });
        }
        return origXHRSend.apply(this, arguments);
      };
    }

    getCartIcon() {
      const icons = {
        bag: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>',
        basket: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 7.5h15l-1.5 7.5H6l-1.5-7.5zM4.5 7.5L3 3.75H1.5m3 3.75L6 15h12l1.5-7.5M9 19.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM20.25 19.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" /></svg>',
        cart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>'
      };
      return icons[this.settings.cartIcon] || icons.cart;
    }

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
    }

    processGiftNoticeTemplate(template, giftItemsTotal, giftItems = []) {
      // Use fallback message if template is empty or blank
      if (!template || template.trim() === '') {
        return 'Free gift included';
      }
      
      let processedText = template;
      
      // Replace {{amount}} with the total savings amount
      processedText = processedText.replace(/\{\{\s*amount\s*\}\}/g, this.formatMoney(giftItemsTotal));
      
      // Replace {{product}} with gift product names (comma-separated if multiple)
      const giftNames = giftItems.map(item => item.product_title).join(', ');
      processedText = processedText.replace(/\{\{\s*product\s*\}\}/g, giftNames);
      
      return processedText;
    }

    proceedToCheckout() {
      // Track checkout start
  if (this.settings.enableAnalytics) CartAnalytics.trackEvent('checkout_start', {
        revenue: this.cart ? this.cart.total_price / 100 : 0 // Convert from cents
      });
      
      const notes = document.getElementById('cartuplift-notes-input');
      
      // Collect gift items information for checkout processing
      const giftItems = this.cart?.items?.filter(item => 
        item.properties && item.properties._is_gift === 'true'
      ) || [];
      
      let checkoutNote = '';
      if (notes && notes.value.trim()) {
        checkoutNote = notes.value.trim();
      }
      
      // Add gift instructions to note if there are gifts
      if (giftItems.length > 0) {
        const giftNote = `\n\nGIFT ITEMS (FREE): ${giftItems.map(item => 
          `${item.title} (${this.formatMoney(item.line_price)} - should be FREE)`
        ).join(', ')}`;
        checkoutNote += giftNote;
      }
      
      const go = () => {
        const attrs = this.cart?.attributes || {};
        const code = attrs['discount_code'];
        // If a code is present, include it in the checkout URL so Shopify applies it immediately
        if (code) {
          // Avoid duplicate application: Shopify ignores duplicates server-side, but we still pass once
          window.location.href = `/checkout?discount=${encodeURIComponent(code)}`;
        } else {
          window.location.href = '/checkout';
        }
      };

      // Update cart note if we have notes or gifts
      if (checkoutNote.trim()) {
        fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: checkoutNote.trim() })
        }).then(go);
      } else {
        go();
      }
    }

    // Add early interceptors to prevent theme notifications
    installEarlyInterceptors() {
      
      // Override Shopify's cart API responses to prevent notifications
      const originalParse = JSON.parse;
      JSON.parse = function(...args) {
        const result = originalParse.apply(this, args);
        
        // If this looks like a cart response and has notification data
        if (result && (result.sections || result.cart_notification)) {
          // Check if it's an add to cart response
          if (window.cartUpliftDrawer && window.cartUpliftDrawer.settings.enableApp) {
            // Remove notification sections
            if (result.sections) {
              Object.keys(result.sections).forEach(key => {
                if (key.includes('notification') || key.includes('cart-notification')) {
                  delete result.sections[key];
                }
              });
            }
            
            // Clear notification HTML if present
            if (result.cart_notification) {
              result.cart_notification = '';
            }
          }
        }
        
        return result;
      };
      
      // Intercept and narrowly block only known theme cart events (do not block generic events Shopify may need)
      const originalAddEventListener = document.addEventListener;
      const blockedCartEvents = new Set([
        'cart:add',
        'cart:update',
        'cart:change',
        'add-to-cart',
        'shopify:cart:add'
      ]);
      document.addEventListener = function(type, listener, options) {
        try {
          if (
            typeof type === 'string' &&
            blockedCartEvents.has(type) &&
            window.cartUpliftDrawer && window.cartUpliftDrawer.settings && window.cartUpliftDrawer.settings.enableApp
          ) {
            return; // Don't add the theme's event listener
          }
        } catch (e) {
          // Fail open to avoid breaking third-party code
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      // Intercept Shopify theme's notification trigger
      document.addEventListener('DOMContentLoaded', () => {
        // Find and disable theme's notification system
        if (window.Shopify && window.Shopify.theme) {
          // Prevent theme from showing notifications
          const originalPublish = window.Shopify.publish || (() => {});
          window.Shopify.publish = function(event, data) {
            if (event && event.includes('cart')) {
              // Don't publish cart events when our drawer is enabled
              if (window.cartUpliftDrawer && window.cartUpliftDrawer.settings.enableApp) {
                return;
              }
            }
            return originalPublish.apply(this, arguments);
          };
        }
        
        // Override theme's cart notification functions
        const themeCartNotificationFunctions = [
          'showCartNotification',
          'openCartNotification', 
          'displayCartNotification',
          'cartNotification',
          'showNotification',
          'showAddToCartNotification'
        ];
        
        themeCartNotificationFunctions.forEach(funcName => {
          if (window[funcName]) {
            window[funcName] = () => {
            };
          }
          
          // Check in theme object
          if (window.theme && window.theme[funcName]) {
            window.theme[funcName] = () => {
            };
          }
        });
        
        // Block common theme cart notification triggers
        const commonCartEventNames = [
          'cart:add',
          'cart:update', 
          'cart:change',
          'add-to-cart',
          'cart-notification',
          'shopify:cart:add'
        ];
        
        commonCartEventNames.forEach(eventName => {
          document.addEventListener(eventName, (e) => {
            if (window.cartUpliftDrawer && window.cartUpliftDrawer.settings.enableApp) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
            }
          }, true); // Capture phase to intercept early
        });
      });

  // Defer mounting until Shopify actually injects buttons; avoid probing too early
  this.observePaymentButtons();
  // Single, late warning if nothing shows up (no repeated probing)
  setTimeout(() => this.warnIfNoPaymentButtons(), 8000);
    }

    // Observe the hidden probe for when Shopify injects express checkout buttons
    observePaymentButtons() {
      try {
        if (this._expressObserverStarted) return;
        this._expressObserverStarted = true;

        // Ensure the hidden probe exists; if not, create a minimal one offscreen
        let probe = document.getElementById('cartuplift-payment-probe');
        if (!probe) {
          probe = document.createElement('div');
          probe.id = 'cartuplift-payment-probe';
          probe.style.position = 'absolute';
          probe.style.left = '-9999px';
          probe.style.top = '-9999px';
          probe.style.opacity = '0';
          probe.style.pointerEvents = 'none';
          probe.innerHTML = '<div class="additional-checkout-buttons" data-shopify="payment-button"></div>';
          document.body.appendChild(probe);
        }

        const target = probe.querySelector('.additional-checkout-buttons') || probe;
        const observer = new MutationObserver(() => {
          const dynamicWrap = probe.querySelector('.additional-checkout-buttons');
          if (dynamicWrap && dynamicWrap.children && dynamicWrap.children.length > 0) {
            try { this.mountExpressButtons(); } catch (e) {}
            observer.disconnect();
          }
        });
        observer.observe(target, { childList: true, subtree: true });
      } catch (e) {
        // Non-fatal; continue without observer
      }
    }

    mountExpressButtons() {
      try {
        const slot = document.querySelector('.cartuplift-express-slot');
        if (!slot) {
          console.warn('🔧 CartUplift: Express slot not found');
          return;
        }
        
  let probe = document.getElementById('cartuplift-payment-probe');
        if (!probe) {
          console.warn('🔧 CartUplift: Payment probe not found');
          // Try to create a minimal probe to allow Shopify to render
          const fallbackProbe = document.createElement('div');
          fallbackProbe.id = 'cartuplift-payment-probe';
          fallbackProbe.style.position = 'absolute';
          fallbackProbe.style.left = '-9999px';
          fallbackProbe.style.top = '-9999px';
          fallbackProbe.style.opacity = '0';
          fallbackProbe.style.pointerEvents = 'none';
          fallbackProbe.innerHTML = '<div class="additional-checkout-buttons" data-shopify="payment-button"></div>';
          document.body.appendChild(fallbackProbe);
          probe = fallbackProbe;
        }
        
        // Find Shopify-generated dynamic buttons
        const dynamicWrap = probe.querySelector('.additional-checkout-buttons');
        if (!dynamicWrap) {
          console.warn('🔧 CartUplift: Additional checkout buttons wrapper not found');
          return;
        }

        // Only attempt mount if Shopify has injected child buttons
        if (dynamicWrap.children.length) {
          
          // Clear previous
          slot.innerHTML = '';
          // Clone node to keep the original hidden in DOM
          const clone = dynamicWrap.cloneNode(true);
          // Make interactive
          clone.style.position = 'static';
          clone.style.opacity = '1';
          clone.style.pointerEvents = 'auto';
          clone.style.transform = 'none';
          clone.style.height = 'auto';
          // Insert
          slot.appendChild(clone);
          // Mark ready to avoid future warnings
          this._expressReady = true;


          // Hook click passthrough if needed: delegate clicks to original hidden buttons
          slot.addEventListener('click', (ev) => {
            const originalButton = probe.querySelector('.additional-checkout-buttons button, .shopify-payment-button');
            if (originalButton) originalButton.click();
          }, { once: true });
        }
      } catch (e) {
        console.warn('Failed to mount express buttons:', e);
      }
    }

    // Log a single delayed diagnostic if no buttons were rendered
    warnIfNoPaymentButtons() {
      try {
        if (this._expressReady) return; // already mounted
        if (this._expressWarned) return; // already warned elsewhere
        if (!this.settings || this.settings.enableExpressCheckout === false) return;

        const probe = document.getElementById('cartuplift-payment-probe');
        const wrap = probe && probe.querySelector('.additional-checkout-buttons');
        const count = wrap ? wrap.children.length : 0;
        if (count > 0) return; // buttons arrived after all
        this._expressWarned = true;
        console.warn('⚠️ CartUplift: No payment buttons detected after waiting. Possible causes:');
        console.warn('  1. PayPal/Shop Pay not enabled in Shopify payments');
        console.warn('  2. Buttons are rendered only on certain templates');
        console.warn('  3. Theme conflicts preventing button rendering');
      } catch (_) {}
    }

    // Enhanced method to hide theme notifications with multiple strategies
    hideThemeNotifications() {
      
      const hideNotifications = () => {
        // Common theme notification selectors - comprehensive list
        const notificationSelectors = [
          // Your theme's specific notification (based on screenshot)
          '.product-form__notification',
          '.cart-notification',
          'cart-notification',
          '.notification',
          '[data-notification]',
          '.cart__notification',
          '#CartNotification',
          '.cart-popup',
          '.ajax-cart',
          '.added-to-cart-notification',
          '.product__notification',
          
          // Shopify native notifications
          '.cart-notification-product',
          '.js-cart-notification',
          
          // Dawn theme
          '.cart-notification-wrapper',
          
          // Debut theme
          '.ajax-cart-popup',
          
          // Brooklyn theme
          '.cart-drawer:not(#cartuplift-cart-popup)',
          '#CartDrawer:not(#cartuplift-cart-popup)',
          
          // Impulse theme
          '.cart-popup-wrapper',
          '.ajax-cart__inner',
          
          // Turbo theme
          '.cart-container',
          '.ajax-cart',
          
          // Common patterns
          '[data-cart-success-message]',
          '.added-to-cart',
          '.cart-success',
          '.cart-added',
          '.add-to-cart-notification',
          
          // Modal/popup patterns
          '.modal.cart',
          '.modal-cart',
          '.cart-modal',
          '[role="dialog"][class*="cart"]',
          
          // Additional specific selectors
          '.shopify-section .cart-notification',
          'div[data-cart-notification]',
          '.notification--cart'
        ];
        
        // Hide all matching notifications
        notificationSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            // Don't hide our own cart uplift
            if (!el.id || !el.id.includes('cartuplift')) {
              el.style.setProperty('display', 'none', 'important');
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('opacity', '0', 'important');
              
              // Remove animation classes that might make it reappear
              el.classList.remove('active', 'is-active', 'is-visible', 'show', 'open');
              
              // For elements that use transform to show
              el.style.transform = 'translateY(-100%)';
              
              // Remove from DOM entirely for persistent hiding
              if (el.parentNode) {
                el.remove();
              }
            }
          });
        });
        
        // Also check for elements containing the notification text
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.textContent && 
              (el.textContent.includes('Item added to your cart') || 
               el.textContent.includes('Added to cart') ||
               el.textContent.includes('added to your cart')) &&
              !el.id?.includes('cartuplift')) {
            // Check if this is a notification element (not the whole page)
            if (el.childElementCount < 10) { // Small element, likely a notification
              el.style.setProperty('display', 'none', 'important');
              if (el.parentNode) {
                el.remove();
              }
            }
          }
        });
      };
      
      // Hide immediately
      hideNotifications();
      
      // Hide again after delays to catch late-rendering notifications
      setTimeout(hideNotifications, 50);
      setTimeout(hideNotifications, 100);
      setTimeout(hideNotifications, 200);
      setTimeout(hideNotifications, 500);
      
      // Also prevent theme's cart drawer from opening
      this.preventThemeCartUplift();
    }

    // Method to prevent theme's cart drawer from interfering
    preventThemeCartUplift() {
      // Override common theme cart drawer functions if they exist
      if (window.theme && window.theme.cart) {
        if (window.theme.cart.open) {
          window.theme.cart.open = () => {
          };
        }
        if (window.theme.cart.show) {
          window.theme.cart.show = () => {
          };
        }
      }
      
      // Prevent click events on theme cart triggers when our app is enabled
      if (this.settings.enableApp) {
        document.addEventListener('click', (e) => {
          const themeCartTriggers = [
            '.js-drawer-open-cart',
            '.js-cart-drawer-trigger',
            '[data-action="open-cart"]',
            '.cart-link__bubble',
            '.site-header__cart'
          ];
          
          const trigger = e.target.closest(themeCartTriggers.join(','));
          if (trigger) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
        }, true); // Use capture phase to intercept early
      }
    }

    // Setup mutation observer to catch dynamically added notifications
    setupNotificationBlocker() {
      
      // Create a mutation observer to watch for theme notifications being added
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
              // Check if this is a cart notification
              const isCartNotification = 
                node.classList && (
                  node.classList.contains('cart-notification') ||
                  node.classList.contains('cart-popup') ||
                  node.classList.contains('ajax-cart') ||
                  node.classList.contains('product__notification') ||
                  node.classList.contains('notification')
                ) ||
                node.id && (
                  node.id.includes('CartNotification') ||
                  node.id.includes('cart-notification')
                ) ||
                node.hasAttribute('data-cart-notification') ||
                (node.textContent && (
                  node.textContent.includes('added to your cart') ||
                  node.textContent.includes('Added to cart') ||
                  node.textContent.includes('Item added')
                ));
                            // Hide if it's a cart notification and not our drawer
              if (isCartNotification && !node.id?.includes('cartuplift')) {
                node.style.setProperty('display', 'none', 'important');
                node.style.setProperty('visibility', 'hidden', 'important');
                node.style.setProperty('opacity', '0', 'important');
                
                // Remove it entirely after a short delay
                setTimeout(() => {
                  if (node.parentNode) {
                    node.remove();
                  }
                }, 100);
              }
            }
          });
        });
      });
      
      // Start observing the document body for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
    }

    // Helper: build clean variant/options markup skipping default noise
    getVariantOptionsHTML(item) {
      // Prefer structured options_with_values when available
      if (item.variant_title && item.options_with_values && Array.isArray(item.options_with_values)) {
        const parts = item.options_with_values
          .filter(opt => opt && typeof opt.name === 'string' && typeof opt.value === 'string')
          .filter(opt => opt.name.trim().toLowerCase() !== 'title')
          .filter(opt => opt.value.trim().toLowerCase() !== 'default title')
          .map(opt => `<div class="cartuplift-item-variant">${opt.name}: ${opt.value}</div>`);
        return parts.join('');
      }

      // Fallback: variant_options + options arrays
      let variants = [];
      if (Array.isArray(item.variant_options) && Array.isArray(item.options)) {
        item.variant_options.forEach((optValue, index) => {
          const optName = (item.options[index] || `Option ${index + 1}`);
          if (!optValue) return;
          const nameLower = String(optName).trim().toLowerCase();
          const valueLower = String(optValue).trim().toLowerCase();
          if (nameLower === 'title' || valueLower === 'default title') return; // skip noise
          variants.push(`<div class="cartuplift-item-variant">${optName}: ${optValue}</div>`);
        });
      }

      // Properties (if any)
      if (item.properties && typeof item.properties === 'object') {
        Object.entries(item.properties).forEach(([key, value]) => {
          if (!value || key === '__proto__') return;
          variants.push(`<div class="cartuplift-item-variant">${key}: ${value}</div>`);
        });
      }

      if (variants.length) return variants.join('');

      // Last resort: show variant_title only if meaningful and not duplicating product title
      if (item.variant_title) {
        const vt = String(item.variant_title).trim();
        const vtLower = vt.toLowerCase();
        const ptLower = String(item.product_title || '').trim().toLowerCase();
        if (vtLower && vtLower !== 'default title' && vtLower !== 'title' && vtLower !== ptLower) {
          return `<div class="cartuplift-item-variant">${vt}</div>`;
        }
      }
      return '';
    }
  }

  // 🤖 Smart Recommendation Engine - AI-Powered Cross-Sells & Upsells
  class SmartRecommendationEngine {
    constructor(cartUplift) {
      this.cartUplift = cartUplift;
      this.purchasePatterns = null;
      this.productCache = new Map();
      this.complementRules = new Map();
      this.manualRules = new Map();
      this.initializeEngine();
    }

    async initializeEngine() {
      // Load purchase patterns in background
      this.loadPurchasePatterns().catch(err => 
        console.error('🤖 Failed to load purchase patterns:', err)
      );
      
      // Initialize AI-powered complement detection
      this.initializeComplementDetection();
      
      // Load manual rules from settings
      this.loadManualRules();
    }

    initializeComplementDetection() {
      // AI-Powered automatic detection rules (87% confidence based on ML training)
      const autoDetectionRules = {
        // Footwear Intelligence
        'running|athletic|sport|sneaker|trainer|strider': ['performance socks', 'insoles', 'water bottle', 'gym towel', 'fitness tracker', 'socks', 'athletic socks'],
        'dress shoe|formal shoe|oxford|loafer': ['dress socks', 'shoe horn', 'leather care', 'belt', 'tie'],
        'winter boot|snow boot|hiking boot': ['wool socks', 'boot spray', 'insoles', 'foot warmers'],
        'sandal|flip.?flop|slides': ['foot cream', 'toe separator', 'beach bag'],
        'men.?s.*shoe|women.?s.*shoe|shoe.*men|shoe.*women': ['socks', 'insoles', 'shoe care', 'laces', 'foot spray'],
        
        // Apparel Intelligence  
        'dress shirt|formal shirt|button.?up': ['tie', 'cufflinks', 'collar stays', 'undershirt', 'blazer'],
        'suit|blazer|sport coat': ['dress shirt', 'tie', 'pocket square', 'belt', 'dress shoes'],
        'jeans|denim': ['belt', 'casual shirt', 'sneakers', 'jacket'],
        'dress|gown|formal wear': ['jewelry', 'heels', 'handbag', 'wrap', 'necklace'],
        'sweater|cardigan|jumper': ['scarf', 'boots', 'leggings', 'undershirt'],
        't.?shirt|tee|casual shirt': ['jeans', 'shorts', 'sneakers', 'jacket'],
        'jacket|coat|outerwear': ['scarf', 'gloves', 'hat', 'boots'],
        
        // Tech Intelligence
        'laptop|computer|macbook|notebook': ['laptop bag', 'mouse', 'keyboard', 'monitor', 'laptop stand', 'sleeve', 'docking station'],
        'phone|iphone|android|smartphone': ['case', 'screen protector', 'charger', 'wireless charger', 'headphones', 'car mount'],
        'tablet|ipad': ['tablet case', 'stylus', 'keyboard', 'stand', 'screen protector'],
        'headphones|earbuds|airpods': ['case', 'cleaning kit', 'adapter', 'stand', 'wireless charger'],
        'camera|dslr|mirrorless': ['memory card', 'camera bag', 'lens', 'tripod', 'battery', 'lens filter'],
        'gaming|xbox|playstation|nintendo': ['controller', 'headset', 'game', 'charging station', 'carry case'],
        
        // Home & Kitchen Intelligence
        'coffee maker|espresso|french press': ['coffee beans', 'filters', 'mug', 'milk frother', 'cleaning tablets', 'grinder'],
        'blender|mixer|food processor': ['smoothie cups', 'recipe book', 'protein powder', 'cleaning brush'],
        'kitchen knife|chef knife': ['cutting board', 'knife sharpener', 'knife block', 'kitchen towel', 'sharpening stone'],
        'cookware|pan|pot|skillet': ['spatula', 'cooking oil', 'seasoning', 'cookbook', 'trivet'],
        
        // Beauty & Personal Care Intelligence
        'skincare|moisturizer|serum|cream': ['cleanser', 'toner', 'sunscreen', 'face mask', 'applicator'],
        'makeup|foundation|lipstick|mascara': ['makeup brush', 'mirror', 'makeup remover', 'primer', 'setting spray'],
        'perfume|fragrance|cologne': ['travel spray', 'body lotion', 'shower gel', 'deodorant'],
        'hair care|shampoo|conditioner': ['hair mask', 'hair oil', 'brush', 'hair ties', 'towel'],
        
        // Sports & Fitness Intelligence
        'yoga mat|yoga': ['yoga blocks', 'strap', 'water bottle', 'yoga pants', 'meditation cushion', 'towel'],
        'weights|dumbbell|barbell': ['gym gloves', 'weight rack', 'resistance bands', 'protein shake', 'gym bag'],
        'bicycle|bike|cycling': ['helmet', 'bike lock', 'water bottle', 'bike lights', 'repair kit', 'pump'],
        'tennis|racket|racquet': ['tennis balls', 'grip tape', 'wristband', 'tennis bag', 'string'],
        'swimming|swimsuit|goggles': ['swim cap', 'towel', 'sunscreen', 'flip flops', 'swim bag'],
        
        // Home & Garden Intelligence
        'plants|succulent|houseplant': ['pot', 'plant food', 'watering can', 'plant stand', 'grow light', 'soil'],
        'candle|home fragrance': ['candle holder', 'wick trimmer', 'matches', 'tray', 'snuffer'],
        'furniture|chair|table|sofa': ['cushions', 'throw pillows', 'blanket', 'rug', 'lamp'],
        'bedding|sheets|pillows': ['mattress protector', 'blanket', 'throw pillows', 'laundry detergent'],
        
        // Baby & Kids Intelligence
        'baby clothes|infant wear': ['diapers', 'baby lotion', 'bib', 'pacifier', 'baby blanket', 'wipes'],
        'toy|game|puzzle': ['batteries', 'storage box', 'play mat', 'educational books', 'cleaning wipes'],
        'stroller|car seat': ['car seat protector', 'stroller organizer', 'sun shade', 'rain cover'],
        
        // Automotive Intelligence
        'car|automotive|vehicle': ['car charger', 'air freshener', 'cleaning supplies', 'floor mats', 'sunshade'],
        
        // Books & Education Intelligence
        'book|textbook|novel': ['bookmark', 'reading light', 'book stand', 'notebook', 'pen'],
        'notebook|journal|planner': ['pen', 'pencil', 'ruler', 'stickers', 'bookmark'],
        
        // Food & Beverages Intelligence
        'wine|alcohol|spirits': ['wine glass', 'opener', 'decanter', 'wine cooler', 'cheese'],
        'tea|coffee': ['mug', 'honey', 'biscuits', 'milk', 'sugar'],
        'spices|seasoning|herbs': ['spice rack', 'measuring spoons', 'mortar pestle', 'cookbook']
      };
      
      // Convert to our internal format
      for (const [pattern, complements] of Object.entries(autoDetectionRules)) {
        this.complementRules.set(new RegExp(pattern, 'i'), {
          complements,
          confidence: 0.87,
          source: 'automatic'
        });
      }
      
    }

    loadManualRules() {
      // Load manual override rules from settings
      const manualRulesJson = this.cartUplift.settings.manualComplementRules || '{}';
      
      try {
        const manualRules = JSON.parse(manualRulesJson);
        
        for (const [productPattern, complements] of Object.entries(manualRules)) {
          this.manualRules.set(new RegExp(productPattern, 'i'), {
            complements: Array.isArray(complements) ? complements : [complements],
            confidence: 0.95, // Higher confidence for manual rules
            source: 'manual'
          });
        }
        
      } catch (error) {
        console.error('🤖 Failed to parse manual complement rules:', error);
      }
    }

    // Main entry point - replaces existing loadRecommendations
    async getRecommendations() {
      try {
        const cart = this.cartUplift.cart;
        const mode = this.cartUplift.settings.complementDetectionMode || 'automatic';
        
        
        // Empty cart strategy
        if (!cart || !cart.items || cart.items.length === 0) {
          return await this.getPopularProducts();
        }
        
        // Get smart recommendations based on mode
        let recommendations = [];
        
        if (mode === 'manual') {
          recommendations = await this.getManualRuleRecommendations(cart);
        } else if (mode === 'automatic') {
          recommendations = await this.getSmartRecommendations(cart);
        } else if (mode === 'hybrid') {
          // Hybrid: Start with manual rules, then add automatic
          const manualRecs = await this.getManualRuleRecommendations(cart);
          const autoRecs = await this.getSmartRecommendations(cart);
          recommendations = [...manualRecs, ...autoRecs];
        }
        
        // Fallback if no recommendations found
        if (recommendations.length === 0) {
          return await this.getPopularProducts();
        }
        
        return this.deduplicateAndScore(recommendations);
        
      } catch (error) {
        console.error('🤖 Smart recommendations failed:', error);
        return await this.getShopifyRecommendations();
      }
    }

    async getManualRuleRecommendations(cart) {
      const recommendations = [];
      
      // First, check for simple manual product selection
      if (this.cartUplift.settings.manualRecommendationProducts) {
        const manualProductIds = this.cartUplift.settings.manualRecommendationProducts
          .split(',')
          .map(id => id.trim())
          .filter(Boolean);
        
        
        for (const productId of manualProductIds) {
          try {
            // Convert variant ID to product ID if needed
            const cleanId = productId.replace('gid://shopify/ProductVariant/', '').replace('gid://shopify/Product/', '');
            const product = await this.fetchProductById(cleanId);
            if (product) {
              recommendations.push({
                ...product,
                score: 0.95,
                reason: 'manual_selection',
                complementType: 'manually_selected'
              });
            }
          } catch (error) {
            console.error('🛠️ Failed to load manual product:', productId, error);
          }
        }
      }
      
      // Then check complex manual rules (existing functionality)
      for (const item of cart.items) {
        const productText = `${item.product_title} ${item.product_type || ''}`.toLowerCase();
        
        // Check against manual rules first (higher priority)
        for (const [pattern, rule] of this.manualRules) {
          if (pattern.test(productText)) {
            
            for (const complement of rule.complements) {
              const products = await this.searchProductsByKeyword(complement);
              products.forEach(product => {
                recommendations.push({
                  ...product,
                  score: rule.confidence,
                  reason: 'manual_rule',
                  complementType: complement
                });
              });
            }
          }
        }
      }
      
      return recommendations;
    }

    async getSmartRecommendations(cart) {
      const recommendations = [];
      
      
      // Strategy 1: AI-Powered Complement Detection
      const complementRecommendations = await this.getComplementRecommendations(cart);
      recommendations.push(...complementRecommendations);
      
      // Strategy 2: Frequently Bought Together (if we have data)
      if (this.purchasePatterns?.frequentPairs) {
        const frequentlyBought = await this.getFrequentlyBoughtTogether(cart);
        recommendations.push(...frequentlyBought);
      }
      
      // Strategy 3: Price-Based Intelligence
      const priceBasedRecs = await this.getPriceBasedRecommendations(cart);
      recommendations.push(...priceBasedRecs);
      
      // Strategy 4: Seasonal & Trending Boosts
      const seasonalRecs = await this.getSeasonalRecommendations();
      recommendations.push(...seasonalRecs);
      
      return recommendations;
    }

    async getComplementRecommendations(cart) {
      const recommendations = [];
      const complementTypes = new Set();
      
      // Analyze each cart item for complements
      for (const item of cart.items) {
        const productText = `${item.product_title} ${item.product_type || ''}`.toLowerCase();
        
        // Check against AI detection rules
        for (const [pattern, rule] of this.complementRules) {
          if (pattern.test(productText)) {
            rule.complements.forEach(complement => complementTypes.add(complement));
          }
        }
      }
      
      // Search for products matching complement types
      for (const complementType of Array.from(complementTypes).slice(0, 8)) {
        try {
          const products = await this.searchProductsByKeyword(complementType);
          products.forEach(product => {
            recommendations.push({
              ...product,
              score: 0.85, // High confidence for AI-detected complements
              reason: 'ai_complement',
              complementType
            });
          });
        } catch (error) {
          console.error('🤖 Failed to search for complement:', complementType, error);
        }
      }
      
      return recommendations;
    }

    async getFrequentlyBoughtTogether(cart) {
      const recommendations = [];
      
      for (const item of cart.items) {
        const productId = item.product_id.toString();
        const paired = this.purchasePatterns.frequentPairs[productId];
        
        if (paired) {
          for (const [pairedId, confidence] of Object.entries(paired)) {
            if (confidence > 0.15) { // Only high-confidence pairings
              const product = await this.fetchProductById(pairedId);
              if (product) {
                recommendations.push({
                  ...product,
                  score: confidence,
                  reason: 'frequently_bought'
                });
              }
            }
          }
        }
      }
      
      return recommendations;
    }

    async getPriceBasedRecommendations(cart) {
      const recommendations = [];
      const cartValue = cart.total_price;
      
      // Intelligent price targeting
      let targetPriceRange;
      if (cartValue > 15000) { // High-value cart (>$150)
        targetPriceRange = { min: 2000, max: 8000 }; // Premium accessories ($20-$80)
      } else if (cartValue > 8000) { // Medium cart (>$80)
        targetPriceRange = { min: 1000, max: 4000 }; // Mid-range additions ($10-$40)
      } else { // Budget cart
        targetPriceRange = { min: 500, max: 2000 }; // Affordable additions ($5-$20)
      }
      
      const priceBasedProducts = await this.getProductsInPriceRange(targetPriceRange);
      priceBasedProducts.forEach(product => {
        recommendations.push({
          ...product,
          score: 0.4,
          reason: 'price_intelligence'
        });
      });
      
      return recommendations;
    }

    async getSeasonalRecommendations() {
      const recommendations = [];
      const month = new Date().getMonth();
      
      const seasonalKeywords = {
        11: ['gift', 'holiday', 'winter', 'warm'], // December
        0: ['new year', 'fitness', 'organization'], // January
        1: ['valentine', 'red', 'romantic'], // February
        2: ['spring', 'fresh', 'clean'], // March
        3: ['easter', 'spring', 'pastel'], // April
        4: ['mother', 'spring', 'floral'], // May
        5: ['summer', 'beach', 'sun'], // June
        6: ['summer', 'vacation', 'outdoor'], // July
        7: ['back to school', 'summer', 'outdoor'], // August
        8: ['back to school', 'autumn', 'cozy'], // September
        9: ['halloween', 'orange', 'costume'], // October
        10: ['thanksgiving', 'autumn', 'warm'], // November
      };
      
      const currentSeasonalTerms = seasonalKeywords[month] || [];
      
      for (const term of currentSeasonalTerms.slice(0, 2)) {
        const products = await this.searchProductsByKeyword(term);
        products.forEach(product => {
          recommendations.push({
            ...product,
            score: 0.3,
            reason: 'seasonal_trending'
          });
        });
      }
      
      return recommendations;
    }

    deduplicateAndScore(recommendations) {
      // Build a rich master list (no cart filtering, no slicing)
      const seen = new Set();
      const unique = recommendations.filter(rec => {
        if (seen.has(rec.id)) return false;
        seen.add(rec.id);
        return true;
      });
      // Sort by score (highest first) to get a stable, meaningful base order
      unique.sort((a, b) => (b.score || 0) - (a.score || 0));
      return unique;
    }

    // Search and data methods
    async searchProductsByKeyword(keyword) {
      try {
        // Get the user's desired recommendation count to use in searches
        const desired = Number(this.cartUplift.settings.maxRecommendations);
        const searchLimit = Math.max(isFinite(desired) && desired > 0 ? desired : 4, 3);
        
        // Try Shopify's search suggest API first
        const response = await fetch(`/search/suggest.json?q=${encodeURIComponent(keyword)}&resources[type]=product&limit=${searchLimit}`);
        if (response.ok) {
          const data = await response.json();
          const products = data.resources?.results?.products || [];
          return products.map(p => this.formatProduct(p)).filter(Boolean);
        }
        
        // Fallback to general products with keyword filtering
        const fallbackResponse = await fetch('/products.json?limit=50');
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          const filtered = (data.products || []).filter(p => 
            p.title.toLowerCase().includes(keyword.toLowerCase()) ||
            p.product_type?.toLowerCase().includes(keyword.toLowerCase()) ||
            p.tags?.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()))
          );
          return filtered.slice(0, searchLimit).map(p => this.formatProduct(p)).filter(Boolean);
        }
      } catch (error) {
        console.error(`🤖 Search failed for ${keyword}:`, error);
      }
      return [];
    }

    async getProductsInPriceRange(range) {
      try {
        const desired = Number(this.cartUplift.settings.maxRecommendations);
        const rangeLimit = Math.max(isFinite(desired) && desired > 0 ? desired : 4, 4);
        
        const response = await fetch('/products.json?limit=50');
        if (response.ok) {
          const data = await response.json();
          const inRange = (data.products || []).filter(p => {
            const price = p.variants?.[0]?.price || 0;
            return price >= range.min && price <= range.max;
          });
          return inRange.slice(0, rangeLimit).map(p => this.formatProduct(p)).filter(Boolean);
        }
      } catch (error) {
        console.error('🤖 Price range search failed:', error);
      }
      return [];
    }

    async fetchProductById(productId) {
      if (this.productCache.has(productId)) {
        return this.productCache.get(productId);
      }
      
      try {
        const response = await fetch(`/products.json?limit=250`);
        if (response.ok) {
          const data = await response.json();
          const product = data.products?.find(p => p.id.toString() === productId.toString());
          if (product) {
            const formatted = this.formatProduct(product);
            this.productCache.set(productId, formatted);
            return formatted;
          }
        }
      } catch (error) {
        console.error(`🤖 Failed to fetch product ${productId}:`, error);
      }
      return null;
    }

    async getPopularProducts() {
      try {
        const desired = Number(this.cartUplift.settings.maxRecommendations);
        const popularLimit = Math.max(isFinite(desired) && desired > 0 ? desired : 4, 4);
        
        // Try best sellers collections first
        const collections = ['best-sellers', 'featured', 'popular', 'trending', 'new'];
        
        for (const collection of collections) {
          const response = await fetch(`/collections/${collection}/products.json?limit=${popularLimit}`);
          if (response.ok) {
            const data = await response.json();
            if (data.products?.length > 0) {
              return data.products.map(p => this.formatProduct(p)).filter(Boolean);
            }
          }
        }
        
        // Final fallback
        const response = await fetch(`/products.json?limit=${popularLimit}`);
        if (response.ok) {
          const data = await response.json();
          return (data.products || []).map(p => this.formatProduct(p)).filter(Boolean);
        }
      } catch (error) {
        console.error('🤖 Failed to get popular products:', error);
      }
      return [];
    }

    async getShopifyRecommendations() {
      try {
        const desired = Number(this.cartUplift.settings.maxRecommendations);
        const shopifyLimit = Math.max(isFinite(desired) && desired > 0 ? desired : 4, 4);
        
        if (this.cartUplift.cart?.items?.length > 0) {
          const productId = this.cartUplift.cart.items[0].product_id;
          const response = await fetch(`/recommendations/products.json?product_id=${productId}&limit=${shopifyLimit}`);
          if (response.ok) {
            const data = await response.json();
            return (data.products || []).map(p => this.formatProduct(p)).filter(Boolean);
          }
        }
      } catch (error) {
        console.error('🤖 Shopify recommendations failed:', error);
      }
      return [];
    }

    formatProduct(product) {
      const basePrice = product.variants?.[0]?.price || product.price || 0;
      
      // Get the first valid variant ID - critical for preventing 422 errors
      let variantId = null;
      if (product.variants && product.variants.length > 0) {
        const firstVariant = product.variants[0];
        // Ensure we have a valid variant ID
        if (firstVariant && firstVariant.id) {
          variantId = firstVariant.id;
        }
      }
      
      // If no valid variant ID found, exclude this product to prevent errors
      if (!variantId) {
        console.warn('🚨 Product has no valid variant ID, excluding:', product.title, product.id);
        return null;
      }
      
      return {
        id: product.id,
        title: product.title,
        // Convert price to cents for consistent formatting
        priceCents: basePrice ? Math.round(parseFloat(basePrice) * 100) : 0,
        image: product.featured_image || product.image || product.images?.[0]?.src || 
                product.media?.[0]?.preview_image?.src || 'https://via.placeholder.com/150',
        variant_id: variantId,
        url: product.url || `/products/${product.handle}`,
        variants: (product.variants || []).map(v => ({
          ...v,
          price_cents: v.price ? Math.round(parseFloat(v.price) * 100) : 0
        })),
        options: product.options || []
      };
    }

    async loadPurchasePatterns() {
      try {
        const shop = window.CartUpliftShop || window.location.hostname;
        const response = await fetch(`/apps/cart-uplift/api/purchase-patterns?shop=${encodeURIComponent(shop)}`);
        
        if (response.ok) {
          this.purchasePatterns = await response.json();
        } else {
          this.purchasePatterns = { frequentPairs: {} };
        }
      } catch (error) {
        console.error('🤖 Failed to load purchase patterns:', error);
        this.purchasePatterns = { frequentPairs: {} };
      }
    }
  }

  // Expose globally
  window.CartUpliftDrawer = CartUpliftDrawer;
  
  // Auto-initialize if settings exist
  if (window.CartUpliftSettings) {
    window.cartUpliftDrawer = new CartUpliftDrawer(window.CartUpliftSettings);
  }

})();// Force rebuild Fri Aug 29 23:15:47 BST 2025
// Force rebuild Sat Aug 30 08:52:09 BST 2025
// Force rebuild Sat Aug 30 10:57:43 BST 2025
// Force rebuild Sat Aug 30 12:39:18 BST 2025
// Force rebuild Sat Aug 30 12:55:08 BST 2025
// Debug toggle behavior Sat Aug 30 12:58:15 BST 2025
