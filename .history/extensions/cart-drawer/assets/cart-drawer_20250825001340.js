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
    }    async fetchCart() {
      try {
        const response = await fetch('/cart.js');
        this.cart = await response.json();
        return this.cart;
      } catch (error) {
        console.error('UpCart: Error fetching cart', error);
        // Provide fallback empty cart
        this.cart = {
          item_count: 0,
          total_price: 0,
          items: []
        };
        return this.cart;
      }
    }

    createStickyCart() {
      // Remove existing if any
      const existing = document.getElementById('upcart-sticky');
      if (existing) existing.remove();

      // Create sticky cart button
      const stickyCart = document.createElement('div');
      stickyCart.id = 'upcart-sticky';
      stickyCart.className = `upcart-sticky ${this.settings.cartPosition}`;
      stickyCart.innerHTML = `
        <button class="upcart-trigger" aria-label="Open cart">
          ${this.getCartIcon()}
          <span class="upcart-count">${this.cart ? this.cart.item_count : 0}</span>
          <span class="upcart-total">${this.formatMoney(this.cart ? this.cart.total_price : 0)}</span>
        </button>
      `;
      
      document.body.appendChild(stickyCart);
      
      // Create drawer
      this.createDrawer();
      
      // Add click handler
      stickyCart.querySelector('.upcart-trigger').addEventListener('click', () => {
        this.toggleDrawer();
      });
    }

    createDrawer() {
      const existing = document.getElementById('upcart-drawer');
      if (existing) existing.remove();

      const drawer = document.createElement('div');
      drawer.id = 'upcart-drawer';
      drawer.className = 'upcart-drawer';
      drawer.innerHTML = `
        <div class="upcart-drawer-overlay"></div>
        <div class="upcart-drawer-content">
          <div class="upcart-drawer-header">
            <h3>Your Cart (<span class="upcart-drawer-count">${this.cart ? this.cart.item_count : 0}</span>)</h3>
            <button class="upcart-drawer-close" aria-label="Close cart">×</button>
          </div>
          
          ${this.settings.enableFreeShipping ? `
          <div class="upcart-free-shipping-section">
            <div class="upcart-shipping-content">
              <p class="upcart-shipping-message">${this.getShippingMessage()}</p>
              <div class="upcart-shipping-progress">
                <div class="upcart-shipping-progress-bar" style="width: ${this.getShippingProgress()}%"></div>
              </div>
            </div>
          </div>` : ''}
          
          <div class="upcart-drawer-items"></div>
          <div class="upcart-drawer-upsells"></div>
          <div class="upcart-drawer-footer">
            <div class="upcart-subtotal">
              <span>Subtotal:</span>
              <span class="upcart-subtotal-price">${this.formatMoney(this.cart ? this.cart.total_price : 0)}</span>
            </div>
            <div class="upcart-actions">
              <a href="/cart" class="upcart-view-cart">View Cart</a>
              <button class="upcart-checkout" onclick="window.location.href='/checkout'">
                Checkout • ${this.formatMoney(this.cart ? this.cart.total_price : 0)}
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(drawer);
      
      // Event listeners
      const closeBtn = drawer.querySelector('.upcart-drawer-close');
      const overlay = drawer.querySelector('.upcart-drawer-overlay');
      
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeDrawer());
      }
      
      if (overlay) {
        overlay.addEventListener('click', () => this.closeDrawer());
      }
      
      // Load cart items
      this.updateDrawerContent();
    }

    getShippingMessage() {
      if (!this.cart || !this.settings.enableFreeShipping) return '';
      
      const threshold = this.getNormalizedThreshold();
      const remaining = Math.max(0, threshold - this.cart.total_price);
      
      if (remaining > 0) {
        return this.settings.shippingMessage.replace('{amount}', this.formatMoney(remaining));
      } else {
        return this.settings.shippingSuccessMessage;
      }
    }

    getShippingProgress() {
      if (!this.cart || !this.settings.enableFreeShipping) return 0;
      
      const threshold = this.getNormalizedThreshold();
      return Math.min((this.cart.total_price / threshold) * 100, 100);
    }

    getNormalizedThreshold() {
      // Clamp extreme values to prevent invisible progress bars
      const raw = Number(this.settings.freeShippingThreshold || 100);
      if (raw >= 100000) return 10000; // Cap at $100 if entered as cents
      return raw * 100; // Convert dollars to cents
    }

    updateDrawerContent() {
      try {
        const itemsContainer = document.querySelector('.upcart-drawer-items');
        if (!itemsContainer || !this.cart) return;

        if (this.cart.items.length === 0) {
          itemsContainer.innerHTML = `
            <div class="upcart-empty">
              <p>Your cart is empty</p>
              <a href="/collections/all" class="upcart-continue-shopping">Continue Shopping</a>
            </div>
          `;
        } else {
          // Safely render each item
          const itemsHTML = this.cart.items.map(item => {
            try {
              return `
              <div class="upcart-item" data-variant-id="${item.variant_id}" data-key="${item.key}">
                <img src="${item.image || ''}" alt="${(item.title || '').replace(/"/g, '&quot;')}" class="upcart-item-image">
                <div class="upcart-item-details">
                  <a href="${item.url}" class="upcart-item-title">${item.product_title}</a>
                  ${item.variant_title ? `<p class="upcart-item-variant">${item.variant_title}</p>` : ''}
                  <div class="upcart-item-price">${this.formatMoney(item.price)}</div>
                  <div class="upcart-quantity">
                    <button class="upcart-quantity-minus" data-variant-id="${item.variant_id}">−</button>
                    <input type="number" class="upcart-quantity-input" value="${item.quantity}" min="0" data-variant-id="${item.variant_id}">
                    <button class="upcart-quantity-plus" data-variant-id="${item.variant_id}">+</button>
                  </div>
                </div>
                <button class="upcart-item-remove" data-variant-id="${item.variant_id}" aria-label="Remove item">×</button>
              </div>`;
            } catch (err) {
              console.warn('Error rendering cart item:', item, err);
              return '';
            }
          }).join('');
          
          itemsContainer.innerHTML = itemsHTML;
        }

        // Update header count
        const drawerCount = document.querySelector('.upcart-drawer-count');
        if (drawerCount) {
          drawerCount.textContent = this.cart.item_count;
        }

        // Update subtotal
        const subtotal = document.querySelector('.upcart-subtotal-price');
        if (subtotal) {
          subtotal.textContent = this.formatMoney(this.cart.total_price);
        }

        // Update checkout button
        const checkoutBtn = document.querySelector('.upcart-checkout');
        if (checkoutBtn) {
          checkoutBtn.textContent = `Checkout • ${this.formatMoney(this.cart.total_price)}`;
        }

        // Update free shipping progress if enabled
        this.updateFreeShippingProgress();

        // Add quantity handlers
        this.attachQuantityHandlers();
        
        // Load upsells if enabled
        if (this.settings.enableUpsells) {
          this.loadUpsells();
        }
      } catch (error) {
        console.error('Error updating drawer content:', error);
      }
    }

    updateFreeShippingProgress() {
      const shippingSection = document.querySelector('.upcart-free-shipping-section');
      if (!shippingSection || !this.settings.enableFreeShipping) return;

      const message = shippingSection.querySelector('.upcart-shipping-message');
      const progressBar = shippingSection.querySelector('.upcart-shipping-progress-bar');
      
      if (message) {
        message.textContent = this.getShippingMessage();
      }
      
      if (progressBar) {
        progressBar.style.width = `${this.getShippingProgress()}%`;
      }
    }

    createFreeShippingBar() {
      const existing = document.getElementById('upcart-shipping-bar');
      if (existing) existing.remove();

      const bar = document.createElement('div');
      bar.id = 'upcart-shipping-bar';
      bar.className = 'upcart-shipping-bar';
      
      // Use high z-index to ensure it appears above headers
      bar.style.position = 'fixed';
      bar.style.top = '0';
      bar.style.left = '0';
      bar.style.right = '0';
      bar.style.zIndex = '999999';
      bar.style.background = '#f8f8f8';
      bar.style.padding = '12px 20px';
      bar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      
      document.body.prepend(bar);
      
      this.updateFreeShippingBar();
    }

    updateFreeShippingBar() {
      const bar = document.getElementById('upcart-shipping-bar');
      if (!bar || !this.cart) return;

      const threshold = this.getNormalizedThreshold();
      const remaining = Math.max(0, threshold - this.cart.total_price);
      const progress = Math.min((this.cart.total_price / threshold) * 100, 100);

      if (remaining > 0) {
        bar.innerHTML = `
          <div class="upcart-shipping-content">
            <p>${this.settings.shippingMessage.replace('{amount}', this.formatMoney(remaining))}</p>
            <div class="upcart-shipping-progress">
              <div class="upcart-shipping-progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>
        `;
      } else {
        bar.innerHTML = `
          <div class="upcart-shipping-content upcart-shipping-success">
            <p>${this.settings.shippingSuccessMessage}</p>
          </div>
        `;
      }
    }

    attachQuantityHandlers() {
      // Minus buttons
      document.querySelectorAll('.upcart-quantity-minus').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const variantId = e.target.dataset.variantId;
          const input = document.querySelector(`.upcart-quantity-input[data-variant-id="${variantId}"]`);
          const newQty = Math.max(0, parseInt(input.value) - 1);
          this.updateQuantity(variantId, newQty);
        });
      });

      // Plus buttons
      document.querySelectorAll('.upcart-quantity-plus').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const variantId = e.target.dataset.variantId;
          const input = document.querySelector(`.upcart-quantity-input[data-variant-id="${variantId}"]`);
          const newQty = parseInt(input.value) + 1;
          this.updateQuantity(variantId, newQty);
        });
      });

      // Input change
      document.querySelectorAll('.upcart-quantity-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const variantId = e.target.dataset.variantId;
          const newQty = Math.max(0, parseInt(e.target.value) || 0);
          this.updateQuantity(variantId, newQty);
        });
      });

      // Remove buttons
      document.querySelectorAll('.upcart-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const variantId = e.target.dataset.variantId;
          this.updateQuantity(variantId, 0);
        });
      });
    }

    async updateQuantity(variantId, quantity) {
      // Find the item in cart
      const item = this.cart.items.find(i => i.variant_id == variantId);
      if (!item) return;

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

        if (response.ok) {
          await this.fetchCart();
          this.updateUI();
        }
      } catch (error) {
        console.error('UpCart: Error updating quantity', error);
      }
    }

    async loadUpsells() {
      const container = document.querySelector('.upcart-drawer-upsells');
      if (!container) return;

      // Fetch upsell products from your backend
      try {
        const response = await fetch(`/api/upsells?shop=${this.settings.shopDomain}`);
        const upsells = await response.json();
        
        if (upsells && upsells.length > 0) {
          container.innerHTML = `
            <div class="upcart-upsells">
              <h4>You might also like</h4>
              <div class="upcart-upsells-grid">
                ${upsells.map(product => `
                  <div class="upcart-upsell-item">
                    <img src="${product.image}" alt="${product.title}">
                    <p>${product.title}</p>
                    <p class="upcart-upsell-price">${this.formatMoney(product.price)}</p>
                    <button class="upcart-add-upsell" data-variant-id="${product.variant_id}">
                      Add to Cart
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
          
          // Add click handlers for upsell products
          container.querySelectorAll('.upcart-add-upsell').forEach(btn => {
            btn.addEventListener('click', (e) => {
              this.addToCart(e.target.dataset.variantId, 1);
            });
          });
        }
      } catch (error) {
        console.error('UpCart: Error loading upsells', error);
      }
    }

    interceptAddToCart() {
      // Intercept form submissions
      document.addEventListener('submit', async (e) => {
        const form = e.target;
        if (form.action && form.action.includes('/cart/add')) {
          e.preventDefault();
          
          const formData = new FormData(form);
          const data = {};
          for (let [key, value] of formData.entries()) {
            data[key] = value;
          }
          
          await this.addToCart(data.id, data.quantity || 1);
        }
      });

      // Intercept AJAX add to cart (for themes using fetch)
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        
        if (args[0] && typeof args[0] === 'string' && args[0].includes('/cart/add')) {
          setTimeout(() => {
            this.fetchCart().then(() => {
              this.updateUI();
              this.openDrawer();
            });
          }, 100);
        }
        
        return response;
      };
    }

    async addToCart(variantId, quantity) {
      try {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: variantId,
            quantity: quantity
          })
        });

        if (response.ok) {
          await this.fetchCart();
          this.updateUI();
          this.openDrawer();
        }
      } catch (error) {
        console.error('UpCart: Error adding to cart', error);
      }
    }

    listenToCartEvents() {
      // Listen for theme cart update events
      document.addEventListener('cart:updated', () => {
        this.fetchCart().then(() => this.updateUI());
      });

      // Shopify cart AJAX API events
      document.addEventListener('cart:change', () => {
        this.fetchCart().then(() => this.updateUI());
      });
    }

    updateUI() {
      // Update all UI elements
      this.updateStickyCart();
      this.updateDrawerContent();
      this.updateFreeShippingBar();
    }

    updateStickyCart() {
      if (!this.cart) return;
      
      const count = document.querySelector('.upcart-count');
      const total = document.querySelector('.upcart-total');
      
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);
    }

    toggleDrawer() {
      if (this.isOpen) {
        this.closeDrawer();
      } else {
        this.openDrawer();
      }
    }

    openDrawer() {
      const drawer = document.getElementById('upcart-drawer');
      if (drawer) {
        drawer.classList.add('open');
        document.body.classList.add('upcart-drawer-open');
        this.isOpen = true;
      }
    }

    closeDrawer() {
      const drawer = document.getElementById('upcart-drawer');
      if (drawer) {
        drawer.classList.remove('open');
        document.body.classList.remove('upcart-drawer-open');
        this.isOpen = false;
      }
    }

    getCartIcon() {
      const icons = {
        bag: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6z"/></svg>',
        cart: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
        basket: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M5.5 21c.8 0 1.5-.7 1.5-1.5S6.3 18 5.5 18 4 18.7 4 19.5 4.7 21 5.5 21zm13 0c.8 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5-1.5.7-1.5 1.5.7 1.5 1.5 1.5zm-10-9l1.5-6h8l1.5 6H8.5z"/></svg>'
      };
      return icons[this.settings.cartIcon] || icons.cart;
    }

    formatMoney(cents) {
      // Basic formatting - ideally use Shopify's money format
      return '$' + (cents / 100).toFixed(2);
    }
  }

  // Initialize UpCart
  window.UpCart = new UpCartDrawer();
})();
