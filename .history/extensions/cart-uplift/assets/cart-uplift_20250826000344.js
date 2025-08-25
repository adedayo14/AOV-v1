(function() {
  'use strict';
  
  console.log('🛒 Cart Uplift script loaded!');

  class CartUpliftDrawer {
    constructor(settings) {
      this.settings = settings || window.CartUpliftSettings || {};
      
      // Ensure boolean settings are properly set
      this.settings.enableStickyCart = Boolean(this.settings.enableStickyCart);
      this.settings.enableFreeShipping = Boolean(this.settings.enableFreeShipping);
      this.settings.enableApp = this.settings.enableApp !== false;
      this.settings.enableRecommendations = Boolean(this.settings.enableRecommendations);
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
      
      console.log('🛒 Cart Uplift setup complete.');
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
    // If no variant title or it's the default, check for individual options
    if (!item.variant_title || item.variant_title === 'Default Title') {
      if (item.options_with_values && item.options_with_values.length > 0) {
        const validOptions = item.options_with_values.filter(option => 
          option.value && option.value !== 'Default Title'
        );
        if (validOptions.length > 0) {
          return validOptions.map(option => 
            `<div class="cartuplift-item-variant">${option.name}: ${option.value}</div>`
          ).join('');
        }
      }
      return '';
    }
    
    // Use variant title if available
    return `<div class="cartuplift-item-variant">${item.variant_title}</div>`;
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
      const layout = this.settings.recommendationLayout || 'column';
      
      return `
        <div class="cartuplift-recommendations cartuplift-recommendations-${layout}">
          <div class="cartuplift-recommendations-header">
            <h3>RECOMMENDED FOR YOU</h3>
            <button class="cartuplift-recommendations-toggle" data-toggle="recommendations">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>
          <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content">
            ${this.getRecommendationItems()}
          </div>
        </div>
      `;
    }

    getRecommendationItems() {
      // Show loading state if not loaded yet
      if (!this._recommendationsLoaded) {
        return '<div class="cartuplift-recommendations-loading">Loading recommendations...</div>';
      }
      
      // If no recommendations, this method shouldn't be called due to shouldShowRecommendations logic
      // But add safety check
      if (!this.recommendations || this.recommendations.length === 0) {
        console.log('🛒 getRecommendationItems called with no recommendations - this should not happen');
        return '';
      }
      
      const layout = this.settings.recommendationLayout || 'column';
      
      if (layout === 'row') {
        return `
          <div class="cartuplift-recommendations-scroll">
            ${this.recommendations.map(product => `
              <div class="cartuplift-recommendation-card">
                <img src="${product.image}" alt="${product.title}" loading="lazy">
                <h4><a href="${product.url}" class="cartuplift-product-link">${product.title}</a></h4>
                <div class="cartuplift-recommendation-price">${this.formatMoney(product.price)}</div>
                <button class="cartuplift-add-recommendation" data-variant-id="${product.variant_id}">
                  Add+
                </button>
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

    refreshRecommendationLayout() {
      // Reload settings to get latest changes
      const recommendationsContainer = document.querySelector('.cartuplift-recommendations-content');
      if (recommendationsContainer && this._recommendationsLoaded) {
        recommendationsContainer.innerHTML = this.getRecommendationItems();
        
        // Re-apply layout class to container  
        const recommendationsSection = document.querySelector('.cartuplift-recommendations');
        if (recommendationsSection) {
          const layout = this.settings.recommendationLayout || 'column';
          // Remove old layout classes and add new one
          recommendationsSection.classList.remove('cartuplift-recommendations-row', 'cartuplift-recommendations-column');
          recommendationsSection.classList.add(`cartuplift-recommendations-${layout}`);
        }
      }
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
        backdrop.addEventListener('click', () => this.closeDrawer());
      }

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeDrawer();
        }
      });

      // Quantity controls
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
          const variantId = e.target.dataset.variantId;
          this.addToCart(variantId, 1);
        } else if (e.target.classList.contains('cartuplift-add-recommendation-circle')) {
          e.preventDefault();
          e.stopPropagation();
          const variantId = e.target.dataset.variantId;
          this.addToCart(variantId, 1);
        } else if (e.target.classList.contains('cartuplift-recommendations-toggle') || e.target.closest('.cartuplift-recommendations-toggle')) {
          console.log('🛒 Toggle recommendations clicked');
          const toggleButton = e.target.classList.contains('cartuplift-recommendations-toggle') 
            ? e.target 
            : e.target.closest('.cartuplift-recommendations-toggle');
          const recommendations = container.querySelector('.cartuplift-recommendations');
          if (recommendations) {
            const isCollapsed = recommendations.classList.contains('collapsed');
            recommendations.classList.toggle('collapsed');
            
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
            
            console.log('🛒 Recommendations collapsed:', recommendations.classList.contains('collapsed'));
          }
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
          
          // Remove the added product from recommendations
          if (this.recommendations && this.recommendations.length > 0) {
            this.recommendations = this.recommendations.filter(rec => 
              rec.variant_id !== variantId
            );
            console.log('🛒 Removed added product from recommendations, remaining:', this.recommendations.length);
            
            // Auto-hide section if all products have been added
            if (this.recommendations.length === 0) {
              console.log('🛒 All recommendations added, hiding section completely');
              // Regenerate drawer content to hide the entire recommendations section
              setTimeout(() => {
                this.updateDrawerContent();
              }, 500); // Small delay to let user see the item was added
            }
          }
          
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
          console.error('🛒 Rate limited, please wait before trying again');
          // Show user-friendly message
          buttons.forEach(button => {
            button.textContent = 'Rate limited - wait';
            setTimeout(() => {
              button.disabled = false;
              button.style.opacity = '1';
              button.textContent = '+';
            }, 3000);
          });
        } else {
          console.error('🛒 Error adding to cart:', response.status, response.statusText);
          // Re-enable buttons on error
          buttons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '1';
            button.textContent = '+';
          });
        }
      } catch (error) {
        console.error('🛒 Error adding to cart:', error);
        // Re-enable buttons on error
        const buttons = document.querySelectorAll(`[data-variant-id="${variantId}"]`);
        buttons.forEach(button => {
          button.disabled = false;
          button.style.opacity = '1';
          button.textContent = '+';
        });
      } finally {
        // Always reset the busy flag after a delay
        setTimeout(() => {
          this._addToCartBusy = false;
        }, 2000);
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
        this.recommendations = products.map(product => ({
          id: product.id,
          title: product.title,
          price: product.variants && product.variants[0] ? product.variants[0].price : 0,
          image: product.images && product.images[0] ? product.images[0].src || product.images[0] : 
                 product.featured_image || 'https://via.placeholder.com/150x150?text=No+Image',
          variant_id: product.variants && product.variants[0] ? product.variants[0].id : null,
          url: product.handle ? `/products/${product.handle}` : (product.url || '#')
        })).filter(item => item.variant_id); // Only include products with valid variants
        
        console.log('🛒 Final recommendations loaded:', this.recommendations.length);
        
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
      
      // Filter out cart items from recommendations
      if (this.recommendations && this.cart && this.cart.items) {
        const cartProductIds = this.cart.items.map(item => item.product_id);
        const originalCount = this.recommendations.length;
        this.recommendations = this.recommendations.filter(rec => 
          !cartProductIds.includes(rec.id)
        );
        
        if (originalCount !== this.recommendations.length) {
          console.log('🛒 Filtered out', originalCount - this.recommendations.length, 'cart items from recommendations');
          // Don't auto-refill recommendations - let them get depleted naturally
        }
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