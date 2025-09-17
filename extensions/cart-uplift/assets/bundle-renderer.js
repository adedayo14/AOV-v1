/**
 * Bundle Renderer for Cart Uplift
 * Displays smart bundles with dynamic pricing and automatic discount codes
 */

// Prevent duplicate class declarations if script loads multiple times
if (typeof window.BundleRenderer === 'undefined') {

class BundleRenderer {
    constructor(settings = {}) {
        this.settings = {
            enableSmartBundles: settings.enableSmartBundles || false,
            bundlesOnProductPages: settings.bundlesOnProductPages !== false,
            bundlesOnCollectionPages: settings.bundlesOnCollectionPages || false,
            bundlesOnCartPage: settings.bundlesOnCartPage || false,
            bundlesOnCheckoutPage: settings.bundlesOnCheckoutPage || false,
            defaultBundleDiscount: settings.defaultBundleDiscount || '15',
            bundleTitleTemplate: settings.bundleTitleTemplate || 'Complete your setup',
            bundleDiscountPrefix: settings.bundleDiscountPrefix || 'BUNDLE',
            bundleSavingsFormat: settings.bundleSavingsFormat || 'both',
            showIndividualPricesInBundle: settings.showIndividualPricesInBundle !== false,
            autoApplyBundleDiscounts: settings.autoApplyBundleDiscounts !== false,
            shopCurrency: settings.shopCurrency || 'USD',
            ...settings
        };
        
        this.currentPage = this.detectPageType();
        this.bundles = [];
        this.renderedBundles = new Set();
        
        this.init();
    }

    init() {
        if (!this.settings.enableSmartBundles) return;
        
        // Initialize based on page type
        switch (this.currentPage) {
            case 'product':
                if (this.settings.bundlesOnProductPages) {
                    this.initProductPageBundles();
                }
                break;
            case 'collection':
                if (this.settings.bundlesOnCollectionPages) {
                    this.initCollectionPageBundles();
                }
                break;
            case 'cart':
                if (this.settings.bundlesOnCartPage) {
                    this.initCartPageBundles();
                }
                break;
            case 'checkout':
                if (this.settings.bundlesOnCheckoutPage) {
                    this.initCheckoutPageBundles();
                }
                break;
        }
    }

    detectPageType() {
        const path = window.location.pathname;
        const body = document.body;
        
        if (path.includes('/products/') || body.classList.contains('template-product')) {
            return 'product';
        } else if (path.includes('/collections/') || body.classList.contains('template-collection')) {
            return 'collection';
        } else if (path.includes('/cart') || body.classList.contains('template-cart')) {
            return 'cart';
        } else if (path.includes('/checkout') || body.classList.contains('template-checkout')) {
            return 'checkout';
        }
        return 'other';
    }

    async initProductPageBundles() {
        const productId = this.getCurrentProductId();
        console.log('[BundleRenderer] Product page detected, productId:', productId);
        
        if (!productId) {
            console.log('[BundleRenderer] No product ID found, skipping bundles');
            return;
        }

        // Check if smart bundle blocks exist on the page
        const smartBundleBlocks = document.querySelectorAll('.cart-uplift-smart-bundles');
        if (smartBundleBlocks.length > 0) {
            console.log('[BundleRenderer] Smart bundle blocks found on page, initializing them directly');
            smartBundleBlocks.forEach(block => {
                const blockProductId = block.getAttribute('data-product-id') || productId;
                const container = block.querySelector(`#smart-bundles-container-${blockProductId}`) || block;
                if (!container) {
                    console.warn('[BundleRenderer] No container found inside smart bundle block');
                    return;
                }
                // Avoid duplicate init
                if (container.dataset.cuInitialized === 'true' || container.classList.contains('smart-bundles-loaded')) {
                    console.log('[BundleRenderer] Skipping already initialized container');
                    return;
                }
                container.dataset.cuInitialized = 'true';
                try {
                    this.initProductPage(blockProductId, container);
                } catch (e) {
                    console.warn('[BundleRenderer] Error initializing theme block container:', e);
                }
            });
            // Do not proceed with automatic placement if blocks exist
            return;
        }

        // No theme blocks found, proceed with automatic placement
        this.performAutomaticPlacement(productId);
    }

    async performAutomaticPlacement(productId) {
        try {
            console.log('[BundleRenderer] Fetching bundles for automatic placement');
            const bundles = await this.fetchBundlesForProduct(productId);
            console.log('[BundleRenderer] Received bundles:', bundles);
            
            if (bundles.length > 0) {
                console.log('[BundleRenderer] Rendering', bundles.length, 'bundles on product page');
                this.renderProductPageBundles(bundles);
            } else {
                console.log('[BundleRenderer] No bundles found for this product');
            }
        } catch (error) {
            console.warn('[BundleRenderer] Failed to load product bundles:', error);
        }
    }

    // Method for theme block integration
    async initProductPage(productId, container) {
        console.log('[BundleRenderer] Theme block integration - productId:', productId, 'container:', container);
        
        if (!productId || !container) {
            console.log('[BundleRenderer] Missing productId or container for theme block');
            return;
        }

        try {
            console.log('[BundleRenderer] Fetching bundles for theme block...');
            const bundles = await this.fetchBundlesForProduct(productId);
            console.log('[BundleRenderer] Theme block received bundles:', bundles);
            
            if (bundles.length > 0) {
                console.log('[BundleRenderer] Rendering bundles in theme block container');
                this.renderBundlesInContainer(bundles, container);
            } else {
                console.log('[BundleRenderer] No bundles available, hiding container');
                container.style.display = 'none';
            }
        } catch (error) {
            console.warn('[BundleRenderer] Failed to load bundles for theme block:', error);
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Unable to load bundle recommendations</p>';
        }
    }

    async initCollectionPageBundles() {
        const collectionId = this.getCurrentCollectionId();
        if (!collectionId) return;

        try {
            const bundles = await this.fetchBundlesForCollection(collectionId);
            if (bundles.length > 0) {
                this.renderCollectionPageBundles(bundles);
            }
        } catch (error) {
            console.warn('Failed to load collection bundles:', error);
        }
    }

    async initCartPageBundles() {
        const cartItems = this.getCartItems();
        
        // Only show bundles if cart has 1-2 items to avoid clutter
        if (cartItems.length === 0 || cartItems.length > 2) return;

        try {
            const bundles = await this.fetchComplementaryBundles(cartItems);
            if (bundles.length > 0) {
                this.renderCartPageBundles(bundles);
            }
        } catch (error) {
            console.warn('Failed to load cart bundles:', error);
        }
    }

    async initCheckoutPageBundles() {
        const cartItems = this.getCartItems();
        if (cartItems.length === 0) return;

        try {
            const bundles = await this.fetchLastChanceBundles(cartItems);
            if (bundles.length > 0) {
                this.renderCheckoutPageBundles(bundles);
            }
        } catch (error) {
            console.warn('Failed to load checkout bundles:', error);
        }
    }

    getCurrentProductId() {
        // Try multiple methods to get product ID
        console.log('[BundleRenderer] Detecting product ID...');
        
        const metaProduct = document.querySelector('meta[property="product:id"]');
        if (metaProduct) {
            const id = metaProduct.getAttribute('content');
            console.log('[BundleRenderer] Found product ID from meta tag:', id);
            return id;
        }

        // Prefer ShopifyAnalytics product id (product-level), not variant id
        if (window.ShopifyAnalytics?.meta?.product?.id) {
            const id = window.ShopifyAnalytics.meta.product.id.toString();
            console.log('[BundleRenderer] Found product ID from ShopifyAnalytics:', id);
            return id;
        }

        const productForm = document.querySelector('form[action*="/cart/add"]');
        if (productForm) {
            const productIdInput = productForm.querySelector('input[name="id"]');
            if (productIdInput) {
                const id = productIdInput.value;
                console.log('[BundleRenderer] Found product ID from form input:', id);
                return id;
            }
        }
        
        // Try URL path detection
        const path = window.location.pathname;
        const productMatch = path.match(/\/products\/([^/?]+)/);
        if (productMatch) {
            const handle = productMatch[1];
            console.log('[BundleRenderer] Found product handle from URL:', handle);
            // Use handle as fallback ID for demo purposes
            return handle;
        }

        console.log('[BundleRenderer] No product ID found');
        return null;
    }

    getCurrentCollectionId() {
        const metaCollection = document.querySelector('meta[property="collection:id"]');
        if (metaCollection) return metaCollection.getAttribute('content');

        if (window.ShopifyAnalytics?.meta?.collection?.id) {
            return window.ShopifyAnalytics.meta.collection.id.toString();
        }

        return null;
    }

    getCartItems() {
        // Try to get cart items from various sources
        if (window.cartUpliftCart?.items) {
            return window.cartUpliftCart.items;
        }

        // Try Shopify AJAX cart
        if (window.fetch) {
            // This would be async, so we'd need to refactor
            // For now, return empty array and handle async separately
        }

        return [];
    }

    async fetchBundlesForProduct(productId) {
        const url = `/apps/cart-uplift/api/bundles?product_id=${productId}&context=product`;
        console.log('[BundleRenderer] Fetching bundles from:', url);
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        
        console.log('[BundleRenderer] API response status:', response.status);
        
        if (!response.ok) {
            console.error('[BundleRenderer] API request failed:', response.status, response.statusText);
            throw new Error('Failed to fetch bundles');
        }
        
        const data = await response.json();
        console.log('[BundleRenderer] API response data:', data);
        
        return data.bundles || [];
    }

    async fetchBundlesForCollection(collectionId) {
        const response = await fetch(`/apps/cart-uplift/api/bundles?collection_id=${collectionId}&context=collection`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to fetch bundles');
        
        const data = await response.json();
        return data.bundles || [];
    }

    async fetchComplementaryBundles(cartItems) {
        const productIds = cartItems.map(item => item.product_id || item.id).join(',');
        const response = await fetch(`/apps/cart-uplift/api/bundles?cart_products=${productIds}&context=cart`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to fetch bundles');
        
        const data = await response.json();
        return data.bundles || [];
    }

    async fetchLastChanceBundles(cartItems) {
        const productIds = cartItems.map(item => item.product_id || item.id).join(',');
        const response = await fetch(`/apps/cart-uplift/api/bundles?cart_products=${productIds}&context=checkout`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to fetch bundles');
        
        const data = await response.json();
        return data.bundles || [];
    }

    renderProductPageBundles(bundles) {
        console.log('[BundleRenderer] Rendering product page bundles:', bundles.length);
        
        const insertionPoint = this.findBundleInsertionPoint('product');
        console.log('[BundleRenderer] Insertion point found:', !!insertionPoint);
        
        if (!insertionPoint) {
            console.warn('[BundleRenderer] No insertion point found for product page bundles');
            return;
        }

        bundles.forEach((bundle, index) => {
            if (index > 1) return; // Limit to 2 bundles on product pages
            
            console.log('[BundleRenderer] Creating bundle element for:', bundle.name);
            const bundleElement = this.createBundleElement(bundle, 'product');
            insertionPoint.appendChild(bundleElement);
            this.renderedBundles.add(bundle.id);
            console.log('[BundleRenderer] Bundle rendered successfully');
        });
    }

    renderBundlesInContainer(bundles, container) {
        console.log('[BundleRenderer] Rendering bundles in theme block container:', bundles.length);
        
        // Clear the container
        container.innerHTML = '';
        container.classList.add('smart-bundles-loaded');
        
        bundles.forEach((bundle, index) => {
            if (index > 1) return; // Limit to 2 bundles
            
            console.log('[BundleRenderer] Creating bundle element for theme block:', bundle.name);
            const bundleElement = this.createBundleElement(bundle, 'theme-block');
            container.appendChild(bundleElement);
            this.renderedBundles.add(bundle.id);
            console.log('[BundleRenderer] Bundle rendered in theme block successfully');
        });
    }

    renderCollectionPageBundles(bundles) {
        const insertionPoint = this.findBundleInsertionPoint('collection');
        if (!insertionPoint) return;

        // Show top bundle for collection
        const topBundle = bundles[0];
        if (topBundle) {
            const bundleElement = this.createBundleElement(topBundle, 'collection');
            insertionPoint.appendChild(bundleElement);
            this.renderedBundles.add(topBundle.id);
        }
    }

    renderCartPageBundles(bundles) {
        const insertionPoint = this.findBundleInsertionPoint('cart');
        if (!insertionPoint) return;

        bundles.forEach((bundle, index) => {
            if (index > 0) return; // Only 1 bundle in cart
            
            const bundleElement = this.createBundleElement(bundle, 'cart');
            insertionPoint.appendChild(bundleElement);
            this.renderedBundles.add(bundle.id);
        });
    }

    renderCheckoutPageBundles(bundles) {
        const insertionPoint = this.findBundleInsertionPoint('checkout');
        if (!insertionPoint) return;

        // Show urgent bundle offer
        const urgentBundle = bundles[0];
        if (urgentBundle) {
            const bundleElement = this.createBundleElement(urgentBundle, 'checkout');
            insertionPoint.appendChild(bundleElement);
            this.renderedBundles.add(urgentBundle.id);
        }
    }

    findBundleInsertionPoint(pageType) {
        console.log('[BundleRenderer] Finding insertion point for page type:', pageType);
        let insertionPoint;

        switch (pageType) {
            case 'product':
                // Try multiple locations on product pages
                const productSelectors = [
                    '.product-form',
                    '.product-form-container', 
                    '[data-product-form]',
                    '.product-details',
                    '.product-info',
                    '.product-content',
                    '.product-description',
                    'form[action*="/cart/add"]',
                    '.product',
                    'main'
                ];
                
                for (const selector of productSelectors) {
                    insertionPoint = document.querySelector(selector);
                    if (insertionPoint) {
                        console.log('[BundleRenderer] Found insertion point with selector:', selector);
                        break;
                    }
                }
                break;
            case 'collection':
                insertionPoint = document.querySelector('.collection-products') ||
                               document.querySelector('.collection-grid') ||
                               document.querySelector('[data-collection-products]');
                break;
            case 'cart':
                insertionPoint = document.querySelector('.cart-items') ||
                               document.querySelector('.cart-container') ||
                               document.querySelector('[data-cart-items]');
                break;
            case 'checkout':
                insertionPoint = document.querySelector('.checkout-content') ||
                               document.querySelector('.checkout-summary') ||
                               document.querySelector('[data-checkout]');
                break;
        }

        // If no specific insertion point found, create one
        if (!insertionPoint) {
            console.log('[BundleRenderer] No suitable insertion point found, creating fallback container');
            insertionPoint = document.createElement('div');
            insertionPoint.className = 'cart-uplift-bundles-container';
            insertionPoint.style.cssText = 'margin: 20px; padding: 20px; border: 2px dashed #ccc; background: #f9f9f9;';
            document.body.appendChild(insertionPoint);
        }

        return insertionPoint;
    }

    createBundleElement(bundle, context) {
        console.log('[BundleRenderer] Creating bundle element for:', bundle.name);
        
        const bundleContainer = document.createElement('div');
        bundleContainer.className = `cart-uplift-bundle cart-uplift-bundle--${context}`;
        bundleContainer.dataset.bundleId = bundle.id;

        const title = this.getBundleTitle(bundle, context);
        const savingsText = this.formatSavings(bundle);
        const productsHtml = this.createProductsHtml(bundle.products);
        const ctaText = this.getBundleCTA(context);

        bundleContainer.innerHTML = `
            <div class="cart-uplift-bundle__content">
                <div class="cart-uplift-bundle__header">
                    <h3 class="cart-uplift-bundle__title">${title}</h3>
                    <p class="cart-uplift-bundle__savings">${savingsText}</p>
                </div>
                <div class="cart-uplift-bundle__products">
                    ${productsHtml}
                </div>
                <div class="cart-uplift-bundle__actions">
                    <button class="cart-uplift-bundle__cta" data-bundle-id="${bundle.id}">
                        ${ctaText}
                    </button>
                    ${bundle.discount_code ? `<p class="cart-uplift-bundle__note">Use discount code: <strong>${bundle.discount_code}</strong></p>` : ''}
                </div>
            </div>
        `;

        // Add click handler
        const ctaButton = bundleContainer.querySelector('.cart-uplift-bundle__cta');
        if (ctaButton) {
            ctaButton.addEventListener('click', () => this.handleBundleAdd(bundle));
            ctaButton.addEventListener('mouseenter', (e) => e.target.style.background = '#005f66');
            ctaButton.addEventListener('mouseleave', (e) => e.target.style.background = '#007c89');
        }

        return bundleContainer;
    }

    getBundleTitle(bundle, context) {
        let title = bundle.name || this.settings.bundleTitleTemplate;
        
        // Replace {product} placeholder if present
        if (title.includes('{product}') && bundle.products.length > 0) {
            title = title.replace('{product}', bundle.products[0].title);
        }
        
        return title;
    }

    getBundleCTA(context) {
        switch (context) {
            case 'product': return 'Add Bundle to Cart';
            case 'collection': return 'Shop Bundle';
            case 'cart': return 'Add to Cart';
            case 'checkout': return 'Add Bundle - Last Chance!';
            default: return 'Add Bundle';
        }
    }

    formatSavings(bundle) {
        const format = this.settings.bundleSavingsFormat;
        const currency = this.settings.shopCurrency;
        
        switch (format) {
            case 'amount':
                return `Save ${this.formatMoney(bundle.savings_amount, currency)}`;
            case 'percentage':
                return `Save ${bundle.discount_percent}%`;
            case 'both':
                return `Save ${this.formatMoney(bundle.savings_amount, currency)} (${bundle.discount_percent}% off)`;
            case 'discount_label':
                return `${bundle.discount_percent}% off bundle`;
            default:
                return `Save ${bundle.discount_percent}%`;
        }
    }

    createProductsHtml(products) {
        return products.map(product => `
            <div class="cart-uplift-product">
                <div class="cart-uplift-product__info">
                    <div class="cart-uplift-product__title">${product.title}</div>
                    ${this.settings.showIndividualPricesInBundle ? 
                        `<div class="cart-uplift-product__price">$${parseFloat(product.price).toFixed(2)}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    createPricingHtml(bundle) {
        const currency = this.settings.shopCurrency;
        
        if (this.settings.showIndividualPricesInBundle) {
            return `
                <div class="cart-uplift-bundle__pricing-comparison">
                    <div class="cart-uplift-bundle__regular-price">
                        <span class="cart-uplift-bundle__regular-label">Individual prices:</span>
                        <span class="cart-uplift-bundle__regular-amount">${this.formatMoney(bundle.regular_total, currency)}</span>
                    </div>
                    <div class="cart-uplift-bundle__bundle-price">
                        <span class="cart-uplift-bundle__bundle-label">Bundle price:</span>
                        <span class="cart-uplift-bundle__bundle-amount">${this.formatMoney(bundle.bundle_price, currency)}</span>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="cart-uplift-bundle__bundle-price">
                    <span class="cart-uplift-bundle__bundle-label">Bundle price:</span>
                    <span class="cart-uplift-bundle__bundle-amount">${this.formatMoney(bundle.bundle_price, currency)}</span>
                </div>
            `;
        }
    }

    formatMoney(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    }

    async handleBundleAdd(bundle) {
        try {
            // Track bundle interaction
            this.trackBundleInteraction(bundle.id, 'clicked');
            
            // Add all products to cart
            const addPromises = bundle.products.map(product => 
                this.addProductToCart(product.variant_id || product.id, 1)
            );
            
            await Promise.all(addPromises);
            
            // Auto-apply discount code if enabled
            if (this.settings.autoApplyBundleDiscounts && bundle.discount_code) {
                await this.applyDiscountCode(bundle.discount_code);
            }
            
            // Show success message
            this.showBundleAddedMessage(bundle);
            
            // Track successful bundle addition
            this.trackBundleInteraction(bundle.id, 'purchased');
            
        } catch (error) {
            console.error('Failed to add bundle:', error);
            this.showBundleErrorMessage(bundle);
        }
    }

    async addProductToCart(variantId, quantity) {
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

        if (!response.ok) {
            throw new Error(`Failed to add product ${variantId} to cart`);
        }

        return response.json();
    }

    async applyDiscountCode(code) {
        // Apply discount code to cart
        const response = await fetch('/discount/' + code, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        return response.ok;
    }

    showBundleAddedMessage(bundle) {
        const message = document.createElement('div');
        message.className = 'cart-uplift-bundle-message cart-uplift-bundle-message--success';
        message.innerHTML = `
            <div class="cart-uplift-bundle-message__content">
                ✅ Bundle added to cart! ${bundle.discount_code ? `Discount code ${bundle.discount_code} applied.` : ''}
                <button class="cart-uplift-bundle-message__close">&times;</button>
            </div>
        `;
        
        document.body.appendChild(message);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 5000);
        
        // Close button handler
        message.querySelector('.cart-uplift-bundle-message__close').addEventListener('click', () => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        });
    }

    showBundleErrorMessage(bundle) {
        const message = document.createElement('div');
        message.className = 'cart-uplift-bundle-message cart-uplift-bundle-message--error';
        message.innerHTML = `
            <div class="cart-uplift-bundle-message__content">
                ❌ Failed to add bundle to cart. Please try again.
                <button class="cart-uplift-bundle-message__close">&times;</button>
            </div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 5000);
        
        message.querySelector('.cart-uplift-bundle-message__close').addEventListener('click', () => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        });
    }

    trackBundleInteraction(bundleId, action) {
        // Track bundle interactions for analytics
        if (window.cartUpliftAnalytics) {
            window.cartUpliftAnalytics.track('bundle_interaction', {
                bundle_id: bundleId,
                action: action,
                context: this.currentPage,
                timestamp: new Date().toISOString()
            });
        }
    }
}

// Auto-initialize when DOM is ready
// Always create a renderer instance so theme blocks can call methods even if
// global settings haven't been preloaded or enableSmartBundles is false.
(function initCartUpliftBundleRenderer() {
    const init = () => {
        try {
            const resolvedSettings = (window.CartUpliftSettings || window.cartUpliftSettings || {});
            // Keep backward compatibility: expose a lowercase alias
            if (!window.cartUpliftSettings) {
                window.cartUpliftSettings = resolvedSettings;
            }
            window.cartUpliftBundleRenderer = new BundleRenderer(resolvedSettings);
        } catch (e) {
            console.warn('[BundleRenderer] Failed to initialize renderer:', e);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BundleRenderer;
}

} // End of duplicate prevention check
