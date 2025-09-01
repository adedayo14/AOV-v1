(function() {
  'use strict';
  
  // Version marker (increment when deploying to verify fresh assets)
  const CART_UPLIFT_VERSION = 'v175';
  console.log('🛒 Cart Uplift script loaded', CART_UPLIFT_VERSION);

  // Safe analytics shim (no-op if not provided by host)
  const CartAnalytics = (window.CartAnalytics && typeof window.CartAnalytics.trackEvent === 'function')
    ? window.CartAnalytics
    : { trackEvent: () => {} };

  // Main drawer controller
  class CartUpliftDrawer {
    constructor(settings) {
      // Merge defaults with provided settings and any globals
      this.settings = Object.assign({}, window.CartUpliftSettings || {}, settings || {});
      
      // Normalize layout setting if present
      if (this.settings && this.settings.recommendationLayout) {
        const map = { horizontal: 'row', vertical: 'column', grid: 'row' };
        this.settings.recommendationLayout = map[this.settings.recommendationLayout] || this.settings.recommendationLayout;
      }
      
      // Ensure boolean settings are properly set
      this.settings.enableStickyCart = Boolean(this.settings.enableStickyCart);
      this.settings.enableFreeShipping = Boolean(this.settings.enableFreeShipping);
      this.settings.enableApp = this.settings.enableApp !== false;
      this.settings.enableRecommendations = this.settings.enableRecommendations !== false; // DEFAULT TO TRUE
      this.settings.enableAddons = Boolean(this.settings.enableAddons);
      this.settings.enableNotes = Boolean(this.settings.enableNotes);
      this.settings.enableDiscountCode = this.settings.enableDiscountCode !== false; // DEFAULT TO TRUE
      this.settings.enableExpressCheckout = this.settings.enableExpressCheckout !== false; // DEFAULT TO TRUE
      this.settings.autoOpenCart = this.settings.autoOpenCart !== false;
      
      console.log('🔧 CartUplift: Express checkout setting:', this.settings.enableExpressCheckout);
      console.log('🔧 CartUplift: Discount code setting:', this.settings.enableDiscountCode);
      
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
        console.log('🛒 Settings update received:', event);
        
        // Deep merge the settings
        this.settings = Object.assign({}, this.settings, window.CartUpliftSettings || {});
        
        // Normalize layout again after update
        if (this.settings.recommendationLayout) {
          const map = { horizontal: 'row', vertical: 'column', grid: 'row' };
          this.settings.recommendationLayout = map[this.settings.recommendationLayout] || this.settings.recommendationLayout;
        }
        
        console.log('🛒 Updated settings:', this.settings);
        
        // If recommendations were just enabled and not loaded yet
        if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
          console.log('🛒 Loading recommendations after settings update...');
          await this.loadRecommendations();
          this._recommendationsLoaded = true;
        } else if (this._allRecommendations.length) {
          // Re-filter recommendations from master list
          this.rebuildRecommendationsFromMaster();
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
      console.log('🛒 Initializing Cart Uplift...');
      
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      await this.setup();
    }

    async setup() {
      console.log('🛒 Setting up Cart Uplift...');
      
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
          console.log('🛒 Loading recommendations (delayed check)...');
          await this.loadRecommendations();
          this._recommendationsLoaded = true;
          this.updateDrawerContent();
        }
      }, 500);
      
      console.log('🛒 Cart Uplift setup complete.');

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
        console.log('🔄 Soft refresh triggered...');
        await this.fetchCart();
        if (this._recommendationsLoaded) {
          this.rebuildRecommendationsFromMaster();
        }
        this.updateDrawerContent();
        console.log('🔄 Soft refresh complete');
      };
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
            console.log('🔄 Settings refreshed from API:', newSettings);
          }
        }
      } catch (error) {
        console.log('🔄 Could not refresh settings from API:', error);
      }
    }

    applyCustomColors() {
      if (this.settings.buttonColor) {
        const style = document.getElementById('cartuplift-dynamic-styles') || document.createElement('style');
        style.id = 'cartuplift-dynamic-styles';
        style.textContent = `
          :root {
            --cartuplift-button-color: ${this.settings.buttonColor} !important;
          }
          .cartuplift-shipping-progress-fill {
            background: ${this.settings.buttonColor} !important;
          }
          .cartuplift-checkout-btn,
          .cartuplift-discount-apply,
          .cartuplift-add-recommendation {
            background: ${this.settings.buttonColor} !important;
          }
          .cartuplift-add-recommendation-circle {
            border-color: ${this.settings.buttonColor} !important;
            color: ${this.settings.buttonColor} !important;
          }
          .cartuplift-add-recommendation-circle:hover {
            background: ${this.settings.buttonColor} !important;
            color: white !important;
          }
          
          /* Force shipping bar color override */
          .cartuplift-shipping-progress-fill {
            background: ${this.settings.shippingBarColor || '#121212'} !important;
          }
          
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
        `;
        if (!document.getElementById('cartuplift-dynamic-styles')) {
          document.head.appendChild(style);
        }
      }
    }

    createStickyCart() {
      if (!this.settings.enableStickyCart) return;
      
      const existing = document.getElementById('cartuplift-sticky');
      if (existing) existing.remove();

      const stickyCart = document.createElement('div');
      stickyCart.id = 'cartuplift-sticky';
      stickyCart.className = `cartuplift-sticky ${this.settings.cartPosition || 'bottom-right'}`;
      stickyCart.innerHTML = `
        <button class="cartuplift-sticky-btn" aria-label="Open cart">
          ${this.getCartIcon()}
          <span class="cartuplift-sticky-count">${this.cart?.item_count || 0}</span>
          <span class="cartuplift-sticky-total">${this.formatMoney(this.getDisplayedTotalCents())}</span>
        </button>
      `;
      
      document.body.appendChild(stickyCart);
      
      stickyCart.querySelector('.cartuplift-sticky-btn').addEventListener('click', () => {
        this.openDrawer();
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
      
      const popup = container.querySelector('#cartuplift-cart-popup');
      if (popup) {
        popup.innerHTML = this.getDrawerHTML();
      }
      
      this.attachDrawerEvents();
    }

    getDrawerHTML() {
      const itemCount = this.cart?.item_count || 0;
  const itemsSubtotal = this.cart?.items_subtotal_price || this.cart?.total_price || 0;
  const { estimatedDiscountCents, hasDiscount, discountLabel } = this.computeEstimatedDiscount(itemsSubtotal);
  const estimatedSubtotal = Math.max(0, itemsSubtotal - estimatedDiscountCents);
      
      // Check if we should show recommendations - only show if:
      // 1. Recommendations are enabled
      // 2. Either we're still loading OR we have actual recommendations to show
      const shouldShowRecommendations = this.settings.enableRecommendations && 
        ((!this._recommendationsLoaded) || (this.recommendations && this.recommendations.length > 0));
      
      console.log('🛒 shouldShowRecommendations:', shouldShowRecommendations, 
        'enableRecommendations:', this.settings.enableRecommendations,
        'loaded:', this._recommendationsLoaded, 
        'count:', this.recommendations?.length || 0,
        'window width:', window.innerWidth);
      
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
                console.log('🔧 CartUplift: Rendering discount section, enableDiscountCode:', this.settings.enableDiscountCode, 'enableNotes:', this.settings.enableNotes);
                return this.settings.enableDiscountCode || this.settings.enableNotes ? this.getDiscountHTML() : '';
              })()}
            </div>
          </div>
          
          <div class="cartuplift-footer">
            ${hasDiscount ? `
            <div class="cartuplift-subtotal" style="margin-bottom:8px;">
              <span>Discount${discountLabel ? ` (${discountLabel})` : ''}</span>
              <span class="cartuplift-subtotal-amount">- ${this.formatMoney(estimatedDiscountCents)}</span>
            </div>
            ` : ''}
            <div class="cartuplift-subtotal">
              <span>${hasDiscount ? 'Subtotal (after discount)' : 'Subtotal'}</span>
              <span class="cartuplift-subtotal-amount">${this.formatMoney(hasDiscount ? estimatedSubtotal : itemsSubtotal)}</span>
            </div>
            
            <button class="cartuplift-checkout-btn" onclick="window.cartUpliftDrawer.proceedToCheckout()">
              CHECKOUT
            </button>
            
            ${(() => {
              console.log('🔧 CartUplift: Rendering footer, enableExpressCheckout:', this.settings.enableExpressCheckout);
              return this.settings.enableExpressCheckout ? this.getExpressCheckoutHTML() : '';
            })()}
          </div>
        </div>
      `;
    }

    getHeaderHTML(itemCount) {
      let threshold = this.settings.freeShippingThreshold || 100;
  const currentTotal = this.cart ? (this.cart.items_subtotal_price ?? this.cart.total_price) : 0;

      // Shopify prices are always in the smallest currency unit (pence for GBP, cents for USD)
      // So if threshold is 100, it means £100 = 10000 pence
      // But let's make sure the threshold is properly converted to match the currency
      const thresholdInSmallestUnit = threshold * 100; // Convert £100 to 10000 pence

      const remaining = Math.max(0, thresholdInSmallestUnit - currentTotal);
      const progress = Math.min((currentTotal / thresholdInSmallestUnit) * 100, 100);
      
      // Debug logging
      console.log('🛒 Free Shipping Debug:', {
        thresholdInSmallestUnit: thresholdInSmallestUnit,
        currentTotal: currentTotal,
        remaining: remaining,
        progress: progress,
        rawThreshold: this.settings.freeShippingThreshold,
        cartExists: !!this.cart,
        itemCount: itemCount,
        buttonColor: this.settings.buttonColor,
        settings: {
          freeShippingText: this.settings.freeShippingText,
          freeShippingAchievedText: this.settings.freeShippingAchievedText,
          enableFreeShipping: this.settings.enableFreeShipping
        }
      });
      
      let freeShippingText = '';
      if (this.settings.enableFreeShipping) {
        // If cart is not loaded yet or is empty, show full threshold needed
        if (!this.cart || currentTotal === 0) {
          freeShippingText = (this.settings.freeShippingText || "Spend {{ amount }} more for free shipping!")
            .replace(/\{\{\s*amount\s*\}\}/g, this.formatMoney(thresholdInSmallestUnit))
            .replace(/{amount}/g, this.formatMoney(thresholdInSmallestUnit));
          console.log('🛒 Free Shipping: Empty cart, showing threshold needed');
        } else if (remaining > 0) {
          freeShippingText = (this.settings.freeShippingText || "Spend {{ amount }} more for free shipping!")
            .replace(/\{\{\s*amount\s*\}\}/g, this.formatMoney(remaining))
            .replace(/{amount}/g, this.formatMoney(remaining));
          console.log('🛒 Free Shipping: Showing remaining amount needed:', this.formatMoney(remaining));
        } else {
          freeShippingText = this.settings.freeShippingAchievedText || "🎉 Free shipping unlocked!";
          console.log('🛒 Free Shipping: Goal achieved!');
        }
      }
      
      return `
        <div class="cartuplift-header">
          <h2 class="cartuplift-cart-title">Cart (${itemCount})</h2>
          ${this.settings.enableFreeShipping ? `
            <div class="cartuplift-shipping-info">
              <p class="cartuplift-shipping-message">${freeShippingText}</p>
            </div>
          ` : ''}
          <button class="cartuplift-close" aria-label="Close cart">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        ${this.settings.enableFreeShipping ? `
          <div class="cartuplift-shipping-info-mobile">
            <p class="cartuplift-shipping-message">${freeShippingText}</p>
          </div>
        ` : ''}
        ${this.settings.enableFreeShipping ? (() => {
          console.log('🛒 Progress Bar Debug:', {
            progress: progress,
            buttonColor: this.settings.buttonColor,
            progressBarHTML: `width: ${progress}%; background: ${this.settings.buttonColor || '#4CAF50'} !important;`
          });
          return `
          <div class="cartuplift-shipping-bar">
            <div class="cartuplift-shipping-progress">
              <div class="cartuplift-shipping-progress-fill" style="width: ${progress}%; background: ${this.settings.buttonColor || '#4CAF50'} !important; display: block;"></div>
            </div>
          </div>`;
        })() : ''}
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
      
      return this.cart.items.map((item, index) => `
        <div class="cartuplift-item" data-variant-id="${item.variant_id}" data-line="${index + 1}">
          <div class="cartuplift-item-image">
            <img src="${item.image}" alt="${item.product_title}" loading="lazy">
          </div>
          <div class="cartuplift-item-info">
            <h4 class="cartuplift-item-title">
              <a href="${item.url}" style="text-transform: none;">${item.product_title}</a>
            </h4>
            ${this.getVariantOptionsHTML(item)}
            <div class="cartuplift-item-quantity-wrapper">
              <div class="cartuplift-quantity">
                <button class="cartuplift-qty-minus" data-line="${index + 1}">−</button>
                <span class="cartuplift-qty-display">${item.quantity}</span>
                <button class="cartuplift-qty-plus" data-line="${index + 1}">+</button>
              </div>
            </div>
          </div>
          <div class="cartuplift-item-price-actions">
            <div class="cartuplift-item-price">${this.formatMoney(item.final_price)}</div>
            <button class="cartuplift-item-remove-x" data-line="${index + 1}" aria-label="Remove item">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M9 6V4h6v2m-9 0 1 14h10l1-14H6z"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');
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
      console.log('🛒 Recommendations HTML rendered (should start EXPANDED):', html.includes('collapsed'));
      return html;
    }

    /** Update recommendations title & layout after settings injected later (e.g. upsell embed loads after main) */
    updateRecommendationsSection() {
      const section = document.querySelector('.cartuplift-recommendations');
      if (!section) {
        // If section doesn't exist but should, recreate the entire drawer
        if (this.settings.enableRecommendations && this._recommendationsLoaded && this.recommendations.length > 0) {
          console.log('🛒 Recommendations section missing, recreating drawer...');
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
        console.log('🔍 DEBUG: Cart product IDs:', cartProductIds, 'types:', cartProductIds.map(id => typeof id));
        console.log('🔍 DEBUG: Recommendation IDs:', this._allRecommendations.map(p => ({ id: p.id, title: p.title, type: typeof p.id })));
        
        // Build visible list by skipping any product in cart and taking next from master, preserving order
        const desired = Number(this.settings.maxRecommendations);
        const max = isFinite(desired) && desired > 0 ? desired : 4;
        const newRecommendations = [];
        for (const p of this._allRecommendations) {
          // Check both strict and loose equality for ID comparison
          const isInCartStrict = cartProductIds.includes(p.id);
          const isInCartLoose = cartProductIds.some(cartId => cartId == p.id);
          console.log(`🔍 DEBUG: ${p.title} (id: ${p.id}, type: ${typeof p.id}) - strict match: ${isInCartStrict}, loose match: ${isInCartLoose}`);
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
      console.log('🔍 SYNC DEBUG: Cart product IDs:', cartProductIds, 'types:', cartProductIds.map(id => typeof id));
      
      // Build visible list by skipping any product in cart and taking next from master, preserving order
      const desired = Number(this.settings.maxRecommendations);
      const max = isFinite(desired) && desired > 0 ? desired : 4;
      const newRecommendations = [];
      for (const p of this._allRecommendations) {
        // Check both strict and loose equality for ID comparison
        const isInCartStrict = cartProductIds.includes(p.id);
        const isInCartLoose = cartProductIds.some(cartId => cartId == p.id);
        console.log(`🔍 SYNC DEBUG: ${p.title} (id: ${p.id}, type: ${typeof p.id}) - strict match: ${isInCartStrict}, loose match: ${isInCartLoose}`);
        if (isInCartStrict || isInCartLoose) continue;
        newRecommendations.push(p);
        if (newRecommendations.length >= max) break;
      }
      
      // Only update if recommendations actually changed
      const currentIds = (this.recommendations || []).map(r => r.id).sort();
      const newIds = newRecommendations.map(r => r.id).sort();
      
      if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
        this.recommendations = newRecommendations;
        console.log('🔍 SYNC DEBUG: Updated recommendations to:', newRecommendations.map(r => r.title));
      } else {
        console.log('🔍 SYNC DEBUG: No changes needed in recommendations');
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
                    <img src="${product.image}" alt="${product.title}" loading="lazy">
                  </div>
                  <div class="cartuplift-product-info">
                    <h4><a href="${product.url || '#'}" class="cartuplift-product-link">${product.title}</a></h4>
                    ${this.generateVariantSelector(product)}
                  </div>
                  <div class="cartuplift-product-actions">
                    <div class="cartuplift-recommendation-price">${this.formatMoney(product.priceCents || 0)}</div>
                    <button class="cartuplift-add-recommendation" data-product-id="${product.id}" data-variant-id="${product.variant_id}">
                      Add+
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
            <img src="${product.image}" alt="${product.title}" loading="lazy">
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
      
      console.log('🛒 Scroll setup:', { isMobile, scrollAmount: this.scrollAmount });
      
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
      
      console.log('🛒 Scroll prev:', { currentScroll, targetScroll, scrollAmount: this.scrollAmount });
      
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
      
      console.log('🛒 Scroll next:', { currentScroll, targetScroll, maxScroll, scrollAmount: this.scrollAmount });
      
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
                        onclick="window.cartUpliftDrawer.applyModalDiscount()">Apply</button>
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
      console.log('🛒 Modal opened with settings:', {
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
      console.log('Applying discount code:', discountCode);
      
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
          console.log('Cart attributes saved:', cartAttributes);
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
          CartAnalytics.trackEvent('product_click', {
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
          CartAnalytics.trackEvent('product_click', {
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
          
          console.log('🛒 Toggle button clicked!', e.target);
          
          // Robustly find the toggle button and recommendations section
          const toggleButton = e.target.classList.contains('cartuplift-recommendations-toggle')
            ? e.target
            : e.target.closest('.cartuplift-recommendations-toggle');
            
          console.log('🛒 Toggle button found:', toggleButton);
          
          // Find the recommendations section relative to the toggle button
          let recommendations = toggleButton.closest('.cartuplift-recommendations');
          if (!recommendations) {
            recommendations = container.querySelector('.cartuplift-recommendations');
          }
          
          console.log('🛒 Recommendations section found:', recommendations);
          
          if (recommendations) {
            const isCollapsed = recommendations.classList.contains('collapsed');
            console.log('🛒 Toggle clicked! Before toggle - isCollapsed:', isCollapsed, 'classes:', recommendations.className);
            recommendations.classList.toggle('collapsed');
            console.log('🛒 After toggle - nowCollapsed:', recommendations.classList.contains('collapsed'), 'classes:', recommendations.className);
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
            console.log('🛒 Recommendations collapsed:', recommendations.classList.contains('collapsed'));
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
        console.log('🛒 Cart fetched:', this.cart);
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
        console.log('🛒 Add to cart already in progress, ignoring click');
        return;
      }
      
      this._addToCartBusy = true;
      
      try {
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

    async loadRecommendations() {
      try {
        console.log('🛒 Loading smart recommendations...');
        
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
        
        console.log('🛒 Smart recommendations loaded:', recommendations.length, 'products');
        
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
        console.log('🛒 Loading fallback recommendations...');
        
  let apiUrl = '';
  let products = [];
  // Honor user setting; any positive number
  const desiredSetting = Number(this.settings.maxRecommendations);
  const desiredMax = isFinite(desiredSetting) && desiredSetting > 0 ? desiredSetting : 4;
        
        // Get product recommendations based on cart items, or popular products if cart is empty
        if (this.cart && this.cart.items && this.cart.items.length > 0) {
          const productId = this.cart.items[0].product_id;
          apiUrl = `/recommendations/products.json?product_id=${productId}&limit=${desiredMax}`;
          console.log('🛒 Loading recommendations based on cart item:', productId);
        } else {
          // Load popular/featured products when cart is empty
          apiUrl = `/products.json?limit=${desiredMax}`;
          console.log('🛒 Loading popular products (cart is empty)');
        }
        
        const response = await fetch(apiUrl);
        
        if (response.ok) {
          const data = await response.json();
          products = data.products || [];
          console.log('🛒 API returned', products.length, 'products');
        } else {
          console.log('🛒 API failed, will load fallback products');
        }
        
        // Always try to keep a buffer so we can fill visible list after filtering cart items
        const targetBuffer = Math.max(desiredMax * 3, desiredMax + 8); // Larger buffer for better selection
        if (products.length < targetBuffer) {
          console.log(`🛒 Loading additional products to reach buffer size ${targetBuffer}...`);
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
              
              console.log('🛒 Added', Math.min(needed, filteredProducts.length), 'fallback products (buffering)');
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
        console.log('🛒 Fallback recommendations loaded:', this._allRecommendations.length, 'showing:', this.recommendations.length);
        
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
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup) return;
      
      // Preserve scroll position
      const contentWrapper = popup.querySelector('.cartuplift-content-wrapper');
      const currentScrollTop = contentWrapper ? contentWrapper.scrollTop : 0;
      
      console.log('🛒 Updating drawer content, cart:', this.cart);
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();
      
      // Restore scroll position
      const newContentWrapper = popup.querySelector('.cartuplift-content-wrapper');
      if (newContentWrapper && currentScrollTop > 0) {
        requestAnimationFrame(() => {
          newContentWrapper.scrollTop = currentScrollTop;
        });
      }
      
      // Update sticky cart
      const count = document.querySelector('.cartuplift-sticky-count');
      const total = document.querySelector('.cartuplift-sticky-total');
  if (count) count.textContent = this.cart.item_count;
  if (total) total.textContent = this.formatMoney(this.getDisplayedTotalCents());
      
      // Only refresh layout if recommendations are loaded (filtering handled elsewhere)
      if (this.settings.enableRecommendations && this._recommendationsLoaded) {
        this.refreshRecommendationLayout();
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

    getDisplayedTotalCents() {
      const base = this.cart?.items_subtotal_price ?? this.cart?.total_price ?? 0;
      const { estimatedDiscountCents } = this.computeEstimatedDiscount(base);
      return Math.max(0, base - estimatedDiscountCents);
    }

    async openDrawer() {
      if (this._isAnimating || this.isOpen) return;
      
      // Track cart open event
      CartAnalytics.trackEvent('cart_open');
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        this._isAnimating = false;
        return;
      }

      // ALWAYS refresh cart and recommendations when opening drawer
      console.log('🔄 Refreshing cart and recommendations on drawer open...');
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
      CartAnalytics.trackEvent('cart_close');
      
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
          if (response.ok && this.settings.autoOpenCart && this.settings.enableApp) {
            // CRITICAL: Hide theme notifications immediately
            this.hideThemeNotifications();
            setTimeout(async () => {
              await this.fetchCart();
              this.updateDrawerContent();
              this.openDrawer();
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
            if (this.status === 200 && self.settings.autoOpenCart && self.settings.enableApp) {
              // Hide theme notifications
              self.hideThemeNotifications();
              
              setTimeout(async () => {
                await self.fetchCart();
                self.updateDrawerContent();
                self.openDrawer();
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
        bag: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6z"/></svg>',
        cart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>'
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

    proceedToCheckout() {
      // Track checkout start
      CartAnalytics.trackEvent('checkout_start', {
        revenue: this.cart ? this.cart.total_price / 100 : 0 // Convert from cents
      });
      
      const notes = document.getElementById('cartuplift-notes-input');
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

      if (notes && notes.value.trim()) {
        fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: notes.value.trim() })
        }).then(go);
      } else {
        go();
      }
    }

    // Add early interceptors to prevent theme notifications
    installEarlyInterceptors() {
      console.log('🛒 Installing early theme notification interceptors...');
      
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
      
      // Intercept and block theme cart events
      const originalAddEventListener = document.addEventListener;
      document.addEventListener = function(type, listener, options) {
        // Block cart-related events when our app is enabled
        if (type && (type.includes('cart') || type.includes('add')) && 
            window.cartUpliftDrawer && window.cartUpliftDrawer.settings.enableApp) {
          console.log(`🛒 Blocked theme event listener: ${type}`);
          return; // Don't add the theme's event listener
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
              console.log('🛒 Intercepted Shopify cart event:', event);
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
              console.log(`🛒 Blocked theme function: ${funcName}`);
            };
          }
          
          // Check in theme object
          if (window.theme && window.theme[funcName]) {
            window.theme[funcName] = () => {
              console.log(`🛒 Blocked theme.${funcName}`);
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
              console.log(`🛒 Blocked theme cart event: ${eventName}`);
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
            }
          }, true); // Capture phase to intercept early
        });
      });

      // After mount, try to hydrate express checkout with Shopify-rendered buttons
      setTimeout(() => this.mountExpressButtons(), 0);
      // Retry after a delay in case Shopify buttons load later
      setTimeout(() => this.mountExpressButtons(), 1000);
      setTimeout(() => this.mountExpressButtons(), 3000);
    }

    mountExpressButtons() {
      try {
        console.log('🔧 CartUplift: Attempting to mount express checkout buttons...');
        
        const slot = document.querySelector('.cartuplift-express-slot');
        if (!slot) {
          console.warn('🔧 CartUplift: Express slot not found');
          return;
        }
        
        const probe = document.getElementById('cartuplift-payment-probe');
        if (!probe) {
          console.warn('🔧 CartUplift: Payment probe not found');
          return;
        }
        
        // Find Shopify-generated dynamic buttons
        const dynamicWrap = probe.querySelector('.additional-checkout-buttons');
        if (!dynamicWrap) {
          console.warn('🔧 CartUplift: Additional checkout buttons wrapper not found');
          return;
        }

        console.log('🔧 CartUplift: Found dynamic buttons wrapper, checking for children...');
        console.log('🔧 CartUplift: Children count:', dynamicWrap.children.length);
        
        // If Shopify has injected child buttons, clone and insert into slot
        if (dynamicWrap.children.length) {
          console.log('✅ CartUplift: Found dynamic payment buttons, mounting...');
          
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

          console.log('✅ CartUplift: Express checkout buttons mounted successfully');

          // Hook click passthrough if needed: delegate clicks to original hidden buttons
          slot.addEventListener('click', (ev) => {
            const originalButton = probe.querySelector('.additional-checkout-buttons button, .shopify-payment-button');
            if (originalButton) originalButton.click();
          }, { once: true });
        } else {
          console.warn('⚠️ CartUplift: No payment buttons found in Shopify wrapper. This could mean:');
          console.warn('  1. PayPal/Shop Pay not enabled in Shopify payments');
          console.warn('  2. Buttons not yet rendered by Shopify');
          console.warn('  3. Theme conflicts preventing button rendering');
        }
      } catch (e) {
        console.warn('Failed to mount express buttons:', e);
      }
    }

    // Enhanced method to hide theme notifications with multiple strategies
    hideThemeNotifications() {
      console.log('🛒 Hiding theme notifications...');
      
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
            console.log('🛒 Theme cart open prevented - using Cart Uplift instead');
          };
        }
        if (window.theme.cart.show) {
          window.theme.cart.show = () => {
            console.log('🛒 Theme cart show prevented - using Cart Uplift instead');
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
      console.log('🛒 Setting up notification blocker...');
      
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
                console.log('🛒 Blocking dynamically added theme notification:', node);
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
      
      console.log('🛒 Notification blocker installed');
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
      
      console.log('🤖 AI Complement Detection initialized with', this.complementRules.size, 'automatic rules');
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
        
        console.log('🤖 Manual complement rules loaded:', this.manualRules.size, 'rules');
      } catch (error) {
        console.error('🤖 Failed to parse manual complement rules:', error);
        console.log('🤖 Manual rules JSON was:', manualRulesJson);
      }
    }

    // Main entry point - replaces existing loadRecommendations
    async getRecommendations() {
      try {
        const cart = this.cartUplift.cart;
        const mode = this.cartUplift.settings.complementDetectionMode || 'automatic';
        
        console.log('🤖 Smart recommendations mode:', mode);
        
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
      
      for (const item of cart.items) {
        const productText = `${item.product_title} ${item.product_type || ''}`.toLowerCase();
        
        // Check against manual rules first (higher priority)
        for (const [pattern, rule] of this.manualRules) {
          if (pattern.test(productText)) {
            console.log('🤖 Manual rule matched for:', item.product_title, '→', rule.complements);
            
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
      
      console.log('🤖 Analyzing cart for smart recommendations...');
      
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
            console.log('🤖 AI detected complements for:', item.product_title, '→', rule.complements);
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
      console.log('🤖 Master recommendations (sorted, unsliced):', unique.map(r => `${r.title} (${r.reason}, ${r.score?.toFixed?.(2)})`));
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
          return products.map(p => this.formatProduct(p));
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
          return filtered.slice(0, searchLimit).map(p => this.formatProduct(p));
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
          return inRange.slice(0, rangeLimit).map(p => this.formatProduct(p));
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
              console.log('🤖 Loaded popular products from:', collection);
              return data.products.map(p => this.formatProduct(p));
            }
          }
        }
        
        // Final fallback
        const response = await fetch(`/products.json?limit=${popularLimit}`);
        if (response.ok) {
          const data = await response.json();
          return (data.products || []).map(p => this.formatProduct(p));
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
            return (data.products || []).map(p => this.formatProduct(p));
          }
        }
      } catch (error) {
        console.error('🤖 Shopify recommendations failed:', error);
      }
      return [];
    }

    formatProduct(product) {
      const basePrice = product.variants?.[0]?.price || product.price || 0;
      
      return {
        id: product.id,
        title: product.title,
        // Convert price to cents for consistent formatting
        priceCents: basePrice ? Math.round(parseFloat(basePrice) * 100) : 0,
        image: product.featured_image || product.image || product.images?.[0]?.src || 
                product.media?.[0]?.preview_image?.src || 'https://via.placeholder.com/150',
        variant_id: product.variants?.[0]?.id || product.id,
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
          console.log('🤖 Purchase patterns loaded:', Object.keys(this.purchasePatterns.frequentPairs || {}).length, 'products');
        } else {
          console.log('🤖 No purchase patterns available, using AI-only mode');
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
