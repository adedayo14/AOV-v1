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
      const pathname = window.location.pathname.toLowerCase();
      const isCart = pathname === '/cart' || pathname === '/cart/';
      console.log('🛒 Cart page detection:', { pathname, isCart });
      return isCart;
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
      if (!this.cart || !this.cart.items || this.cart.items.length === 0) {
        return '<div class="upcart-empty-cart">Your cart is empty</div>';
      }
      
      return this.cart.items.map(item => `
        <div class="upcart-product-item" data-variant-id="${item.variant_id}">
          <div class="upcart-product-image">
            <img src="${item.featured_image?.url || item.image}" alt="${item.title}">
          </div>
          <div class="upcart-product-details">
            <h4 class="upcart-product-title">${item.title}</h4>
            <div class="upcart-product-price">${this.formatMoney(item.price)}</div>
            <div class="upcart-quantity-controls">
              <button class="upcart-quantity-minus" data-variant-id="${item.variant_id}">-</button>
              <input class="upcart-quantity-input" type="number" value="${item.quantity}" data-variant-id="${item.variant_id}">
              <button class="upcart-quantity-plus" data-variant-id="${item.variant_id}">+</button>
            </div>
          </div>
          <button class="upcart-remove-item" data-variant-id="${item.variant_id}">Remove</button>
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
    }

    hijackThemeCartDrawer() {
      console.log('🛒 Setting up theme cart drawer hijacking...');
      
      // Override theme cart drawer opening
      const originalAddEventListener = HTMLElement.prototype.addEventListener;
      HTMLElement.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click' && this.matches && this.matches('[data-cart-drawer-toggle], .cart-toggle, .js-drawer-open-cart')) {
          // Intercept cart drawer open clicks
          const newListener = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🛒 Intercepted cart drawer open, showing UpCart instead');
            window.UpCart.openDrawer();
          };
          return originalAddEventListener.call(this, type, newListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      // Watch for theme cart drawers and hide them
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Hide theme cart drawers when they appear
              const themeDrawers = node.querySelectorAll ? 
                node.querySelectorAll('#CartPopup, #cart-drawer, .cart-drawer:not(.upcart-cart)') : [];
              
              themeDrawers.forEach(drawer => {
                if (!drawer.classList.contains('upcart-cart')) {
                  console.log('🛒 Hiding theme cart drawer:', drawer);
                  drawer.style.display = 'none';
                }
              });
            }
          });
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
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
      if (cartPopup && this.cart) {
        // Update header count
        const headerText = cartPopup.querySelector('.upcart-header-text');
        if (headerText) {
          headerText.textContent = `Cart • ${this.cart.item_count}`;
        }
        
        // Update products section
        const productsSection = cartPopup.querySelector('.upcart-products-section');
        if (productsSection) {
          productsSection.innerHTML = this.renderCartItems();
        }
        
        // Update checkout button
        const checkoutButton = cartPopup.querySelector('.upcart-checkout-button');
        if (checkoutButton) {
          checkoutButton.textContent = `Checkout • ${this.formatMoney(this.cart.total_price)}`;
        }
        
        // Update free shipping if enabled
        if (this.settings.enableFreeShipping) {
          const freeShippingSection = cartPopup.querySelector('.upcart-free-shipping');
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
              <path d="M7 4V2a1 1 0 0 1 2 0v2h6V2a1 1 0 0 1 2 0v2h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1zM6 6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H6zm2 6a1 1 0 0 1 1-1h6a1 1 0 0 1 0 2H9a1 1 0 0 1-1-1z"/>
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
      const freeShippingThreshold = parseFloat(this.settings.freeShippingThreshold) || 50;
      const currentTotal = this.cart?.total_price ? parseFloat(this.cart.total_price) / 100 : 0;
      const remainingAmount = Math.max(0, freeShippingThreshold - currentTotal);
      
      const freeShippingBar = document.createElement('div');
      freeShippingBar.id = 'upcart-free-shipping-bar';
      
      if (remainingAmount > 0) {
        freeShippingBar.innerHTML = `
          <div class="upcart-shipping-message">
            Add ${this.formatMoney(remainingAmount * 100)} more for FREE shipping!
          </div>
          <div class="upcart-shipping-progress">
            <div class="upcart-shipping-progress-bar" style="width: ${Math.min(100, (currentTotal / freeShippingThreshold) * 100)}%"></div>
          </div>
        `;
      } else {
        freeShippingBar.innerHTML = `
          <div class="upcart-shipping-message upcart-shipping-achieved">
            🎉 You've qualified for FREE shipping!
          </div>
        `;
      }
      
      document.body.appendChild(freeShippingBar);
      console.log('🛒 Free shipping bar created');
    }

    getFreeShippingHTML() {
      const freeShippingThreshold = parseFloat(this.settings.freeShippingThreshold) || 50;
      const currentTotal = this.cart?.total_price ? parseFloat(this.cart.total_price) / 100 : 0;
      const remainingAmount = Math.max(0, freeShippingThreshold - currentTotal);
      
      if (remainingAmount > 0) {
        return `
          <div class="upcart-free-shipping">
            <div class="upcart-shipping-message">
              Add ${this.formatMoney(remainingAmount * 100)} more for FREE shipping!
            </div>
            <div class="upcart-shipping-progress">
              <div class="upcart-shipping-progress-bar" style="width: ${Math.min(100, (currentTotal / freeShippingThreshold) * 100)}%"></div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="upcart-free-shipping">
            <div class="upcart-shipping-message upcart-shipping-achieved">
              🎉 You've qualified for FREE shipping!
            </div>
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
      if (stickyCart) {
        const countElement = stickyCart.querySelector('.upcart-sticky-cart-count');
        const totalElement = stickyCart.querySelector('.upcart-sticky-cart-total');
        
        if (countElement) countElement.textContent = this.cart?.item_count || 0;
        if (totalElement) totalElement.textContent = this.formatMoney(this.cart?.total_price || 0);
      }
      
      // Update free shipping bar
      const freeShippingBar = document.getElementById('upcart-free-shipping-bar');
      if (freeShippingBar && this.settings.enableFreeShipping) {
        const freeShippingThreshold = parseFloat(this.settings.freeShippingThreshold) || 50;
        const currentTotal = this.cart?.total_price ? parseFloat(this.cart.total_price) / 100 : 0;
        const remainingAmount = Math.max(0, freeShippingThreshold - currentTotal);
        
        if (remainingAmount > 0) {
          freeShippingBar.innerHTML = `
            <div class="upcart-shipping-message">
              Add ${this.formatMoney(remainingAmount * 100)} more for FREE shipping!
            </div>
            <div class="upcart-shipping-progress">
              <div class="upcart-shipping-progress-bar" style="width: ${Math.min(100, (currentTotal / freeShippingThreshold) * 100)}%"></div>
            </div>
          `;
        } else {
          freeShippingBar.innerHTML = `
            <div class="upcart-shipping-message upcart-shipping-achieved">
              🎉 You've qualified for FREE shipping!
            </div>
          `;
        }
      }
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
      document.addEventListener('submit', (e) => {
        if (e.target.querySelector('[name="add"]')) {
          console.log('🛒 Add to cart form detected');
          e.preventDefault();
          this.handleAddToCart(e.target);
        }
      });
      
      // Intercept add to cart buttons
      document.addEventListener('click', (e) => {
        if (e.target.matches('[data-add-to-cart], .btn-add-to-cart, .product-form__cart-submit')) {
          console.log('🛒 Add to cart button detected');
          e.preventDefault();
          const form = e.target.closest('form') || e.target.closest('[data-product-form]');
          if (form) {
            this.handleAddToCart(form);
          }
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
          console.log('🛒 Product added to cart successfully');
        }
      } catch (error) {
        console.error('🛒 Error adding to cart:', error);
      }
    }

    formatMoney(cents) {
      const format = window.UpCartMoneyFormat || '${{amount}}';
      const amount = (cents / 100).toFixed(2);
      return format.replace(/\{\{amount\}\}/g, amount);
    }
  }

  // Initialize UpCart when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUpCart);
  } else {
    initUpCart();
  }

  function initUpCart() {
    if (window.UpCartSettings) {
      window.UpCart = new UpCartDrawer(window.UpCartSettings);
      console.log('🛒 UpCart initialized with settings:', window.UpCartSettings);
    } else {
      console.warn('🛒 UpCart settings not found');
    }
  }

})();
