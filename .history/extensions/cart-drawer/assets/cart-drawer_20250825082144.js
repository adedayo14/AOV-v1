(function() {
  'use strict';
  
  console.log('🛒 UpCart script loaded!');
  console.log('🛒 Window settings available:', !!window.UpCartSettings);

  class UpCartDrawer {
    constructor(settings) {
      this.settings = settings || window.UpCartSettings;
      this.cart = null;
      this.isOpen = false;
      this.initPromise = this.init();
    }

    async init() {
      console.log('🛒 Initializing UpCart...');
      // Wait for DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      await this.setup();
    }

    async setup() {
      console.log('🛒 Setting up UpCart...');
      
      // Fetch initial cart data FIRST
      await this.fetchCart();
      console.log('🛒 Cart data loaded:', this.cart);
      
      // Check if we should only show on cart page
      const pathname = window.location.pathname.toLowerCase();
      const isCartPage = pathname === '/cart' || pathname === '/cart/';
      
      // Create cart drawer - it's needed for all pages when cart icon is clicked
      this.createDrawer();
      
      // Handle sticky cart based on settings
      if (this.settings.enableStickyCart && (!this.settings.showOnlyOnCartPage || isCartPage)) {
        console.log('🛒 Creating sticky cart...');
        this.createStickyCart();
      } else {
        // Remove existing sticky cart if disabled
        const existing = document.getElementById('upcart-sticky');
        if (existing) {
          existing.remove();
          console.log('🛒 Removed existing sticky cart (disabled)');
        }
      }
      
      // Set up cart replacement
      this.setupCleanCartReplacement();
      
      // Install auto-open functionality
      this.installAddToCartAutoOpen();
      
      // Hide theme cart drawers
      this.hideAllThemeCartDrawers();
      
      // Ensure drawer content is rendered properly
      this.ensureDrawerRendered();
      
      console.log('🛒 UpCart setup complete.');
    }

    setupCleanCartReplacement() {
      console.log('🛒 Setting up clean cart replacement...');
      
      // Hide theme cart elements with CSS
      this.hideThemeCartElements();
      
      // Set up cart click interception
      this.interceptCartClicks();
      
      console.log('🛒 Clean cart replacement setup complete!');
    }

    hideThemeCartElements() {
      const style = document.createElement('style');
      style.id = 'upcart-theme-hiding';
      style.textContent = `
        /* Hide all potential theme cart drawers */
        #CartDrawer:not(#upcart-cart-popup),
        .cart-drawer:not(.upcart-cart),
        .drawer--cart:not(.upcart-cart),
        [data-cart-drawer]:not([data-upcart-hidden]) {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
      console.log('🛒 Theme cart elements hidden with CSS');
    }

    interceptCartClicks() {
      console.log('🛒 Setting up cart click interception...');
      
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
      
      const flexSelectors = cartSelectors.join(',');
      
      document.addEventListener('click', (e) => {
        const target = e.target.closest(flexSelectors);
        if (target) {
          console.log('🛒 Intercepted cart click on:', target, 'selector matched:', !!target);
          e.preventDefault();
          e.stopPropagation();
          this.openDrawer();
          return false;
        }
      }, true);
      
      console.log('🛒 Cart click interception setup for selectors:', cartSelectors);
    }

    hideAllThemeCartDrawers() {
      console.log('🛒 Hiding ALL theme cart drawers...');
      
      const selectors = [
        '#CartDrawer', '.cart-drawer', '.drawer--cart',
        '#sidebar-cart', '.sidebar-cart', '#mini-cart'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (!el.id?.includes('upcart')) {
            console.log('🛒 Hiding theme cart:', selector, el);
            el.setAttribute('data-upcart-hidden', 'true');
          }
        });
      });
      
      this.addHidingCSS();
    }

    addHidingCSS() {
      if (document.getElementById('upcart-hiding-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'upcart-hiding-styles';
      style.textContent = `
        [data-upcart-hidden="true"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
      console.log('🛒 Added hiding CSS');
    }

    createStickyCart() {
      const existing = document.getElementById('upcart-sticky');
      if (existing) existing.remove();

      const stickyCart = document.createElement('div');
      stickyCart.id = 'upcart-sticky';
      stickyCart.className = `upcart-sticky ${this.settings.cartPosition}`;
      stickyCart.innerHTML = `
        <button class="upcart-trigger" aria-label="Open cart">
          ${this.getCartIcon()}
          <span class="upcart-count">${this.cart?.item_count || 0}</span>
          <span class="upcart-total">${this.formatMoney(this.cart?.total_price || 0)}</span>
        </button>
      `;
      
      document.body.appendChild(stickyCart);
      
      stickyCart.querySelector('.upcart-trigger').addEventListener('click', () => {
        this.openDrawer();
      });
    }

    createDrawer() {
      // Check if container exists from app-embed.liquid
      let container = document.getElementById('upcart-app-container');
      
      if (!container) {
        console.log('🛒 Creating new drawer container...');
        container = document.createElement('div');
        container.id = 'upcart-app-container';
        container.innerHTML = `
          <div id="upcart-backdrop" class="upcart-backdrop"></div>
          <div id="upcart-cart-popup" class="upcart-cart-popup"></div>
        `;
        document.body.appendChild(container);
      }
      
      // Ensure the popup exists and has the cart structure
      const popup = container.querySelector('#upcart-cart-popup');
      if (popup) {
        const drawerHTML = this.getDrawerHTML();
        console.log('🛒 Drawer HTML injected. Length:', drawerHTML.length);
        popup.innerHTML = drawerHTML;
      }
      
      this.attachDrawerEvents();
      
      // Verify render after creation
      setTimeout(() => this.ensureDrawerRendered('post-create timeout 1'), 100);
      setTimeout(() => this.ensureDrawerRendered('post-create timeout 2'), 500);
      setTimeout(() => this.ensureDrawerRendered('post-create timeout 3'), 1000);
    }

    getDrawerHTML() {
      const itemCount = this.cart?.item_count || 0;
      const totalPrice = this.cart?.total_price || 0;
      
      return `
        <div class="upcart-cart">
          <div class="upcart-header">
            <h3>Your Cart (${itemCount})</h3>
            <button class="upcart-close" aria-label="Close cart">×</button>
          </div>
          
          ${this.settings.enableFreeShipping ? `
            <div class="upcart-progress-section">
              ${this.getFreeShippingProgressHTML()}
            </div>
          ` : ''}
          
          <div class="upcart-items">
            ${this.getCartItemsHTML()}
          </div>
          
          <div class="upcart-footer">
            ${this.settings.enableDiscountCode ? `
              <div class="upcart-discount-section">
                <div class="upcart-discount-input-wrapper">
                  <input type="text" id="upcart-discount-code" class="upcart-discount-input" placeholder="Discount code" autocomplete="off">
                  <button type="button" class="upcart-discount-apply" onclick="window.upCartDrawer.applyDiscountCode()">Apply</button>
                </div>
                <div id="upcart-discount-message" class="upcart-discount-message"></div>
              </div>
            ` : ''}
            
            ${this.settings.enableNotes ? `
              <div class="upcart-notes-section">
                <label for="upcart-order-notes" class="upcart-notes-label">Add a note to your order</label>
                <textarea id="upcart-order-notes" class="upcart-notes-textarea" placeholder="Special instructions for your order..." rows="3" maxlength="500"></textarea>
              </div>
            ` : ''}
            
            <div class="upcart-subtotal">
              <span>Subtotal</span>
              <span class="upcart-subtotal-price">${this.formatMoney(totalPrice)}</span>
            </div>
            <div class="upcart-actions">
              <button class="upcart-checkout" onclick="window.upCartDrawer.proceedToCheckout()">
                Checkout • ${this.formatMoney(totalPrice)}
              </button>
              <a href="/cart" class="upcart-view-cart">View cart</a>
            </div>
          </div>
        </div>
      `;
    }

    getFreeShippingProgressHTML() {
      if (!this.cart || !this.settings.enableFreeShipping) return '';
      
      const threshold = this.settings.freeShippingThreshold * 100;
      const currentTotal = this.cart.total_price;
      const remaining = Math.max(0, threshold - currentTotal);
      const progress = Math.min((currentTotal / threshold) * 100, 100);
      
      return `
        <div class="upcart-free-shipping-bar">
          <div class="upcart-free-shipping-text">
            ${remaining > 0 
              ? `🚚 You're ${this.formatMoney(remaining)} away from free shipping!`
              : `🎉 You qualify for free shipping!`}
          </div>
          <div class="upcart-progress-bar">
            <div class="upcart-progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="upcart-progress-remaining">
            ${remaining > 0 
              ? `Add ${this.formatMoney(remaining)} more for free shipping`
              : `You qualify for free shipping! 🎉`}
          </div>
        </div>
      `;
    }

    getCartItemsHTML() {
      if (!this.cart || !this.cart.items || this.cart.items.length === 0) {
        return `
          <div class="upcart-empty">
            <h4>Your cart is empty</h4>
            <p>Add some products to get started!</p>
          </div>
        `;
      }
      
      return `
        <div class="upcart-items-list">
          ${this.cart.items.map(item => `
            <div class="upcart-item" data-variant-id="${item.variant_id}">
              <div class="upcart-item-image">
                <img src="${item.image}" alt="${item.product_title}" loading="lazy">
              </div>
              <div class="upcart-item-details">
                <a href="${item.url}" class="upcart-item-title">${item.product_title}</a>
                ${item.variant_title ? `<div class="upcart-item-variant">${item.variant_title}</div>` : ''}
                <div class="upcart-item-price">${this.formatMoney(item.final_price)}</div>
                <div class="upcart-item-quantity">
                  <input type="number" class="upcart-quantity-input" value="${item.quantity}" min="0" data-variant-id="${item.variant_id}">
                  <button class="upcart-remove-btn" data-variant-id="${item.variant_id}">Remove</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    attachDrawerEvents() {
      const container = document.getElementById('upcart-app-container');
      if (!container) return;
      
      // Close button
      const closeBtn = container.querySelector('.upcart-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeDrawer());
      }
      
      // Backdrop
      const backdrop = container.querySelector('#upcart-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => this.closeDrawer());
      }
      
      // Quantity controls
      container.addEventListener('change', (e) => {
        if (e.target.classList.contains('upcart-quantity-input')) {
          const variantId = e.target.dataset.variantId;
          const quantity = Math.max(0, parseInt(e.target.value) || 0);
          this.updateQuantity(variantId, quantity);
        }
      });
      
      container.addEventListener('click', (e) => {
        if (e.target.classList.contains('upcart-remove-btn')) {
          const variantId = e.target.dataset.variantId;
          this.updateQuantity(variantId, 0);
        }
      });
      
      // Load existing order notes
      this.loadOrderNotes();
    }

    ensureDrawerRendered(context = '') {
      const popup = document.querySelector('#upcart-cart-popup');
      if (!popup) return;
      
      const cart = popup.querySelector('.upcart-cart');
      const isBlank = !cart || cart.innerHTML.trim() === '';
      
      // Check specific elements
      const checkElements = {
        hasHeader: !!popup.querySelector('.upcart-header'),
        hasItemsWrapper: !!popup.querySelector('.upcart-items'),
        hasFooter: !!popup.querySelector('.upcart-footer'),
        textLength: popup.textContent?.length || 0
      };
      
      console.log('🛒 ensureDrawerRendered check. Context:', context, 'isBlank:', isBlank, checkElements);
      
      if (isBlank && this.cart) {
        console.log('🛒 Drawer is blank, re-rendering...');
        popup.innerHTML = this.getDrawerHTML();
        this.attachDrawerEvents();
      }
      
      // Log progress bar status
      const progressBar = popup.querySelector('.upcart-progress-bar');
      if (progressBar && this.settings.enableFreeShipping) {
        const progressFill = progressBar.querySelector('.upcart-progress-fill');
        console.log('🛒 Progress bar status:', {
          context,
          display: window.getComputedStyle(progressBar).display,
          opacity: window.getComputedStyle(progressBar).opacity,
          visibility: window.getComputedStyle(progressBar).visibility,
          height: window.getComputedStyle(progressBar).height,
          fillWidth: progressFill ? progressFill.style.width : 'N/A'
        });
      }
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

    async updateQuantity(variantId, quantity) {
      try {
        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: variantId, quantity })
        });
        
        if (response.ok) {
          await this.fetchCart();
          this.updateDrawerContent();
        }
      } catch (error) {
        console.error('🛒 Error updating quantity:', error);
      }
    }

    updateDrawerContent() {
      console.log('🛒 updateDrawerContent() start. Cart present:', !!this.cart, 'item_count:', this.cart?.item_count);
      
      const popup = document.querySelector('#upcart-cart-popup');
      if (!popup || !this.cart) return;
      
      // Check if drawer was open before updating content
      const existingDrawer = popup.querySelector('.upcart-cart');
      const wasOpen = existingDrawer && existingDrawer.classList.contains('is-open');
      
      // Update the entire drawer content
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();
      this.loadOrderNotes(); // ensure textarea gets prefilled after re-render
      
      // Restore the open state if it was open before
      if (wasOpen) {
        const newDrawer = popup.querySelector('.upcart-cart');
        if (newDrawer) {
          newDrawer.classList.add('is-open');
        }
      }
      
      // Update sticky cart if exists
      const count = document.querySelector('.upcart-count');
      const total = document.querySelector('.upcart-total');
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);
      
      this.ensureDrawerRendered('after updateDrawerContent');
    }

    updateDrawerContentForAutoOpen() {
      // Special version for auto-open that doesn't interfere with animation states
      console.log('🛒 updateDrawerContentForAutoOpen() start. Cart present:', !!this.cart, 'item_count:', this.cart?.item_count);
      
      const popup = document.querySelector('#upcart-cart-popup');
      if (!popup || !this.cart) return;
      
      // Simply update the content without preserving any animation states
      // since this is called before opening
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();
      this.loadOrderNotes();
      
      // Update sticky cart if exists
      const count = document.querySelector('.upcart-count');
      const total = document.querySelector('.upcart-total');
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);
    }

    openDrawer() {
      console.log('🛒 openDrawer() called!');
      
      const container = document.getElementById('upcart-app-container');
      if (!container) return;

      container.classList.add('upcart-active');

      // Ensure content exists before showing
      const popup = container.querySelector('#upcart-cart-popup');
      if (!popup || !popup.querySelector('.upcart-cart')) {
        popup.innerHTML = this.getDrawerHTML();
        this.attachDrawerEvents();
        this.loadOrderNotes();
      }

      // Trigger the slide-in now (not at creation time)
      const drawer = container.querySelector('.upcart-cart');
      if (drawer) drawer.classList.add('is-open');

      this.isOpen = true;
    }

    closeDrawer() {
      console.log('🛒 closeDrawer() called!');
      
      const container = document.getElementById('upcart-app-container');
      if (!container) {
        console.log('🛒 No container found for closing');
        return;
      }

      console.log('🛒 Container classes before close:', container.className);

      // Start the slide-out animation
      const drawer = container.querySelector('.upcart-cart');
      if (drawer) {
        console.log('🛒 Starting slide-out animation');
        drawer.classList.remove('is-open');
        drawer.classList.add('is-closing');
        
        // Remove the backdrop and container after animation completes
        setTimeout(() => {
          console.log('🛒 Removing backdrop after animation');
          container.classList.remove('upcart-active');
          drawer.classList.remove('is-closing');
          
          // Force hide the container to ensure backdrop disappears
          container.style.display = 'none';
          
          this.isOpen = false;
          console.log('🛒 Container classes after close:', container.className);
          
          // Force check the backdrop visibility
          const backdrop = container.querySelector('#upcart-backdrop');
          if (backdrop) {
            const backdropStyle = window.getComputedStyle(backdrop);
            console.log('🛒 Backdrop display after close:', backdropStyle.display, 'opacity:', backdropStyle.opacity);
          }
        }, 300); // Match the animation duration
      } else {
        console.log('🛒 No drawer found, fallback close');
        // Fallback if no drawer found
        container.classList.remove('upcart-active');
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
      const amount = (cents / 100).toFixed(2);
      
      if (window.UpCartMoneyFormat) {
        try {
          // Replace common Shopify money format patterns
          return window.UpCartMoneyFormat.replace(/\{\{\s*amount\s*\}\}/g, amount);
        } catch {
          // Fallback if format is invalid
        }
      }
      
      return '$' + amount;
    }

    async applyDiscountCode() {
      const discountInput = document.getElementById('upcart-discount-code');
      const messageDiv = document.getElementById('upcart-discount-message');
      
      if (!discountInput || !messageDiv) return;
      
      const discountCode = discountInput.value.trim();
      if (!discountCode) {
        this.showDiscountMessage('Please enter a discount code', 'error');
        return;
      }
      
      this.showDiscountMessage('Applying discount...', 'loading');
      
      // Use GET redirect which is how Shopify applies discount codes
      window.location.href = '/discount/' + encodeURIComponent(discountCode) + '?redirect=/cart';
    }
    
    showDiscountMessage(message, type = 'info') {
      const messageDiv = document.getElementById('upcart-discount-message');
      if (!messageDiv) return;
      
      messageDiv.textContent = message;
      messageDiv.className = `upcart-discount-message ${type}`;
      
      if (type === 'error' || type === 'success') {
        setTimeout(() => {
          messageDiv.textContent = '';
          messageDiv.className = 'upcart-discount-message';
        }, 3000);
      }
    }
    
    proceedToCheckout() {
      // Save order notes to cart attributes before checkout
      const notesTextarea = document.getElementById('upcart-order-notes');
      if (notesTextarea && notesTextarea.value.trim()) {
        const orderNotes = notesTextarea.value.trim();
        
        // Update cart with notes
        fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            attributes: {
              'Order Notes': orderNotes
            }
          })
        }).then(() => {
          window.location.href = '/checkout';
        }).catch(error => {
          console.error('Error saving order notes:', error);
          window.location.href = '/checkout';
        });
      } else {
        window.location.href = '/checkout';
      }
    }
    
    loadOrderNotes() {
      if (!this.settings.enableNotes) return;
      
      const notesTextarea = document.getElementById('upcart-order-notes');
      if (!notesTextarea) return;
      
      // Load existing order notes from cart attributes
      if (this.cart && this.cart.attributes && this.cart.attributes['Order Notes']) {
        notesTextarea.value = this.cart.attributes['Order Notes'];
      }
    }

    installAddToCartAutoOpen() {
      if (!this.settings.autoOpenCart || this._fetchPatched) return;
      this._fetchPatched = true;

      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        let url = args[0];
        try {
          // Normalise Request object
          if (url && typeof url === 'object' && 'url' in url) url = url.url;

          const isAddToCart =
            typeof url === 'string' &&
            (url.includes('/cart/add') || url.includes('/cart/add.js'));

          const resp = await origFetch.apply(window, args);

          if (isAddToCart && resp.ok) {
            // Give the theme a moment to finish its own updates
            setTimeout(async () => {
              try {
                await this.fetchCart();
                // Update content first, then open with proper animation
                this.updateDrawerContentForAutoOpen();
                this.openDrawer();
              } catch (e) {
                console.warn('UpCart auto-open after add failed:', e);
              }
            }, 50);
          }

          return resp;
        } catch (e) {
          return origFetch.apply(window, args);
        }
      };

      // Also listen for common theme events
      document.addEventListener('cart:added', () => {
        if (!this.settings.autoOpenCart) return;
        this.fetchCart().then(() => {
          this.updateDrawerContentForAutoOpen();
          this.openDrawer();
        });
      });

      document.addEventListener('product:added', () => {
        if (!this.settings.autoOpenCart) return;
        this.fetchCart().then(() => {
          this.updateDrawerContentForAutoOpen();
          this.openDrawer();
        });
      });

      console.log('🛒 Auto-open cart functionality installed');
    }
  }

  // Expose the constructor for the embed to call
  window.UpCartDrawer = UpCartDrawer;

  // Do NOT auto-create an instance here - let the embed handle initialization
  console.log('🛒 UpCartDrawer class exported to window');

})();