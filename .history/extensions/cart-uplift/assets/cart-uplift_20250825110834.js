(function() {
  'use strict';
  
  console.log('🛒 Cart Uplift script loaded!');
  console.log('🛒 Window settings available:', !!window.CartUpliftSettings);

  class CartUpliftDrawer {
    constructor(settings) {
      this.settings = settings || window.CartUpliftSettings;
      this.cart = null;
      this.isOpen = false;
      this._unbindFns = [];
      this._isAnimating = false;
      this._eventsBound = false;
      this._quantityBusy = false;
      this._fetchPatched = false;
      this._themeAddBound = false;
      this.initPromise = this.init();
    }

    async init() {
      console.log('🛒 Initializing Cart Uplift...');
      // Wait for DOM
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
        const existing = document.getElementById('cartuplift-sticky');
        if (existing) {
          existing.remove();
          console.log('🛒 Removed existing sticky cart (disabled)');
        }
      }
      
      // Set up cart replacement
      this.setupCleanCartReplacement();
      
      // Install cart monitoring functionality
      this.installAddToCartMonitoring();
      
      // Check if we should reopen cart after discount application
      this.checkDiscountRedirect();
      
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

    checkDiscountRedirect() {
      // Check if we returned from discount application
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('cart_opened') === 'true') {
        console.log('🛒 Detected return from discount application, reopening cart...');
        
        // Clean up the URL
        const url = new URL(window.location);
        url.searchParams.delete('cart_opened');
        window.history.replaceState({}, document.title, url.toString());
        
        // Reopen the cart after a short delay to ensure everything is loaded
        setTimeout(() => {
          this.openDrawer();
        }, 500);
      }
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
      let container = document.getElementById('cartuplift-app-container');
      
      if (!container) {
        console.log('🛒 Creating new drawer container...');
        container = document.createElement('div');
        container.id = 'cartuplift-app-container';
        container.innerHTML = `
          <div id="cartuplift-backdrop" class="cartuplift-backdrop"></div>
          <div id="cartuplift-cart-popup" class="cartuplift-cart-popup"></div>
        `;
        document.body.appendChild(container);
      }
      
      // Ensure the popup exists and has the cart structure
      const popup = container.querySelector('#cartuplift-cart-popup');
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
                  <button type="button" class="upcart-discount-apply" onclick="window.cartUpliftDrawer.applyDiscountCode()">Apply</button>
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
              <button class="upcart-checkout" onclick="window.cartUpliftDrawer.proceedToCheckout()">
                Checkout • ${this.formatMoney(totalPrice)}
              </button>
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
          ${this.cart.items.map((item, index) => `
            <div class="upcart-item" data-variant-id="${item.variant_id}" data-line="${index + 1}">
              <div class="upcart-item-image">
                <img src="${item.image}" alt="${item.product_title}" loading="lazy">
              </div>
              <div class="upcart-item-details">
                <a href="${item.url}" class="upcart-item-title">${item.product_title}</a>
                ${item.variant_title ? `<div class="upcart-item-variant">${item.variant_title}</div>` : ''}
                <div class="upcart-item-price">${this.formatMoney(item.final_price)}</div>
                <div class="upcart-item-quantity">
                  <input type="number" class="upcart-quantity-input" value="${item.quantity}" min="0" data-line="${index + 1}" data-variant-id="${item.variant_id}">
                  <button class="upcart-remove-btn" data-line="${index + 1}" data-variant-id="${item.variant_id}">Remove</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    attachDrawerEvents() {
      const container = document.getElementById('cartuplift-app-container');
      if (!container) return;

      // Close button
      const closeBtn = container.querySelector('.upcart-close');
      if (closeBtn) {
        const closeHandler = () => this.closeDrawer();
        closeBtn.addEventListener('click', closeHandler);
        this._unbindFns.push(() => closeBtn.removeEventListener('click', closeHandler));
      }
      
      // Backdrop - add immediate cleanup when clicked
      const backdrop = container.querySelector('#cartuplift-backdrop');
      if (backdrop) {
        const backdropHandler = (e) => {
          e.stopPropagation();
          this.forceCleanThemeArtifacts(); // Immediate cleanup
          this.closeDrawer();
        };
        backdrop.addEventListener('click', backdropHandler);
        this._unbindFns.push(() => backdrop.removeEventListener('click', backdropHandler));
      }

      // Global document events (only bind once)
      if (!this._eventsBound) {
        // Close on Escape
        const onKey = (e) => { 
          if (e.key === 'Escape' && this.isOpen) this.closeDrawer(); 
        };
        document.addEventListener('keydown', onKey);
        this._unbindFns.push(() => document.removeEventListener('keydown', onKey));

        // Close on click outside the drawer (and not the sticky trigger)
        const onDocDown = (e) => {
          if (!this.isOpen) return;
          const insideDrawer = e.target.closest('.upcart-cart');
          const hitTrigger = e.target.closest('#cartuplift-sticky');
          if (!insideDrawer && !hitTrigger) {
            this.closeDrawer();
          }
        };
        // Use capture so we see the event before theme handlers stop it
        document.addEventListener('mousedown', onDocDown, true);
        this._unbindFns.push(() => document.removeEventListener('mousedown', onDocDown, true));

        this._eventsBound = true;
      }

      // Quantity controls
      const changeHandler = (e) => {
        if (e.target.classList.contains('upcart-quantity-input')) {
          const line = e.target.dataset.line;
          const quantity = Math.max(0, parseInt(e.target.value) || 0);
          console.log('🛒 Quantity change detected:', { line, quantity });
          this.updateQuantity(line, quantity);
        }
      };
      container.addEventListener('change', changeHandler);
      this._unbindFns.push(() => container.removeEventListener('change', changeHandler));
      
      const clickHandler = (e) => {
        if (e.target.classList.contains('upcart-remove-btn')) {
          const line = e.target.dataset.line;
          console.log('🛒 Remove button clicked:', { line });
          this.updateQuantity(line, 0);
        }
      };
      container.addEventListener('click', clickHandler);
      this._unbindFns.push(() => container.removeEventListener('click', clickHandler));
      
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

    async updateQuantity(line, quantity) {
      if (this._quantityBusy) return; // prevent multiple rapid updates
      this._quantityBusy = true;
      
      try {
        console.log('🛒 Updating quantity:', { line, quantity });
        
        // Show loading state
        const lineItem = document.querySelector(`[data-line="${line}"]`);
        if (lineItem) {
          lineItem.classList.add('loading');
          // Optional: show spinner or loading text
        }

        const formData = new FormData();
        formData.append('line', line);
        formData.append('quantity', quantity);

        const response = await fetch('/cart/change.js', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const cartData = await response.json();
        
        // Update cart data and refresh content
        this.cart = cartData;
        this.updateDrawerContent();
        
        // Remove loading state
        if (lineItem) {
          lineItem.classList.remove('loading');
        }
        
        console.log('🛒 Quantity updated successfully');
      } catch (error) {
        console.error('🛒 Error updating quantity:', error);
        // Remove loading state on error
        const lineItem = document.querySelector(`[data-line="${line}"]`);
        if (lineItem) {
          lineItem.classList.remove('loading');
        }
      } finally {
        this._quantityBusy = false; // release lock
      }
    }

    updateDrawerContent() {
      console.log('🛒 updateDrawerContent() start. Cart present:', !!this.cart, 'item_count:', this.cart?.item_count);
      
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup || !this.cart) {
        console.log('🛒 No popup found or no cart data in updateDrawerContent:', {popup: !!popup, cart: !!this.cart});
        return;
      }
      
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
      
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup || !this.cart) {
        console.log('🛒 No popup found or no cart data:', {popup: !!popup, cart: !!this.cart});
        return;
      }
      
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
      
      console.log('🛒 Drawer content updated for auto-open with', this.cart.item_count, 'items');
    }

    openDrawer() {
      if (this._isAnimating || this.isOpen) return; // guard
      console.log('🛒 openDrawer() called!');
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        this._isAnimating = false;
        return;
      }

      // Mark the page as having our drawer open (and neutralise theme scroll locks)
      document.documentElement.classList.add('cartuplift-drawer-open');
      document.body.classList.add('cartuplift-drawer-open');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';

      container.style.display = '';
      container.classList.add('cartuplift-active');

      // Ensure content exists before showing
      const popup = container.querySelector('#cartuplift-cart-popup');
      if (!popup || !popup.querySelector('.upcart-cart')) {
        popup.innerHTML = this.getDrawerHTML();
        this.attachDrawerEvents();
        this.loadOrderNotes();
      }

      const backdrop = container.querySelector('#cartuplift-backdrop');
      const drawer = container.querySelector('.upcart-cart');

      if (backdrop) backdrop.classList.remove('is-closing');
      if (drawer) {
        drawer.classList.remove('is-closing');
        drawer.classList.add('is-open');
      }

      // Start continuous monitoring for theme interference
      this.startBlurMonitoring();

      // Clean any theme artifacts that might interfere with our drawer
      setTimeout(() => {
        this.forceCleanThemeArtifacts();
      }, 0); // Immediate cleanup to prevent blur flash

      // ENHANCED: More aggressive cleanup for auto-open scenarios
      setTimeout(() => {
        this.forceCleanThemeArtifacts();
        console.log('🛒 100ms cleanup after open');
      }, 100);
      
      setTimeout(() => {
        this.forceCleanThemeArtifacts();
        console.log('🛒 300ms cleanup after open');
      }, 300);

      // Release animation lock immediately after classes are set
      const finish = () => { 
        this._isAnimating = false; 
        this.isOpen = true; 
      };
      setTimeout(finish, 0);
    }

    closeDrawer() {
      if (this._isAnimating || !this.isOpen) return; // guard
      console.log('🛒 closeDrawer() called!');
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        console.log('🛒 No container found for closing');
        this._isAnimating = false;
        return;
      }

      // IMMEDIATE cleanup to prevent any blur artifacts
      this.forceCleanThemeArtifacts();

      const drawer = container.querySelector('.upcart-cart');
      const backdrop = container.querySelector('#cartuplift-backdrop');

      // Start close animations
      if (drawer) {
        drawer.classList.remove('is-open');
        drawer.classList.add('is-closing');
      }
      if (backdrop) {
        backdrop.classList.add('is-closing');
      }

      // Aggressive periodic cleanup during close animation
      const cleanupInterval = setInterval(() => {
        this.forceCleanThemeArtifacts();
      }, 50); // Clean every 50ms during close

      // When animations end, fully reset state. Use animationend so timing stays in sync.
      const finishClose = () => {
        console.log('🛒 Finishing close - cleaning all theme artifacts');
        clearInterval(cleanupInterval); // Stop the periodic cleanup
        
        container.classList.remove('cartuplift-active');
        container.style.display = 'none';

        // Remove our own flags
        document.documentElement.classList.remove('cartuplift-drawer-open');
        document.body.classList.remove('cartuplift-drawer-open');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';

        // Clean animation classes for next time
        if (drawer) drawer.classList.remove('is-closing');
        if (backdrop) backdrop.classList.remove('is-closing');

        // ENHANCED cleanup - run multiple times to ensure it sticks
        this.forceCleanThemeArtifacts();
        setTimeout(() => this.forceCleanThemeArtifacts(), 50);
        setTimeout(() => this.forceCleanThemeArtifacts(), 150);
        setTimeout(() => this.forceCleanThemeArtifacts(), 300);

        // Stop blur monitoring
        this.stopBlurMonitoring();

        this.isOpen = false;
        this._isAnimating = false; // release lock
        console.log('🛒 Close cleanup complete');
      };

      const onEnd = (e) => {
        console.log('🛒 Animation ended, triggering cleanup');
        finishClose();
      };

      // Prefer animationend; fall back to a timeout as a safety net
      if (drawer) drawer.addEventListener('animationend', onEnd, { once: true });
      if (backdrop) backdrop.addEventListener('animationend', onEnd, { once: true });
      setTimeout(() => {
        console.log('🛒 Safety timeout triggered cleanup');
        finishClose();
      }, 400); // safety if animationend doesn't fire
    }

    forceCleanThemeArtifacts() {
      console.log('🛒 Force cleaning theme artifacts');
      
      // Proactively clear common theme artefact classes that cause blur/dimming/lock
      const leftoverClasses = [
        'js-drawer-open',
        'drawer-open', 
        'modal-open',
        'overflow-hidden',
        'no-scroll',
        'cart-open',
        'drawer-opened',
        'cart-drawer-open',
        'navigation-open',
        'scroll-lock',
        'popup-open',
        'sidebar-open',
        'menu-open',
        'drawer-is-open',
        'has-drawer-open',
        'overlay-active',
        'fixed',
        'locked',
        'noscroll',
        'no-scroll-y',
        'scroll-disabled',
        'modal-active',
        'dialog-open'
      ];
      
      leftoverClasses.forEach(cls => {
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
      });

      // Enhanced inline style cleanup
      const elementsToClean = [document.body, document.documentElement];
      elementsToClean.forEach(el => {
        if (el) {
          // Reset positioning and overflow
          el.style.position = '';
          el.style.top = '';
          el.style.left = '';
          el.style.overflow = '';
          el.style.overflowY = '';
          el.style.overflowX = '';
          el.style.height = '';
          el.style.width = '';
          el.style.maxHeight = '';
          el.style.paddingRight = '';
          el.style.marginRight = '';
          
          // Clear any filter/blur effects
          el.style.filter = '';
          el.style.webkitFilter = '';
          el.style.backdropFilter = '';
          el.style.webkitBackdropFilter = '';
          
          // Reset interaction and visibility
          el.style.pointerEvents = '';
          el.style.userSelect = '';
          el.style.touchAction = '';
          el.style.transform = '';
          el.style.opacity = '';
        }
      });
      
      // Force clear any potential filter/blur styles on ALL content containers
      const contentSelectors = [
        'main',
        '#MainContent', 
        '.main-content',
        '.site-content',
        '.page-content',
        '#main',
        '.main',
        'body > *:not(#cartuplift-app-container)',
        '.shopify-section',
        '.page-wrapper',
        '.site-wrapper',
        '.container',
        '.content-wrapper'
      ];
      
      contentSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (element && element.id !== 'cartuplift-app-container') {
            element.style.filter = '';
            element.style.webkitFilter = '';
            element.style.backdropFilter = '';
            element.style.webkitBackdropFilter = '';
            element.style.opacity = '';
            element.style.transform = '';
            element.style.pointerEvents = '';
            element.style.userSelect = '';
            element.style.touchAction = '';
            
            // Remove any blur classes
            const blurClasses = ['blur', 'blurred', 'dimmed', 'overlay-on'];
            blurClasses.forEach(cls => element.classList.remove(cls));
          }
        });
      });
      
      // Clear data attributes that themes might use to track state
      const dataAttrsToRemove = [
        'data-drawer-open',
        'data-cart-open',
        'data-modal-open',
        'data-overlay-open',
        'data-popup-open',
        'data-scroll-lock'
      ];
      
      dataAttrsToRemove.forEach(attr => {
        document.documentElement.removeAttribute(attr);
        document.body.removeAttribute(attr);
      });
      
      // Enhanced inert and aria-hidden cleanup
      document.querySelectorAll('[inert]').forEach(el => {
        if (!el.closest('#cartuplift-app-container')) {
          el.removeAttribute('inert');
        }
      });
      
      document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
        if (!el.closest('#cartuplift-app-container')) {
          el.removeAttribute('aria-hidden');
          el.style.pointerEvents = '';
          el.style.userSelect = '';
          el.style.touchAction = '';
        }
      });

      // Remove any theme overlay/backdrop elements
      const overlaySelectors = [
        '.drawer-overlay', '.modal-overlay', '.backdrop', '.overlay',
        '.cart-drawer-overlay', '.js-overlay', '.menu-overlay',
        '.site-overlay', '.page-overlay', '.theme-overlay',
        '[data-overlay]', '[data-backdrop]'
      ];
      
      overlaySelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (!el.closest('#cartuplift-app-container')) {
            el.style.display = 'none';
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '-1';
          }
        });
      });

      console.log('🛒 Enhanced theme artifact cleanup complete');
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
      
      // Store the current cart state and close the drawer
      this.closeDrawer();
      
      // Use Shopify's discount URL system but redirect back to current page
      const currentUrl = window.location.href;
      const redirectUrl = currentUrl.includes('?') ? 
        `${currentUrl}&cart_opened=true` : 
        `${currentUrl}?cart_opened=true`;
      
      // Apply discount and return to current page with flag to reopen cart
      window.location.href = `/discount/${encodeURIComponent(discountCode)}?redirect=${encodeURIComponent(redirectUrl)}`;
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

    installAddToCartMonitoring() {
      if (this._fetchPatched) return; // Prevent duplicate patching
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

          if (isAddToCart && resp.ok && !this._isAnimating) { // prevent during animations
            console.log('🛒 Add to cart detected, removing theme loading blur...');
            
            // IMMEDIATELY remove any theme loading blur/overlay
            this.removeThemeLoadingEffects();
            
            // Always update cart data in background
            setTimeout(async () => {
              try {
                await this.fetchCart();
                this.updateDrawerContentForAutoOpen();
                
                // Update sticky cart count if it exists
                const count = document.querySelector('.upcart-count');
                const total = document.querySelector('.upcart-total');
                if (count) count.textContent = this.cart.item_count;
                if (total) total.textContent = this.formatMoney(this.cart.total_price);
                
                console.log('🛒 Cart updated in background, item count:', this.cart.item_count);
                
                // Only auto-open if setting is enabled and drawer is not already open
                if (this.settings.autoOpenCart && !this.isOpen && !this._isAnimating) {
                  console.log('🛒 Auto-opening drawer...');
                  this.openDrawer();
                } else {
                  console.log('🛒 Auto-open disabled or drawer already open, cart updated silently');
                }
              } catch (e) {
                console.warn('UpCart cart update after add failed:', e);
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
        if (!this.settings.autoOpenCart || this._isAnimating) return;
        
        // Pre-cleanup for theme events
        this.forceCleanThemeArtifacts();
        
        this.fetchCart().then(() => {
          if (!this.isOpen && !this._isAnimating) { // double-check state
            this.forceCleanThemeArtifacts();
            this.updateDrawerContentForAutoOpen();
            this.openDrawer();
            
            // Post-cleanup for theme events
            setTimeout(() => this.forceCleanThemeArtifacts(), 100);
            setTimeout(() => this.forceCleanThemeArtifacts(), 300);
          }
        });
      });

      document.addEventListener('product:added', () => {
        if (!this.settings.autoOpenCart || this._isAnimating) return;
        
        // Pre-cleanup for theme events
        this.forceCleanThemeArtifacts();
        
        this.fetchCart().then(() => {
          if (!this.isOpen && !this._isAnimating) { // double-check state
            this.forceCleanThemeArtifacts();
            this.updateDrawerContentForAutoOpen();
            this.openDrawer();
            
            // Post-cleanup for theme events
            setTimeout(() => this.forceCleanThemeArtifacts(), 100);
            setTimeout(() => this.forceCleanThemeArtifacts(), 300);
          }
        });
      });
      
      console.log('🛒 Cart monitoring functionality installed (updates cart data on add-to-cart, auto-open based on settings)');
    }

    removeThemeLoadingEffects() {
      console.log('🛒 Removing theme loading effects...');
      
      // Remove common loading/blur classes from body and html
      const loadingClasses = [
        'loading',
        'adding-to-cart',
        'cart-loading',
        'product-loading',
        'form-loading',
        'overlay-loading',
        'blur-loading',
        'processing',
        'adding',
        'cart-busy'
      ];
      
      loadingClasses.forEach(cls => {
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
      });

      // Remove loading attributes
      const loadingAttrs = [
        'data-loading',
        'data-cart-loading',
        'data-adding-to-cart',
        'data-processing'
      ];
      
      loadingAttrs.forEach(attr => {
        document.documentElement.removeAttribute(attr);
        document.body.removeAttribute(attr);
      });

      // Clear any loading-related inline styles that cause blur
      const elementsToCheck = document.querySelectorAll('main, #MainContent, .shopify-section, .page-wrapper, .site-wrapper, .container');
      elementsToCheck.forEach(el => {
        // Remove filter/blur effects that might be loading states
        const computedStyle = window.getComputedStyle(el);
        if (computedStyle.filter && computedStyle.filter.includes('blur')) {
          console.log('🛒 Removing loading blur from:', el.tagName, el.className);
          el.style.filter = '';
          el.style.webkitFilter = '';
        }
        if (computedStyle.backdropFilter && computedStyle.backdropFilter.includes('blur')) {
          console.log('🛒 Removing loading backdrop blur from:', el.tagName, el.className);
          el.style.backdropFilter = '';
          el.style.webkitBackdropFilter = '';
        }
        
        // Remove loading classes from individual elements
        loadingClasses.forEach(cls => el.classList.remove(cls));
      });

      // Remove any loading overlays
      const loadingOverlays = document.querySelectorAll('.loading-overlay, .cart-loading-overlay, .add-to-cart-overlay, [data-loading-overlay]');
      loadingOverlays.forEach(overlay => {
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        overlay.style.pointerEvents = 'none';
      });

      console.log('🛒 Theme loading effects removed');
    }

    startBlurMonitoring() {
      if (this._blurMonitor) return; // already monitoring
      
      console.log('🛒 Starting blur monitoring...');
      
      // Monitor for blur effects being applied while drawer is open
      // Reduced frequency to improve performance
      this._blurMonitor = setInterval(() => {
        if (this.isOpen) {
          this.detectAndRemoveBlur();
        }
      }, 250); // Check every 250ms instead of 100ms for better performance
    }

    stopBlurMonitoring() {
      if (this._blurMonitor) {
        clearInterval(this._blurMonitor);
        this._blurMonitor = null;
        console.log('🛒 Stopped blur monitoring');
      }
    }

    detectAndRemoveBlur() {
      // More efficient detection - only check common elements that might have blur
      const elementsToCheck = document.querySelectorAll('main, #MainContent, .shopify-section, .page-wrapper, body > *:not(#cartuplift-app-container)');
      let blurDetected = false;
      
      elementsToCheck.forEach(el => {
        if (el.id === 'cartuplift-app-container') return; // skip our container
        
        const computedStyle = window.getComputedStyle(el);
        const hasFilter = computedStyle.filter && computedStyle.filter !== 'none';
        const hasBackdropFilter = computedStyle.backdropFilter && computedStyle.backdropFilter !== 'none';
        
        if (hasFilter || hasBackdropFilter) {
          console.log('🛒 Blur detected on element, removing:', el.tagName, el.className, { 
            filter: computedStyle.filter, 
            backdropFilter: computedStyle.backdropFilter 
          });
          
          el.style.filter = 'none';
          el.style.webkitFilter = 'none';
          el.style.backdropFilter = 'none';
          el.style.webkitBackdropFilter = 'none';
          blurDetected = true;
        }
      });
      
      if (blurDetected) {
        console.log('🛒 Blur detected, running full cleanup');
        // Also run our full cleanup
        this.forceCleanThemeArtifacts();
      }
    }

    destroy() {
      // Stop blur monitoring
      this.stopBlurMonitoring();
      
      // Remove global flags
      document.documentElement.classList.remove('cartuplift-drawer-open');
      document.body.classList.remove('cartuplift-drawer-open');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';

      // Remove our listeners if we bound them
      if (this._unbindFns) {
        this._unbindFns.forEach(fn => { 
          try { 
            fn(); 
          } catch {} 
        });
        this._unbindFns = [];
      }

      // Hide container
      const container = document.getElementById('cartuplift-app-container');
      if (container) {
        container.style.display = 'none';
        container.classList.remove('cartuplift-active');
      }

      // Remove sticky cart
      const stickyCart = document.getElementById('cartuplift-sticky');
      if (stickyCart) {
        stickyCart.remove();
      }

      console.log('🛒 Cart Uplift instance destroyed');
    }
  }

  // Expose the constructor for the embed to call
  window.CartUpliftDrawer = CartUpliftDrawer;

  // Do NOT auto-create an instance here - let the embed handle initialization
  console.log('🛒 CartUpliftDrawer class exported to window');

})();