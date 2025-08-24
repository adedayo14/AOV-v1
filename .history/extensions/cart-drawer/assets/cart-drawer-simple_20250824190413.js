(function() {
  'use strict';
  
  console.log('🛒 UpCart script loaded!');
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
      console.log('🛒 Setting up UpCart...');
      
      // Fetch initial cart data FIRST
      await this.fetchCart();
      console.log('🛒 Cart data loaded:', this.cart);
      
      // Create the drawer
      this.createDrawer();
      
      // Set up cart interception
      this.setupCartInterception();
      
      // Update the drawer content
      this.updateDrawerContent();
      
      console.log('🛒 UpCart setup complete!');
    }

    setupCartInterception() {
      console.log('🛒 Setting up cart click interception...');
      
      // Simple cart selectors
      const cartSelectors = [
        'a[href="/cart"]',
        'a[href*="/cart"]',
        '.cart-icon',
        '.cart-link',
        '.cart-toggle',
        '.header__cart-toggle',
        '#cart-icon-bubble',
        '.icon-cart'
      ];
      
      // Add click listeners to intercept cart clicks
      cartSelectors.forEach(selector => {
        document.addEventListener('click', (e) => {
          const target = e.target.closest(selector);
          if (target) {
            console.log('🛒 Intercepted cart click');
            e.preventDefault();
            e.stopPropagation();
            this.openDrawer();
            return false;
          }
        }, true);
      });
      
      console.log('🛒 Cart click interception setup complete');
    }

    createDrawer() {
      console.log('🛒 Creating UpCart drawer...');
      
      // Check if container already exists from app-embed
      let container = document.getElementById('upcart-app-container');
      
      if (!container) {
        container = document.createElement('div');
        container.id = 'upcart-app-container';
        document.body.appendChild(container);
      }
      
      // Always populate with content
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
      
      console.log('🛒 Drawer created');
      
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

      console.log('🛒 Updating drawer content');

      // Update items
      const itemsContainer = document.querySelector('.upcart-cart-items');
      if (itemsContainer) {
        if (this.cart.items && this.cart.items.length > 0) {
          itemsContainer.innerHTML = this.cart.items.map(item => `
            <div class="upcart-cart-item">
              <img src="${item.image}" alt="${item.product_title}" class="upcart-item-image">
              <div class="upcart-item-details">
                <h4 class="upcart-item-title">${item.product_title}</h4>
                <div class="upcart-item-variant">${item.variant_title || ''}</div>
                <div class="upcart-item-price">$${(item.final_price / 100).toFixed(2)}</div>
              </div>
              <div class="upcart-item-quantity">
                <span>Qty: ${item.quantity}</span>
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
      if (!this.settings || !this.settings.enableFreeShipping) return;

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
      console.log('🛒 Opening drawer');
      
      const container = document.getElementById('upcart-app-container');
      if (container) {
        container.classList.add('upcart-active');
        this.isOpen = true;
        
        // Refresh cart data when opening
        this.fetchCart().then(() => {
          this.updateDrawerContent();
        });
      }
    }

    closeDrawer() {
      console.log('🛒 Closing drawer');
      
      const container = document.getElementById('upcart-app-container');
      if (container) {
        container.classList.remove('upcart-active');
        this.isOpen = false;
      }
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
