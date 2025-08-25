(function() {
  'use strict';

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
      // Fetch initial cart
      await this.fetchCart();
      
      // Create UI elements
      if (this.settings.enableStickyCart) {
        this.createStickyCart();
      }
      
      if (this.settings.enableFreeShipping) {
        this.createFreeShippingBar();
      }
      
      // Listen for cart changes
      this.listenToCartEvents();
      
      // Intercept add to cart forms
      this.interceptAddToCart();
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

    ensureDrawerRendered(context) {
      const container = document.getElementById('upcart-app-container');
      if (!container) {
        console.warn('🛒 ensureDrawerRendered: container missing. Recreating. Context:', context);
        this.createDrawer();
        return;
      }
      const header = container.querySelector('.upcart-header');
      const itemsWrapper = container.querySelector('.upcart-items, .upcart-items-list');
      const footer = container.querySelector('.upcart-footer');
      const isBlank = !header || !itemsWrapper || !footer || container.textContent.trim().length === 0;
      console.log('🛒 ensureDrawerRendered check. Context:', context, 'isBlank:', isBlank, {
        hasHeader: !!header,
        hasItemsWrapper: !!itemsWrapper,
        hasFooter: !!footer,
        textLength: container.textContent.trim().length
      });
      if (isBlank) {
        console.warn('🛒 Drawer appears blank. Forcing re-render. Context:', context);
        // Rebuild without removing existing to avoid flicker
        try {
          const previousClass = container.className;
          const wasOpen = container.classList.contains('upcart-active');
          // Temporarily detach to rebuild markup
          container.innerHTML = '';
          this.createDrawer();
          if (wasOpen) {
            requestAnimationFrame(() => this.openDrawer());
          }
          container.className = previousClass;
        } catch (e) {
          console.error('🛒 Error forcing drawer re-render:', e);
        }
      }
      // Always verify progress bar after render checks
      this.ensureProgressBar('ensureDrawerRendered:' + context);
    }

    ensureProgressBar(context) {
      if (!this.settings.enableFreeShipping) return; // feature disabled
      const container = document.getElementById('upcart-app-container');
      if (!container) return;
      let progressSection = container.querySelector('.upcart-progress-section');
      if (!progressSection) {
        console.warn('🛒 Progress section missing. Re-injecting. Context:', context);
        const header = container.querySelector('.upcart-header');
        const referenceNode = header ? header.nextElementSibling : null;
        const totalPrice = this.cart ? this.cart.total_price : 0;
        const html = `\n            <div class="upcart-progress-section" data-upcart-reinjected="true">\n              <div class="upcart-free-shipping-bar">\n                <div class="upcart-free-shipping-text">🚚 You're $${((this.settings.freeShippingThreshold * 100 - totalPrice) / 100).toFixed(2)} away from free shipping!</div>\n                <div class="upcart-progress-bar">\n                  <div class="upcart-progress-fill" style="width: ${Math.min((totalPrice / (this.settings.freeShippingThreshold * 100)) * 100, 100)}%"></div>\n                </div>\n                <div class="upcart-progress-remaining">\n                  ${totalPrice >= this.settings.freeShippingThreshold * 100 ? '🎉 You qualify for free shipping!' : `Add $${((this.settings.freeShippingThreshold * 100 - totalPrice) / 100).toFixed(2)} more for free shipping`}\n                </div>\n              </div>\n            </div>`;
        if (referenceNode) {
          referenceNode.insertAdjacentHTML('beforebegin', html);
        } else {
          container.firstElementChild?.insertAdjacentHTML('afterbegin', html);
        }
        progressSection = container.querySelector('.upcart-progress-section');
      }
      if (progressSection) {
        // Force visibility & layout
        progressSection.style.display = 'block';
        progressSection.style.opacity = '1';
        progressSection.style.pointerEvents = 'auto';
        progressSection.style.visibility = 'visible';
        // Log computed style for debugging
        const cs = window.getComputedStyle(progressSection);
        console.log('🛒 Progress bar status:', {
          context,
          display: cs.display,
            opacity: cs.opacity,
            visibility: cs.visibility,
            height: cs.height,
            width: cs.width,
            hasFill: !!progressSection.querySelector('.upcart-progress-fill')
        });
      }
    }

    logProgressBarStatus() {
      this.ensureProgressBar('manual-log');
    }

    updateFreeShippingBar() {
      const progressSection = document.querySelector('.upcart-progress-section');
      if (!progressSection) return;

      if (!this.cart || !this.settings.enableFreeShipping) {
        progressSection.style.display = 'none';
        return;
      }
  const threshold = this.getFreeShippingThresholdCents();
  const currentTotal = this.cart.total_price;
  const remaining = Math.max(0, threshold - currentTotal);
  const progress = threshold === 0 ? 100 : Math.min((currentTotal / threshold) * 100, 100);
  progressSection.style.display = 'block';

      const progressText = document.querySelector('.upcart-free-shipping-text');
      const progressFill = document.querySelector('.upcart-progress-fill');
      const progressRemaining = document.querySelector('.upcart-progress-remaining');

      if (progressText) {
        if (remaining > 0) {
          progressText.innerHTML = `🚚 You're $${(remaining / 100).toFixed(2)} away from free shipping!`;
        } else {
          progressText.innerHTML = `🎉 You qualify for free shipping!`;
        }
      }

      if (progressFill) {
        progressFill.style.width = `${progress}%`;
      }

      if (progressRemaining) {
        if (remaining > 0) {
          progressRemaining.innerHTML = `Add $${(remaining / 100).toFixed(2)} more for free shipping`;
        } else {
          progressRemaining.innerHTML = `You qualify for free shipping! 🎉`;
        }
      }
    }

    getFreeShippingThresholdCents() {
      const raw = Number(this.settings.freeShippingThreshold || 0);
      if (!isFinite(raw) || raw < 0) return 0;
      // Heuristics:
      // 1. If merchant typed cents already (>= 10000 => >= $100) AND not absurdly huge, assume cents
      // 2. If absurdly large (>= 5,000,000 => $50k as cents) we likely mis-scaled; treat as already cents but clamp for UI.
      let cents = raw;
      if (raw < 10000) { // < $100 if treated as cents → they probably entered dollars
        cents = raw * 100;
      }
      // Clamp to a maximum sensible threshold (e.g., $10,000) for progress math to avoid near-zero fills
      const MAX_CENTS = 1000000; // $10,000
      this._thresholdClamped = cents > MAX_CENTS;
      if (cents > MAX_CENTS) cents = MAX_CENTS;
      return cents;
    }

    formatMoneyRaw(cents) {
      return '$' + (cents / 100).toFixed(2);
    }

    detectAnomalies() {
      try {
        const raw = Number(this.settings.freeShippingThreshold || 0);
        if (raw >= 1000000) {
          console.warn('🛒 Anomaly: Extremely large free shipping threshold configured:', raw, '→ consider entering a normal dollar amount like 50 or 100.');
        }
      } catch(e) {}
    }

    startBlankGuard() {
      if (this._blankGuardStarted) return;
      this._blankGuardStarted = true;
      const container = () => document.getElementById('upcart-app-container');
      const check = () => {
        const el = container();
        if (!el) return;
        if (el.textContent.trim().length === 0 || el.children.length === 0) {
          console.warn('🛒 BlankGuard: container became empty – rebuilding');
          this.createDrawer();
          if (this.isOpen) this.openDrawer();
        }
      };
      this._blankGuardInterval = setInterval(check, 1200);
    }

    debugState() {
      return {
        cartLoaded: !!this.cart,
        itemCount: this.cart && this.cart.item_count,
        total: this.cart && this.cart.total_price,
        settings: this.settings,
        effectiveThreshold: this.getFreeShippingThresholdCents(),
        thresholdWasClamped: !!this._thresholdClamped,
        drawerOpen: this.isOpen,
        hasContainer: !!document.getElementById('upcart-app-container'),
        containerLength: (document.getElementById('upcart-app-container')||{innerHTML:''}).innerHTML.length,
        progressSection: !!document.querySelector('.upcart-progress-section')
      };
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

    createFreeShippingBar() {
      // Don't create free shipping bar if showOnlyOnCartPage is enabled and we're not on cart page
      if (this.settings.showOnlyOnCartPage && !this.isCartPage()) {
        return;
      }
      
      const existing = document.getElementById('upcart-shipping-bar');
      if (existing) existing.remove();

      const bar = document.createElement('div');
      bar.id = 'upcart-shipping-bar';
      bar.className = 'upcart-shipping-bar';
      document.body.prepend(bar);
      
      this.updateFreeShippingBar();
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
      if (!this.cart) return; // Don't update if cart data isn't loaded yet
      
      const count = document.querySelector('.upcart-count');
      const total = document.querySelector('.upcart-total');
      const drawerCount = document.querySelector('.upcart-drawer-count');
      const subtotal = document.querySelector('.upcart-subtotal-price');
      const checkoutBtn = document.querySelector('.upcart-checkout');
      
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);
      if (drawerCount) drawerCount.textContent = this.cart.item_count;
      if (subtotal) subtotal.textContent = this.formatMoney(this.cart.total_price);
      if (checkoutBtn) {
        checkoutBtn.textContent = `Checkout • ${this.formatMoney(this.cart.total_price)}`;
      }
    }

    toggleDrawer() {
      if (this.isOpen) {
        this.closeDrawer();
      } else {
        this.openDrawer();
      }
    }

    openDrawer() {
      console.log('🛒 openDrawer() called!');
      const container = document.getElementById('upcart-app-container');
      console.log('🛒 Found container element:', !!container, container);
      if (container) {
        console.log('🛒 Adding active class to container');
        container.classList.add('upcart-active');
        document.body.classList.add('upcart-drawer-open');
        this.isOpen = true;
        console.log('🛒 Drawer should now be open, classes:', container.className);
        
        // Force the container to stay visible
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('pointer-events', 'auto', 'important');
        
        // Force a reflow to ensure CSS is applied
        void container.offsetHeight;
        
        // Double-check the drawer is visible
        setTimeout(() => {
          const computedStyle = window.getComputedStyle(container);
          console.log('🛒 Container display:', computedStyle.display, 'pointer-events:', computedStyle.pointerEvents);
          
          // If it's somehow hidden, force it visible again
          if (computedStyle.display === 'none' || !container.classList.contains('upcart-active')) {
            console.log('🛒 Drawer was hidden! Forcing it back open...');
            container.classList.add('upcart-active');
            container.style.setProperty('display', 'block', 'important');
            container.style.setProperty('pointer-events', 'auto', 'important');
          }
        }, 100);
        
        // Keep checking and forcing open for a few seconds
        let checkCount = 0;
        const keepOpenInterval = setInterval(() => {
          checkCount++;
          if (checkCount > 20) { // Stop after 2 seconds
            clearInterval(keepOpenInterval);
            return;
          }
          
          if (!container.classList.contains('upcart-active') || window.getComputedStyle(container).display === 'none') {
            console.log('🛒 Drawer closed unexpectedly - forcing back open', checkCount);
            container.classList.add('upcart-active');
            container.style.setProperty('display', 'block', 'important');
            container.style.setProperty('pointer-events', 'auto', 'important');
          }
        }, 100);
  // Refresh progress bar when drawer is definitively open
  this.updateFreeShippingBar();
        
      } else {
        console.error('🛒 No container element found! Creating drawer...');
        this.createDrawer();
        // Try again after creating
        setTimeout(() => {
          const newContainer = document.getElementById('upcart-app-container');
          if (newContainer) {
            newContainer.classList.add('upcart-active');
            document.body.classList.add('upcart-drawer-open');
            this.isOpen = true;
          }
        }, 100);
      }
    }

    closeDrawer() {
      console.log('🛒 closeDrawer() called!');
      console.trace('🛒 Close drawer call stack:');
      const container = document.getElementById('upcart-app-container');
      if (container) {
        container.classList.remove('upcart-active');
        document.body.classList.remove('upcart-drawer-open');
        this.isOpen = false;
        console.log('🛒 Drawer closed');
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
  console.log('🛒 Initializing UpCart...');
  console.log('🛒 Available settings:', window.UpCartSettings);
  window.UpCart = new UpCartDrawer();
  console.log('🛒 UpCart instance created:', window.UpCart);
})();
