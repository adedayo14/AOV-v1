class CartUplift {
  constructor() {
    this.isOpen = false;
    this._unbindFns = [];
    this.CONVERSION_FACTOR = 100; // Convert dollars to cents
    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;
    
    // Restore page state immediately
    this.restorePageState();
    
    this.bindEvents();
    this.createStickyButton();
    this.applyCSS();
    this.removeStickyCartCompletely();
    this.enforceSettings();
    
    // Start monitoring
    this.startStickyCartMonitoring();
  }

  restorePageState() {
    document.body.classList.remove('cartuplift-drawer-open');
    document.body.classList.add('cartuplift-no-blur', 'cartuplift-restore-interaction');
    
    // Remove any existing overlays
    const existingContainers = document.querySelectorAll('#cartuplift-app-container');
    existingContainers.forEach(container => {
      if (container && !container.classList.contains('active')) {
        container.style.display = 'none';
        container.style.pointerEvents = 'none';
      }
    });
  }

  applyCSS() {
    const settings = window.CartUpliftSettings || {};
    
    // Apply CSS variables from settings
    const root = document.documentElement;
    
    if (settings.cartBackgroundColor) {
      root.style.setProperty('--cartuplift-bg-color', settings.cartBackgroundColor);
    }
    if (settings.cartTextColor) {
      root.style.setProperty('--cartuplift-text-color', settings.cartTextColor);
    }
    if (settings.cartButtonColor) {
      root.style.setProperty('--cartuplift-button-color', settings.cartButtonColor);
    }
    if (settings.cartDrawerWidth) {
      root.style.setProperty('--cartuplift-drawer-width', settings.cartDrawerWidth + 'px');
    }
  }

  startStickyCartMonitoring() {
    // Monitor for theme cart drawers and remove them continuously
    const monitorInterval = setInterval(() => {
      this.removeStickyCartCompletely();
    }, 1000);
    
    this._unbindFns.push(() => clearInterval(monitorInterval));
  }

  removeStickyCartCompletely() {
    const settings = window.CartUpliftSettings || {};
    
    // Only proceed if sticky cart is disabled
    if (settings.enableStickyCart === true) {
      return; // Sticky cart is enabled, don't remove
    }
    
    // Multi-layered removal strategy
    const selectors = [
      '#CartDrawer:not(#cartuplift-cart-popup)',
      '.cart-drawer:not(.cartuplift-drawer)',
      '.drawer--cart:not(.cartuplift-drawer)',
      '[data-cart-drawer]:not(.cartuplift-drawer)',
      '.cart-sidebar:not(.cartuplift-drawer)',
      '.sidebar-cart:not(.cartuplift-drawer)',
      '.mini-cart:not(.cartuplift-drawer)',
      '.drawer-cart:not(.cartuplift-drawer)',
      '.js-drawer-open-cart:not(.cartuplift-drawer)',
      '.header__cart-drawer:not(.cartuplift-drawer)',
      '[id*="cart-drawer"]:not(#cartuplift-cart-popup)',
      '[class*="cart-drawer"]:not(.cartuplift-drawer)',
      '[class*="drawer-cart"]:not(.cartuplift-drawer)'
    ];
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el && !el.closest('#cartuplift-app-container')) {
            el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;';
            el.setAttribute('data-cartuplift-hidden', 'true');
            el.remove();
          }
        });
      } catch (e) {
        console.warn('CartUplift: Error removing theme drawer:', e);
      }
    });
    
    // Remove any modal overlays from theme cart
    const overlays = document.querySelectorAll('.overlay, .backdrop, .modal-backdrop, [class*="overlay"], [class*="backdrop"]');
    overlays.forEach(overlay => {
      if (overlay && !overlay.closest('#cartuplift-app-container')) {
        const rect = overlay.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8) {
          overlay.style.display = 'none !important';
          overlay.remove();
        }
      }
    });
  }

  enforceSettings() {
    const settings = window.CartUpliftSettings || {};
    
    // Dynamic CSS injection for settings enforcement
    let styleEl = document.getElementById('cartuplift-dynamic-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'cartuplift-dynamic-styles';
      document.head.appendChild(styleEl);
    }
    
    let dynamicCSS = '';
    
    // Progress bar styling with transparency
    if (settings.shippingBarColor) {
      dynamicCSS += `
        .cartuplift-shipping-progress {
          background: rgba(0, 0, 0, 0.1) !important;
        }
        .cartuplift-shipping-progress-fill {
          background: ${settings.shippingBarColor} !important;
        }
      `;
    }
    
    // Sticky cart enforcement
    if (settings.enableStickyCart === false) {
      dynamicCSS += `
        .cartuplift-sticky {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
    }
    
    styleEl.textContent = dynamicCSS;
  }

  bindEvents() {
    // Prevent duplicate bindings
    this.unbindEvents();
    
    // Theme cart button override
    const cartButtons = document.querySelectorAll('a[href="/cart"], [href*="cart"], .cart-link, .header__cart-link, [data-cart-drawer-toggle], .js-drawer-open-cart');
    cartButtons.forEach(btn => {
      const clickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openDrawer();
      };
      btn.addEventListener('click', clickHandler);
      this._unbindFns.push(() => btn.removeEventListener('click', clickHandler));
    });
    
    // AJAX cart events
    const ajaxHandler = () => {
      setTimeout(() => this.updateCartUI(), 100);
    };
    
    document.addEventListener('cart:updated', ajaxHandler);
    document.addEventListener('cart:changed', ajaxHandler);
    this._unbindFns.push(() => {
      document.removeEventListener('cart:updated', ajaxHandler);
      document.removeEventListener('cart:changed', ajaxHandler);
    });
  }

  unbindEvents() {
    this._unbindFns.forEach(fn => fn());
    this._unbindFns = [];
  }

  createStickyButton() {
    const settings = window.CartUpliftSettings || {};
    
    // Remove existing sticky button
    const existing = document.getElementById('cartuplift-sticky-cart');
    if (existing) existing.remove();
    
    // Don't create if disabled
    if (settings.enableStickyCart === false) {
      return;
    }
    
    const stickyHtml = `
      <div id="cartuplift-sticky-cart" class="cartuplift-sticky ${settings.stickyPosition || 'bottom-right'}">
        <button class="cartuplift-sticky-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V19A2 2 0 0119 21H19A2 2 0 0121 19V13M9 19.5A1.5 1.5 0 109 22.5 1.5 1.5 0 009 19.5ZM20 19.5A1.5 1.5 0 1020 22.5 1.5 1.5 0 0020 19.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="cartuplift-sticky-count">0</span>
          <span class="cartuplift-sticky-total">$0.00</span>
        </button>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', stickyHtml);
    
    const stickyBtn = document.querySelector('#cartuplift-sticky-cart .cartuplift-sticky-btn');
    if (stickyBtn) {
      const clickHandler = () => this.openDrawer();
      stickyBtn.addEventListener('click', clickHandler);
      this._unbindFns.push(() => stickyBtn.removeEventListener('click', clickHandler));
    }
    
    this.updateStickyButton();
  }

  async updateStickyButton() {
    try {
      const response = await fetch('/cart.js');
      const cart = await response.json();
      
      const countEl = document.querySelector('.cartuplift-sticky-count');
      const totalEl = document.querySelector('.cartuplift-sticky-total');
      
      if (countEl) countEl.textContent = cart.item_count;
      if (totalEl) totalEl.textContent = this.formatMoney(cart.total_price);
      
      const stickyCart = document.getElementById('cartuplift-sticky-cart');
      if (stickyCart) {
        if (cart.item_count > 0) {
          stickyCart.style.display = 'block';
        } else {
          stickyCart.style.display = 'none';
        }
      }
    } catch (error) {
      console.warn('CartUplift: Error updating sticky button:', error);
    }
  }

  async openDrawer() {
    if (this.isOpen) return;
    
    this.isOpen = true;
    document.body.classList.add('cartuplift-drawer-open');
    
    // Track analytics
    this.trackEvent('cart_drawer_opened');
    
    try {
      await this.fetchCartData();
      this.renderDrawer();
      this.attachDrawerEvents();
      
      const container = document.getElementById('cartuplift-app-container');
      if (container) {
        container.style.display = 'block';
        container.style.pointerEvents = 'auto';
        
        setTimeout(() => {
          container.classList.add('active');
        }, 50);
      }
    } catch (error) {
      console.error('CartUplift: Error opening drawer:', error);
      this.closeDrawer();
    }
  }

  closeDrawer() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    this.trackEvent('cart_drawer_closed');
    
    const container = document.getElementById('cartuplift-app-container');
    if (container) {
      container.classList.remove('active');
      
      setTimeout(() => {
        container.style.display = 'none';
        container.style.pointerEvents = 'none';
      }, 300);
    }
    
    document.body.classList.remove('cartuplift-drawer-open');
    this.restorePageState();
  }

  async fetchCartData() {
    try {
      const response = await fetch('/cart.js');
      if (!response.ok) throw new Error('Cart fetch failed');
      
      this.cartData = await response.json();
      return this.cartData;
    } catch (error) {
      console.error('CartUplift: Error fetching cart:', error);
      this.cartData = { items: [], total_price: 0, item_count: 0 };
      return this.cartData;
    }
  }

  renderDrawer() {
    const settings = window.CartUpliftSettings || {};
    
    // Remove existing container
    const existing = document.getElementById('cartuplift-app-container');
    if (existing) existing.remove();
    
    const drawerHtml = `
      <div id="cartuplift-app-container">
        <div id="cartuplift-backdrop"></div>
        <div id="cartuplift-cart-popup">
          <div class="cartuplift-drawer">
            ${this.getHeaderHTML()}
            ${this.getItemsHTML()}
            ${settings.enableRecommendations ? this.getRecommendationsHTML() : ''}
            ${this.getFooterHTML()}
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', drawerHtml);
  }

  getHeaderHTML() {
    const settings = window.CartUpliftSettings || {};
    const cart = this.cartData || {};
    
    // Convert threshold from dollars to cents for comparison
    const thresholdCents = (parseFloat(settings.freeShippingThreshold) || 0) * this.CONVERSION_FACTOR;
    const currentTotal = cart.total_price || 0;
    const remaining = Math.max(0, thresholdCents - currentTotal);
    const progress = thresholdCents > 0 ? Math.min(100, (currentTotal / thresholdCents) * 100) : 0;
    
    let shippingText = settings.freeShippingText || 'Free shipping on orders over [amount]';
    
    if (thresholdCents > 0) {
      if (remaining > 0) {
        const remainingFormatted = this.formatMoney(remaining);
        shippingText = `Add ${remainingFormatted} more for free shipping!`;
      } else {
        shippingText = settings.freeShippingAchievedText || 'You qualify for free shipping!';
      }
    }
    
    return `
      <div class="cartuplift-header">
        <div class="cartuplift-header-top">
          <div class="cartuplift-header-row">
            <h2 class="cartuplift-title">${settings.cartTitle || 'Your Cart'}</h2>
            <div class="cartuplift-shipping-text">${shippingText}</div>
            <button class="cartuplift-close" aria-label="Close cart">×</button>
          </div>
          ${thresholdCents > 0 ? `
            <div class="cartuplift-shipping-progress-row">
              <div class="cartuplift-shipping-progress">
                <div class="cartuplift-shipping-progress-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  getItemsHTML() {
    const cart = this.cartData || {};
    
    if (!cart.items || cart.items.length === 0) {
      return `
        <div class="cartuplift-items">
          <div class="cartuplift-empty">
            <h4>Your cart is empty</h4>
            <p>Discover our latest products and add them to your cart.</p>
            <a href="/collections/all" class="cartuplift-continue-shopping">Continue Shopping</a>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="cartuplift-items">
        ${cart.items.map((item, index) => `
          <div class="cartuplift-item" data-variant-id="${item.variant_id}" data-line="${index + 1}">
            <div class="cartuplift-item-image">
              <img src="${item.image}" alt="${item.product_title}" loading="lazy">
            </div>
            <div class="cartuplift-item-info">
              <div class="cartuplift-item-title">
                <a href="${item.url}">${item.product_title}</a>
              </div>
              ${item.variant_title ? `<div class="cartuplift-item-variant">${item.variant_title}</div>` : ''}
              ${item.options_with_values && item.options_with_values.length > 1 ? 
                item.options_with_values.map(option => `<div class="cartuplift-item-option">${this.capitalizeFirstLetter(option.name)}: ${option.value}</div>`).join('') 
                : ''}
              <div class="cartuplift-item-quantity-wrapper">
                <div class="cartuplift-quantity">
                  <button class="cartuplift-qty-minus" data-line="${index + 1}" aria-label="Decrease quantity"> - </button>
                  <span class="cartuplift-qty-display">${item.quantity}</span>
                  <button class="cartuplift-qty-plus" data-line="${index + 1}" aria-label="Increase quantity"> + </button>
                </div>
              </div>
            </div>
            <div class="cartuplift-item-price-actions">
              <div class="cartuplift-item-price">${this.formatMoney(item.final_price)}</div>
              <button class="cartuplift-item-remove-x" data-line="${index + 1}" data-variant-id="${item.variant_id}" aria-label="Remove item">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  getRecommendationsHTML() {
    const settings = window.CartUpliftSettings || {};
    
    // Mock recommendations - replace with actual product data
    const recommendations = [
      { id: 1, title: 'Recommended Product 1', price: 2999, image: 'https://via.placeholder.com/100x100' },
      { id: 2, title: 'Recommended Product 2', price: 1999, image: 'https://via.placeholder.com/100x100' },
      { id: 3, title: 'Recommended Product 3', price: 3999, image: 'https://via.placeholder.com/100x100' }
    ];
    
    const layout = settings.recommendationsLayout || 'column';
    
    return `
      <div class="cartuplift-recommendations cartuplift-recommendations-${layout}">
        <div class="cartuplift-recommendations-header">
          <h3>${settings.recommendationsTitle || 'You might also like'}</h3>
          <button class="cartuplift-recommendations-toggle" aria-label="Toggle recommendations">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="cartuplift-recommendations-content">
          ${layout === 'row' ? `
            <div class="cartuplift-recommendations-scroll">
              ${recommendations.map(product => `
                <div class="cartuplift-recommendation-card">
                  <img src="${product.image}" alt="${product.title}">
                  <h4>${product.title}</h4>
                  <div class="cartuplift-recommendation-price">${this.formatMoney(product.price)}</div>
                  <button class="cartuplift-add-recommendation" data-product-id="${product.id}">Add</button>
                </div>
              `).join('')}
            </div>
          ` : `
            ${recommendations.map(product => `
              <div class="cartuplift-recommendation-item">
                <img src="${product.image}" alt="${product.title}">
                <div class="cartuplift-recommendation-info">
                  <h4>${product.title}</h4>
                  <div class="cartuplift-recommendation-price">${this.formatMoney(product.price)}</div>
                </div>
                <button class="cartuplift-add-recommendation-circle" data-product-id="${product.id}" aria-label="Add to cart">+</button>
              </div>
            `).join('')}
          `}
        </div>
      </div>
    `;
  }

  getFooterHTML() {
    const settings = window.CartUpliftSettings || {};
    const cart = this.cartData || {};
    
    return `
      <div class="cartuplift-footer">
        ${settings.enableDiscountCode ? `
          <div class="cartuplift-discount">
            <div class="cartuplift-discount-input-wrapper">
              <input type="text" class="cartuplift-discount-input" placeholder="${settings.discountCodePlaceholder || 'Discount code'}" />
              <button class="cartuplift-discount-apply">Apply</button>
            </div>
            <div class="cartuplift-discount-message"></div>
          </div>
        ` : ''}
        
        ${settings.enableOrderNotes ? `
          <div class="cartuplift-notes">
            <label class="cartuplift-notes-label" for="cartuplift-order-notes">${settings.orderNotesLabel || 'Order notes'}</label>
            <textarea class="cartuplift-notes-textarea" id="cartuplift-order-notes" placeholder="${settings.orderNotesPlaceholder || 'Special instructions for your order'}"></textarea>
          </div>
        ` : ''}
        
        <div class="cartuplift-subtotal">
          <span>Total</span>
          <span>${this.formatMoney(cart.total_price || 0)}</span>
        </div>
        
        <button class="cartuplift-checkout-btn" onclick="window.location.href='/checkout'">
          ${settings.checkoutButtonText || 'Checkout'}
        </button>
        
        ${settings.enableExpressCheckout ? `
          <div class="cartuplift-express-checkout">
            <button class="cartuplift-paypal-btn">
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjI1IiB2aWV3Qm94PSIwIDAgMTAwIDI1IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNMTIgNC41QzEyIDIuMDE0NzIgMTQuMDE0NyAwIDE2LjUgMEgyMEMyMS4xMDQ2IDAgMjIgMC44OTU0MyAyMiAyVjZDMjIgNy4xMDQ1NyAyMS4xMDQ2IDggMjAgOEgxNi41QzE0LjAxNDcgOCAxMiA1Ljk4NTI4IDEyIDMuNVY0LjVaIiBmaWxsPSIjMDA5Y2RlIi8+CjwvcGF0aD4KPC9zdmc+" alt="PayPal">
            </button>
            <button class="cartuplift-shoppay-btn">Shop Pay</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  attachDrawerEvents() {
    const container = document.getElementById('cartuplift-app-container');
    if (!container) return;

    // Close button
    const closeBtn = container.querySelector('.cartuplift-close');
    if (closeBtn) {
      const closeHandler = () => this.closeDrawer();
      closeBtn.addEventListener('click', closeHandler);
      this._unbindFns.push(() => closeBtn.removeEventListener('click', closeHandler));
    }
    
    // Backdrop
    const backdrop = container.querySelector('#cartuplift-backdrop');
    if (backdrop) {
      const backdropHandler = (e) => {
        e.stopPropagation();
        this.closeDrawer();
      };
      backdrop.addEventListener('click', backdropHandler);
      this._unbindFns.push(() => backdrop.removeEventListener('click', backdropHandler));
    }
    
    // Quantity controls
    container.querySelectorAll('.cartuplift-qty-minus, .cartuplift-qty-plus').forEach(btn => {
      const clickHandler = (e) => this.handleQuantityChange(e);
      btn.addEventListener('click', clickHandler);
      this._unbindFns.push(() => btn.removeEventListener('click', clickHandler));
    });
    
    // Remove buttons
    container.querySelectorAll('.cartuplift-item-remove-x').forEach(btn => {
      const clickHandler = (e) => this.handleRemoveItem(e);
      btn.addEventListener('click', clickHandler);
      this._unbindFns.push(() => btn.removeEventListener('click', clickHandler));
    });
    
    // Recommendations toggle
    const toggleBtn = container.querySelector('.cartuplift-recommendations-toggle');
    if (toggleBtn) {
      const toggleHandler = () => {
        const recommendationsEl = container.querySelector('.cartuplift-recommendations');
        if (recommendationsEl) {
          recommendationsEl.classList.toggle('collapsed');
        }
      };
      toggleBtn.addEventListener('click', toggleHandler);
      this._unbindFns.push(() => toggleBtn.removeEventListener('click', toggleHandler));
    }
    
    // Discount code
    const discountBtn = container.querySelector('.cartuplift-discount-apply');
    if (discountBtn) {
      const discountHandler = () => this.handleDiscountCode();
      discountBtn.addEventListener('click', discountHandler);
      this._unbindFns.push(() => discountBtn.removeEventListener('click', discountHandler));
    }
    
    // Recommendation add buttons
    container.querySelectorAll('.cartuplift-add-recommendation, .cartuplift-add-recommendation-circle').forEach(btn => {
      const addHandler = (e) => this.handleAddRecommendation(e);
      btn.addEventListener('click', addHandler);
      this._unbindFns.push(() => btn.removeEventListener('click', addHandler));
    });
  }

  async handleQuantityChange(e) {
    const btn = e.target;
    const line = btn.getAttribute('data-line');
    const isIncrease = btn.classList.contains('cartuplift-qty-plus');
    const item = btn.closest('.cartuplift-item');
    
    if (!line || !item) return;
    
    item.classList.add('loading');
    
    try {
      const currentQty = parseInt(item.querySelector('.cartuplift-qty-display').textContent);
      const newQty = isIncrease ? currentQty + 1 : Math.max(0, currentQty - 1);
      
      const formData = new FormData();
      formData.append('id', line);
      formData.append('quantity', newQty);
      
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        await this.updateCartUI();
        this.trackEvent('quantity_changed', { line, newQty });
      }
    } catch (error) {
      console.error('CartUplift: Error updating quantity:', error);
    } finally {
      item.classList.remove('loading');
    }
  }

  async handleRemoveItem(e) {
    const btn = e.target.closest('.cartuplift-item-remove-x');
    const line = btn.getAttribute('data-line');
    const variantId = btn.getAttribute('data-variant-id');
    const item = btn.closest('.cartuplift-item');
    
    if (!line || !item) return;
    
    item.classList.add('loading');
    
    try {
      const formData = new FormData();
      formData.append('id', line);
      formData.append('quantity', 0);
      
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        await this.updateCartUI();
        this.trackEvent('item_removed', { variantId });
      }
    } catch (error) {
      console.error('CartUplift: Error removing item:', error);
    } finally {
      item.classList.remove('loading');
    }
  }

  async handleDiscountCode() {
    const input = document.querySelector('.cartuplift-discount-input');
    const messageEl = document.querySelector('.cartuplift-discount-message');
    const btn = document.querySelector('.cartuplift-discount-apply');
    
    if (!input || !messageEl || !btn) return;
    
    const code = input.value.trim();
    if (!code) return;
    
    btn.disabled = true;
    messageEl.className = 'cartuplift-discount-message loading';
    messageEl.textContent = 'Applying discount...';
    
    try {
      const formData = new FormData();
      formData.append('discount_code', code);
      
      const response = await fetch('/cart/apply_discount.js', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        messageEl.className = 'cartuplift-discount-message success';
        messageEl.textContent = 'Discount applied successfully!';
        await this.updateCartUI();
        this.trackEvent('discount_applied', { code });
      } else {
        throw new Error('Invalid discount code');
      }
    } catch (error) {
      messageEl.className = 'cartuplift-discount-message error';
      messageEl.textContent = 'Invalid discount code';
    } finally {
      btn.disabled = false;
    }
  }

  async handleAddRecommendation(e) {
    const btn = e.target.closest('[data-product-id]');
    const productId = btn.getAttribute('data-product-id');
    
    if (!productId) return;
    
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Adding...';
    
    try {
      const formData = new FormData();
      formData.append('id', productId);
      formData.append('quantity', 1);
      
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        await this.updateCartUI();
        btn.textContent = 'Added!';
        this.trackEvent('recommendation_added', { productId });
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 2000);
      } else {
        throw new Error('Failed to add product');
      }
    } catch (error) {
      console.error('CartUplift: Error adding recommendation:', error);
      btn.textContent = 'Error';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }

  async updateCartUI() {
    try {
      await this.fetchCartData();
      
      if (this.isOpen) {
        // Update drawer content
        const container = document.getElementById('cartuplift-app-container');
        if (container) {
          const drawer = container.querySelector('.cartuplift-drawer');
          if (drawer) {
            const settings = window.CartUpliftSettings || {};
            drawer.innerHTML = `
              ${this.getHeaderHTML()}
              ${this.getItemsHTML()}
              ${settings.enableRecommendations ? this.getRecommendationsHTML() : ''}
              ${this.getFooterHTML()}
            `;
            this.attachDrawerEvents();
          }
        }
      }
      
      // Update sticky button
      this.updateStickyButton();
      
    } catch (error) {
      console.error('CartUplift: Error updating cart UI:', error);
    }
  }

  formatMoney(cents) {
    const settings = window.CartUpliftSettings || {};
    const amount = (cents / 100).toFixed(2);
    const currency = settings.currency || '$';
    return `${currency}${amount}`;
  }

  capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  trackEvent(eventName, eventData = {}) {
    try {
      const settings = window.CartUpliftSettings || {};
      
      // Google Analytics
      if (settings.enableGoogleAnalytics && typeof gtag !== 'undefined') {
        gtag('event', eventName, {
          event_category: 'CartUplift',
          ...eventData
        });
      }
      
      // Facebook Pixel
      if (settings.enableFacebookPixel && typeof fbq !== 'undefined') {
        fbq('track', eventName, eventData);
      }
      
      // Custom analytics
      if (typeof window.customCartAnalytics === 'function') {
        window.customCartAnalytics(eventName, eventData);
      }
      
    } catch (error) {
      console.warn('CartUplift: Analytics tracking error:', error);
    }
  }

  destroy() {
    this.unbindEvents();
    
    const elements = [
      '#cartuplift-app-container',
      '#cartuplift-sticky-cart',
      '#cartuplift-dynamic-styles'
    ];
    
    elements.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) el.remove();
    });
    
    this.restorePageState();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.cartUplift = new CartUplift();
  });
} else {
  window.cartUplift = new CartUplift();
}
        };
        backdrop.addEventListener('click', backdropHandler);
        this._unbindFns.push(() => backdrop.removeEventListener('click', backdropHandler));
      }

      // Global document events (only bind once)
      if (!this._eventsBound) {
        const onKey = (e) => { 
          if (e.key === 'Escape' && this.isOpen) this.closeDrawer(); 
        };
        document.addEventListener('keydown', onKey);
        this._unbindFns.push(() => document.removeEventListener('keydown', onKey));

        const onDocDown = (e) => {
          if (!this.isOpen) return;
          const insideDrawer = e.target.closest('.cartuplift-drawer');
          const hitTrigger = e.target.closest('#cartuplift-sticky');
          if (!insideDrawer && !hitTrigger) {
            this.closeDrawer();
          }
        };
        document.addEventListener('mousedown', onDocDown, true);
        this._unbindFns.push(() => document.removeEventListener('mousedown', onDocDown, true));

        this._eventsBound = true;
      }

      // Quantity controls
      const changeHandler = (e) => {
        if (e.target.classList.contains('cartuplift-qty-input')) {
          const line = e.target.dataset.line;
          const quantity = Math.max(0, parseInt(e.target.value) || 0);
          console.log('🛒 Quantity change detected:', { line, quantity });
          this.updateQuantity(line, quantity);
        }
      };
      container.addEventListener('change', changeHandler);
      this._unbindFns.push(() => container.removeEventListener('change', changeHandler));
      
      const clickHandler = (e) => {
        if (e.target.classList.contains('cartuplift-qty-plus')) {
          e.preventDefault();
          e.stopPropagation();
          const line = e.target.dataset.line;
          const display = container.querySelector(`[data-line="${line}"] .cartuplift-qty-display`);
          if (display) {
            const currentValue = parseInt(display.textContent) || 0;
            const newQuantity = currentValue + 1;
            console.log('🛒 Plus button clicked:', { line, currentValue, newQuantity });
            this.updateQuantity(line, newQuantity);
          }
        }
        else if (e.target.classList.contains('cartuplift-qty-minus')) {
          e.preventDefault();
          e.stopPropagation();
          const line = e.target.dataset.line;
          const display = container.querySelector(`[data-line="${line}"] .cartuplift-qty-display`);
          if (display) {
            const currentValue = parseInt(display.textContent) || 0;
            const newQuantity = Math.max(0, currentValue - 1);
            console.log('🛒 Minus button clicked:', { line, currentValue, newQuantity });
            this.updateQuantity(line, newQuantity);
          }
        }
        else if (e.target.classList.contains('cartuplift-item-remove-x') || 
                 e.target.closest('.cartuplift-item-remove-x')) {
          e.preventDefault();
          e.stopPropagation();
          const button = e.target.classList.contains('cartuplift-item-remove-x') 
            ? e.target 
            : e.target.closest('.cartuplift-item-remove-x');
          const line = button.dataset.line;
          console.log('🛒 X button clicked:', { line });
          this.updateQuantity(line, 0);
        }
      };
      container.addEventListener('click', clickHandler);
      this._unbindFns.push(() => container.removeEventListener('click', clickHandler));
      
      // Load existing order notes and recommendations
      this.loadOrderNotes();
      
      // Load recommendations after drawer is created
      if (this.settings.enableRecommendations) {
        setTimeout(() => {
          this.loadRecommendations();
        }, 100);
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
      if (this._quantityBusy) return;
      this._quantityBusy = true;
      
      try {
        console.log('🛒 Updating quantity:', { line, quantity });

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
        this.cart = cartData;
        this.updateDrawerContent();
        
        console.log('🛒 Quantity updated successfully');
      } catch (error) {
        console.error('🛒 Error updating quantity:', error);
      } finally {
        this._quantityBusy = false;
      }
    }

    updateDrawerContent() {
      console.log('🛒 updateDrawerContent() start. Cart present:', !!this.cart, 'item_count:', this.cart?.item_count);
      
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup || !this.cart) {
        console.log('🛒 No popup found or no cart data in updateDrawerContent:', {popup: !!popup, cart: !!this.cart});
        return;
      }
      
      const container = document.getElementById('cartuplift-app-container');
      const wasOpen = container && container.classList.contains('active');
      
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();
      this.loadOrderNotes();
      
      if (wasOpen && container) {
        container.classList.add('active');
      }
      
      // Update sticky cart if exists
      const count = document.querySelector('.cartuplift-sticky-count');
      const total = document.querySelector('.cartuplift-sticky-total');
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);
    }

    updateDrawerContentForAutoOpen() {
      console.log('🛒 updateDrawerContentForAutoOpen() start. Cart present:', !!this.cart, 'item_count:', this.cart?.item_count);
      
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup || !this.cart) {
        console.log('🛒 No popup found or no cart data:', {popup: !!popup, cart: !!this.cart});
        return;
      }
      
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();
      this.loadOrderNotes();
      
      // Update sticky cart if exists
      const count = document.querySelector('.cartuplift-sticky-count');
      const total = document.querySelector('.cartuplift-sticky-total');
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);
      
      console.log('🛒 Drawer content updated for auto-open with', this.cart.item_count, 'items');
    }

    openDrawer() {
      if (this._isAnimating || this.isOpen) return;
      console.log('🛒 openDrawer() called!');

      if (this.settings.enableAnalytics) {
        window.dispatchEvent(new CustomEvent('cartuplift:opened', {
          detail: {
            cart: this.cart,
            trigger: 'manual'
          }
        }));
      }
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        this._isAnimating = false;
        return;
      }

      this.clearOverlayCleanup();
      document.documentElement.classList.add('cartuplift-drawer-open');
      document.body.classList.add('cartuplift-drawer-open');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';

      container.style.display = '';
      container.classList.add('active');

      const popup = container.querySelector('#cartuplift-cart-popup');
      if (!popup || !popup.querySelector('.cartuplift-drawer')) {
        popup.innerHTML = this.getDrawerHTML();
        this.attachDrawerEvents();
        this.loadOrderNotes();
      }

      this.forceCleanThemeArtifacts();

      setTimeout(() => { 
        this._isAnimating = false; 
        this.isOpen = true; 
      }, 100);
    }

    closeDrawer() {
      if (this._isAnimating || !this.isOpen) return;
      console.log('🛒 closeDrawer() called!');
      
      this._isAnimating = true;
      const container = document.getElementById('cartuplift-app-container');
      if (!container) {
        console.log('🛒 No container found for closing');
        this._isAnimating = false;
        return;
      }

      container.classList.remove('active');
      this.scheduleOverlayCleanup();

      const finishClose = () => {
        console.log('🛒 Finishing close - cleaning up');
        
        container.style.display = 'none';
        document.documentElement.classList.remove('cartuplift-drawer-open');
        document.body.classList.remove('cartuplift-drawer-open');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';

        this.isOpen = false;
        this._isAnimating = false;
        console.log('🛒 Close cleanup complete');
      };

      setTimeout(finishClose, 350);
    }

    scheduleOverlayCleanup() {
      console.log('🛒 Scheduling overlay cleanup...');
      
      if (this._overlayCleanupTimer) {
        clearTimeout(this._overlayCleanupTimer);
      }

      this._overlayCleanupTimer = setTimeout(() => {
        console.log('🛒 Executing scheduled overlay cleanup');
        this.restorePageInteraction();
        this._overlayCleanupTimer = null;
      }, 400);
    }

    clearOverlayCleanup() {
      if (this._overlayCleanupTimer) {
        console.log('🛒 Clearing scheduled overlay cleanup');
        clearTimeout(this._overlayCleanupTimer);
        this._overlayCleanupTimer = null;
      }
    }

    forceCleanThemeArtifacts() {
      console.log('🛒 Force cleaning theme artifacts');
      
      const leftoverClasses = [
        'js-drawer-open', 'drawer-open', 'modal-open', 'overflow-hidden',
        'no-scroll', 'cart-open', 'drawer-opened', 'cart-drawer-open',
        'navigation-open', 'scroll-lock', 'popup-open', 'sidebar-open',
        'menu-open', 'drawer-is-open', 'has-drawer-open', 'overlay-active',
        'fixed', 'locked', 'noscroll', 'no-scroll-y', 'scroll-disabled',
        'modal-active', 'dialog-open', 'loading', 'adding-to-cart',
        'cart-loading', 'blur', 'blurred', 'dimmed'
      ];
      
      leftoverClasses.forEach(cls => {
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
      });

      [document.body, document.documentElement].forEach(el => {
        if (el) {
          const stylesToClear = [
            'position', 'top', 'left', 'overflow', 'overflowY', 'overflowX',
            'height', 'width', 'maxHeight', 'paddingRight', 'marginRight',
            'filter', 'webkitFilter', 'backdropFilter', 'webkitBackdropFilter',
            'pointerEvents', 'userSelect', 'touchAction', 'transform', 'opacity'
          ];
          stylesToClear.forEach(prop => {
            el.style[prop] = '';
          });
        }
      });

      const contentSelectors = [
        'main', '#MainContent', '.main-content', '.site-content',
        '.page-content', '#main', '.main', '.shopify-section',
        '.page-wrapper', '.site-wrapper', '.container', '.content-wrapper'
      ];
      
      contentSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          if (element && element.id !== 'cartuplift-app-container') {
            const effectsToRemove = [
              'filter', 'webkitFilter', 'backdropFilter', 'webkitBackdropFilter',
              'opacity', 'transform', 'pointerEvents', 'userSelect', 'touchAction'
            ];
            effectsToRemove.forEach(prop => {
              element.style[prop] = '';
            });
            
            const blurClasses = ['blur', 'blurred', 'dimmed', 'overlay-on'];
            blurClasses.forEach(cls => element.classList.remove(cls));
          }
        });
      });

      const overlaySelectors = [
        '.drawer-overlay', '.modal-overlay', '.backdrop', '.overlay',
        '.cart-drawer-overlay', '.js-overlay', '.menu-overlay',
        '.site-overlay', '.page-overlay', '.theme-overlay'
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

      console.log('🛒 Theme artifact cleanup complete');
    }

    restorePageInteraction() {
      console.log('🛒 Restoring page interaction...');
      
      const blockingClasses = [
        'loading', 'adding-to-cart', 'cart-loading', 'product-loading',
        'overlay-active', 'modal-open', 'popup-open', 'drawer-open',
        'scroll-lock', 'no-scroll', 'noscroll', 'overflow-hidden',
        'js-drawer-open', 'drawer-opened', 'cart-drawer-open',
        'blur', 'blurred', 'dimmed', 'overlay-on'
      ];
      
      blockingClasses.forEach(cls => {
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
      });

      [document.documentElement, document.body].forEach(el => {
        if (el) {
          const stylesToClear = [
            'position', 'top', 'left', 'overflow', 'overflowY', 'overflowX',
            'height', 'width', 'maxHeight', 'paddingRight', 'marginRight',
            'filter', 'webkitFilter', 'backdropFilter', 'webkitBackdropFilter',
            'opacity', 'transform', 'pointerEvents', 'userSelect', 'touchAction'
          ];
          
          stylesToClear.forEach(prop => {
            el.style[prop] = '';
          });
        }
      });

      this.removeAllBlurEffects();

      const blockingAttrs = [
        'data-loading', 'data-cart-loading', 'data-adding-to-cart',
        'data-drawer-open', 'data-cart-open', 'data-modal-open'
      ];
      
      blockingAttrs.forEach(attr => {
        document.documentElement.removeAttribute(attr);
        document.body.removeAttribute(attr);
      });

      document.querySelectorAll('[inert]:not(#cartuplift-app-container *)').forEach(el => {
        el.removeAttribute('inert');
      });
      
      document.querySelectorAll('[aria-hidden="true"]:not(#cartuplift-app-container *)').forEach(el => {
        el.removeAttribute('aria-hidden');
        el.style.pointerEvents = '';
        el.style.userSelect = '';
        el.style.touchAction = '';
      });

      const overlaySelectors = [
        '.loading-overlay', '.cart-loading-overlay', '.add-to-cart-overlay',
        '.drawer-overlay', '.modal-overlay', '.backdrop', '.overlay',
        '.cart-drawer-overlay', '.js-overlay', '.menu-overlay',
        '.site-overlay', '.page-overlay', '.theme-overlay'
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

      this.forceReflow();
      console.log('🛒 Page interaction fully restored');
    }

    removeAllBlurEffects() {
      console.log('🛒 Removing all blur effects...');
      
      const allElements = document.querySelectorAll('*');
      let removedCount = 0;
      
      allElements.forEach(el => {
        if (el.id === 'cartuplift-app-container' || el.closest('#cartuplift-app-container')) return;
        
        const style = window.getComputedStyle(el);
        
        if (style.filter && style.filter.includes('blur')) {
          el.style.filter = 'none';
          el.style.webkitFilter = 'none';
          removedCount++;
        }
        
        if (style.backdropFilter && style.backdropFilter.includes('blur')) {
          el.style.backdropFilter = 'none';
          el.style.webkitBackdropFilter = 'none';
          removedCount++;
        }
        
        if (style.opacity && parseFloat(style.opacity) < 1 && parseFloat(style.opacity) > 0) {
          el.style.opacity = '';
          removedCount++;
        }
        
        if (style.transform && style.transform !== 'none') {
          el.style.transform = '';
          removedCount++;
        }
        
        if (style.pointerEvents === 'none' && !el.hasAttribute('disabled')) {
          el.style.pointerEvents = '';
          removedCount++;
        }
      });
      
      console.log(`🛒 Removed ${removedCount} blur/blocking effects`);
    }

    forceReflow() {
      document.body.style.display = 'none';
      void document.body.offsetHeight;
      document.body.style.display = '';
      
      document.body.style.opacity = '0.999';
      void document.body.offsetHeight;
      document.body.style.opacity = '';
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
      
      if (window.CartUpliftMoneyFormat) {
        try {
          return window.CartUpliftMoneyFormat.replace(/\{\{\s*amount\s*\}\}/g, amount);
        } catch {
          // Fallback if format is invalid
        }
      }
      
      return '(function() {
  'use strict';
  
  console.log('🛒 Cart Uplift script loaded!');
  console.log('🛒 Window settings available:', !!window.CartUpliftSettings);

  class CartUpliftDrawer {
    constructor(settings) {
      this.settings = settings || window.CartUpliftSettings;
      
      // Validate and set defaults for critical settings
      if (!this.settings) {
        console.warn('🛒 No settings provided, using defaults');
        this.settings = {};
      }
      
      // Ensure boolean settings are properly set with proper defaults
      this.settings.enableStickyCart = this.settings.enableStickyCart !== false;
      this.settings.enableFreeShipping = this.settings.enableFreeShipping !== false;
      this.settings.enableApp = this.settings.enableApp !== false;
      this.settings.autoOpenCart = this.settings.autoOpenCart !== false;
      this.settings.enableRecommendations = this.settings.enableRecommendations !== false;
      this.settings.enableExpressCheckout = this.settings.enableExpressCheckout !== false;
      
      // Set other defaults
      this.settings.cartPosition = this.settings.cartPosition || 'bottom-right';
      this.settings.cartIcon = this.settings.cartIcon || 'cart';
      this.settings.recommendationLayout = this.settings.recommendationLayout || 'column';
      this.settings.freeShippingThreshold = this.settings.freeShippingThreshold || 100;
      this.settings.buttonColor = this.settings.buttonColor || '#45C0B6';
      
      console.log('🛒 Constructor settings validation:', {
        enableStickyCart: this.settings.enableStickyCart,
        enableFreeShipping: this.settings.enableFreeShipping,
        enableApp: this.settings.enableApp,
        buttonColor: this.settings.buttonColor,
        recommendationLayout: this.settings.recommendationLayout
      });
      
      // Immediate sticky cart removal if disabled
      if (!this.settings.enableStickyCart) {
        setTimeout(() => {
          this.removeStickyCartCompletely();
        }, 100);
      }
      
      this.cart = null;
      this.recommendations = [];
      this.isOpen = false;
      this._unbindFns = [];
      this._isAnimating = false;
      this._eventsBound = false;
      this._quantityBusy = false;
      this._fetchPatched = false;
      this._overlayCleanupTimer = null;
      this.initPromise = this.init();
    }

    removeStickyCartCompletely() {
      console.log('🛒 Completely removing sticky cart...');
      
      const stickyById = document.getElementById('cartuplift-sticky');
      if (stickyById) {
        stickyById.remove();
        console.log('🛒 Removed sticky cart by ID');
      }
      
      document.querySelectorAll('.cartuplift-sticky').forEach(el => {
        el.remove();
        console.log('🛒 Removed sticky cart by class');
      });
      
      document.querySelectorAll('.cartuplift-sticky-btn').forEach(el => {
        const parent = el.closest('div');
        if (parent) parent.remove();
        console.log('🛒 Removed sticky cart by button class');
      });
      
      let hideStyle = document.getElementById('cartuplift-hide-sticky');
      if (!hideStyle) {
        hideStyle = document.createElement('style');
        hideStyle.id = 'cartuplift-hide-sticky';
        hideStyle.textContent = `
          #cartuplift-sticky,
          .cartuplift-sticky,
          .cartuplift-sticky-btn,
          [id*="sticky"],
          [class*="sticky"],
          [id*="cartuplift-sticky"],
          [class*="cartuplift-sticky"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            z-index: -1 !important;
          }
        `;
        document.head.appendChild(hideStyle);
        console.log('🛒 Added aggressive CSS to hide sticky cart');
      }
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
      console.log('🛒 Settings received:', this.settings);
      
      // Fetch initial cart data FIRST
      await this.fetchCart();
      console.log('🛒 Cart data loaded:', this.cart);
      
      // Check if we should only show on cart page
      const pathname = window.location.pathname.toLowerCase();
      const isCartPage = pathname === '/cart' || pathname === '/cart/';
      
      // Create cart drawer
      this.createDrawer();
      
      // Handle sticky cart based on settings
      console.log('🛒 Sticky cart check:', {
        enableStickyCart: this.settings.enableStickyCart,
        showOnlyOnCartPage: this.settings.showOnlyOnCartPage,
        isCartPage: isCartPage,
        shouldCreate: this.settings.enableStickyCart && (!this.settings.showOnlyOnCartPage || isCartPage)
      });
      
      if (this.settings.enableStickyCart && (!this.settings.showOnlyOnCartPage || isCartPage)) {
        console.log('🛒 Creating sticky cart...');
        this.createStickyCart();
      } else {
        console.log('🛒 Sticky cart disabled - removing all instances');
        this.removeStickyCartCompletely();
      }
      
      // Set up cart replacement
      this.setupCleanCartReplacement();
      
      // Install cart monitoring functionality
      this.installAddToCartMonitoring();
      
      // Check if we should reopen cart after discount application
      this.checkDiscountRedirect();
      
      // Hide theme cart drawers
      this.hideAllThemeCartDrawers();
      
      // Force settings enforcement
      this.enforceSettings();
      
      // Set up continuous settings monitoring
      this.startSettingsMonitoring();
      
      console.log('🛒 Cart Uplift setup complete.');
    }

    setupCleanCartReplacement() {
      console.log('🛒 Setting up clean cart replacement...');
      this.hideThemeCartElements();
      this.interceptCartClicks();
      console.log('🛒 Clean cart replacement setup complete!');
    }

    checkDiscountRedirect() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('cart_opened') === 'true') {
        console.log('🛒 Detected return from discount application, reopening cart...');
        
        const url = new URL(window.location);
        url.searchParams.delete('cart_opened');
        window.history.replaceState({}, document.title, url.toString());
        
        setTimeout(() => {
          this.openDrawer();
        }, 500);
      }
    }

    hideThemeCartElements() {
      const style = document.createElement('style');
      style.id = 'cartuplift-theme-hiding';
      style.textContent = `
        #CartDrawer:not(#cartuplift-cart-popup),
        .cart-drawer:not(.cartuplift-drawer),
        .drawer--cart:not(.cartuplift-drawer),
        [data-cart-drawer]:not([data-cartuplift-hidden]) {
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
          console.log('🛒 Intercepted cart click on:', target);
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
          if (!el.id?.includes('cartuplift')) {
            console.log('🛒 Hiding theme cart:', selector, el);
            el.setAttribute('data-cartuplift-hidden', 'true');
          }
        });
      });
      
      this.addHidingCSS();
    }

    addHidingCSS() {
      if (document.getElementById('cartuplift-hiding-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'cartuplift-hiding-styles';
      style.textContent = `
        [data-cartuplift-hidden="true"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
      console.log('🛒 Added hiding CSS');
    }

    enforceSettings() {
      console.log('🛒 Enforcing settings...', this.settings);
      
      if (!this.settings.enableStickyCart) {
        console.log('🛒 Sticky cart is disabled, removing all instances');
        this.removeStickyCartCompletely();
      }
      
      if (this.settings.buttonColor) {
        let existingStyle = document.getElementById('cartuplift-color-overrides');
        if (existingStyle) {
          existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = 'cartuplift-color-overrides';
        style.textContent = `
          :root {
            --cartuplift-button-color: ${this.settings.buttonColor} !important;
          }
          
          .cartuplift-shipping-progress {
            background: #e5e7eb !important;
            position: relative !important;
            z-index: 1 !important;
          }
          
          .cartuplift-shipping-progress-fill {
            background: ${this.settings.buttonColor} !important;
            z-index: 2 !important;
            position: relative !important;
          }
          
          .cartuplift-checkout-btn {
            background: ${this.settings.buttonColor} !important;
          }
          
          .cartuplift-discount-apply {
            background: ${this.settings.buttonColor} !important;
          }
          
          .cartuplift-add-recommendation-circle {
            border-color: ${this.settings.buttonColor} !important;
            color: ${this.settings.buttonColor} !important;
          }
          
          .cartuplift-add-recommendation-circle:hover {
            background: ${this.settings.buttonColor} !important;
            color: #fff !important;
          }
          
          .cartuplift-qty-plus,
          .cartuplift-qty-minus {
            background: #f8f8f8 !important;
            color: #333 !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
          }
          
          .cartuplift-qty-plus:hover,
          .cartuplift-qty-minus:hover {
            background: #e8e8e8 !important;
            filter: none !important;
            opacity: 1 !important;
          }
        `;
        document.head.appendChild(style);
        console.log('🛒 Enforced color settings with color:', this.settings.buttonColor);
      }
      
      console.log('🛒 Settings enforcement complete');
    }

    startSettingsMonitoring() {
      console.log('🛒 Starting settings monitoring...');
      
      setInterval(() => {
        if (!this.settings.enableStickyCart) {
          this.removeStickyCartCompletely();
        }
        
        if (this.settings.buttonColor) {
          const colorOverride = document.getElementById('cartuplift-color-overrides');
          if (!colorOverride) {
            this.enforceSettings();
          }
        }
      }, 1000);
    }

    createStickyCart() {
      if (!this.settings.enableStickyCart) {
        console.log('🛒 Sticky cart disabled, not creating');
        return;
      }
      
      const existing = document.getElementById('cartuplift-sticky');
      if (existing) existing.remove();

      console.log('🛒 Creating sticky cart with settings:', {
        enableStickyCart: this.settings.enableStickyCart,
        cartPosition: this.settings.cartPosition
      });

      const stickyCart = document.createElement('div');
      stickyCart.id = 'cartuplift-sticky';
      stickyCart.className = `cartuplift-sticky ${this.settings.cartPosition}`;
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
      
      console.log('🛒 Sticky cart created successfully');
    }

    createDrawer() {
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
      
      const popup = container.querySelector('#cartuplift-cart-popup');
      if (popup) {
        const drawerHTML = this.getDrawerHTML();
        console.log('🛒 Drawer HTML injected. Length:', drawerHTML.length);
        popup.innerHTML = drawerHTML;
      }
      
      this.attachDrawerEvents();
    }

    getDrawerHTML() {
      const itemCount = this.cart?.item_count || 0;
      const totalPrice = this.cart?.total_price || 0;
      
      return `
        <div class="cartuplift-drawer">
          <div class="cartuplift-header">
            ${this.getHeaderHTML(itemCount)}
          </div>
          
          <div class="cartuplift-items">
            ${this.getCartItemsHTML()}
          </div>
          
          ${this.settings.enableRecommendations ? this.getRecommendationsHTML() : ''}
          
          ${this.settings.enableAddons ? this.getAddonsHTML() : ''}
          
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
        </div>
      `;
    }

    getRecommendationsHTML() {
      if (!this.settings.enableRecommendations) return '';
      
      const layout = this.settings.recommendationLayout || 'column';
      
      if (layout === 'column') {
        return `
          <div class="cartuplift-recommendations cartuplift-recommendations-column">
            <div class="cartuplift-recommendations-header">
              <h3 style="color: ${this.settings.buttonColor || '#45C0B6'}; font-size: 14px; font-weight: 600; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">RECOMMENDED FOR YOU</h3>
            </div>
            <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content">
              <div class="cartuplift-recommendations-loading">Loading recommendations...</div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="cartuplift-recommendations cartuplift-recommendations-row">
            <div class="cartuplift-recommendations-header">
              <h3>You may also like</h3>
            </div>
            <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content">
              <div class="cartuplift-recommendations-scroll">
                <div class="cartuplift-recommendations-loading">Loading recommendations...</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    async loadRecommendations() {
      console.log('🛒 Loading real product recommendations...');
      
      const contentDiv = document.getElementById('cartuplift-recommendations-content');
      if (!contentDiv) return;

      try {
        // Get products in cart to avoid recommending the same items
        const cartProductIds = this.cart?.items?.map(item => item.product_id) || [];
        
        // Use Shopify's product recommendations API
        let recommendationsUrl = '/recommendations/products.json?';
        
        // If we have cart items, get recommendations based on them
        if (cartProductIds.length > 0) {
          recommendationsUrl += `product_id=${cartProductIds[0]}&limit=4`;
        } else {
          // Fallback: get popular/recent products
          recommendationsUrl = '/products.json?limit=4';
        }
        
        console.log('🛒 Fetching recommendations from:', recommendationsUrl);
        
        const response = await fetch(recommendationsUrl);
        const data = await response.json();
        
        let products = [];
        
        if (data.products) {
          // Handle /products.json response
          products = data.products;
        } else if (Array.isArray(data)) {
          // Handle /recommendations/products.json response
          products = data;
        }
        
        // Filter out products already in cart
        products = products.filter(product => !cartProductIds.includes(product.id));
        
        // Limit to max upsells setting
        products = products.slice(0, this.settings.maxUpsells || 4);
        
        console.log('🛒 Found', products.length, 'recommendations:', products);
        
        this.recommendations = products;
        this.renderRecommendations();
        
      } catch (error) {
        console.error('🛒 Error loading recommendations:', error);
        contentDiv.innerHTML = '<div class="cartuplift-recommendations-error">Unable to load recommendations</div>';
      }
    }

    renderRecommendations() {
      const contentDiv = document.getElementById('cartuplift-recommendations-content');
      if (!contentDiv || !this.recommendations.length) return;

      const layout = this.settings.recommendationLayout || 'column';
      
      if (layout === 'column') {
        contentDiv.innerHTML = this.recommendations.map(product => {
          const variant = product.variants[0];
          const price = this.formatMoney(variant.price);
          const image = product.images[0] || 'https://via.placeholder.com/50x50';
          
          return `
            <div class="cartuplift-recommendation-item">
              <img src="${image}" alt="${product.title}" loading="lazy">
              <div class="cartuplift-recommendation-info">
                <h4>${product.title}</h4>
                <div class="cartuplift-recommendation-price">${price}</div>
              </div>
              <button class="cartuplift-add-recommendation-circle" 
                      data-variant-id="${variant.id}" 
                      data-product-id="${product.id}"
                      title="Add to cart">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          `;
        }).join('');
      } else {
        const scrollDiv = contentDiv.querySelector('.cartuplift-recommendations-scroll') || contentDiv;
        scrollDiv.innerHTML = this.recommendations.map(product => {
          const variant = product.variants[0];
          const price = this.formatMoney(variant.price);
          const image = product.images[0] || 'https://via.placeholder.com/80x80';
          
          return `
            <div class="cartuplift-recommendation-card">
              <img src="${image}" alt="${product.title}" loading="lazy">
              <h4>${product.title}</h4>
              <div class="cartuplift-recommendation-price">${price}</div>
              <button class="cartuplift-add-recommendation" 
                      data-variant-id="${variant.id}" 
                      data-product-id="${product.id}">Add+</button>
            </div>
          `;
        }).join('');
      }

      // Attach click handlers to recommendation buttons
      this.attachRecommendationHandlers();
    }

    attachRecommendationHandlers() {
      const buttons = document.querySelectorAll('.cartuplift-add-recommendation-circle, .cartuplift-add-recommendation');
      
      buttons.forEach(button => {
        button.addEventListener('click', async (e) => {
          e.preventDefault();
          const variantId = button.dataset.variantId;
          const productId = button.dataset.productId;
          
          if (!variantId) return;
          
          try {
            console.log('🛒 Adding recommendation to cart:', { variantId, productId });
            
            // Show loading state
            const originalText = button.textContent;
            button.disabled = true;
            button.style.opacity = '0.6';
            button.textContent = 'Adding...';
            
            // Add to cart
            const formData = new FormData();
            formData.append('id', variantId);
            formData.append('quantity', '1');
            
            const response = await fetch('/cart/add.js', {
              method: 'POST',
              body: formData,
              headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });

            if (response.ok) {
              // Refresh cart data
              await this.fetchCart();
              this.updateDrawerContent();
              
              // Dispatch analytics event
              if (this.settings.enableAnalytics) {
                window.dispatchEvent(new CustomEvent('cartuplift:item_added', {
                  detail: {
                    variant_id: variantId,
                    product_id: productId,
                    trigger: 'recommendation'
                  }
                }));
              }
              
              console.log('🛒 Recommendation added successfully');
            } else {
              throw new Error('Failed to add to cart');
            }
            
          } catch (error) {
            console.error('🛒 Error adding recommendation:', error);
            alert('Sorry, there was an error adding this item to your cart.');
          } finally {
            // Reset button state
            button.disabled = false;
            button.style.opacity = '';
            button.textContent = originalText;
          }
        });
      });
    }

    getAddonsHTML() {
      if (!this.settings.enableAddons) return '';
      
      return `
        <div class="cartuplift-addons">
          <div class="cartuplift-addons-header">
            <h3>Add these to your order</h3>
          </div>
          <div class="cartuplift-addons-content" id="cartuplift-addons-content">
            <button class="cartuplift-addon-btn">+ Add Gift Note & Logo Free Packaging</button>
          </div>
        </div>
      `;
    }

    getDiscountHTML() {
      if (!this.settings.enableDiscountCode) return '';
      
      return `
        <div class="cartuplift-discount">
          <input type="text" id="cartuplift-discount-code" class="cartuplift-discount-input" placeholder="Discount code" autocomplete="off">
          <button type="button" class="cartuplift-discount-apply" onclick="window.cartUpliftDrawer.applyDiscountCode()">Apply</button>
        </div>
        <div id="cartuplift-discount-message" class="cartuplift-discount-message"></div>
      `;
    }

    getNotesHTML() {
      if (!this.settings.enableNotes) return '';
      
      return `
        <div class="cartuplift-notes">
          <label for="cartuplift-order-notes" class="cartuplift-notes-label">Order notes</label>
          <textarea id="cartuplift-order-notes" class="cartuplift-notes-textarea" placeholder="Special instructions for your order..." rows="3" maxlength="500"></textarea>
        </div>
      `;
    }

    getHeaderHTML(itemCount) {
      let threshold = this.settings.freeShippingThreshold || 100;
      const currentTotal = this.cart ? this.cart.total_price : 0;

      if (threshold < 1000) {
        threshold = threshold * 100;
      }

      if (!threshold || threshold <= 0) {
        threshold = 10000;
      }

      const remaining = Math.max(0, threshold - currentTotal);
      const progress = Math.min((currentTotal / threshold) * 100, 100);
      
      let freeShippingText = '';
      if (remaining > 0) {
        const remainingFormatted = this.formatMoney(remaining);
        if (this.settings.freeShippingText && this.settings.freeShippingText.trim() !== '') {
          freeShippingText = this.settings.freeShippingText.replace(/{amount}/g, remainingFormatted);
        } else {
          freeShippingText = `You are ${remainingFormatted} away from free shipping!`;
        }
      } else {
        if (this.settings.freeShippingAchievedText && this.settings.freeShippingAchievedText.trim() !== '') {
          freeShippingText = this.settings.freeShippingAchievedText;
        } else {
          freeShippingText = `You have earned free shipping!`;
        }
      }
      
      return `
        <div class="cartuplift-header-top">
          <div class="cartuplift-header-row">
            <div class="cartuplift-header-left">
              <h3 class="cartuplift-title">CART (${itemCount})</h3>
            </div>
            <div class="cartuplift-header-center">
              ${this.settings.enableFreeShipping ? `
                <p class="cartuplift-shipping-text">
                  ${freeShippingText}
                </p>
              ` : ''}
            </div>
            <div class="cartuplift-header-right">
              <button class="cartuplift-close" aria-label="Close cart">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          ${this.settings.enableFreeShipping ? `
            <div class="cartuplift-shipping-progress-row">
              <div class="cartuplift-shipping-progress">
                <div class="cartuplift-shipping-progress-fill" style="width: ${progress}%;"></div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
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
            <img src="${item.image}" alt="${item.product_title + amount;
    }

    async applyDiscountCode() {
      const discountInput = document.getElementById('cartuplift-discount-code');
      const messageDiv = document.getElementById('cartuplift-discount-message');
      
      if (!discountInput || !messageDiv) return;
      
      const discountCode = discountInput.value.trim();
      if (!discountCode) {
        this.showDiscountMessage('Please enter a discount code', 'error');
        return;
      }
      
      this.showDiscountMessage('Applying discount...', 'loading');
      this.closeDrawer();
      
      const currentUrl = window.location.href;
      const redirectUrl = currentUrl.includes('?') ? 
        `${currentUrl}&cart_opened=true` : 
        `${currentUrl}?cart_opened=true`;
      
      window.location.href = `/discount/${encodeURIComponent(discountCode)}?redirect=${encodeURIComponent(redirectUrl)}`;
    }
    
    showDiscountMessage(message, type = 'info') {
      const messageDiv = document.getElementById('cartuplift-discount-message');
      if (!messageDiv) return;
      
      messageDiv.textContent = message;
      messageDiv.className = `cartuplift-discount-message ${type}`;
      
      if (type === 'error' || type === 'success') {
        setTimeout(() => {
          messageDiv.textContent = '';
          messageDiv.className = 'cartuplift-discount-message';
        }, 3000);
      }
    }
    
    proceedToCheckout() {
      if (this.settings.enableAnalytics) {
        window.dispatchEvent(new CustomEvent('cartuplift:checkout_started', {
          detail: {
            total_price: this.cart?.total_price || 0,
            item_count: this.cart?.item_count || 0,
            items: this.cart?.items || []
          }
        }));
      }

      const notesTextarea = document.getElementById('cartuplift-order-notes');
      if (notesTextarea && notesTextarea.value.trim()) {
        const orderNotes = notesTextarea.value.trim();
        
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
      
      const notesTextarea = document.getElementById('cartuplift-order-notes');
      if (!notesTextarea) return;
      
      if (this.cart && this.cart.attributes && this.cart.attributes['Order Notes']) {
        notesTextarea.value = this.cart.attributes['Order Notes'];
      }
    }

    installAddToCartMonitoring() {
      if (this._fetchPatched) return;
      this._fetchPatched = true;

      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        let url = args[0];
        try {
          if (url && typeof url === 'object' && 'url' in url) url = url.url;

          const isAddToCart =
            typeof url === 'string' &&
            (url.includes('/cart/add') || url.includes('/cart/add.js'));

          const resp = await origFetch.apply(window, args);

          if (isAddToCart && resp.ok && !this._isAnimating) {
            console.log('🛒 Add to cart detected, cleaning theme loading effects...');
            
            this.removeThemeLoadingEffects();

            if (this.settings.enableAnalytics) {
              window.dispatchEvent(new CustomEvent('cartuplift:item_added', {
                detail: {
                  trigger: 'fetch_monitoring'
                }
              }));
            }
            
            setTimeout(async () => {
              try {
                await this.fetchCart();
                this.updateDrawerContentForAutoOpen();
                
                const count = document.querySelector('.cartuplift-sticky-count');
                const total = document.querySelector('.cartuplift-sticky-total');
                if (count) count.textContent = this.cart.item_count;
                if (total) total.textContent = this.formatMoney(this.cart.total_price);
                
                console.log('🛒 Cart updated in background, item count:', this.cart.item_count);
                
                if (this.settings.autoOpenCart && !this.isOpen && !this._isAnimating) {
                  console.log('🛒 Auto-opening drawer...');
                  this.openDrawer();
                } else {
                  console.log('🛒 Auto-open disabled or drawer already open');
                }
              } catch (e) {
                console.warn('Cart update after add failed:', e);
              }
            }, 50);
          }

          return resp;
        } catch (e) {
          return origFetch.apply(window, args);
        }
      };

      document.addEventListener('cart:added', () => {
        console.log('🛒 Theme cart:added event detected');
        this.removeThemeLoadingEffects();
        
        if (this.settings.enableAnalytics) {
          window.dispatchEvent(new CustomEvent('cartuplift:item_added', {
            (function() {
  'use strict';
  
  console.log('🛒 Cart Uplift script loaded!');
  console.log('🛒 Window settings available:', !!window.CartUpliftSettings);

  class CartUpliftDrawer {
    constructor(settings) {
      this.settings = settings || window.CartUpliftSettings;
      
      // Validate and set defaults for critical settings
      if (!this.settings) {
        console.warn('🛒 No settings provided, using defaults');
        this.settings = {};
      }
      
      // Ensure boolean settings are properly set with proper defaults
      this.settings.enableStickyCart = this.settings.enableStickyCart !== false;
      this.settings.enableFreeShipping = this.settings.enableFreeShipping !== false;
      this.settings.enableApp = this.settings.enableApp !== false;
      this.settings.autoOpenCart = this.settings.autoOpenCart !== false;
      this.settings.enableRecommendations = this.settings.enableRecommendations !== false;
      this.settings.enableExpressCheckout = this.settings.enableExpressCheckout !== false;
      
      // Set other defaults
      this.settings.cartPosition = this.settings.cartPosition || 'bottom-right';
      this.settings.cartIcon = this.settings.cartIcon || 'cart';
      this.settings.recommendationLayout = this.settings.recommendationLayout || 'column';
      this.settings.freeShippingThreshold = this.settings.freeShippingThreshold || 100;
      this.settings.buttonColor = this.settings.buttonColor || '#45C0B6';
      
      console.log('🛒 Constructor settings validation:', {
        enableStickyCart: this.settings.enableStickyCart,
        enableFreeShipping: this.settings.enableFreeShipping,
        enableApp: this.settings.enableApp,
        buttonColor: this.settings.buttonColor,
        recommendationLayout: this.settings.recommendationLayout
      });
      
      // Immediate sticky cart removal if disabled
      if (!this.settings.enableStickyCart) {
        setTimeout(() => {
          this.removeStickyCartCompletely();
        }, 100);
      }
      
      this.cart = null;
      this.recommendations = [];
      this.isOpen = false;
      this._unbindFns = [];
      this._isAnimating = false;
      this._eventsBound = false;
      this._quantityBusy = false;
      this._fetchPatched = false;
      this._overlayCleanupTimer = null;
      this.initPromise = this.init();
    }

    removeStickyCartCompletely() {
      console.log('🛒 Completely removing sticky cart...');
      
      const stickyById = document.getElementById('cartuplift-sticky');
      if (stickyById) {
        stickyById.remove();
        console.log('🛒 Removed sticky cart by ID');
      }
      
      document.querySelectorAll('.cartuplift-sticky').forEach(el => {
        el.remove();
        console.log('🛒 Removed sticky cart by class');
      });
      
      document.querySelectorAll('.cartuplift-sticky-btn').forEach(el => {
        const parent = el.closest('div');
        if (parent) parent.remove();
        console.log('🛒 Removed sticky cart by button class');
      });
      
      let hideStyle = document.getElementById('cartuplift-hide-sticky');
      if (!hideStyle) {
        hideStyle = document.createElement('style');
        hideStyle.id = 'cartuplift-hide-sticky';
        hideStyle.textContent = `
          #cartuplift-sticky,
          .cartuplift-sticky,
          .cartuplift-sticky-btn,
          [id*="sticky"],
          [class*="sticky"],
          [id*="cartuplift-sticky"],
          [class*="cartuplift-sticky"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            left: -9999px !important;
            top: -9999px !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            z-index: -1 !important;
          }
        `;
        document.head.appendChild(hideStyle);
        console.log('🛒 Added aggressive CSS to hide sticky cart');
      }
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
      console.log('🛒 Settings received:', this.settings);
      
      // Fetch initial cart data FIRST
      await this.fetchCart();
      console.log('🛒 Cart data loaded:', this.cart);
      
      // Check if we should only show on cart page
      const pathname = window.location.pathname.toLowerCase();
      const isCartPage = pathname === '/cart' || pathname === '/cart/';
      
      // Create cart drawer
      this.createDrawer();
      
      // Handle sticky cart based on settings
      console.log('🛒 Sticky cart check:', {
        enableStickyCart: this.settings.enableStickyCart,
        showOnlyOnCartPage: this.settings.showOnlyOnCartPage,
        isCartPage: isCartPage,
        shouldCreate: this.settings.enableStickyCart && (!this.settings.showOnlyOnCartPage || isCartPage)
      });
      
      if (this.settings.enableStickyCart && (!this.settings.showOnlyOnCartPage || isCartPage)) {
        console.log('🛒 Creating sticky cart...');
        this.createStickyCart();
      } else {
        console.log('🛒 Sticky cart disabled - removing all instances');
        this.removeStickyCartCompletely();
      }
      
      // Set up cart replacement
      this.setupCleanCartReplacement();
      
      // Install cart monitoring functionality
      this.installAddToCartMonitoring();
      
      // Check if we should reopen cart after discount application
      this.checkDiscountRedirect();
      
      // Hide theme cart drawers
      this.hideAllThemeCartDrawers();
      
      // Force settings enforcement
      this.enforceSettings();
      
      // Set up continuous settings monitoring
      this.startSettingsMonitoring();
      
      console.log('🛒 Cart Uplift setup complete.');
    }

    setupCleanCartReplacement() {
      console.log('🛒 Setting up clean cart replacement...');
      this.hideThemeCartElements();
      this.interceptCartClicks();
      console.log('🛒 Clean cart replacement setup complete!');
    }

    checkDiscountRedirect() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('cart_opened') === 'true') {
        console.log('🛒 Detected return from discount application, reopening cart...');
        
        const url = new URL(window.location);
        url.searchParams.delete('cart_opened');
        window.history.replaceState({}, document.title, url.toString());
        
        setTimeout(() => {
          this.openDrawer();
        }, 500);
      }
    }

    hideThemeCartElements() {
      const style = document.createElement('style');
      style.id = 'cartuplift-theme-hiding';
      style.textContent = `
        #CartDrawer:not(#cartuplift-cart-popup),
        .cart-drawer:not(.cartuplift-drawer),
        .drawer--cart:not(.cartuplift-drawer),
        [data-cart-drawer]:not([data-cartuplift-hidden]) {
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
          console.log('🛒 Intercepted cart click on:', target);
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
          if (!el.id?.includes('cartuplift')) {
            console.log('🛒 Hiding theme cart:', selector, el);
            el.setAttribute('data-cartuplift-hidden', 'true');
          }
        });
      });
      
      this.addHidingCSS();
    }

    addHidingCSS() {
      if (document.getElementById('cartuplift-hiding-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'cartuplift-hiding-styles';
      style.textContent = `
        [data-cartuplift-hidden="true"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
      console.log('🛒 Added hiding CSS');
    }

    enforceSettings() {
      console.log('🛒 Enforcing settings...', this.settings);
      
      if (!this.settings.enableStickyCart) {
        console.log('🛒 Sticky cart is disabled, removing all instances');
        this.removeStickyCartCompletely();
      }
      
      if (this.settings.buttonColor) {
        let existingStyle = document.getElementById('cartuplift-color-overrides');
        if (existingStyle) {
          existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = 'cartuplift-color-overrides';
        style.textContent = `
          :root {
            --cartuplift-button-color: ${this.settings.buttonColor} !important;
          }
          
          .cartuplift-shipping-progress {
            background: #e5e7eb !important;
            position: relative !important;
            z-index: 1 !important;
          }
          
          .cartuplift-shipping-progress-fill {
            background: ${this.settings.buttonColor} !important;
            z-index: 2 !important;
            position: relative !important;
          }
          
          .cartuplift-checkout-btn {
            background: ${this.settings.buttonColor} !important;
          }
          
          .cartuplift-discount-apply {
            background: ${this.settings.buttonColor} !important;
          }
          
          .cartuplift-add-recommendation-circle {
            border-color: ${this.settings.buttonColor} !important;
            color: ${this.settings.buttonColor} !important;
          }
          
          .cartuplift-add-recommendation-circle:hover {
            background: ${this.settings.buttonColor} !important;
            color: #fff !important;
          }
          
          .cartuplift-qty-plus,
          .cartuplift-qty-minus {
            background: #f8f8f8 !important;
            color: #333 !important;
            border: 1px solid #ddd !important;
            border-radius: 4px !important;
          }
          
          .cartuplift-qty-plus:hover,
          .cartuplift-qty-minus:hover {
            background: #e8e8e8 !important;
            filter: none !important;
            opacity: 1 !important;
          }
        `;
        document.head.appendChild(style);
        console.log('🛒 Enforced color settings with color:', this.settings.buttonColor);
      }
      
      console.log('🛒 Settings enforcement complete');
    }

    startSettingsMonitoring() {
      console.log('🛒 Starting settings monitoring...');
      
      setInterval(() => {
        if (!this.settings.enableStickyCart) {
          this.removeStickyCartCompletely();
        }
        
        if (this.settings.buttonColor) {
          const colorOverride = document.getElementById('cartuplift-color-overrides');
          if (!colorOverride) {
            this.enforceSettings();
          }
        }
      }, 1000);
    }

    createStickyCart() {
      if (!this.settings.enableStickyCart) {
        console.log('🛒 Sticky cart disabled, not creating');
        return;
      }
      
      const existing = document.getElementById('cartuplift-sticky');
      if (existing) existing.remove();

      console.log('🛒 Creating sticky cart with settings:', {
        enableStickyCart: this.settings.enableStickyCart,
        cartPosition: this.settings.cartPosition
      });

      const stickyCart = document.createElement('div');
      stickyCart.id = 'cartuplift-sticky';
      stickyCart.className = `cartuplift-sticky ${this.settings.cartPosition}`;
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
      
      console.log('🛒 Sticky cart created successfully');
    }

    createDrawer() {
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
      
      const popup = container.querySelector('#cartuplift-cart-popup');
      if (popup) {
        const drawerHTML = this.getDrawerHTML();
        console.log('🛒 Drawer HTML injected. Length:', drawerHTML.length);
        popup.innerHTML = drawerHTML;
      }
      
      this.attachDrawerEvents();
    }

    getDrawerHTML() {
      const itemCount = this.cart?.item_count || 0;
      const totalPrice = this.cart?.total_price || 0;
      
      return `
        <div class="cartuplift-drawer">
          <div class="cartuplift-header">
            ${this.getHeaderHTML(itemCount)}
          </div>
          
          <div class="cartuplift-items">
            ${this.getCartItemsHTML()}
          </div>
          
          ${this.settings.enableRecommendations ? this.getRecommendationsHTML() : ''}
          
          ${this.settings.enableAddons ? this.getAddonsHTML() : ''}
          
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
        </div>
      `;
    }

    getRecommendationsHTML() {
      if (!this.settings.enableRecommendations) return '';
      
      const layout = this.settings.recommendationLayout || 'column';
      
      if (layout === 'column') {
        return `
          <div class="cartuplift-recommendations cartuplift-recommendations-column">
            <div class="cartuplift-recommendations-header">
              <h3 style="color: ${this.settings.buttonColor || '#45C0B6'}; font-size: 14px; font-weight: 600; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">RECOMMENDED FOR YOU</h3>
            </div>
            <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content">
              <div class="cartuplift-recommendations-loading">Loading recommendations...</div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="cartuplift-recommendations cartuplift-recommendations-row">
            <div class="cartuplift-recommendations-header">
              <h3>You may also like</h3>
            </div>
            <div class="cartuplift-recommendations-content" id="cartuplift-recommendations-content">
              <div class="cartuplift-recommendations-scroll">
                <div class="cartuplift-recommendations-loading">Loading recommendations...</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    async loadRecommendations() {
      console.log('🛒 Loading real product recommendations...');
      
      const contentDiv = document.getElementById('cartuplift-recommendations-content');
      if (!contentDiv) return;

      try {
        // Get products in cart to avoid recommending the same items
        const cartProductIds = this.cart?.items?.map(item => item.product_id) || [];
        
        // Use Shopify's product recommendations API
        let recommendationsUrl = '/recommendations/products.json?';
        
        // If we have cart items, get recommendations based on them
        if (cartProductIds.length > 0) {
          recommendationsUrl += `product_id=${cartProductIds[0]}&limit=4`;
        } else {
          // Fallback: get popular/recent products
          recommendationsUrl = '/products.json?limit=4';
        }
        
        console.log('🛒 Fetching recommendations from:', recommendationsUrl);
        
        const response = await fetch(recommendationsUrl);
        const data = await response.json();
        
        let products = [];
        
        if (data.products) {
          // Handle /products.json response
          products = data.products;
        } else if (Array.isArray(data)) {
          // Handle /recommendations/products.json response
          products = data;
        }
        
        // Filter out products already in cart
        products = products.filter(product => !cartProductIds.includes(product.id));
        
        // Limit to max upsells setting
        products = products.slice(0, this.settings.maxUpsells || 4);
        
        console.log('🛒 Found', products.length, 'recommendations:', products);
        
        this.recommendations = products;
        this.renderRecommendations();
        
      } catch (error) {
        console.error('🛒 Error loading recommendations:', error);
        contentDiv.innerHTML = '<div class="cartuplift-recommendations-error">Unable to load recommendations</div>';
      }
    }

    renderRecommendations() {
      const contentDiv = document.getElementById('cartuplift-recommendations-content');
      if (!contentDiv || !this.recommendations.length) return;

      const layout = this.settings.recommendationLayout || 'column';
      
      if (layout === 'column') {
        contentDiv.innerHTML = this.recommendations.map(product => {
          const variant = product.variants[0];
          const price = this.formatMoney(variant.price);
          const image = product.images[0] || 'https://via.placeholder.com/50x50';
          
          return `
            <div class="cartuplift-recommendation-item">
              <img src="${image}" alt="${product.title}" loading="lazy">
              <div class="cartuplift-recommendation-info">
                <h4>${product.title}</h4>
                <div class="cartuplift-recommendation-price">${price}</div>
              </div>
              <button class="cartuplift-add-recommendation-circle" 
                      data-variant-id="${variant.id}" 
                      data-product-id="${product.id}"
                      title="Add to cart">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          `;
        }).join('');
      } else {
        const scrollDiv = contentDiv.querySelector('.cartuplift-recommendations-scroll') || contentDiv;
        scrollDiv.innerHTML = this.recommendations.map(product => {
          const variant = product.variants[0];
          const price = this.formatMoney(variant.price);
          const image = product.images[0] || 'https://via.placeholder.com/80x80';
          
          return `
            <div class="cartuplift-recommendation-card">
              <img src="${image}" alt="${product.title}" loading="lazy">
              <h4>${product.title}</h4>
              <div class="cartuplift-recommendation-price">${price}</div>
              <button class="cartuplift-add-recommendation" 
                      data-variant-id="${variant.id}" 
                      data-product-id="${product.id}">Add+</button>
            </div>
          `;
        }).join('');
      }

      // Attach click handlers to recommendation buttons
      this.attachRecommendationHandlers();
    }

    attachRecommendationHandlers() {
      const buttons = document.querySelectorAll('.cartuplift-add-recommendation-circle, .cartuplift-add-recommendation');
      
      buttons.forEach(button => {
        button.addEventListener('click', async (e) => {
          e.preventDefault();
          const variantId = button.dataset.variantId;
          const productId = button.dataset.productId;
          
          if (!variantId) return;
          
          try {
            console.log('🛒 Adding recommendation to cart:', { variantId, productId });
            
            // Show loading state
            const originalText = button.textContent;
            button.disabled = true;
            button.style.opacity = '0.6';
            button.textContent = 'Adding...';
            
            // Add to cart
            const formData = new FormData();
            formData.append('id', variantId);
            formData.append('quantity', '1');
            
            const response = await fetch('/cart/add.js', {
              method: 'POST',
              body: formData,
              headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });

            if (response.ok) {
              // Refresh cart data
              await this.fetchCart();
              this.updateDrawerContent();
              
              // Dispatch analytics event
              if (this.settings.enableAnalytics) {
                window.dispatchEvent(new CustomEvent('cartuplift:item_added', {
                  detail: {
                    variant_id: variantId,
                    product_id: productId,
                    trigger: 'recommendation'
                  }
                }));
              }
              
              console.log('🛒 Recommendation added successfully');
            } else {
              throw new Error('Failed to add to cart');
            }
            
          } catch (error) {
            console.error('🛒 Error adding recommendation:', error);
            alert('Sorry, there was an error adding this item to your cart.');
          } finally {
            // Reset button state
            button.disabled = false;
            button.style.opacity = '';
            button.textContent = originalText;
          }
        });
      });
    }

    getAddonsHTML() {
      if (!this.settings.enableAddons) return '';
      
      return `
        <div class="cartuplift-addons">
          <div class="cartuplift-addons-header">
            <h3>Add these to your order</h3>
          </div>
          <div class="cartuplift-addons-content" id="cartuplift-addons-content">
            <button class="cartuplift-addon-btn">+ Add Gift Note & Logo Free Packaging</button>
          </div>
        </div>
      `;
    }

    getDiscountHTML() {
      if (!this.settings.enableDiscountCode) return '';
      
      return `
        <div class="cartuplift-discount">
          <input type="text" id="cartuplift-discount-code" class="cartuplift-discount-input" placeholder="Discount code" autocomplete="off">
          <button type="button" class="cartuplift-discount-apply" onclick="window.cartUpliftDrawer.applyDiscountCode()">Apply</button>
        </div>
        <div id="cartuplift-discount-message" class="cartuplift-discount-message"></div>
      `;
    }

    getNotesHTML() {
      if (!this.settings.enableNotes) return '';
      
      return `
        <div class="cartuplift-notes">
          <label for="cartuplift-order-notes" class="cartuplift-notes-label">Order notes</label>
          <textarea id="cartuplift-order-notes" class="cartuplift-notes-textarea" placeholder="Special instructions for your order..." rows="3" maxlength="500"></textarea>
        </div>
      `;
    }

    getHeaderHTML(itemCount) {
      let threshold = this.settings.freeShippingThreshold || 100;
      const currentTotal = this.cart ? this.cart.total_price : 0;

      if (threshold < 1000) {
        threshold = threshold * 100;
      }

      if (!threshold || threshold <= 0) {
        threshold = 10000;
      }

      const remaining = Math.max(0, threshold - currentTotal);
      const progress = Math.min((currentTotal / threshold) * 100, 100);
      
      let freeShippingText = '';
      if (remaining > 0) {
        const remainingFormatted = this.formatMoney(remaining);
        if (this.settings.freeShippingText && this.settings.freeShippingText.trim() !== '') {
          freeShippingText = this.settings.freeShippingText.replace(/{amount}/g, remainingFormatted);
        } else {
          freeShippingText = `You are ${remainingFormatted} away from free shipping!`;
        }
      } else {
        if (this.settings.freeShippingAchievedText && this.settings.freeShippingAchievedText.trim() !== '') {
          freeShippingText = this.settings.freeShippingAchievedText;
        } else {
          freeShippingText = `You have earned free shipping!`;
        }
      }
      
      return `
        <div class="cartuplift-header-top">
          <div class="cartuplift-header-row">
            <div class="cartuplift-header-left">
              <h3 class="cartuplift-title">CART (${itemCount})</h3>
            </div>
            <div class="cartuplift-header-center">
              ${this.settings.enableFreeShipping ? `
                <p class="cartuplift-shipping-text">
                  ${freeShippingText}
                </p>
              ` : ''}
            </div>
            <div class="cartuplift-header-right">
              <button class="cartuplift-close" aria-label="Close cart">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          ${this.settings.enableFreeShipping ? `
            <div class="cartuplift-shipping-progress-row">
              <div class="cartuplift-shipping-progress">
                <div class="cartuplift-shipping-progress-fill" style="width: ${progress}%;"></div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    capitalizeFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
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
            <img src="${item.image}" alt="${item.product_title