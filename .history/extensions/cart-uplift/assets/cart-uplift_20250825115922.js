/* Cart Uplift – COMPLETE REWRITE
   - Robust open/close with animation locks.
   - Click outside & Escape to close.
   - Global blur neutraliser (no stuck blur).
   - Quantity steppers with optimistic loading state.
   - Silent updates (no reopen jitter).
   - Simple product recommendations.
   - Sticky cart button.
   - No auto-instantiation here; your Liquid does that.
*/
(function () {
  'use strict';

  class CartUpliftDrawer {
    constructor(settings) {
      this.settings       = settings || window.CartUpliftSettings || {};
      this.cart           = null;
      this.isOpen         = false;

      // guards & bookkeeping
      this._isAnimating   = false;
      this._quantityBusy  = false;
      this._unbindFns     = [];
      this._eventsBound   = false;
      this._fetchPatched  = false;
      this._themeAddBound = false;
      this._blurMonitor   = null;

      this.initPromise    = this.init();
    }

    /* -------------------- Lifecycle -------------------- */
    async init() {
      if (document.readyState === 'loading') {
        await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
      }
      await this.setup();
    }

    async setup() {
      await this.fetchCart();

      this.createDrawer();
      if (this.settings.enableStickyCart && (!this.settings.showOnlyOnCartPage)) {
        this.createStickyCart();
      }

      this.setupCleanCartReplacement();
      this.installAddToCartMonitoring();
      this.checkDiscountRedirect();
      this.hideAllThemeCartDrawers();
      this.ensureDrawerRendered();
    }

    /* -------------------- DOM creation -------------------- */
    createDrawer() {
      let container = document.getElementById('cartuplift-app-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'cartuplift-app-container';
        container.innerHTML = `
          <div id="cartuplift-backdrop" class="cartuplift-backdrop"></div>
          <div id="cartuplift-cart-popup" class="cartuplift-cart-popup"></div>
        `;
        document.body.appendChild(container);
      }

      const popup = container.querySelector('#cartuplift-cart-popup');
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();

      // safety render checks
      setTimeout(() => this.ensureDrawerRendered('t+100'), 100);
      setTimeout(() => this.ensureDrawerRendered('t+500'), 500);
    }

    createStickyCart() {
      const existing = document.getElementById('upcart-sticky');
      if (existing) existing.remove();

      const sticky = document.createElement('div');
      sticky.id = 'upcart-sticky';
      sticky.className = `upcart-sticky ${this.settings.cartPosition || 'bottom-right'}`;
      sticky.innerHTML = `
        <button class="upcart-trigger" aria-label="Open cart">
          ${this.getCartIcon()}
          <span class="upcart-count">${this.cart?.item_count || 0}</span>
          <span class="upcart-total">${this.formatMoney(this.cart?.total_price || 0)}</span>
        </button>
      `;
      document.body.appendChild(sticky);
      const btn = sticky.querySelector('.upcart-trigger');
      const onClick = () => this.openDrawer();
      btn.addEventListener('click', onClick);
      this._unbindFns.push(() => btn.removeEventListener('click', onClick));
    }

    /* -------------------- Markup -------------------- */
    getDrawerHTML() {
      const itemCount = this.cart?.item_count || 0;
      const total     = this.cart?.total_price || 0;

      return `
        <div class="upcart-cart cu-cart">
          <div class="cu-header">
            <div class="cu-title">CART <span class="cu-count">(${itemCount})</span></div>
            <button class="cu-close" aria-label="Close cart">×</button>
          </div>

          ${this.settings.enableFreeShipping ? `
            <div class="cu-freebar" role="status" aria-live="polite">
              <div class="cu-freebar-msg">${this.getFreeShippingText()}</div>
              <div class="cu-freebar-track"><div class="cu-freebar-fill" style="width:${this.getFreeShippingPct()}%"></div></div>
            </div>` : ``}

          <div class="upcart-items cu-items">${this.getCartItemsHTML()}</div>

          ${this.settings.enableUpsells ? `
            <div class="cu-recos">
              <div class="cu-recos-head">
                <span>RECOMMENDED FOR YOU</span>
                <button class="cu-recos-toggle" aria-expanded="true" aria-controls="cu-recos-list">⌄</button>
              </div>
              <div id="cu-recos-list" class="cu-recos-list"></div>
            </div>` : ``}

          <div class="upcart-footer cu-footer">
            <div class="cu-subtotal">
              <span>Subtotal</span>
              <span class="cu-subtotal-amount">${this.formatMoney(total)}</span>
            </div>
            <button class="cu-checkout" onclick="window.cartUpliftDrawer.proceedToCheckout()">CHECKOUT</button>
            <div class="cu-accelerated">
              <button class="cu-wallet cu-wallet--paypal" aria-label="PayPal" onclick="window.cartUpliftDrawer.proceedToCheckout()">PayPal</button>
              <button class="cu-wallet cu-wallet--shop"   aria-label="Shop Pay" onclick="window.cartUpliftDrawer.proceedToCheckout()">shop<span>Pay</span></button>
            </div>
            ${this.settings.enableNotes ? `
              <button class="cu-note-toggle" type="button" aria-controls="cu-note-area" aria-expanded="false">Add Gift Note &amp; Logo Free Packaging +</button>
              <div id="cu-note-area" class="cu-note-area" hidden>
                <label class="upcart-notes-label" for="upcart-order-notes">Order notes</label>
                <textarea id="upcart-order-notes" class="upcart-notes-textarea" rows="3" maxlength="500" placeholder="Special instructions..."></textarea>
              </div>` : ``}
          </div>
        </div>
      `;
    }

    getCartItemsHTML() {
      if (!this.cart || !this.cart.items || !this.cart.items.length) {
        return `<div class="upcart-empty" style="padding:40px 20px;text-align:center;color:#666"><h4>Your cart is empty</h4><p>Add some products to get started!</p></div>`;
      }
      return `
        <div class="cu-lineitems">
          ${this.cart.items.map((it, idx) => `
            <article class="cu-item" data-variant-id="${it.variant_id}" data-line="${idx + 1}">
              <figure class="cu-thumb">
                <img src="${it.image || (it.featured_image && it.featured_image.url) || ''}" alt="${it.product_title}">
              </figure>
              <div class="cu-meta">
                <a class="cu-name" href="${it.url}">${it.product_title}</a>
                ${it.variant_title ? `<div class="cu-variant">${it.variant_title}</div>` : ``}
                <div class="cu-qtywrap" role="group" aria-label="Quantity">
                  <button class="cu-step cu-step--minus" data-line="${idx + 1}" aria-label="Decrease">−</button>
                  <input class="cu-qty" type="number" inputmode="numeric" value="${it.quantity}" min="0" data-line="${idx + 1}">
                  <button class="cu-step cu-step--plus"  data-line="${idx + 1}" aria-label="Increase">+</button>
                </div>
              </div>
              <div class="cu-price">${this.formatMoney(it.final_price)}</div>
              <button class="cu-remove" data-line="${idx + 1}" aria-label="Remove item">×</button>
            </article>
          `).join('')}
        </div>
      `;
    }

    /* -------------------- Event binding -------------------- */
    attachDrawerEvents() {
      const container = document.getElementById('cartuplift-app-container');
      if (!container) return;

      const closeBtn = container.querySelector('.cu-close');
      if (closeBtn) {
        const handler = () => this.closeDrawer();
        closeBtn.addEventListener('click', handler);
        this._unbindFns.push(() => closeBtn.removeEventListener('click', handler));
      }

      const backdrop = container.querySelector('#cartuplift-backdrop');
      if (backdrop) {
        const handler = (e) => { e.stopPropagation(); this.closeDrawer(); };
        backdrop.addEventListener('click', handler);
        this._unbindFns.push(() => backdrop.removeEventListener('click', handler));
      }

      // Global once
      if (!this._eventsBound) {
        const onEsc = (e) => { if (e.key === 'Escape' && this.isOpen) this.closeDrawer(); };
        document.addEventListener('keydown', onEsc);
        this._unbindFns.push(() => document.removeEventListener('keydown', onEsc));

        // Click outside (capture to beat theme handlers)
        const onDown = (e) => {
          if (!this.isOpen) return;
          const inDrawer = e.target.closest('.cu-cart');
          const isTrigger = e.target.closest('#upcart-sticky');
          if (!inDrawer && !isTrigger) this.closeDrawer();
        };
        document.addEventListener('mousedown', onDown, true);
        this._unbindFns.push(() => document.removeEventListener('mousedown', onDown, true));

        this._eventsBound = true;
      }

      // Steppers
      const onStepper = (e) => {
        const minus = e.target.closest('.cu-step--minus');
        const plus  = e.target.closest('.cu-step--plus');
        if (!minus && !plus) return;
        const line  = (minus || plus).dataset.line;
        const input = container.querySelector(`.cu-qty[data-line="${line}"]`);
        let value   = Math.max(0, parseInt(input.value || '0', 10));
        value = minus ? Math.max(0, value - 1) : value + 1;
        input.value = value;
        this.updateQuantity(line, value);
      };
      container.addEventListener('click', onStepper);
      this._unbindFns.push(() => container.removeEventListener('click', onStepper));

      // Qty direct input
      const onQtyChange = (e) => {
        if (!e.target.classList.contains('cu-qty')) return;
        const line = e.target.dataset.line;
        const qty  = Math.max(0, parseInt(e.target.value || '0', 10));
        this.updateQuantity(line, qty);
      };
      container.addEventListener('change', onQtyChange);
      this._unbindFns.push(() => container.removeEventListener('change', onQtyChange));

      // Remove
      const onRemove = (e) => {
        const btn = e.target.closest('.cu-remove');
        if (!btn) return;
        this.updateQuantity(btn.dataset.line, 0);
      };
      container.addEventListener('click', onRemove);
      this._unbindFns.push(() => container.removeEventListener('click', onRemove));

      // Notes toggle
      const noteToggle = container.querySelector('.cu-note-toggle');
      if (noteToggle) {
        const area = container.querySelector('#cu-note-area');
        const handler = () => {
          const hidden = area.hasAttribute('hidden');
          noteToggle.setAttribute('aria-expanded', String(hidden));
          if (hidden) area.removeAttribute('hidden'); else area.setAttribute('hidden', '');
        };
        noteToggle.addEventListener('click', handler);
        this._unbindFns.push(() => noteToggle.removeEventListener('click', handler));
      }

      // Recs
      const recToggle = container.querySelector('.cu-recos-toggle');
      if (recToggle) {
        const list = container.querySelector('#cu-recos-list');
        const handler = () => {
          const open = recToggle.getAttribute('aria-expanded') === 'true';
          recToggle.setAttribute('aria-expanded', String(!open));
          list.style.display = open ? 'none' : '';
        };
        recToggle.addEventListener('click', handler);
        this._unbindFns.push(() => recToggle.removeEventListener('click', handler));
      }

      if (this.settings.enableUpsells) this.loadRecommendations();
      if (this.settings.enableNotes)  this.loadOrderNotes();
    }

    /* -------------------- Fetch & updates -------------------- */
    async fetchCart() {
      try {
        const res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
        this.cart = await res.json();
      } catch (e) {
        console.error('Cart fetch failed', e);
        this.cart = { items: [], item_count: 0, total_price: 0 };
      }
    }

    async updateQuantity(line, quantity) {
      if (this._quantityBusy) return;
      this._quantityBusy = true;

      // row loading state
      const row = document.querySelector(`.cu-item[data-line="${line}"]`);
      if (row) row.classList.add('loading');

      try {
        const fd = new FormData();
        fd.append('line', line);
        fd.append('quantity', quantity);

        const res = await fetch('/cart/change.js', { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.cart = await res.json();

        this.updateDrawerContent(); // preserves open state
      } catch (e) {
        console.error('Quantity update error', e);
      } finally {
        if (row) row.classList.remove('loading');
        this._quantityBusy = false;
      }
    }

    updateDrawerContent() {
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup || !this.cart) return;

      const wasOpen = !!popup.querySelector('.upcart-cart.is-open');
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();

      // keep state
      if (wasOpen) popup.querySelector('.upcart-cart')?.classList.add('is-open');

      // sticky badge
      const count = document.querySelector('.upcart-count');
      const total = document.querySelector('.upcart-total');
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);

      this.ensureDrawerRendered('after-update');
    }

    updateDrawerContentForAutoOpen() {
      const popup = document.querySelector('#cartuplift-cart-popup');
      if (!popup || !this.cart) return;
      popup.innerHTML = this.getDrawerHTML();
      this.attachDrawerEvents();

      // sticky badge
      const count = document.querySelector('.upcart-count');
      const total = document.querySelector('.upcart-total');
      if (count) count.textContent = this.cart.item_count;
      if (total) total.textContent = this.formatMoney(this.cart.total_price);
    }

    /* -------------------- Open/Close -------------------- */
    openDrawer() {
      if (this._isAnimating || this.isOpen) return;
      this._isAnimating = true;

      const container = document.getElementById('cartuplift-app-container');
      if (!container) { this._isAnimating = false; return; }

      document.documentElement.classList.add('cartuplift-drawer-open');
      document.body.classList.add('cartuplift-drawer-open');
      container.style.display = '';
      container.classList.add('cartuplift-active');

      const popup   = container.querySelector('#cartuplift-cart-popup');
      if (!popup || !popup.querySelector('.upcart-cart')) {
        popup.innerHTML = this.getDrawerHTML();
        this.attachDrawerEvents();
      }

      const drawer  = container.querySelector('.upcart-cart');
      const backdrop = container.querySelector('#cartuplift-backdrop');

      backdrop?.classList.remove('is-closing');
      drawer?.classList.remove('is-closing');
      drawer?.classList.add('is-open');

      // Start monitoring for theme interference
      this.startBlurMonitoring();
      // Immediate cleanup to avoid flash
      this.forceCleanThemeArtifacts();

      // settle locks
      setTimeout(() => { this._isAnimating = false; this.isOpen = true; }, 0);

      // Event hook
      window.dispatchEvent(new CustomEvent('cartuplift:opened'));
    }

    closeDrawer() {
      if (this._isAnimating || !this.isOpen) return;
      this._isAnimating = true;

      const container = document.getElementById('cartuplift-app-container');
      const drawer    = container?.querySelector('.upcart-cart');
      const backdrop  = container?.querySelector('#cartuplift-backdrop');

      drawer?.classList.remove('is-open');
      drawer?.classList.add('is-closing');
      backdrop?.classList.add('is-closing');

      const finish = () => {
        container?.classList.remove('cartuplift-active');
        if (container) container.style.display = 'none';

        document.documentElement.classList.remove('cartuplift-drawer-open');
        document.body.classList.remove('cartuplift-drawer-open');

        drawer?.classList.remove('is-closing');
        backdrop?.classList.remove('is-closing');

        this.restorePageInteraction();
        this.stopBlurMonitoring();

        this.isOpen = false;
        this._isAnimating = false;

        window.dispatchEvent(new CustomEvent('cartuplift:closed'));
      };

      const onEnd = () => finish();
      if (drawer)   drawer.addEventListener('animationend', onEnd, { once: true });
      if (backdrop) backdrop.addEventListener('animationend', onEnd, { once: true });
      setTimeout(finish, 400); // safety
    }

    /* -------------------- Theme interference cleanup -------------------- */
    forceCleanThemeArtifacts() {
      const classes = [
        'js-drawer-open','drawer-open','modal-open','overflow-hidden','no-scroll',
        'cart-open','drawer-opened','cart-drawer-open','navigation-open','scroll-lock',
        'popup-open','sidebar-open','menu-open','drawer-is-open','has-drawer-open',
        'overlay-active','fixed','locked','noscroll','no-scroll-y','scroll-disabled',
        'modal-active','dialog-open','adding-to-cart','cart-loading','product-loading'
      ];
      classes.forEach(c => { document.documentElement.classList.remove(c); document.body.classList.remove(c); });

      // inline styles on html/body
      [document.documentElement, document.body].forEach(el => {
        ['position','top','left','overflow','overflowY','overflowX','height','width','maxHeight',
         'paddingRight','marginRight','filter','webkitFilter','backdropFilter','webkitBackdropFilter',
         'opacity','transform','pointerEvents','userSelect','touchAction'].forEach(p => { el.style[p] = ''; });
      });

      // remove inert / aria-hidden on content
      document.querySelectorAll('[inert]').forEach(el => el.removeAttribute('inert'));
      document.querySelectorAll('[aria-hidden="true"]').forEach(el => el.removeAttribute('aria-hidden'));

      // collapse common overlays
      const overlays = [
        '.drawer-overlay','.modal-overlay','.backdrop','.overlay',
        '.cart-drawer-overlay','.js-overlay','.menu-overlay','.site-overlay',
        '.page-overlay','.theme-overlay','[data-overlay]','[data-backdrop]'
      ];
      overlays.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (!el.closest('#cartuplift-app-container')) {
            el.style.display = 'none'; el.style.opacity = '0'; el.style.pointerEvents = 'none'; el.style.zIndex = '-1';
          }
        });
      });
    }

    restorePageInteraction() {
      this.forceCleanThemeArtifacts(); // covers it thoroughly
    }

    startBlurMonitoring() {
      if (this._blurMonitor) return;
      this._blurMonitor = setInterval(() => {
        if (!this.isOpen) return;
        // Check a few likely elements for any blur that reappears
        document.querySelectorAll('main,#MainContent,.shopify-section,body > *:not(#cartuplift-app-container)').forEach(el => {
          const cs = window.getComputedStyle(el);
          if ((cs.filter && cs.filter !== 'none') || (cs.backdropFilter && cs.backdropFilter !== 'none')) {
            el.style.filter = 'none'; el.style.webkitFilter = 'none';
            el.style.backdropFilter = 'none'; el.style.webkitBackdropFilter = 'none';
          }
        });
      }, 250);
    }

    stopBlurMonitoring() { if (this._blurMonitor) { clearInterval(this._blurMonitor); this._blurMonitor = null; } }

    /* -------------------- Intercept cart triggers -------------------- */
    setupCleanCartReplacement() {
      this.hideThemeCartElements();
      this.interceptCartClicks();
    }

    hideThemeCartElements() {
      const style = document.createElement('style');
      style.id = 'upcart-theme-hiding';
      style.textContent = `
        #CartDrawer:not(#upcart-cart-popup),
        .cart-drawer:not(.cu-cart),
        .drawer--cart:not(.cu-cart),
        [data-cart-drawer]:not([data-upcart-hidden]) { display:none !important; }
      `;
      document.head.appendChild(style);
    }

    hideAllThemeCartDrawers() {
      ['#CartDrawer','.cart-drawer','.drawer--cart','#sidebar-cart','.sidebar-cart','#mini-cart']
        .forEach(sel => document.querySelectorAll(sel).forEach(el => { if (!el.id?.includes('upcart')) el.setAttribute('data-upcart-hidden','true'); }));
      const style = document.createElement('style');
      style.id = 'upcart-hiding-styles';
      style.textContent = `[data-upcart-hidden="true"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}`;
      document.head.appendChild(style);
    }

    interceptCartClicks() {
      const selectors = [
        '[data-cart-drawer-toggle]','.cart-toggle','.js-drawer-open-cart','.header__cart-toggle',
        '.cart-icon','.cart-link','[data-drawer-toggle="cart"]','.cart-button','#cart-icon-bubble',
        'a[href="/cart"]','a[href*="/cart"]','.header-cart','[href="/cart"]','.icon-cart'
      ].join(',');
      const handler = (e) => {
        const t = e.target.closest(selectors);
        if (!t) return;
        e.preventDefault(); e.stopPropagation();
        this.openDrawer();
      };
      document.addEventListener('click', handler, true);
      this._unbindFns.push(() => document.removeEventListener('click', handler, true));
    }

    /* -------------------- Add-to-cart monitoring -------------------- */
    installAddToCartMonitoring() {
      if (this._fetchPatched) return;
      this._fetchPatched = true;

      const _fetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        let url = args[0];
        if (url && typeof url === 'object' && 'url' in url) url = url.url;

        const isAdd = typeof url === 'string' && (url.includes('/cart/add') || url.includes('/cart/add.js'));
        const resp  = await _fetch(...args);

        if (isAdd && resp.ok) {
          setTimeout(async () => {
            await this.fetchCart();
            this.updateDrawerContentForAutoOpen();
            if (this.settings.autoOpenCart && !this.isOpen && !this._isAnimating) this.openDrawer();
          }, 50);
        }
        return resp;
      };

      // Theme events
      const onAdded = () => {
        if (!this.settings.autoOpenCart || this._isAnimating) return;
        this.fetchCart().then(() => {
          this.updateDrawerContentForAutoOpen();
          if (!this.isOpen) this.openDrawer();
        });
      };
      if (!this._themeAddBound) {
        document.addEventListener('cart:added', onAdded);
        document.addEventListener('product:added', onAdded);
        this._unbindFns.push(() => {
          document.removeEventListener('cart:added', onAdded);
          document.removeEventListener('product:added', onAdded);
        });
        this._themeAddBound = true;
      }
    }

    /* -------------------- Recommendations -------------------- */
    async loadRecommendations() {
      try {
        const first = this.cart?.items?.[0];
        if (!first || !first.product_id) return;
        const res = await fetch(`/recommendations/products.json?product_id=${first.product_id}&limit=${this.settings.maxUpsells || 4}`);
        if (!res.ok) return;
        const data = await res.json();
        this.renderRecommendations(data.products || []);
      } catch (_) {}
    }

    renderRecommendations(products) {
      const wrap = document.getElementById('cu-recos-list');
      if (!wrap) return;
      if (!products.length) { wrap.innerHTML = ''; return; }

      wrap.innerHTML = products.slice(0, this.settings.maxUpsells || 4).map(p => {
        const v = (p.variants || [])[0];
        const price = (v?.price ?? p.price ?? 0);
        return `
          <div class="cu-reco" data-product-id="${p.id}">
            <img class="cu-reco-img" src="${(p.images?.[0]?.src) || p.featured_image}" alt="${p.title}">
            <div class="cu-reco-title">${p.title}</div>
            <div class="cu-reco-row">
              <span class="cu-reco-price">${this.formatMoney(price)}</span>
              ${v ? `<button class="cu-reco-add" data-variant-id="${v.id}">Add+</button>` : ``}
            </div>
          </div>`;
      }).join('');

      // one-time binding per render
      const onClick = async (e) => {
        const btn = e.target.closest('.cu-reco-add');
        if (!btn) return;
        btn.disabled = true;
        try {
          await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id: btn.dataset.variantId, quantity: 1 })
          });
          await this.fetchCart();
          this.updateDrawerContent(); // keep open
        } finally { btn.disabled = false; }
      };
      wrap.addEventListener('click', onClick, { once: true });
      this._unbindFns.push(() => wrap.removeEventListener('click', onClick));
    }

    /* -------------------- Helpers & utilities -------------------- */
    ensureDrawerRendered(context = '') {
      const popup = document.querySelector('#cartuplift-cart-popup');
      const ok = !!popup?.querySelector('.cu-cart');
      if (!ok && this.cart) {
        popup.innerHTML = this.getDrawerHTML();
        this.attachDrawerEvents();
      }
    }

    getFreeShippingPct() {
      if (!this.cart || !this.settings.enableFreeShipping) return 0;
      const threshold = (this.settings.freeShippingThreshold || 0) * 100;
      const current   = this.cart.total_price || 0;
      if (!threshold) return 0;
      return Math.min(100, Math.max(0, (current / threshold) * 100));
    }

    getFreeShippingText() {
      if (!this.cart || !this.settings.enableFreeShipping) return '';
      const threshold = (this.settings.freeShippingThreshold || 0) * 100;
      const current   = this.cart.total_price || 0;
      const remaining = Math.max(0, threshold - current);
      return remaining > 0
        ? `You're ${this.formatMoney(remaining)} away from free shipping`
        : `You've earned free shipping!`;
    }

    getCartIcon() {
      const icons = {
        cart: '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
        bag:  '<svg viewBox="0 0 24 24"><path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4V6z"/></svg>',
        basket:'<svg viewBox="0 0 24 24"><path d="M5.5 21c.8 0 1.5-.7 1.5-1.5S6.3 18 5.5 18 4 18.7 4 19.5 4.7 21 5.5 21zm13 0c.8 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5-1.5.7-1.5 1.5.7 1.5 1.5 1.5zm-10-9l1.5-6h8l1.5 6H8.5z"/></svg>'
      };
      return icons[this.settings.cartIcon] || icons.cart;
    }

    formatMoney(cents) {
      try {
        const fmt = window.CartUpliftMoneyFormat || "{{amount}}";
        const amount = (cents / 100).toFixed(2);
        return fmt
          .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, String(Math.round(cents / 100)))
          .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, amount.replace('.', ','))
          .replace(/\{\{\s*amount\s*\}\}/g, amount);
      } catch { return '£' + (cents / 100).toFixed(2); }
    }

    showDiscountMessage(msg, type='info') {
      const el = document.getElementById('upcart-discount-message');
      if (!el) return;
      el.textContent = msg;
      el.className = `upcart-discount-message ${type}`;
      if (type === 'error' || type === 'success') setTimeout(() => { el.textContent=''; el.className='upcart-discount-message'; }, 3000);
    }

    async applyDiscountCode() {
      const input = document.getElementById('upcart-discount-code');
      if (!input) return;
      const code = (input.value || '').trim();
      if (!code) { this.showDiscountMessage('Please enter a discount code', 'error'); return; }
      this.showDiscountMessage('Applying discount...', 'loading');
      this.closeDrawer();
      const here = window.location.href;
      const redirect = here.includes('?') ? `${here}&cart_opened=true` : `${here}?cart_opened=true`;
      window.location.href = `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(redirect)}`;
    }

    proceedToCheckout() {
      const ta = document.getElementById('upcart-order-notes');
      if (ta && ta.value.trim()) {
        fetch('/cart/update.js', {
          method:'POST',
          headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},
          body: JSON.stringify({ attributes: { 'Order Notes': ta.value.trim() }})
        }).finally(() => window.location.href = '/checkout');
      } else {
        window.location.href = '/checkout';
      }
    }

    loadOrderNotes() {
      const ta = document.getElementById('upcart-order-notes');
      if (!ta) return;
      if (this.cart?.attributes?.['Order Notes']) ta.value = this.cart.attributes['Order Notes'];
    }

    checkDiscountRedirect() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('cart_opened') === 'true') {
        params.delete('cart_opened');
        const url = new URL(window.location);
        url.searchParams.delete('cart_opened');
        window.history.replaceState({}, document.title, url.toString());
        setTimeout(() => this.openDrawer(), 400);
      }
    }

    /* -------------------- Housekeeping -------------------- */
    destroy() {
      this.stopBlurMonitoring();
      document.documentElement.classList.remove('cartuplift-drawer-open');
      document.body.classList.remove('cartuplift-drawer-open');
      this._unbindFns.forEach(fn => { try { fn(); } catch {} });
      this._unbindFns.length = 0;

      const container = document.getElementById('cartuplift-app-container');
      if (container) { container.classList.remove('cartuplift-active'); container.style.display = 'none'; }
      const sticky = document.getElementById('upcart-sticky');
      if (sticky) sticky.remove();
    }
  }

  // expose for Liquid
  window.CartUpliftDrawer = CartUpliftDrawer;
})();
