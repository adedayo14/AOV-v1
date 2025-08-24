(function() {
  'use strict';
  
  console.log('🛒 UpCart Clean script loaded!');
  console.log('🛒 Window settings available:', !!window.UpCartSettings);

  class UpCartDrawer {
    constructor(settings) {
      this.settings = settings || window.UpCartSettings;
      this.cart = null;
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
      console.log('🛒 Setting up UpCart with clean cart replacement...');
      
      // Fetch initial cart data FIRST
      await this.fetchCart();
      console.log('🛒 Cart data loaded:', this.cart);
      
      // Now create UI elements with cart data available
      this.createDrawer();
      
      // Set up clean cart replacement (no aggressive hijacking)
      this.setupCartReplacement();
      
      // Hide all existing theme cart drawers
      this.hideThemeCartElements();
      
      // Update the drawer content now that we have cart data
      this.updateDrawerContent();
      
      console.log('🛒 UpCart setup complete!');
    }

    setupCartReplacement() {
      console.log('🛒 Setting up clean cart replacement...');
      
      // Set up simple click interception for cart links
      this.interceptCartClicks();
      
      // Prevent theme cart drawer functions
      this.preventThemeCartDrawer();
      
      console.log('🛒 Clean cart replacement setup complete!');
    }

    hideThemeCartElements() {
      // Add CSS to hide theme cart drawers
      const style = document.createElement('style');
      style.id = 'upcart-theme-hiding';
      style.textContent = `
        /* Hide all potential theme cart drawers and overlays */
        .drawer[data-drawer="cart"],
        #cart-drawer,
        .cart-drawer,
        .js-drawer[data-drawer="cart"],
        .site-nav__cart-drawer,
        #CartDrawer,
        .cart-sidebar,
        .cart-popup,
        .header-cart-drawer,
        .theme-cart-drawer,
        [id*="cart-drawer"]:not(#upcart-cart-popup),
        [class*="cart-drawer"]:not(.upcart-cart),
        .drawer--cart,
        #cart-overlay,
        .cart-overlay,
        .overlay[data-drawer="cart"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        /* Ensure our cart drawer is always on top and visible when active */
        #upcart-app-container.upcart-active {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          z-index: 99999 !important;
        }
      `;
      
      // Remove existing style if it exists
      const existingStyle = document.getElementById('upcart-theme-hiding');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      document.head.appendChild(style);
      console.log('🛒 Theme cart elements hidden with CSS');
    }

    interceptCartClicks() {
      console.log('🛒 Setting up cart click interception...');
      
      // Simple cart selectors
      const cartSelectors = [
        '[data-cart-drawer-toggle]',
        '.cart-toggle', 
        '.js-drawer-open-cart',
        '.header__cart-toggle',
        '.cart-icon',
        '.cart-link',
        '[data-drawer-toggle="cart"]',
        '.cart-button',
        '#cart-icon-bubble',
        'a[href="/cart"]',
        'a[href*="/cart"]',
        '.header-cart',
        '[href="/cart"]',
        '.icon-cart'
      ];
      
      // Add click listeners to intercept cart clicks
      cartSelectors.forEach(selector => {
        document.addEventListener('click', (e) => {
          const target = e.target.closest(selector);
          if (target) {
            console.log('🛒 Intercepted cart click on:', target, 'selector matched:', target.matches(selector));
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Open our cart drawer instead
            this.openDrawer();
            return false;
          }
        }, true);
      });
      
      console.log('🛒 Cart click interception setup for selectors:', cartSelectors);
    }

    preventThemeCartDrawer() {
      // Prevent common theme cart drawer functions
      const preventFunctions = ['openCartDrawer', 'showCartDrawer', 'toggleCartDrawer', 'cart_drawer_open'];
      
      preventFunctions.forEach(funcName => {
        if (window[funcName]) {
          window[funcName] = function(...args) {
            console.log(`🛒 Prevented theme function: ${funcName}`);
            // Don't call the original function, open our drawer instead
            if (window.UpCart) {
              window.UpCart.openDrawer();
            }
            return false;
          };
        }
      });
    }

    createDrawer() {
      console.log('🛒 Creating UpCart drawer...');
      
      // Create container
      const existingContainer = document.getElementById('upcart-app-container');
      if (existingContainer) {
        console.log('🛒 Container already exists, updating...');
        return;
      }

      const container = document.createElement('div');
      container.id = 'upcart-app-container';
      container.innerHTML = `
        <div id="upcart-backdrop" class="upcart-backdrop"></div>
        <div id="upcart-cart-popup" class="upcart-cart-popup">
          <div class="upcart-cart">
            <div class="upcart-cart-header">
              <h2>Your Cart</h2>
              <button class="upcart-close-btn" aria-label="Close cart">×</button>
            </div>
            
            <div class="upcart-free-shipping-bar">
              <div class="upcart-progress">
                <div class="upcart-progress-fill"></div>
              </div>
              <div class="upcart-shipping-text">
                <span class="upcart-shipping-amount"></span>
              </div>
            </div>
            
            <div class="upcart-cart-items">
              <div class="upcart-loading">Loading cart...</div>
            </div>
            
            <div class="upcart-cart-footer">
              <div class="upcart-subtotal">
                <span>Subtotal: <strong class="upcart-subtotal-amount">$0.00</strong></span>
              </div>
              <button class="upcart-checkout-btn">Checkout</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);
      console.log('🛒 Drawer container created');

      // Add event listeners
      this.addDrawerEventListeners();
    }

    addDrawerEventListeners() {
      // Close button
      const closeBtn = document.querySelector('.upcart-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeDrawer());
      }

      // Backdrop click
      const backdrop = document.getElementById('upcart-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => this.closeDrawer());
      }

      // Checkout button
      const checkoutBtn = document.querySelector('.upcart-checkout-btn');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
          window.location.href = '/checkout';
        });
      }

      // Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeDrawer();
        }
      });
    }

    async fetchCart() {
      console.log('🛒 Fetching cart data...');
      try {
        const response = await fetch('/cart.js');
        this.cart = await response.json();
        console.log('🛒 Cart data fetched successfully:', this.cart);
      } catch (error) {
        console.error('🛒 Error fetching cart:', error);
        this.cart = { items: [], item_count: 0, total_price: 0 };
      }
    }

    updateDrawerContent() {
      if (!this.cart) return;

      console.log('🛒 Updating drawer content with cart:', this.cart);

      // Update items
      const itemsContainer = document.querySelector('.upcart-cart-items');
      if (itemsContainer) {
        if (this.cart.items && this.cart.items.length > 0) {
          itemsContainer.innerHTML = this.cart.items.map(item => `
            <div class="upcart-cart-item" data-variant-id="${item.variant_id}">
              <img src="${item.image}" alt="${item.product_title}" class="upcart-item-image">
              <div class="upcart-item-details">
                <h4 class="upcart-item-title">${item.product_title}</h4>
                <div class="upcart-item-variant">${item.variant_title || ''}</div>
                <div class="upcart-item-price">$${(item.final_price / 100).toFixed(2)}</div>
              </div>
              <div class="upcart-item-quantity">
                <input type="number" value="${item.quantity}" min="1" class="upcart-quantity-input" data-variant-id="${item.variant_id}">
                <button class="upcart-remove-btn" data-variant-id="${item.variant_id}">Remove</button>
              </div>
            </div>
          `).join('');
        } else {
          itemsContainer.innerHTML = '<div class="upcart-empty">Your cart is empty</div>';
        }
      }

      // Update subtotal
      const subtotalAmount = document.querySelector('.upcart-subtotal-amount');
      if (subtotalAmount) {
        subtotalAmount.textContent = `$${(this.cart.total_price / 100).toFixed(2)}`;
      }

      // Update free shipping progress
      this.updateFreeShippingProgress();
    }

    updateFreeShippingProgress() {
      if (!this.settings.enableFreeShipping) return;

      const threshold = this.settings.freeShippingThreshold * 100; // Convert to cents
      const current = this.cart.total_price;
      const remaining = Math.max(0, threshold - current);
      const progress = Math.min(100, (current / threshold) * 100);

      const progressFill = document.querySelector('.upcart-progress-fill');
      const shippingText = document.querySelector('.upcart-shipping-amount');

      if (progressFill) {
        progressFill.style.width = `${progress}%`;
      }

      if (shippingText) {
        if (remaining > 0) {
          shippingText.textContent = `Add $${(remaining / 100).toFixed(2)} more for free shipping!`;
        } else {
          shippingText.textContent = 'You qualify for free shipping!';
        }
      }
    }

    openDrawer() {
      console.log('🛒 openDrawer() called!');
      
      const container = document.getElementById('upcart-app-container');
      console.log('🛒 Found container element:', !!container, container);
      
      if (container) {
        console.log('🛒 Adding active class to container');
        container.classList.add('upcart-active');
        this.isOpen = true;
        
        console.log('🛒 Drawer should now be open, classes:', container.className);
        console.log('🛒 Container display:', window.getComputedStyle(container).display, 'pointer-events:', window.getComputedStyle(container).pointerEvents);
        
        // Refresh cart data when opening
        this.fetchCart().then(() => {
          this.updateDrawerContent();
        });
      } else {
        console.error('🛒 Container not found!');
      }
    }

    closeDrawer() {
      console.log('🛒 closeDrawer() called!');
      
      const container = document.getElementById('upcart-app-container');
      if (container) {
        container.classList.remove('upcart-active');
        this.isOpen = false;
        console.log('🛒 Drawer closed');
      }
    }

    // Utility methods
    async refreshCart() {
      await this.fetchCart();
      this.updateDrawerContent();
    }
  }

  // Initialize when DOM is ready
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

  initUpCart();

})();
