/**
 * Bundle Renderer for Cart Uplift
 * Displays smart bundles with dynamic pricing and automatic discount codes
 */

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
        if (!productId) return;

        try {
            const bundles = await this.fetchBundlesForProduct(productId);
            if (bundles.length > 0) {
                this.renderProductPageBundles(bundles);
            }
        } catch (error) {
            console.warn('Failed to load product bundles:', error);
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
        const metaProduct = document.querySelector('meta[property="product:id"]');
        if (metaProduct) return metaProduct.getAttribute('content');

        const productForm = document.querySelector('form[action*="/cart/add"]');
        if (productForm) {
            const productIdInput = productForm.querySelector('input[name="id"]');
            if (productIdInput) return productIdInput.value;
        }

        // Try window.ShopifyAnalytics or other global variables
        if (window.ShopifyAnalytics?.meta?.product?.id) {
            return window.ShopifyAnalytics.meta.product.id.toString();
        }

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
        const response = await fetch(`/apps/cart-uplift/api/bundles?product_id=${productId}&context=product`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to fetch bundles');
        
        const data = await response.json();
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
        const insertionPoint = this.findBundleInsertionPoint('product');
        if (!insertionPoint) return;

        bundles.forEach((bundle, index) => {
            if (index > 1) return; // Limit to 2 bundles on product pages
            
            const bundleElement = this.createBundleElement(bundle, 'product');
            insertionPoint.appendChild(bundleElement);
            this.renderedBundles.add(bundle.id);
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
        let insertionPoint;

        switch (pageType) {
            case 'product':
                // Try multiple locations on product pages
                insertionPoint = document.querySelector('.product-form') ||
                               document.querySelector('.product-form-container') ||
                               document.querySelector('[data-product-form]') ||
                               document.querySelector('.product-details');
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
            insertionPoint = document.createElement('div');
            insertionPoint.className = 'cart-uplift-bundles-container';
            document.body.appendChild(insertionPoint);
        }

        return insertionPoint;
    }

    createBundleElement(bundle, context) {
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
                    <div class="cart-uplift-bundle__savings">${savingsText}</div>
                </div>
                
                <div class="cart-uplift-bundle__products">
                    ${productsHtml}
                </div>
                
                <div class="cart-uplift-bundle__pricing">
                    ${this.createPricingHtml(bundle)}
                </div>
                
                <div class="cart-uplift-bundle__actions">
                    <button class="cart-uplift-bundle__cta" data-bundle-id="${bundle.id}" data-discount-code="${bundle.discount_code}">
                        ${ctaText}
                    </button>
                    ${bundle.discount_code ? `<div class="cart-uplift-bundle__discount-code">Code: <span>${bundle.discount_code}</span></div>` : ''}
                </div>
            </div>
        `;

        // Add click handler
        const ctaButton = bundleContainer.querySelector('.cart-uplift-bundle__cta');
        ctaButton.addEventListener('click', () => this.handleBundleAdd(bundle));

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
            <div class="cart-uplift-bundle__product">
                <div class="cart-uplift-bundle__product-image">
                    ${product.image ? `<img src="${product.image}" alt="${product.title}">` : ''}
                </div>
                <div class="cart-uplift-bundle__product-details">
                    <div class="cart-uplift-bundle__product-title">${product.title}</div>
                    ${this.settings.showIndividualPricesInBundle ? 
                        `<div class="cart-uplift-bundle__product-price">${this.formatMoney(product.price, this.settings.shopCurrency)}</div>` : ''}
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.cartUpliftSettings?.enableSmartBundles) {
            window.cartUpliftBundleRenderer = new BundleRenderer(window.cartUpliftSettings);
        }
    });
} else {
    if (window.cartUpliftSettings?.enableSmartBundles) {
        window.cartUpliftBundleRenderer = new BundleRenderer(window.cartUpliftSettings);
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BundleRenderer;
}
