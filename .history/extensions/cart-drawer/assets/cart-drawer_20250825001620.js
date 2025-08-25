(function() {
  'use strict';
  
  console.log('🛒 UpCart script loaded!');
  console.log('🛒 Window settings available:', !!window.UpCartSettings);

  class UpCartDrawer {
    constructor(settings) {
      this.settings = settings || window.UpCartSettings;
      this.cart = window.UpCartPreloadedCart || null;
      this.isOpen = false;
      this.init();
    }

    async init() {
      // Wait for DOM
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    }

    async setup() {
      console.log('🛒 UpCart Debug - Setup called');
      console.log('🛒 Settings loaded:', this.settings);
      console.log('🛒 Current URL:', window.location.href);
      console.log('🛒 showOnlyOnCartPage:', this.settings?.showOnlyOnCartPage);
      console.log('🛒 isCartPage():', this.isCartPage());
      
      // If showOnlyOnCartPage is enabled, only create UI elements on cart pages
      // But still initialize cart tracking and drawer functionality for all pages
      if (this.settings.showOnlyOnCartPage && !this.isCartPage()) {
        console.log('🛒 Limited mode - Only cart tracking, no UI elements');
        // Still listen for cart changes and set up drawer functionality
        this.listenToCartEvents();
        this.interceptAddToCart();
        // Set up cart drawer hijacking for when users add to cart
        this.hijackThemeCartDrawer();
        return;
      }
      
      console.log('🛒 Full mode - Creating all UI elements');
      
      // Fetch fresh cart if not preloaded
      if (!this.cart) {
        await this.fetchCart();
      }
      console.log('🛒 Cart data:', this.cart);
      
      // Create our cart drawer system
      this.createCartDrawer();
      
      // Create sticky cart if enabled
      if (this.settings.enableStickyCart) {
        console.log('🛒 Creating sticky cart...');
        this.createStickyCart();
      }
      
      // Create free shipping bar if enabled
      if (this.settings.enableFreeShipping) {
        console.log('🛒 Creating free shipping bar...');
        this.createFreeShippingBar();
      }
      
      // Listen for cart changes
      this.listenToCartEvents();
      
      // Intercept add to cart forms
      this.interceptAddToCart();
      
      // Hijack theme cart drawer
      this.hijackThemeCartDrawer();
      
      console.log('🛒 Setup completed!');
    }

    isCartPage() {
      return window.location.pathname === '/cart' || window.location.pathname.startsWith('/cart/');
    }

    createCartDrawer() {
      // Create the main cart drawer (replaces theme drawer)
      const container = document.getElementById('upcart-app-container');
      const cartPopup = document.getElementById('upcart-cart-popup');
      
      if (!container || !cartPopup) {
        console.error('🛒 UpCart container not found');
        return;
      }
      
      // Build the cart drawer HTML (similar to working app structure)
      cartPopup.innerHTML = `
        <div class="upcart-cart upcart-cart-right upcart-cart-fixed">
          <div class="upcart-cart-card">
            <div class="upcart-header">
              <h3 class="upcart-header-text">Cart • ${this.cart?.item_count || 0}</h3>
              <div class="upcart-header-close-button" role="button" aria-label="Close cart">
                <svg viewBox="0 0 20 20"><path d="m11.414 10 6.293-6.293a1 1 0 1 0-1.414-1.414l-6.293 6.293-6.293-6.293a1 1 0 0 0-1.414 1.414l6.293 6.293-6.293 6.293a1 1 0 1 0 1.414 1.414l6.293-6.293 6.293 6.293a.998.998 0 0 0 1.707-.707.999.999 0 0 0-.293-.707l-6.293-6.293z"></path></svg>
              </div>
            </div>
            <div class="upcart-cart-body">
              ${this.settings.enableFreeShipping ? this.getFreeShippingHTML() : ''}
              <div class="upcart-products-section">
                ${this.renderCartItems()}
              </div>
              ${this.settings.enableUpsells ? '<div class="upcart-upsells-section"><h4>You might also like</h4><div id="upcart-upsells"></div></div>' : ''}
            </div>
            <div class="upcart-footer">
              <div class="upcart-checkout-container">
                <a href="/checkout" class="upcart-checkout-button">
                  Checkout • ${this.formatMoney(this.cart?.total_price || 0)}
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add event listeners
      this.attachCartDrawerEvents();
      
      console.log('🛒 Cart drawer created');
    }

    renderCartItems() {
      if (!this.cart || this.cart.items.length === 0) {
        return `
          <div class="upcart-cart-empty">
            <h3>Your cart is empty</h3>
            <p>Add some products to get started!</p>
            <a href="/collections/all" class="upcart-continue-shopping">Continue Shopping</a>
          </div>
        `;
      }

      return this.cart.items.map(item => `
        <div class="upcart-cart-item" data-variant-id="${item.variant_id}">
          <div class="upcart-item-image">
            <img src="${item.image}" alt="${item.title}" />
          </div>
          <div class="upcart-item-details">
            <h4 class="upcart-item-title">${item.product_title}</h4>
            ${item.variant_title ? `<p class="upcart-item-variant">${item.variant_title}</p>` : ''}
            <div class="upcart-item-price">${this.formatMoney(item.price)}</div>
            <div class="upcart-quantity-controls">
              <button class="upcart-quantity-minus" data-variant-id="${item.variant_id}">-</button>
              <input type="number" class="upcart-quantity-input" value="${item.quantity}" data-variant-id="${item.variant_id}" min="0">
              <button class="upcart-quantity-plus" data-variant-id="${item.variant_id}">+</button>
            </div>
          </div>
          <button class="upcart-remove-item" data-variant-id="${item.variant_id}" aria-label="Remove item">×</button>
        </div>
      `).join('');
    }

    attachCartDrawerEvents() {
      const container = document.getElementById('upcart-app-container');
      const backdrop = document.getElementById('upcart-backdrop');
      const closeButton = container.querySelector('.upcart-header-close-button');
      
      // Close drawer events
      [backdrop, closeButton].forEach(element => {
        if (element) {
          element.addEventListener('click', () => this.closeDrawer());
        }
      });
      
      // Quantity controls
      container.addEventListener('click', (e) => {
        if (e.target.classList.contains('upcart-quantity-minus')) {
          const variantId = e.target.dataset.variantId;
          const input = container.querySelector(`input[data-variant-id="${variantId}"]`);
          const newQty = Math.max(0, parseInt(input.value) - 1);
          this.updateQuantity(variantId, newQty);
        }
        
        if (e.target.classList.contains('upcart-quantity-plus')) {
          const variantId = e.target.dataset.variantId;
          const input = container.querySelector(`input[data-variant-id="${variantId}"]`);
          const newQty = parseInt(input.value) + 1;
          this.updateQuantity(variantId, newQty);
        }
        
        if (e.target.classList.contains('upcart-remove-item')) {
          const variantId = e.target.dataset.variantId;
          this.updateQuantity(variantId, 0);
        }
      });
      
      // Quantity input changes
      container.addEventListener('change', (e) => {
        if (e.target.classList.contains('upcart-quantity-input')) {
          const variantId = e.target.dataset.variantId;
          const newQty = Math.max(0, parseInt(e.target.value) || 0);
          this.updateQuantity(variantId, newQty);
        }
      });
    }

    hijackThemeCartDrawer() {
      // Intercept all cart clicks and redirect to our drawer
      document.addEventListener('click', (e) => {
        const target = e.target.closest('a[href*="/cart"], button[data-cart-drawer], .cart-drawer-trigger, [data-drawer-trigger="CartDrawer"]');
        if (target && !target.closest('#upcart-app-container')) {
          e.preventDefault();
          e.stopPropagation();
          console.log('🛒 Intercepted cart click, opening UpCart drawer instead');
          this.openDrawer();
        }
      }, true);
      
      // Hide theme cart drawers
      const hideSelectors = [
        'cart-drawer',
        '[data-drawer="CartDrawer"]',
        '.cart-drawer',
        '#CartDrawer',
        'cart-notification-product',
        'cart-notification'
      ];
      
      hideSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          el.style.display = 'none !important';
          el.style.visibility = 'hidden !important';
        });
      });
    }

    openDrawer() {
      console.log('🛒 Opening UpCart drawer');
      const container = document.getElementById('upcart-app-container');
      if (container) {
        container.style.display = 'block';
        container.classList.add('upcart-active');
        this.isOpen = true;
        
        // Refresh cart content
        this.fetchCart().then(() => {
          this.updateCartDrawerContent();
        });
      }
    }

    closeDrawer() {
      console.log('🛒 Closing UpCart drawer');
      const container = document.getElementById('upcart-app-container');
      if (container) {
        container.style.display = 'none';
        container.classList.remove('upcart-active');
        this.isOpen = false;
      }
    }

    updateCartDrawerContent() {
      const cartPopup = document.getElementById('upcart-cart-popup');
      if (cartPopup) {
        // Update header count
        const headerText = cartPopup.querySelector('.upcart-header-text');
        if (headerText) {
          headerText.textContent = `Cart • ${this.cart?.item_count || 0}`;
        }
        
        // Update products section
        const productsSection = cartPopup.querySelector('.upcart-products-section');
        if (productsSection) {
          productsSection.innerHTML = this.renderCartItems();
        }
        
        // Update checkout button
        const checkoutButton = cartPopup.querySelector('.upcart-checkout-button');
        if (checkoutButton) {
          checkoutButton.textContent = `Checkout • ${this.formatMoney(this.cart?.total_price || 0)}`;
        }
        
        // Update free shipping if enabled
        if (this.settings.enableFreeShipping) {
          const freeShippingSection = cartPopup.querySelector('.upcart-free-shipping-section');
          if (freeShippingSection) {
            freeShippingSection.innerHTML = this.getFreeShippingHTML();
          }
        }
      }
    }

    createStickyCart() {
      const stickyCart = document.createElement('div');
      stickyCart.id = 'upcart-sticky-cart';
      stickyCart.innerHTML = `
        <div class="upcart-sticky-cart-content">
          <div class="upcart-sticky-cart-icon">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </div>
          <div class="upcart-sticky-cart-text">
            <span class="upcart-sticky-cart-count">${this.cart?.item_count || 0}</span> item(s) - 
            <span class="upcart-sticky-cart-total">${this.formatMoney(this.cart?.total_price || 0)}</span>
          </div>
          <button class="upcart-sticky-cart-button">View Cart</button>
        </div>
      `;
      
      document.body.appendChild(stickyCart);
      
      // Add click event to open drawer
      stickyCart.addEventListener('click', () => {
        this.openDrawer();
      });
      
      console.log('🛒 Sticky cart created');
    }

    createFreeShippingBar() {
      const freeShippingBar = document.createElement('div');
      freeShippingBar.id = 'upcart-free-shipping-bar';
      freeShippingBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999999 !important;
        background: #f8f8f8;
        padding: 12px 20px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;
      
      document.body.prepend(freeShippingBar);
      this.updateFreeShippingBar();
      
      console.log('🛒 Free shipping bar created');
    }

    getFreeShippingHTML() {
      if (!this.cart || !this.settings.enableFreeShipping) return '';
      
      const threshold = this.getNormalizedThreshold();
      const remaining = Math.max(0, threshold - this.cart.total_price);
      const progress = Math.min((this.cart.total_price / threshold) * 100, 100);
      
      if (remaining > 0) {
        const message = this.settings.shippingMessage.replace('{amount}', this.formatMoney(remaining));
        return `
          <div class="upcart-free-shipping-section">
            <div class="upcart-shipping-message">${message}</div>
            <div class="upcart-shipping-progress">
              <div class="upcart-shipping-progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="upcart-free-shipping-section upcart-shipping-success">
            <div class="upcart-shipping-message">${this.settings.shippingSuccessMessage}</div>
          </div>
        `;
      }
    }

    async fetchCart() {
      try {
        const response = await fetch('/cart.js');
        this.cart = await response.json();
        console.log('🛒 Cart fetched:', this.cart);
        return this.cart;
      } catch (error) {
        console.error('🛒 Error fetching cart:', error);
        return null;
      }
    }

    async updateQuantity(variantId, quantity) {
      try {
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: variantId,
            quantity: quantity
          })
        });
        
        this.cart = await response.json();
        this.updateCartDrawerContent();
        this.updateStickyCart();
        console.log('🛒 Cart updated:', this.cart);
        
      } catch (error) {
        console.error('🛒 Error updating cart:', error);
      }
    }

    updateStickyCart() {
      const stickyCart = document.getElementById('upcart-sticky-cart');
      if (stickyCart && this.cart) {
        const count = stickyCart.querySelector('.upcart-sticky-cart-count');
        const total = stickyCart.querySelector('.upcart-sticky-cart-total');
        
        if (count) count.textContent = this.cart.item_count;
        if (total) total.textContent = this.formatMoney(this.cart.total_price);
      }
    }

    updateFreeShippingBar() {
      const bar = document.getElementById('upcart-free-shipping-bar');
      if (!bar || !this.cart || !this.settings.enableFreeShipping) return;

      const threshold = this.getNormalizedThreshold();
      const remaining = Math.max(0, threshold - this.cart.total_price);
      const progress = Math.min((this.cart.total_price / threshold) * 100, 100);

      if (remaining > 0) {
        const message = this.settings.shippingMessage.replace('{amount}', this.formatMoney(remaining));
        bar.innerHTML = `
          <div>${message}</div>
          <div style="width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; margin-top: 8px;">
            <div style="width: ${progress}%; height: 100%; background: #28a745; border-radius: 2px; transition: width 0.3s ease;"></div>
          </div>
        `;
      } else {
        bar.innerHTML = `<div>${this.settings.shippingSuccessMessage}</div>`;
      }
    }

    getNormalizedThreshold() {
      // Clamp extreme values to prevent invisible progress bars
      const raw = Number(this.settings.freeShippingThreshold || 100);
      if (raw >= 100000) return 10000; // Cap at $100 if entered as cents
      return raw * 100; // Convert dollars to cents
    }

    listenToCartEvents() {
      // Listen to Shopify cart events
      document.addEventListener('cart:updated', (event) => {
        console.log('🛒 Cart updated event:', event);
        this.cart = event.detail;
        this.updateCartDrawerContent();
        this.updateStickyCart();
      });
      
      // Listen to theme cart open events
      document.addEventListener('cart:open', () => {
        console.log('🛒 Cart open event detected, opening UpCart instead');
        this.openDrawer();
      });
    }

    interceptAddToCart() {
      // Intercept add to cart forms
      document.addEventListener('submit', async (e) => {
        const form = e.target;
        if (form.action && form.action.includes('/cart/add')) {
          e.preventDefault();
          
          const formData = new FormData(form);
          const data = {};
          for (let [key, value] of formData.entries()) {
            data[key] = value;
          }
          
          await this.handleAddToCart(form);
        }
      });
    }

    async handleAddToCart(form) {
      try {
        const formData = new FormData(form);
        
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          await this.fetchCart();
          this.updateCartDrawerContent();
          this.updateStickyCart();
          this.openDrawer();
          console.log('🛒 Product added to cart');
        }
      } catch (error) {
        console.error('🛒 Error adding to cart:', error);
      }
    }

    formatMoney(cents) {
      // Basic formatting - ideally use Shopify's money format
      return '$' + (cents / 100).toFixed(2);
    }
  }

  // Initialize UpCart when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUpCart);
  } else {
    initUpCart();
  }

  function initUpCart() {
    console.log('🛒 Initializing UpCart...');
    console.log('🛒 Available settings:', window.UpCartSettings);
    
    if (window.UpCartSettings) {
      window.UpCart = new UpCartDrawer(window.UpCartSettings);
      console.log('🛒 UpCart instance created:', window.UpCart);
    } else {
      console.error('🛒 UpCartSettings not found!');
    }
  }

})();
