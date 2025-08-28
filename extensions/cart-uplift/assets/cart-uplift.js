(function() {
  'use strict';
  
  // Version marker (increment when deploying to verify fresh assets)
  const CART_UPLIFT_VERSION = 'v140';
  console.log('🛒 Cart Uplift script loaded', CART_UPLIFT_VERSION);

  // Analytics tracking helper
  const CartAnalytics = {
    sessionId: null,
    shop: (typeof window !== 'undefined' && (window.CartUpliftShop || window.location?.hostname)) || '',
    
    init() {
      // Generate session ID for tracking
      this.sessionId = this.generateSessionId();
      
      // Track page load as potential cart opportunity
      this.trackEvent('page_view');
    },
    
    generateSessionId() {
      return 'cart_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    },
    
    trackEvent(eventType, data = {}) {
      try {
        const eventData = {
          eventType,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          shop: this.shop,
          ...data
        };
        
        // Send to tracking endpoint
        fetch('/apps/cart-uplift/api/cart-tracking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            eventType: eventData.eventType,
            sessionId: eventData.sessionId,
            shop: eventData.shop || '',
            productId: eventData.productId || '',
            productTitle: eventData.productTitle || '',
            revenue: eventData.revenue || ''
          })
        }).then(response => {
          if (response.ok) {
            console.log('📊 Cart event tracked:', eventData.eventType);
          }
        }).catch(error => {
          console.warn('Cart tracking failed:', error);
        });
        
        // Also send to GA4 if available
        if (typeof window !== 'undefined' && typeof window.gtag !== 'undefined') {
          window.gtag('event', eventType, {
            custom_parameter_1: eventData.sessionId,
            custom_parameter_2: eventData.productId
          });
        }
      } catch (error) {
        console.warn('Cart analytics error:', error);
      }
    }
  };
  
  // Initialize analytics tracking
  CartAnalytics.init();

  class CartUpliftDrawer {
    constructor(settings) {
      this.settings = settings || window.CartUpliftSettings || {};
      // Normalize recommendation layout values (admin uses horizontal/vertical, theme uses row/column)
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
      this.settings.enableDiscountCode = Boolean(this.settings.enableDiscountCode);
      this.settings.enableExpressCheckout = Boolean(this.settings.enableExpressCheckout);
      this.settings.autoOpenCart = this.settings.autoOpenCart !== false;
      
      this.cart = null;
      this.isOpen = false;
      this._isAnimating = false;
      this._quantityBusy = false;
      this._recommendationsLoaded = false;
      this.recommendations = [];
      this._allRecommendations = []; // Master list to allow re-show after removal from cart

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
      
      // Create cart drawer AFTER cart is fetched
      this.createDrawer();
      
      // Update drawer content with actual cart data
      this.updateDrawerContent();
      
      // Handle sticky cart
      if (this.settings.enableStickyCart) {
        this.createStickyCart();
      }
      
      // Set up cart replacement
      this.setupCartInterception();
      
      // Install cart monitoring
      this.installAddToCartMonitoring();
      
      // Apply custom colors
      this.applyCustomColors();
      
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
          <span class="cartuplift-sticky-total">${this.formatMoney(this.cart?.total_price || 0)}</span>
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
      const totalPrice = this.cart?.total_price || 0;
      
      // Check if we should show recommendations - only show if:
      // 1. Recommendations are enabled
      // 2. Either we're still loading OR we have actual recommendations to show
      const shouldShowRecommendations = this.settings.enableRecommendations && 
        ((!this._recommendationsLoaded) || (this.recommendations && this.recommendations.length > 0));
      
      console.log('🛒 shouldShowRecommendations:', shouldShowRecommendations, 
        'loaded:', this._recommendationsLoaded, 
        'count:', this.recommendations?.length || 0);
      
      return `
        <div class="cartuplift-drawer${shouldShowRecommendations ? ' has-recommendations' : ''}">
          ${this.getHeaderHTML(itemCount)}
          
          <div class="cartuplift-content-wrapper">
            <div class="cartuplift-items">
              ${this.getCartItemsHTML()}
            </div>
            
            <div class="cartuplift-scrollable-content">
              ${this.settings.enableAddons ? this.getAddonsHTML() : ''}
            </div>
          </div>
          
          ${shouldShowRecommendations ? this.getRecommendationsHTML() : ''}
          
          <div class="cartuplift-footer">
            ${this.settings.enableDiscountCode ? this.getDiscountHTML() : ''}
            ${this.settings.enableNotes ? this.getNotesHTML() : ''}
            
            <div class="cartuplift-subtotal">
              <span>Subtotal</span>
              <span class="cartuplift-subtotal-amount">${this.formatMoney(totalPrice)}</span>
            </div>
            
            <button class="cartuplift-checkout-btn" onclick="window.cartUpliftDrawer.proceedToCheckout()">
              CHECKOUT
            </button>
            
            ${this.settings.enableExpressCheckout ? this.getExpressCheckoutHTML() : ''}
          </div>
        </div>
      `;
    }

    getHeaderHTML(itemCount) {
      let threshold = this.settings.freeShippingThreshold || 100;
      const currentTotal = this.cart ? this.cart.total_price : 0;

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
          freeShippingText = (this.settings.freeShippingText || "Spend {amount} more for free shipping!")
            .replace(/{amount}/g, this.formatMoney(thresholdInSmallestUnit));
          console.log('🛒 Free Shipping: Empty cart, showing threshold needed');
        } else if (remaining > 0) {
          freeShippingText = (this.settings.freeShippingText || "Spend {amount} more for free shipping!")
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

    getVariantOptionsHTML(item) {
      // First check if we have properly structured options
      if (item.options_with_values && item.options_with_values.length > 0) {
        return item.options_with_values
          .filter(option => option.value && option.value !== 'Default Title')
          .map(option => `<div class="cartuplift-item-variant">${option.name}: ${option.value}</div>`)
          .join('');
      }
      
      // If we have variant_title like "Black / 10"
      if (item.variant_title && item.variant_title !== 'Default Title') {
        // Split by forward slash with optional spaces
        const options = item.variant_title.split(/\s*\/\s*/);
        
        // If we have multiple parts, try to identify what they are
        if (options.length > 1) {
          return options.map((option, index) => {
            // Try to intelligently label the options
            let label = '';
            
            // Check if it's a color (common color names or contains common color words)
            const colorPattern = /black|white|red|blue|green|yellow|grey|gray|brown|navy|pink|purple|orange|beige|cream/i;
            // Check if it's a size (contains numbers or size indicators)
            const sizePattern = /^\d+(\.\d+)?$|^(XS|S|M|L|XL|XXL|XXXL|\d+)$/i;
            
            if (colorPattern.test(option)) {
              label = 'Color';
            } else if (sizePattern.test(option)) {
              label = 'Size';
            } else if (index === 0) {
              label = 'Option 1';
            } else {
              label = 'Option 2';
            }
            
            return `<div class="cartuplift-item-variant">${label}: ${option}</div>`;
          }).join('');
        }
        
        // Single variant option
        return `<div class="cartuplift-item-variant">${item.variant_title}</div>`;
      }
      
      // Check if item has individual properties for color/size
      let variants = [];
      
      // Some Shopify themes provide these separately
      if (item.variant_options) {
        item.variant_options.forEach((option, index) => {
          if (option && option !== 'Default Title') {
            // Try to determine the label based on position or content
            let label = item.options && item.options[index] ? item.options[index] : `Option ${index + 1}`;
            variants.push(`<div class="cartuplift-item-variant">${label}: ${option}</div>`);
          }
        });
      }
      
      // Alternative: check for properties directly on the item
      if (item.properties && typeof item.properties === 'object') {
        Object.entries(item.properties).forEach(([key, value]) => {
          if (value && key !== '__proto__') {
            variants.push(`<div class="cartuplift-item-variant">${key}: ${value}</div>`);
          }
        });
      }
      
      return variants.join('') || '';
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
              <a href="${item.url}">${item.product_title}</a>
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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
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
        </div>`;

      return `
        <div class="cartuplift-recommendations cartuplift-recommendations-${layout}">
          <div class="cartuplift-recommendations-header">
            <h3 class="cartuplift-recommendations-title">${title}</h3>
            <button class="cartuplift-recommendations-toggle" data-toggle="recommendations" aria-expanded="true" aria-controls="cartuplift-recommendations-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>
          <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content">
            ${this.getRecommendationItems()}
          </div>
          ${layout === 'row' ? controlsHTML : ''}
        </div>
      `;
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
      section.className = `cartuplift-recommendations cartuplift-recommendations-${layout}`;
      
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
          }, 100);
        }
      }
    }

    rebuildRecommendationsFromMaster() {
      if (!this._allRecommendations.length) return;
      const cartProductIds = (this.cart?.items || []).map(i => i.product_id);
      const filtered = this._allRecommendations.filter(r => !cartProductIds.includes(r.id));
      const max = this.settings.maxRecommendations || 4;
      this.recommendations = filtered.slice(0, max);
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
                    <div class="cartuplift-recommendation-price">${this.formatMoney(product.price)}</div>
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
              <div class="cartuplift-recommendation-price">${this.formatMoney(product.price)}</div>
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
        // Get the option name (typically Size, Color, etc.)
    const firstOption = (product.options && product.options.length > 0) ? product.options[0] : null;
    const optionLabel = typeof firstOption === 'string' ? firstOption : (firstOption && firstOption.name) ? firstOption.name : 'Option';
        
        return `
          <div class="cartuplift-product-variation">
            <select class="cartuplift-size-dropdown" data-product-id="${product.id}">
        <option value="">Select ${optionLabel}</option>
              ${product.variants.map(variant => 
                variant.available ? `
                  <option value="${variant.id}" data-price="${variant.price}">
                    ${variant.title}
                  </option>
                ` : ''
              ).join('')}
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
                </button>`;
              section.appendChild(controls);
            }
            setTimeout(() => {
              const scrollContainer = document.querySelector('.cartuplift-recommendations-content');
              if (scrollContainer) {
                this.setupScrollControls(scrollContainer);
                this.updateCarouselButtons(scrollContainer);
                scrollContainer.addEventListener('scroll', () => {
                  this.updateCarouselButtons(scrollContainer);
                });
              }
            }, 100);
          }
        }
      }
    }

    setupScrollControls(scrollContainer) {
      // Calculate scroll amounts based on card width (340px + 15px gap = 355px)
      this.cardWidth = 340;
      this.gap = 15;
      this.scrollAmount = this.cardWidth + this.gap;
      
      // Bind navigation events
      const prevBtn = document.querySelector('.cartuplift-carousel-nav.prev');
      const nextBtn = document.querySelector('.cartuplift-carousel-nav.next');
      
      if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => this.scrollPrev(scrollContainer));
        nextBtn.addEventListener('click', () => this.scrollNext(scrollContainer));
      }
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
      const targetScroll = Math.min(maxScroll, currentScroll + this.scrollAmount);
      
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

    handleVariantChange(select) {
      const card = select.closest('.cartuplift-recommendation-card');
      if (!card) return;
      
      const variantId = select.value;
      const selectedOption = select.options[select.selectedIndex];
      const price = selectedOption.dataset.price;
      
      // Update add button with selected variant
      const addBtn = card.querySelector('.cartuplift-add-recommendation');
      if (addBtn && variantId) {
        addBtn.dataset.variantId = variantId;
      }
      
      // Update price display if available
      if (price) {
        const priceElement = card.querySelector('.cartuplift-recommendation-price');
        if (priceElement) {
          priceElement.textContent = this.formatMoney(parseInt(price));
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
      return `
        <div class="cartuplift-discount">
          <input type="text" id="cartuplift-discount-code" class="cartuplift-discount-input" placeholder="Discount code">
          <button class="cartuplift-discount-apply" onclick="window.cartUpliftDrawer.applyDiscountCode()">Apply</button>
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

    getExpressCheckoutHTML() {
      return `
        <div class="cartuplift-express-checkout">
          <button class="cartuplift-paypal-btn">
            <img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" alt="PayPal">
          </button>
          <button class="cartuplift-shoppay-btn">
            Shop Pay
          </button>
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
          // Only close if the click is directly on the backdrop, not a child
          if (e.target === backdrop) {
            this.closeDrawer();
          }
        });
      }

      // Fallback: click outside the drawer closes it
      document.addEventListener('mousedown', (e) => {
        if (!this.isOpen) return;
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
          this.closeDrawer();
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
          (e.target.closest && e.target.closest('.cartuplift-recommendations-toggle'))
        ) {
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
                // Expanding - arrow points down (your original SVG)
                arrow.setAttribute('d', 'm19.5 8.25-7.5 7.5-7.5-7.5');
              } else {
                // Collapsing - arrow points up (your collapse SVG)
                arrow.setAttribute('d', 'm4.5 15.75 7.5-7.5 7.5 7.5');
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
            
            // Update button states after scroll
            setTimeout(() => this.updateCarouselButtons(scrollContainer), 100);
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
    }

    async fetchCart() {
      try {
        const response = await fetch('/cart.js');
        this.cart = await response.json();
        console.log('🛒 Cart fetched:', this.cart);
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
          
          // Do NOT permanently remove; we'll simply re-filter so it disappears while in cart
          this.rebuildRecommendationsFromMaster();
          
          await this.fetchCart();
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
        console.log('🛒 Loading recommendations...');
        
        let apiUrl = '';
        let products = [];
        
        // Get product recommendations based on cart items, or popular products if cart is empty
        if (this.cart && this.cart.items && this.cart.items.length > 0) {
          const productId = this.cart.items[0].product_id;
          apiUrl = `/recommendations/products.json?product_id=${productId}&limit=4`;
          console.log('🛒 Loading recommendations based on cart item:', productId);
        } else {
          // Load popular/featured products when cart is empty
          apiUrl = `/products.json?limit=4`;
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
        
        // If we don't have enough products, load more from general products endpoint
        if (products.length < 4) {
          console.log('🛒 Loading additional products to reach 4 total...');
          try {
            const fallbackResponse = await fetch('/products.json?limit=8'); // Load more for better filtering
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              const fallbackProducts = fallbackData.products || [];
              
              // Filter out products that are already in cart or already in recommendations
              const cartProductIds = this.cart && this.cart.items ? 
                this.cart.items.map(item => item.product_id) : [];
              
              const existingProductIds = products.map(p => p.id);
              
              const filteredProducts = fallbackProducts.filter(product => 
                !cartProductIds.includes(product.id) && 
                !existingProductIds.includes(product.id) &&
                product.variants && product.variants.length > 0 && 
                product.variants[0].available
              );
              
              // Add filtered products until we have 4 total
              const needed = 4 - products.length;
              products = products.concat(filteredProducts.slice(0, needed));
              
              console.log('🛒 Added', Math.min(needed, filteredProducts.length), 'fallback products');
            }
          } catch (fallbackError) {
            console.error('🛒 Error loading fallback products:', fallbackError);
          }
        }
        
        // Convert to our format
  this._allRecommendations = products.map(product => ({
          id: product.id,
          title: product.title,
          price: product.variants && product.variants[0] ? product.variants[0].price : 0,
          image: product.images && product.images[0] ? product.images[0].src || product.images[0] : 
                 product.featured_image || 'https://via.placeholder.com/150x150?text=No+Image',
          variant_id: product.variants && product.variants[0] ? product.variants[0].id : null,
          url: product.handle ? `/products/${product.handle}` : (product.url || '#'),
          variants: product.variants || [],
          options: product.options || []
        })).filter(item => item.variant_id); // Only include products with valid variants
  this.rebuildRecommendationsFromMaster();
  console.log('🛒 Final recommendations loaded (master):', this._allRecommendations.length, 'showing:', this.recommendations.length);
        
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
        console.error('🛒 Error loading recommendations:', error);
        this.recommendations = [];
        this._recommendationsLoaded = true;
      }
    }

    updateDrawerContent() {
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup) return;
      
      console.log('🛒 Updating drawer content, cart:', this.cart);
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();
      
      // Rebuild recommendations each render so removed cart items come back
      if (this._allRecommendations.length) {
        this.rebuildRecommendationsFromMaster();
      }
      
      // Update sticky cart
      const count = document.querySelector('.cartuplift-sticky-count');
      const total = document.querySelector('.cartuplift-sticky-total');
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);
      
      // Refresh recommendations layout if they're already loaded
      if (this.settings.enableRecommendations && this._recommendationsLoaded) {
        this.refreshRecommendationLayout();
      }
    }

    openDrawer() {
      if (this._isAnimating || this.isOpen) return;
      
      // Track cart open event
      CartAnalytics.trackEvent('cart_open');
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        this._isAnimating = false;
        return;
      }

      // Update drawer content before showing to ensure latest data
      this.updateDrawerContent();
      
      // Load recommendations if not already loaded and enabled
      if (this.settings.enableRecommendations && !this._recommendationsLoaded) {
        this.loadRecommendations();
      }

      // Show container and add active class
      container.style.display = 'block';
      
      // Force reflow
      void container.offsetHeight;
      
      // Add active class for animation
      container.classList.add('active');
      
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
      }, 300);
    }

    setupCartInterception() {
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
        
        if (args[0] && args[0].toString().includes('/cart/add')) {
          if (response.ok && this.settings.autoOpenCart) {
            setTimeout(async () => {
              await this.fetchCart();
              this.updateDrawerContent();
              this.openDrawer();
            }, 100);
          }
        }
        
        return response;
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
      const amount = (cents / 100).toFixed(2);
      
      if (window.CartUpliftMoneyFormat) {
        try {
          return window.CartUpliftMoneyFormat.replace(/\{\{\s*amount\s*\}\}/g, amount);
        } catch {
          // Fallback
        }
      }
      
      return '$' + amount;
    }

    async applyDiscountCode() {
      const input = document.getElementById('cartuplift-discount-code');
      if (!input || !input.value.trim()) return;
      
      const code = input.value.trim();
      window.location.href = `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(window.location.pathname)}`;
    }

    proceedToCheckout() {
      // Track checkout start
      CartAnalytics.trackEvent('checkout_start', {
        revenue: this.cart ? this.cart.total_price / 100 : 0 // Convert from cents
      });
      
      const notes = document.getElementById('cartuplift-notes-input');
      if (notes && notes.value.trim()) {
        fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: notes.value.trim() })
        }).then(() => {
          window.location.href = '/checkout';
        });
      } else {
        window.location.href = '/checkout';
      }
    }
  }

  // Expose globally
  window.CartUpliftDrawer = CartUpliftDrawer;
  
  // Auto-initialize if settings exist
  if (window.CartUpliftSettings) {
    window.cartUpliftDrawer = new CartUpliftDrawer(window.CartUpliftSettings);
  }

})();