/**
 * ML-powered bundle discovery engine
 * Finds intelligent product combinations using customer behavior patterns
 */
export class BundleDiscoveryEngine {
  constructor(privacyLevel = 'basic') {
    this.privacyLevel = privacyLevel;
    this.frequentItemsets = new Map();
    this.associationRules = new Map();
    this.bundleCache = new Map();
    this.minSupport = 0.01; // Minimum 1% support
    this.minConfidence = 0.3; // Minimum 30% confidence
    this.maxBundleSize = 4;
    
    this.initialized = false;
  }

  /**
   * Initialize the bundle discovery system
   */
  async initialize() {
    if (this.privacyLevel === 'basic') {
      await this.initializeBasicMode();
    } else {
      await this.initializeAdvancedMode();
    }
    
    this.initialized = true;
  }

  async initializeBasicMode() {
    // Use aggregated, anonymized bundle data
    try {
      const response = await fetch('/apps/cart-uplift/api/ml/aggregated-bundles');
      const data = await response.json();
      
      this.loadPrecomputedBundles(data.bundles);
      this.loadBasicAssociations(data.associations);
    } catch (error) {
      console.warn('Failed to load aggregated bundles:', error);
      this.initializeFallback();
    }
  }

  async initializeAdvancedMode() {
    try {
      const response = await fetch('/apps/cart-uplift/api/ml/bundle-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacy_level: this.privacyLevel,
          min_support: this.minSupport,
          min_confidence: this.minConfidence
        })
      });
      
      const data = await response.json();
      
      this.loadFrequentItemsets(data.frequent_itemsets);
      this.loadAssociationRules(data.association_rules);
      this.loadBundlePerformance(data.bundle_performance);
      
    } catch (error) {
      console.warn('Failed to load bundle data:', error);
      await this.initializeBasicMode();
    }
  }

  initializeFallback() {
    // Initialize with empty state
    this.frequentItemsets.clear();
    this.associationRules.clear();
    this.bundleCache.clear();
  }

  loadPrecomputedBundles(bundles) {
    this.bundleCache.clear();
    
    for (const bundle of bundles) {
      const key = bundle.items.sort().join('-');
      this.bundleCache.set(key, {
        items: bundle.items,
        support: bundle.support,
        lift: bundle.lift,
        confidence: bundle.confidence,
        performance: bundle.performance || {}
      });
    }
  }

  loadBasicAssociations(associations) {
    this.associationRules.clear();
    
    for (const rule of associations) {
      const key = `${rule.antecedent}->${rule.consequent}`;
      this.associationRules.set(key, {
        antecedent: rule.antecedent,
        consequent: rule.consequent,
        confidence: rule.confidence,
        lift: rule.lift,
        support: rule.support
      });
    }
  }

  loadFrequentItemsets(itemsets) {
    this.frequentItemsets.clear();
    
    for (const itemset of itemsets) {
      const key = itemset.items.sort().join('-');
      this.frequentItemsets.set(key, {
        items: itemset.items,
        support: itemset.support,
        size: itemset.items.length
      });
    }
  }

  loadAssociationRules(rules) {
    this.associationRules.clear();
    
    for (const rule of rules) {
      const key = `${rule.antecedent.join(',')}->${rule.consequent.join(',')}`;
      this.associationRules.set(key, rule);
    }
  }

  loadBundlePerformance(performance) {
    // Load historical bundle performance metrics
    for (const [bundleKey, metrics] of Object.entries(performance)) {
      if (this.bundleCache.has(bundleKey)) {
        this.bundleCache.get(bundleKey).performance = metrics;
      }
    }
  }

  /**
   * Discover bundles for a given set of products
   */
  async discoverBundles(productIds, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      maxBundles = 5,
      minBundleSize = 2,
      maxBundleSize = this.maxBundleSize,
      includeReasons = true,
      sortBy = 'lift' // 'lift', 'confidence', 'support', 'performance'
    } = options;

    let bundles = [];

    if (this.privacyLevel === 'basic') {
      bundles = this.discoverBasicBundles(productIds, maxBundles);
    } else {
      bundles = this.discoverAdvancedBundles(productIds, maxBundles, minBundleSize, maxBundleSize);
    }

    // Sort and filter bundles
    bundles = this.sortBundles(bundles, sortBy)
      .filter(bundle => bundle.items.length >= minBundleSize && bundle.items.length <= maxBundleSize)
      .slice(0, maxBundles);

    // Add explanations if requested
    if (includeReasons) {
      bundles = bundles.map(bundle => ({
        ...bundle,
        reason: this.generateBundleReason(bundle, productIds)
      }));
    }

    return bundles.map(bundle => ({
      ...bundle,
      strategy: 'bundle_discovery',
      privacy_level: this.privacyLevel
    }));
  }

  discoverBasicBundles(productIds, maxBundles) {
    const bundles = [];
    
    // Find bundles that include any of the input products
    for (const [bundleKey, bundleData] of this.bundleCache) {
      const hasCommonProduct = bundleData.items.some(item => productIds.includes(item));
      
      if (hasCommonProduct) {
        bundles.push({
          id: bundleKey,
          items: bundleData.items,
          support: bundleData.support,
          confidence: bundleData.confidence || 0.5,
          lift: bundleData.lift || 1.0,
          performance: bundleData.performance || {}
        });
      }
    }

    return bundles;
  }

  discoverAdvancedBundles(productIds, maxBundles, minBundleSize, maxBundleSize) {
    const bundles = [];
    
    // Method 1: Association rule based discovery
    const ruleBasedBundles = this.findRuleBasedBundles(productIds);
    bundles.push(...ruleBasedBundles);
    
    // Method 2: Frequent itemset based discovery
    const itemsetBasedBundles = this.findItemsetBasedBundles(productIds, minBundleSize, maxBundleSize);
    bundles.push(...itemsetBasedBundles);
    
    // Method 3: Complementary product discovery
    const complementaryBundles = this.findComplementaryBundles(productIds);
    bundles.push(...complementaryBundles);
    
    // Method 4: Seasonal/temporal bundles
    if (this.privacyLevel === 'full_ml') {
      const temporalBundles = this.findTemporalBundles(productIds);
      bundles.push(...temporalBundles);
    }

    // Deduplicate bundles
    return this.deduplicateBundles(bundles);
  }

  findRuleBasedBundles(productIds) {
    const bundles = [];
    const bundleMap = new Map();

    for (const productId of productIds) {
      // Find rules where this product is the antecedent
      for (const [ruleKey, rule] of this.associationRules) {
        if (rule.antecedent.includes(productId)) {
          const bundleItems = [...rule.antecedent, ...rule.consequent];
          const bundleKey = bundleItems.sort().join('-');
          
          if (!bundleMap.has(bundleKey)) {
            bundleMap.set(bundleKey, {
              id: bundleKey,
              items: bundleItems,
              support: rule.support,
              confidence: rule.confidence,
              lift: rule.lift,
              source: 'association_rule'
            });
          }
        }
      }
    }

    return Array.from(bundleMap.values());
  }

  findItemsetBasedBundles(productIds, minSize, maxSize) {
    const bundles = [];
    
    for (const [itemsetKey, itemset] of this.frequentItemsets) {
      if (itemset.size < minSize || itemset.size > maxSize) continue;
      
      // Check if this itemset shares products with input
      const commonProducts = itemset.items.filter(item => productIds.includes(item));
      
      if (commonProducts.length > 0) {
        // Calculate bundle metrics
        const bundleMetrics = this.calculateBundleMetrics(itemset.items);
        
        bundles.push({
          id: itemsetKey,
          items: itemset.items,
          support: itemset.support,
          confidence: bundleMetrics.confidence,
          lift: bundleMetrics.lift,
          source: 'frequent_itemset',
          commonProducts: commonProducts.length
        });
      }
    }

    return bundles;
  }

  findComplementaryBundles(productIds) {
    const bundles = [];
    const productCategories = this.getProductCategories(productIds);
    
    // Find products that complement the categories of input products
    const complementaryProducts = this.findComplementaryProducts(productCategories);
    
    // Create bundles with complementary products
    for (const productId of productIds) {
      const relatedProducts = complementaryProducts.filter(p => 
        p.product_id !== productId && this.areProductsComplementary(productId, p.product_id)
      );
      
      if (relatedProducts.length > 0) {
        // Create bundles of different sizes
        for (let size = 2; size <= Math.min(this.maxBundleSize, relatedProducts.length + 1); size++) {
          const combinations = this.generateCombinations([productId, ...relatedProducts.map(p => p.product_id)], size);
          
          for (const combination of combinations.slice(0, 3)) { // Limit combinations
            const bundleMetrics = this.calculateBundleMetrics(combination);
            
            bundles.push({
              id: combination.sort().join('-'),
              items: combination,
              support: bundleMetrics.support,
              confidence: bundleMetrics.confidence,
              lift: bundleMetrics.lift,
              source: 'complementary'
            });
          }
        }
      }
    }

    return bundles;
  }

  findTemporalBundles(productIds) {
    // Advanced: Find bundles based on temporal patterns
    const bundles = [];
    const currentSeason = this.getCurrentSeason();
    const currentMonth = new Date().getMonth();
    
    // This would typically query seasonal/temporal pattern data
    // For now, return empty array as placeholder
    return bundles;
  }

  calculateBundleMetrics(items) {
    // Calculate support, confidence, and lift for a bundle
    const bundleKey = items.sort().join('-');
    
    if (this.bundleCache.has(bundleKey)) {
      const cached = this.bundleCache.get(bundleKey);
      return {
        support: cached.support,
        confidence: cached.confidence,
        lift: cached.lift
      };
    }

    // Default metrics for new bundles
    return {
      support: 0.05,
      confidence: 0.4,
      lift: 1.2
    };
  }

  areProductsComplementary(productId1, productId2) {
    // Check if two products are complementary
    const ruleKey1 = `${productId1}->${productId2}`;
    const ruleKey2 = `${productId2}->${productId1}`;
    
    const rule1 = this.associationRules.get(ruleKey1);
    const rule2 = this.associationRules.get(ruleKey2);
    
    return (rule1 && rule1.lift > 1.0) || (rule2 && rule2.lift > 1.0);
  }

  generateCombinations(items, size) {
    if (size === 1) return items.map(item => [item]);
    if (size > items.length) return [];
    
    const combinations = [];
    
    for (let i = 0; i <= items.length - size; i++) {
      const head = items[i];
      const tailCombinations = this.generateCombinations(items.slice(i + 1), size - 1);
      
      for (const tail of tailCombinations) {
        combinations.push([head, ...tail]);
      }
    }
    
    return combinations;
  }

  deduplicateBundles(bundles) {
    const uniqueBundles = new Map();
    
    for (const bundle of bundles) {
      const key = bundle.items.sort().join('-');
      
      if (!uniqueBundles.has(key) || bundle.lift > uniqueBundles.get(key).lift) {
        uniqueBundles.set(key, bundle);
      }
    }
    
    return Array.from(uniqueBundles.values());
  }

  sortBundles(bundles, sortBy) {
    switch (sortBy) {
      case 'lift':
        return bundles.sort((a, b) => b.lift - a.lift);
      case 'confidence':
        return bundles.sort((a, b) => b.confidence - a.confidence);
      case 'support':
        return bundles.sort((a, b) => b.support - a.support);
      case 'performance':
        return bundles.sort((a, b) => (b.performance?.conversion_rate || 0) - (a.performance?.conversion_rate || 0));
      default:
        return bundles.sort((a, b) => b.lift - a.lift);
    }
  }

  generateBundleReason(bundle, originalProducts) {
    const commonProducts = bundle.items.filter(item => originalProducts.includes(item));
    
    if (bundle.source === 'association_rule') {
      return commonProducts.length > 0 
        ? `Customers who bought ${commonProducts[0]} often buy these together`
        : 'Frequently bought together by other customers';
    }
    
    if (bundle.source === 'frequent_itemset') {
      return `Popular product combination with ${Math.round(bundle.support * 100)}% of customers`;
    }
    
    if (bundle.source === 'complementary') {
      return 'These products complement each other well';
    }
    
    return `Recommended bundle (${Math.round(bundle.confidence * 100)}% confidence)`;
  }

  /**
   * Generate smart bundles for cart optimization
   */
  async generateSmartBundles(cartItems, customerProfile = null, options = {}) {
    const {
      bundleType = 'upsell', // 'upsell', 'cross_sell', 'complete_look'
      priceRange = 'any', // 'budget', 'mid', 'premium', 'any'
      maxBundles = 3
    } = options;

    if (!this.initialized) {
      await this.initialize();
    }

    const cartProductIds = cartItems.map(item => item.product_id || item.id);
    let bundles = [];

    switch (bundleType) {
      case 'upsell':
        bundles = await this.generateUpsellBundles(cartProductIds, customerProfile);
        break;
      case 'cross_sell':
        bundles = await this.generateCrossSellBundles(cartProductIds, customerProfile);
        break;
      case 'complete_look':
        bundles = await this.generateCompleteLookBundles(cartProductIds, customerProfile);
        break;
      default:
        bundles = await this.discoverBundles(cartProductIds, { maxBundles });
    }

    // Filter by price range if specified
    if (priceRange !== 'any' && customerProfile) {
      bundles = this.filterBundlesByPriceRange(bundles, priceRange, customerProfile);
    }

    return bundles.slice(0, maxBundles);
  }

  async generateUpsellBundles(cartProductIds, customerProfile) {
    // Find higher-value items that complement cart items
    const bundles = await this.discoverBundles(cartProductIds);
    
    return bundles.filter(bundle => {
      // Bundle should include cart items plus additional higher-value items
      const hasCartItems = cartProductIds.some(id => bundle.items.includes(id));
      const hasAdditionalItems = bundle.items.some(id => !cartProductIds.includes(id));
      
      return hasCartItems && hasAdditionalItems;
    });
  }

  async generateCrossSellBundles(cartProductIds, customerProfile) {
    // Find complementary items from different categories
    const bundles = await this.discoverBundles(cartProductIds);
    
    return bundles.filter(bundle => {
      // Should have items that complement but don't overlap with cart
      return !bundle.items.some(id => cartProductIds.includes(id));
    });
  }

  async generateCompleteLookBundles(cartProductIds, customerProfile) {
    // Generate complete outfit/look bundles
    if (this.privacyLevel === 'basic') {
      return this.generateBasicCompleteLook(cartProductIds);
    }
    
    // Advanced complete look generation based on style preferences
    return this.generateAdvancedCompleteLook(cartProductIds, customerProfile);
  }

  generateBasicCompleteLook(cartProductIds) {
    // Simple complete look based on cached bundles
    return Array.from(this.bundleCache.values())
      .filter(bundle => bundle.items.length >= 3)
      .slice(0, 3);
  }

  generateAdvancedCompleteLook(cartProductIds, customerProfile) {
    // Advanced complete look using customer style preferences
    const styleBundles = [];
    
    // This would integrate with style/category analysis
    // For now, return basic bundles
    return this.generateBasicCompleteLook(cartProductIds);
  }

  filterBundlesByPriceRange(bundles, priceRange, customerProfile) {
    const pricePreference = customerProfile?.features?.monetary?.price_tier || 'mid_range';
    
    // Filter bundles based on customer's price sensitivity
    return bundles.filter(bundle => {
      // This would require product price data
      // For now, return all bundles
      return true;
    });
  }

  // Utility methods
  getProductCategories(productIds) {
    // This would typically fetch product category data
    return productIds.map(id => ({ product_id: id, category: 'unknown' }));
  }

  findComplementaryProducts(categories) {
    // This would find products that complement the given categories
    return [];
  }

  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  /**
   * Track bundle performance for learning
   */
  trackBundlePerformance(bundleId, action, metadata = {}) {
    if (this.privacyLevel === 'basic') return;

    const performanceData = {
      bundle_id: bundleId,
      action, // 'viewed', 'clicked', 'added_to_cart', 'purchased'
      timestamp: Date.now(),
      metadata,
      privacy_level: this.privacyLevel
    };

    // Send to server for analysis
    this.sendBundleAnalytics(performanceData);
  }

  async sendBundleAnalytics(data) {
    try {
      await fetch('/apps/cart-uplift/api/ml/bundle-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.warn('Failed to send bundle analytics:', error);
    }
  }
}
