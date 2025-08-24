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
      console.log('🛒 Setting up UpCart with aggressive cart replacement...');
      
      // Fetch initial cart data FIRST
      await this.fetchCart();
      console.log('🛒 Cart data loaded:', this.cart);
      
      // Now create UI elements with cart data available
      this.createDrawer();
      
      // Set up aggressive cart hijacking
      this.setupAggressiveCartHijacking();
      
      // Hide all existing theme cart drawers immediately
      this.hideAllThemeCartDrawers();
      
      // Update the drawer content now that we have cart data
      this.updateDrawerContent();
      
      console.log('🛒 UpCart setup complete with aggressive mode');
    }

    isCartPage() {
      const pathname = window.location.pathname.toLowerCase();
      
      // Check for full page cart
      const isFullPageCart = pathname === '/cart' || pathname === '/cart/';
      
      // Check for cart drawer indicators
      const hasCartDrawer = document.querySelector('[data-cart-drawer], .cart-drawer, #cart-drawer, .drawer--cart, [id*="cart-drawer"], [class*="cart-drawer"]') !== null;
      
      // Check if any cart drawer is currently open/visible
      const cartDrawerOpen = document.querySelector('.cart-drawer.is-open, .cart-drawer.active, .drawer--cart.is-open, [data-cart-drawer].is-open') !== null;
      
      // Check for Shopify's cart object being updated (indicates cart interaction)
      const hasCartActivity = window.location.href.includes('cart') || 
                             document.body.classList.contains('cart-drawer-open') ||
                             document.body.classList.contains('drawer-open');
      
      const isCart = isFullPageCart || hasCartDrawer || cartDrawerOpen || hasCartActivity;
      
      console.log('🛒 Cart page detection:', { 
        pathname, 
        isFullPageCart,
        hasCartDrawer, 
        cartDrawerOpen,
        hasCartActivity,
        isCart 
      });
      
      return isCart;
    }

    setupAggressiveCartHijacking() {
      console.log('🛒 Setting up AGGRESSIVE cart hijacking...');
      
      // 1. Override ALL click events on cart drawer toggles
      this.interceptAllCartClicks();
      
      // 2. Override Shopify theme functions
      this.overrideShopifyCartFunctions();
      
      // 3. Watch for new cart drawers and hide them
      this.watchForNewCartDrawers();
      
      // 4. Hijack AJAX cart operations
      this.hijackAjaxCartOperations();
      
      console.log('🛒 Aggressive hijacking setup complete');
    }

    hideAllThemeCartDrawers() {
      console.log('🛒 Hiding ALL theme cart drawers...');
      
      // Comprehensive list of cart drawer selectors
      const selectors = [
        '#CartPopup', '#cart-drawer', '.cart-drawer', '.drawer--cart',
        '#sidebar-cart', '.sidebar-cart', '#mini-cart', '.mini-cart',
        '.cart-popup', '.cart-slide', '.cart-sidebar', '#cart-popup',
        '.js-drawer-cart', '[data-cart-drawer]', '.header__cart-drawer',
        '.cart__drawer', '.side-cart', '.cart-overlay', '.cart-modal'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (!el.classList.contains('upcart-cart') && !el.id.includes('upcart')) {
              console.log('🛒 Hiding theme cart:', selector, el);
              el.style.setProperty('display', 'none', 'important');
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('opacity', '0', 'important');
              el.style.setProperty('pointer-events', 'none', 'important');
              el.setAttribute('data-upcart-hidden', 'true');
            }
          });
        } catch (e) {
          console.log('🛒 Error hiding selector:', selector, e);
        }
      });
      
      // Also add CSS to hide theme cart drawers
      this.addHidingCSS();
    }

    addHidingCSS() {
      if (document.getElementById('upcart-hiding-styles')) return;
      
      const style = document.createElement('style');
      style.id = 'upcart-hiding-styles';
      style.textContent = `
        /* UpCart: Hide all theme cart drawers */
        #CartPopup:not(#upcart-cart-popup),
        #cart-drawer:not(#upcart-cart-popup),
        .cart-drawer:not(.upcart-cart),
        .drawer--cart:not(.upcart-cart),
        .sidebar-cart:not(.upcart-cart),
        .mini-cart:not(.upcart-cart),
        .cart-popup:not(.upcart-cart),
        [data-cart-drawer]:not(.upcart-cart) {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
      console.log('🛒 Added hiding CSS');
    }

    interceptAllCartClicks() {
      console.log('🛒 Intercepting ALL cart clicks...');
      
      // List of cart trigger selectors
      const triggerSelectors = [
        '[data-cart-drawer-toggle]', '.cart-toggle', '.js-drawer-open-cart',
        '.header__cart-toggle', '.cart-icon', '.cart-link', '[data-drawer-toggle="cart"]',
        '.site-nav__cart', '.cart-button', '#cart-icon-bubble', '.cart-count-bubble',
        'a[href="/cart"]', 'a[href*="/cart"]', '.header-cart', '.nav-cart',
        '.cart-drawer-toggle', '.open-cart', '.show-cart', '[data-cart-toggle]',
        // Add more specific selectors
        '.header__icon--cart', '.cart', '[href="/cart"]', '[aria-label*="cart" i]',
        '[aria-label*="Cart" i]', '.icon-cart', '#CartCount', '.cart-count'
      ];
      
      console.log('🛒 Watching for cart selectors:', triggerSelectors);
      
      // Use capture phase to intercept before any other handlers
      document.addEventListener('click', (e) => {
        // Check if clicked element or any parent matches cart triggers
        const target = e.target.closest(triggerSelectors.join(','));
        if (target) {
          console.log('🛒 Intercepted cart click on:', target, 'selector matched:', target.outerHTML.substring(0, 100));
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.openDrawer();
          return false;
        }
      }, true);
      
      // Also intercept by checking href attributes
      document.addEventListener('click', (e) => {
        const target = e.target.closest('a');
        if (target && target.href && target.href.includes('/cart')) {
          console.log('🛒 Intercepted cart link:', target.href, target);
          e.preventDefault();
          e.stopPropagation();
          this.openDrawer();
          return false;
        }
      }, true);
      
      // Also listen for any clicks and log them for debugging
      document.addEventListener('click', (e) => {
        if (e.target.textContent && e.target.textContent.toLowerCase().includes('cart')) {
          console.log('🛒 DEBUG: Click on element containing "cart":', e.target, e.target.outerHTML.substring(0, 100));
        }
      }, false);
    }

    overrideShopifyCartFunctions() {
      console.log('🛒 Overriding Shopify cart functions...');
      
      // Replace with our function
      const openUpCart = () => {
        console.log('🛒 Shopify cart function intercepted!');
        this.openDrawer();
      };
      
      window.openCart = openUpCart;
      window.openCartDrawer = openUpCart;
      window.toggleCartDrawer = openUpCart;
      window.showCartDrawer = openUpCart;
      window.openMiniCart = openUpCart;
      
      // Override theme-specific functions
      if (window.theme && window.theme.cart) {
        window.theme.cart.open = openUpCart;
        window.theme.cart.toggle = openUpCart;
      }
      
      // Override jQuery-based functions
      if (window.jQuery) {
        const $ = window.jQuery;
        // Remove existing cart drawer event handlers
        $(document).off('click.cartDrawer click.cart-drawer click.minicart');
      }
    }

    watchForNewCartDrawers() {
      console.log('🛒 Watching for new cart drawers...');
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the node itself is a cart drawer
              const cartSelectors = [
                '#CartPopup', '#cart-drawer', '.cart-drawer', '.drawer--cart'
              ];
              
              cartSelectors.forEach(selector => {
                if (node.matches && node.matches(selector) && !node.id.includes('upcart')) {
                  console.log('🛒 New theme cart drawer detected, hiding:', node);
                  node.style.setProperty('display', 'none', 'important');
                  node.style.setProperty('visibility', 'hidden', 'important');
                  node.setAttribute('data-upcart-hidden', 'true');
                }
                
                // Check children too
                if (node.querySelectorAll) {
                  const children = node.querySelectorAll(selector);
                  children.forEach(child => {
                    if (!child.id.includes('upcart')) {
                      console.log('🛒 New theme cart drawer child detected, hiding:', child);
                      child.style.setProperty('display', 'none', 'important');
                      child.style.setProperty('visibility', 'hidden', 'important');
                      child.setAttribute('data-upcart-hidden', 'true');
                    }
                  });
                }
              });
            }
          });
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-drawer-open']
      });
    }

    hijackAjaxCartOperations() {
      console.log('🛒 Hijacking AJAX cart operations...');
      
      // Override fetch for cart operations
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const [url] = args;
        const urlString = url.toString();
        
        if (urlString.includes('/cart/add.js') || urlString.includes('/cart/add')) {
          console.log('🛒 Intercepted AJAX cart add:', urlString);
          try {
            const result = await originalFetch(...args);
            // Update our cart and show drawer
            await this.fetchCart();
            this.updateDrawerContent();
            this.openDrawer();
            return result;
          } catch (error) {
            console.error('🛒 Error in cart add:', error);
            throw error;
          }
        }
        
        return originalFetch(...args);
      };
      
      // Override XMLHttpRequest for older themes
      const originalXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (url.includes('/cart/add') || url.includes('/cart/change')) {
          console.log('🛒 Intercepted XHR cart operation:', url);
          this.addEventListener('load', () => {
            if (this.status === 200) {
              window.UpCart.fetchCart().then(() => {
                window.UpCart.updateDrawerContent();
                window.UpCart.openDrawer();
              });
            }
          });
        }
        return originalXHROpen.call(this, method, url, ...args);
      };
    }

    // Remove old functions - now using aggressive hijacking approach

    isCartDrawerElement(element) {
      const cartDrawerSelectors = [
        'data-cart-drawer',
        'cart-drawer',
        'drawer--cart',
        'cart__drawer',
        'sidecart',
        'mini-cart'
      ];
      
      return cartDrawerSelectors.some(selector => 
        element.hasAttribute && element.hasAttribute(selector) ||
        element.classList && element.classList.contains(selector) ||
        element.id && element.id.includes(selector.replace('-', ''))
      );
    }

    injectIntoCartDrawer(drawerElement) {
      // Prevent duplicate injection
      if (drawerElement.querySelector('.upcart-injected')) {
        console.log('🛒 Already injected into this drawer');
        return;
      }
      
      console.log('🛒 Injecting UpCart into cart drawer...', drawerElement);
      
      // For CartPopup (Dawn theme pattern)
      if (drawerElement.id === 'CartPopup' || drawerElement.classList.contains('styles_CartPreview__')) {
        this.injectIntoDawnThemeCart(drawerElement);
        return;
      }
      
      // Generic injection for other themes
      this.injectIntoGenericCart(drawerElement);
    }

    injectIntoDawnThemeCart(cartElement) {
      console.log('🛒 Injecting into Dawn-style cart');
      
      // Look for the cart body where products are listed
      const cartBody = cartElement.querySelector('.upcart-cart-body, .styles_CartPreview__body__');
      if (!cartBody) {
        console.log('🛒 Cart body not found in Dawn cart');
        return;
      }
      
      // Create free shipping section (inject after rewards if present, or at top)
      const rewardsSection = cartBody.querySelector('.upcart-rewards, .styles_TieredRewards__');
      if (!rewardsSection && this.settings.enableFreeShipping) {
        const freeShippingSection = document.createElement('div');
        freeShippingSection.className = 'upcart-injected upcart-rewards styles_TieredRewards__ UpcartDesignSettings__cartTextColor';
        freeShippingSection.innerHTML = this.getDawnStyleFreeShipping();
        
        // Insert at the beginning of cart body
        cartBody.insertBefore(freeShippingSection, cartBody.firstChild);
      }
      
      // Create upsells section (inject before footer/checkout area)
      if (this.settings.enableUpsells) {
        const bottomModules = cartElement.querySelector('.styles_CartPreview__bottomModules__');
        if (bottomModules && !bottomModules.querySelector('.upcart-injected-upsells')) {
          const upsellsSection = document.createElement('div');
          upsellsSection.className = 'upcart-injected upcart-injected-upsells';
          upsellsSection.innerHTML = `
            <div style="padding: 20px; border-top: 1px solid #eee;">
              <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; text-align: center;">Recommended for you</h4>
              <div id="upcart-dawn-upsells" style="display: flex; gap: 12px; overflow-x: auto;">
                Loading recommendations...
              </div>
            </div>
          `;
          
          bottomModules.insertBefore(upsellsSection, bottomModules.firstChild);
          this.loadUpsellsForDrawer('upcart-dawn-upsells');
        }
      }
      
      console.log('🛒 Dawn-style injection completed');
    }

    injectIntoGenericCart(drawerElement) {
      console.log('🛒 Injecting into generic cart drawer');
      
      // Create our cart drawer enhancement
      const upCartSection = document.createElement('div');
      upCartSection.className = 'upcart-injected';
      upCartSection.innerHTML = `
        <div class="upcart-drawer-enhancement">
          ${this.settings.enableFreeShipping ? `<div class="upcart-free-shipping-progress" style="padding: 16px; border-bottom: 1px solid #eee;">${this.getFreeShippingHTML()}</div>` : ''}
          ${this.settings.enableUpsells ? `<div class="upcart-upsells-section" style="padding: 16px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">You might also like</h4>
            <div class="upcart-upsells-grid" id="upcart-drawer-upsells">
              Loading recommendations...
            </div>
          </div>` : ''}
        </div>
      `;
      
      // Try to find a good place to inject (before footer/actions)
      const footer = drawerElement.querySelector('.cart-footer, .drawer__footer, [class*="footer"], .cart-actions, .drawer-actions, .styles_Footer__');
      if (footer) {
        footer.parentNode.insertBefore(upCartSection, footer);
      } else {
        // Fallback: append to the drawer
        drawerElement.appendChild(upCartSection);
      }
      
      // Load upsells for this drawer
      if (this.settings.enableUpsells) {
        this.loadUpsellsForDrawer('upcart-drawer-upsells');
      }
      
      console.log('🛒 Generic injection completed');
    }

    getDawnStyleFreeShipping() {
      if (!this.cart) return '';
      
      const threshold = this.settings.freeShippingThreshold * 100;
      const remaining = threshold - this.cart.total_price;
      const progress = Math.min((this.cart.total_price / threshold) * 100, 100);
      
      if (remaining > 0) {
        return `
          <div class="upcart-rewards-message">${this.settings.shippingMessage.replace('{amount}', this.formatMoney(remaining))}</div>
          <div class="upcart-rewards-bar-background styles_TieredRewards__progressBar__" style="background-color: rgb(226, 226, 226);">
            <div class="upcart-rewards-bar-foreground styles_Rewards__progressBar--progress__" style="background-color: rgb(147, 211, 255); width: ${progress}%;"></div>
          </div>
        `;
      } else {
        return `
          <div class="upcart-rewards-message" style="color: #4CAF50;">${this.settings.shippingSuccessMessage}</div>
          <div class="upcart-rewards-bar-background styles_TieredRewards__progressBar__" style="background-color: rgb(226, 226, 226);">
            <div class="upcart-rewards-bar-foreground styles_Rewards__progressBar--progress__" style="background-color: rgb(147, 211, 255); width: 100%;"></div>
          </div>
        `;
      }
    }

    getFreeShippingHTML() {
      if (!this.settings.enableFreeShipping || !this.cart) return '';
      
      const threshold = this.settings.freeShippingThreshold * 100;
      const remaining = threshold - this.cart.total_price;
      const progress = Math.min((this.cart.total_price / threshold) * 100, 100);
      
      if (remaining > 0) {
        return `
          <div style="text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 14px;">
              ${this.settings.shippingMessage.replace('{amount}', this.formatMoney(remaining))}
            </p>
            <div style="width: 100%; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden;">
              <div style="width: ${progress}%; height: 100%; background: #4CAF50; transition: width 0.3s ease;"></div>
            </div>
          </div>
        `;
      } else {
        return `
          <div style="text-align: center; color: #4CAF50;">
            <p style="margin: 0; font-size: 14px; font-weight: 600;">
              ${this.settings.shippingSuccessMessage}
            </p>
          </div>
        `;
      }
    }

    loadUpsellsForDrawer(containerId) {
      // Similar to existing loadUpsells but for drawer
      fetch('/apps/cart-drawer/api/upsells')
        .then(response => response.json())
        .then(products => {
          const container = document.getElementById(containerId);
          if (container && products.length > 0) {
            container.innerHTML = this.renderUpsellsGrid(products.slice(0, 3)); // Show max 3 in drawer
          } else if (container) {
            container.innerHTML = '<p style="font-size: 12px; color: #666;">No recommendations available</p>';
          }
        })
        .catch(error => {
          console.error('Error loading drawer upsells:', error);
          const container = document.getElementById(containerId);
          if (container) {
            container.innerHTML = '<p style="font-size: 12px; color: #666;">Unable to load recommendations</p>';
          }
        });
    }

    async fetchCart() {
      try {
        console.log('🛒 Fetching cart data...');
        const response = await fetch('/cart.js');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.cart = await response.json();
        console.log('🛒 Cart data fetched successfully:', this.cart);
        return this.cart;
      } catch (error) {
        console.error('🛒 Error fetching cart:', error);
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
      
      // Use default values if cart data isn't loaded yet
      const itemCount = this.cart ? this.cart.item_count : 0;
      const totalPrice = this.cart ? this.cart.total_price : 0;
      
      stickyCart.innerHTML = `
        <button class="upcart-trigger" aria-label="Open cart">
          ${this.getCartIcon()}
          <span class="upcart-count">${itemCount}</span>
          <span class="upcart-total">${this.formatMoney(totalPrice)}</span>
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

      // Use default values if cart data isn't loaded yet
      const itemCount = this.cart ? this.cart.item_count : 0;
      const totalPrice = this.cart ? this.cart.total_price : 0;

      const drawer = document.createElement('div');
      drawer.id = 'upcart-drawer';
      drawer.className = 'upcart-drawer';
      drawer.innerHTML = `
        <div class="upcart-drawer-overlay"></div>
        <div class="upcart-drawer-content">
          <div class="upcart-drawer-header">
            <h3>Your Cart (<span class="upcart-drawer-count">${itemCount}</span>)</h3>
            <button class="upcart-drawer-close" aria-label="Close cart">×</button>
          </div>
          <div class="upcart-drawer-items"></div>
          <div class="upcart-drawer-upsells"></div>
          <div class="upcart-drawer-footer">
            <div class="upcart-subtotal">
              <span>Subtotal:</span>
              <span class="upcart-subtotal-price">${this.formatMoney(totalPrice)}</span>
            </div>
            <div class="upcart-actions">
              <a href="/cart" class="upcart-view-cart">View Cart</a>
              <button class="upcart-checkout" onclick="window.location.href='/checkout'">
                Checkout • ${this.formatMoney(this.cart.total_price)}
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(drawer);
      
      // Event listeners
      drawer.querySelector('.upcart-drawer-close').addEventListener('click', () => {
        this.closeDrawer();
      });
      
      drawer.querySelector('.upcart-drawer-overlay').addEventListener('click', () => {
        this.closeDrawer();
      });
      
      // Load cart items
      this.updateDrawerContent();
    }

    updateDrawerContent() {
      const itemsContainer = document.querySelector('.upcart-drawer-items');
      if (!itemsContainer) return;

      if (this.cart.items.length === 0) {
        itemsContainer.innerHTML = `
          <div class="upcart-empty">
            <p>Your cart is empty</p>
            <a href="/collections/all" class="upcart-continue-shopping">Continue Shopping</a>
          </div>
        `;
        return;
      }

      itemsContainer.innerHTML = this.cart.items.map(item => `
        <div class="upcart-item" data-variant-id="${item.variant_id}" data-key="${item.key}">
          <img src="${item.image}" alt="${item.title}" class="upcart-item-image">
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
        </div>
      `).join('');

      // Add quantity handlers
      this.attachQuantityHandlers();
      
      // Load upsells if enabled
      if (this.settings.enableUpsells) {
        this.loadUpsells();
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

    updateFreeShippingBar() {
      const bar = document.getElementById('upcart-shipping-bar');
      if (!bar) return;

      const threshold = this.settings.freeShippingThreshold * 100; // Convert to cents
      const remaining = threshold - this.cart.total_price;
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
      const drawer = document.getElementById('upcart-drawer');
      console.log('🛒 Found drawer element:', !!drawer, drawer);
      if (drawer) {
        console.log('🛒 Adding open class to drawer');
        drawer.classList.add('open');
        document.body.classList.add('upcart-drawer-open');
        this.isOpen = true;
        console.log('🛒 Drawer should now be open');
      } else {
        console.error('🛒 No drawer element found! Creating drawer...');
        this.createDrawer();
        // Try again after creating
        setTimeout(() => {
          const newDrawer = document.getElementById('upcart-drawer');
          if (newDrawer) {
            newDrawer.classList.add('open');
            document.body.classList.add('upcart-drawer-open');
            this.isOpen = true;
          }
        }, 100);
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
  console.log('🛒 Initializing UpCart...');
  console.log('🛒 Available settings:', window.UpCartSettings);
  window.UpCart = new UpCartDrawer();
  console.log('🛒 UpCart instance created:', window.UpCart);
})();
