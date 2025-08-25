(function() {
  'use strict';
  
  console.log('🛒 Cart Uplift script initialized');

  class CartUpliftDrawer {
    constructor(settings) {
      this.settings = settings || window.CartUpliftSettings || {};
      this.cart = null;
      this.isOpen = false;
      this.isAnimating = false;
      this.init();
    }

    async init() {
      console.log('🛒 Initializing Cart Uplift...');
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }
      await this.setup();
    }

    async setup() {
      console.log('🛒 Setting up Cart Uplift...');
      
      // Fetch initial cart data
      await this.fetchCart();
      console.log('🛒 Cart loaded:', this.cart);
      
      // Create drawer structure
      this.createDrawer();
      
      // Set up sticky cart if enabled
      const pathname = window.location.pathname.toLowerCase();
      const isCartPage = pathname === '/cart' || pathname === '/cart/';
      
      if (this.settings.enableStickyCart && (!this.settings.showOnlyOnCartPage || isCartPage)) {
        this.createStickyCart();
      }
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Hide theme cart drawers
      this.hideThemeCartDrawers();
      
      // Monitor add to cart
      this.monitorAddToCart();
      
      console.log('🛒 Setup complete');
    }

    createDrawer() {
      // Remove existing container if present
      const existing = document.getElementById('cartuplift-app-container');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.id = 'cartuplift-app-container';
      container.className = 'cartuplift-container';
      container.innerHTML = `
        <div id="cartuplift-backdrop" class="cartuplift-backdrop"></div>
        <div id="cartuplift-cart-popup" class="cartuplift-cart-popup">
          <div class="cartuplift-drawer">
            ${this.getDrawerHTML()}
          </div>
        </div>
      `;
      
      document.body.appendChild(container);
      this.attachDrawerEvents();
    }

    getDrawerHTML() {
      const itemCount = this.cart?.item_count || 0;
      const totalPrice = this.cart?.total_price || 0;
      
      return `
        <!-- Header -->
        <div class="cartuplift-header">
          <h2 class="cartuplift-title">CART (${itemCount})</h2>
          <button class="cartuplift-close" aria-label="Close cart">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Free Shipping Bar -->
        ${this.settings.enableFreeShipping ? this.getFreeShippingHTML() : ''}

        <!-- Cart Items -->
        <div class="cartuplift-items">
          ${this.getCartItemsHTML()}
        </div>

        <!-- Recommendations -->
        ${this.settings.enableUpsells ? this.getRecommendationsHTML() : ''}

        <!-- Add-ons -->
        ${this.settings.enableAddons ? this.getAddonsHTML() : ''}

        <!-- Footer -->
        <div class="cartuplift-footer">
          ${this.settings.enableDiscountCode ? this.getDiscountHTML() : ''}
          ${this.settings.enableNotes ? this.getNotesHTML() : ''}
          
          <div class="cartuplift-subtotal">
            <span>Subtotal</span>
            <span class="cartuplift-subtotal-amount">${this.formatMoney(totalPrice)}</span>
          </div>
          
          <button class="cartuplift-checkout-btn" onclick="window.location.href='/checkout'">
            CHECKOUT
          </button>
          
          ${this.settings.enableExpressCheckout ? `
            <div class="cartuplift-express-checkout">
              <button class="cartuplift-paypal-btn">
                <img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" alt="PayPal">
              </button>
              <button class="cartuplift-shoppay-btn">
                <span>Shop</span><span>Pay</span>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }

    getFreeShippingHTML() {
      if (!this.cart) return '';
      
      const threshold = this.settings.freeShippingThreshold * 100;
      const current = this.cart.total_price;
      const remaining = Math.max(0, threshold - current);
      const progress = Math.min(100, (current / threshold) * 100);
      
      return `
        <div class="cartuplift-shipping-bar">
          <div class="cartuplift-shipping-message">
            ${remaining > 0 
              ? `You're ${this.formatMoney(remaining)} away from free shipping!`
              : `You've earned free shipping!`}
          </div>
          <div class="cartuplift-shipping-progress">
            <div class="cartuplift-shipping-progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>
      `;
    }

    getCartItemsHTML() {
      if (!this.cart || !this.cart.items || this.cart.items.length === 0) {
        return `
          <div class="cartuplift-empty">
            <p>Your cart is empty</p>
            <a href="/collections/all" class="cartuplift-continue-shopping">Continue Shopping</a>
          </div>
        `;
      }

      return this.cart.items.map((item, index) => `
        <div class="cartuplift-item" data-line="${index + 1}">
          <div class="cartuplift-item-image">
            <img src="${item.image}" alt="${item.product_title}">
          </div>
          <div class="cartuplift-item-details">
            <h3 class="cartuplift-item-title">${item.product_title}</h3>
            ${item.variant_title ? `<p class="cartuplift-item-variant">Color: ${item.variant_title}</p>` : ''}
            ${item.options_with_values ? `<p class="cartuplift-item-size">Size: ${item.options_with_values.find(o => o.name === 'Size')?.value || ''}</p>` : ''}
            
            <div class="cartuplift-item-controls">
              <div class="cartuplift-quantity">
                <button class="cartuplift-qty-minus" data-line="${index + 1}">−</button>
                <input type="number" class="cartuplift-qty-input" value="${item.quantity}" min="0" data-line="${index + 1}">
                <button class="cartuplift-qty-plus" data-line="${index + 1}">+</button>
              </div>
            </div>
          </div>
          <div class="cartuplift-item-price">
            <span>${this.formatMoney(item.final_line_price)}</span>
            <button class="cartuplift-item-remove" data-line="${index + 1}" aria-label="Remove item">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');
    }

    getRecommendationsHTML() {
      const layout = this.settings.recommendationLayout || 'row';
      
      // Mock recommendations - in production, fetch from your API
      const recommendations = [
        { id: 1, title: 'Anytime Ankle Sock', price: 1600, image: 'https://via.placeholder.com/100', colors: ['white', 'black', 'blue', 'grey'] },
        { id: 2, title: 'Crew Sock', price: 1800, image: 'https://via.placeholder.com/100', colors: ['black', 'white'] }
      ];

      if (layout === 'row') {
        return `
          <div class="cartuplift-recommendations cartuplift-recommendations-row">
            <div class="cartuplift-recommendations-header">
              <h3>RECOMMENDED FOR YOU</h3>
              <button class="cartuplift-recommendations-toggle" aria-label="Toggle recommendations">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M6 8L10 12L14 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <div class="cartuplift-recommendations-scroll">
              ${recommendations.map(product => `
                <div class="cartuplift-recommendation-card">
                  <img src="${product.image}" alt="${product.title}">
                  <h4>${product.title}</h4>
                  <p class="cartuplift-recommendation-price">${this.formatMoney(product.price)}</p>
                  <div class="cartuplift-recommendation-colors">
                    ${product.colors.map(color => `<span class="cartuplift-color-dot" style="background: ${color}"></span>`).join('')}
                  </div>
                  <div class="cartuplift-recommendation-size">
                    <select>
                      <option>Size: S (UK W2-4.5)</option>
                      <option>Size: M (UK W5-7.5)</option>
                      <option>Size: L (UK W8-10.5)</option>
                    </select>
                  </div>
                  <button class="cartuplift-add-recommendation" data-product-id="${product.id}">Add+</button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        return `
          <div class="cartuplift-recommendations cartuplift-recommendations-column">
            <h3 class="cartuplift-recommendations-title">RECOMMENDED FOR YOU</h3>
            ${recommendations.map(product => `
              <div class="cartuplift-recommendation-item">
                <img src="${product.image}" alt="${product.title}">
                <div class="cartuplift-recommendation-info">
                  <h4>${product.title}</h4>
                  <p class="cartuplift-recommendation-price">${this.formatMoney(product.price)}</p>
                </div>
                <button class="cartuplift-add-recommendation-circle" data-product-id="${product.id}">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            `).join('')}
          </div>
        `;
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
          <input type="text" class="cartuplift-discount-input" placeholder="Discount code">
          <button class="cartuplift-discount-apply">Apply</button>
        </div>
      `;
    }

    getNotesHTML() {
      return `
        <div class="cartuplift-notes">
          <textarea class="cartuplift-notes-input" placeholder="Add a note to your order..." rows="2"></textarea>
        </div>
      `;
    }

    createStickyCart() {
      const existing = document.getElementById('cartuplift-sticky');
      if (existing) existing.remove();

      const sticky = document.createElement('div');
      sticky.id = 'cartuplift-sticky';
      sticky.className = `cartuplift-sticky ${this.settings.cartPosition}`;
      sticky.innerHTML = `
        <button class="cartuplift-sticky-btn" aria-label="Open cart">
          ${this.getCartIcon()}
          <span class="cartuplift-sticky-count">${this.cart?.item_count || 0}</span>
          <span class="cartuplift-sticky-total">${this.formatMoney(this.cart?.total_price || 0)}</span>
        </button>
      `;
      
      document.body.appendChild(sticky);
      
      sticky.querySelector('.cartuplift-sticky-btn').addEventListener('click', () => {
        this.openDrawer();
      });
    }

    attachDrawerEvents() {
      const container = document.getElementById('cartuplift-app-container');
      if (!container) return;

      // Close button
      container.querySelector('.cartuplift-close')?.addEventListener('click', () => {
        this.closeDrawer();
      });

      // Backdrop click
      container.querySelector('#cartuplift-backdrop')?.addEventListener('click', () => {
        this.closeDrawer();
      });

      // Quantity controls
      container.addEventListener('click', (e) => {
        if (e.target.classList.contains('cartuplift-qty-minus')) {
          const line = e.target.dataset.line;
          const input = container.querySelector(`.cartuplift-qty-input[data-line="${line}"]`);
          const newQty = Math.max(0, parseInt(input.value) - 1);
          this.updateQuantity(line, newQty);
        }
        
        if (e.target.classList.contains('cartuplift-qty-plus')) {
          const line = e.target.dataset.line;
          const input = container.querySelector(`.cartuplift-qty-input[data-line="${line}"]`);
          const newQty = parseInt(input.value) + 1;
          this.updateQuantity(line, newQty);
        }
        
        if (e.target.classList.contains('cartuplift-item-remove') || e.target.closest('.cartuplift-item-remove')) {
          const btn = e.target.closest('.cartuplift-item-remove') || e.target;
          const line = btn.dataset.line;
          this.updateQuantity(line, 0);
        }

        if (e.target.classList.contains('cartuplift-add-recommendation')) {
          // Handle recommendation add
          console.log('Add recommendation:', e.target.dataset.productId);
        }
      });

      // Quantity input change
      container.addEventListener('change', (e) => {
        if (e.target.classList.contains('cartuplift-qty-input')) {
          const line = e.target.dataset.line;
          const quantity = Math.max(0, parseInt(e.target.value) || 0);
          this.updateQuantity(line, quantity);
        }
      });

      // ESC key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeDrawer();
        }
      });
    }

    setupEventListeners() {
      // Cart icon clicks
      document.addEventListener('click', (e) => {
        const cartLink = e.target.closest('a[href="/cart"], [data-cart-toggle], .cart-icon, #cart-icon-bubble');
        if (cartLink) {
          e.preventDefault();
          this.openDrawer();
        }
      }, true);
    }

    hideThemeCartDrawers() {
      const style = document.createElement('style');
      style.textContent = `
        #CartDrawer:not(#cartuplift-cart-popup),
        .cart-drawer:not(.cartuplift-drawer),
        [data-cart-drawer]:not(#cartuplift-app-container) {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    monitorAddToCart() {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        
        if (args[0] && typeof args[0] === 'string' && args[0].includes('/cart/add')) {
          setTimeout(() => {
            this.fetchCart().then(() => {
              this.updateDrawer();
              if (this.settings.autoOpenCart) {
                this.openDrawer();
              }
            });
          }, 200);
        }
        
        return response;
      };
    }

    async fetchCart() {
      try {
        const response = await fetch('/cart.js');
        this.cart = await response.json();
        return this.cart;
      } catch (error) {
        console.error('Error fetching cart:', error);
        this.cart = { items: [], item_count: 0, total_price: 0 };
        return this.cart;
      }
    }

    async updateQuantity(line, quantity) {
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
          this.updateDrawer();
        }
      } catch (error) {
        console.error('Error updating quantity:', error);
      }
    }

    updateDrawer() {
      const drawer = document.querySelector('.cartuplift-drawer');
      if (drawer) {
        drawer.innerHTML = this.getDrawerHTML();
        this.attachDrawerEvents();
      }

      // Update sticky cart
      const count = document.querySelector('.cartuplift-sticky-count');
      const total = document.querySelector('.cartuplift-sticky-total');
      if (count) count.textContent = this.cart?.item_count || 0;
      if (total) total.textContent = this.formatMoney(this.cart?.total_price || 0);
    }

    openDrawer() {
      if (this.isAnimating || this.isOpen) return;
      
      this.isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) return;

      // Show container
      container.style.display = 'block';
      
      // Force reflow
      void container.offsetHeight;
      
      // Add active class for animation
      container.classList.add('active');
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      setTimeout(() => {
        this.isAnimating = false;
        this.isOpen = true;
      }, 300);
    }

    closeDrawer() {
      if (this.isAnimating || !this.isOpen) return;
      
      this.isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) return;

      // Remove active class
      container.classList.remove('active');
      
      // Restore body scroll
      document.body.style.overflow = '';
      
      setTimeout(() => {
        container.style.display = 'none';
        this.isAnimating = false;
        this.isOpen = false;
      }, 300);
    }

    getCartIcon() {
      const icons = {
        bag: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M5 5h10l-.5 10h-9L5 5zm5-2a2 2 0 00-2 2h4a2 2 0 00-2-2z" fill="currentColor"/></svg>',
        cart: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M1 1h3l1 12h10l1-8H6M7 17a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" stroke="currentColor" fill="none"/></svg>',
        basket: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 7h14l-1 9H4L3 7zm4-3l1 3m6-3l-1 3" stroke="currentColor" fill="none"/></svg>'
      };
      return icons[this.settings.cartIcon] || icons.cart;
    }

    formatMoney(cents) {
      return '£' + (cents / 100).toFixed(2);
    }
  }

  // Initialize
  window.CartUpliftDrawer = CartUpliftDrawer;
  
  if (window.CartUpliftSettings) {
    window.cartUplift = new CartUpliftDrawer(window.CartUpliftSettings);
  }

})();