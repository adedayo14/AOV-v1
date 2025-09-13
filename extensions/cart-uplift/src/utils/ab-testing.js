/**
 * Simple A/B testing framework for cart uplift optimizations
 */
export class ABTesting {
  constructor() {
    this.experiments = new Map();
    this.assignments = this.loadAssignments();
    this.userId = this.getUserId();
  }

  /**
   * Register a new experiment
   */
  register(experimentId, variants, config = {}) {
    const experiment = {
      variants,
      weights: config.weights || variants.map(() => 1 / variants.length),
      enabled: config.enabled !== false,
      startDate: config.startDate || Date.now(),
      endDate: config.endDate,
      targetingRules: config.targetingRules || {},
      description: config.description || ''
    };

    this.experiments.set(experimentId, experiment);
    
    // Track experiment registration
    this.track('experiment_registered', {
      experiment_id: experimentId,
      variants: variants.length,
      description: experiment.description
    });
  }

  /**
   * Get variant for user (with consistent assignment)
   */
  getVariant(experimentId) {
    const experiment = this.experiments.get(experimentId);
    
    if (!experiment || !experiment.enabled) {
      return 'control';
    }

    // Check if experiment is active
    const now = Date.now();
    if (now < experiment.startDate || (experiment.endDate && now > experiment.endDate)) {
      return 'control';
    }

    // Check existing assignment
    const assignmentKey = `${experimentId}_${this.userId}`;
    if (this.assignments[assignmentKey]) {
      return this.assignments[assignmentKey];
    }

    // Check targeting rules
    if (!this.matchesTargeting(experiment.targetingRules)) {
      return 'control';
    }

    // Assign new variant using deterministic hash
    const variant = this.assignVariant(experimentId, experiment);
    this.assignments[assignmentKey] = variant;
    this.saveAssignments();
    
    // Track assignment
    this.track('experiment_assigned', {
      experiment_id: experimentId,
      variant,
      user_id: this.userId
    });
    
    return variant;
  }

  /**
   * Check if user matches targeting rules
   */
  matchesTargeting(rules) {
    if (!rules || Object.keys(rules).length === 0) return true;

    // Cart value targeting
    if (rules.minCartValue || rules.maxCartValue) {
      const cartValue = this.getCartValue();
      if (rules.minCartValue && cartValue < rules.minCartValue) return false;
      if (rules.maxCartValue && cartValue > rules.maxCartValue) return false;
    }

    // Device targeting
    if (rules.devices) {
      const device = this.getDeviceType();
      if (!rules.devices.includes(device)) return false;
    }

    // Traffic percentage
    if (rules.trafficPercentage && rules.trafficPercentage < 100) {
      const hash = this.hashUserId('traffic');
      if (hash > rules.trafficPercentage / 100) return false;
    }

    // New vs returning users
    if (rules.userType) {
      const isNewUser = this.isNewUser();
      if (rules.userType === 'new' && !isNewUser) return false;
      if (rules.userType === 'returning' && isNewUser) return false;
    }

    return true;
  }

  /**
   * Assign variant using deterministic hashing
   */
  assignVariant(experimentId, experiment) {
    const hash = this.hashUserId(experimentId);
    let cumulative = 0;
    
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulative += experiment.weights[i];
      if (hash < cumulative) {
        return experiment.variants[i];
      }
    }
    
    // Fallback to first variant
    return experiment.variants[0];
  }

  /**
   * Track conversion for experiment analysis
   */
  trackConversion(experimentId, conversionType = 'conversion', value = 1) {
    const variant = this.getVariant(experimentId);
    
    this.track('experiment_conversion', {
      experiment_id: experimentId,
      variant,
      conversion_type: conversionType,
      value,
      user_id: this.userId
    });
  }

  /**
   * Get experiment results (for admin dashboard)
   */
  getResults(experimentId) {
    // In a real implementation, this would fetch from analytics
    // For now, return placeholder structure
    return {
      experimentId,
      variants: {},
      status: 'running',
      significance: null,
      winner: null
    };
  }

  /**
   * Utility methods
   */
  getUserId() {
    // Try multiple sources for user ID
    let userId = localStorage.getItem('cu_user_id');
    
    if (!userId) {
      // Check for Shopify customer ID
      userId = window.ShopifyAnalytics?.meta?.page?.customerId;
    }
    
    if (!userId) {
      // Generate anonymous ID
      userId = 'anon_' + this.generateId();
      localStorage.setItem('cu_user_id', userId);
    }
    
    return userId;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  hashUserId(salt) {
    const str = this.userId + salt;
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }

  getCartValue() {
    try {
      // Try to get from global cart object
      if (window.cartUpliftDrawer?.cart?.total_price) {
        return window.cartUpliftDrawer.cart.total_price;
      }
      
      // Fallback to fetch current cart
      return 0;
    } catch (error) {
      return 0;
    }
  }

  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  isNewUser() {
    // Simple heuristic: check if they have any stored data
    const hasStoredData = localStorage.getItem('cu_view_history') || 
                         localStorage.getItem('cu_purchase_history');
    return !hasStoredData;
  }

  loadAssignments() {
    try {
      const stored = localStorage.getItem('cu_ab_assignments');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  saveAssignments() {
    try {
      localStorage.setItem('cu_ab_assignments', JSON.stringify(this.assignments));
    } catch (error) {
      console.warn('Failed to save A/B assignments:', error);
    }
  }

  track(event, properties) {
    // Send to analytics
    if (window.cartUpliftDrawer?.learning?.track) {
      window.cartUpliftDrawer.learning.track(event, properties);
    }
    
    // Also log for debugging
    console.log(`[A/B Test] ${event}:`, properties);
  }

  /**
   * Helper method to wrap feature flags
   */
  isEnabled(featureId) {
    return this.getVariant(featureId) !== 'control';
  }

  /**
   * Easy setup for common experiments
   */
  setupRecommendationExperiments() {
    // Test recommendation layouts
    this.register('rec_layout', ['carousel', 'grid', 'list'], {
      description: 'Test which recommendation layout performs best',
      weights: [0.4, 0.4, 0.2]
    });

    // Test recommendation count
    this.register('rec_count', ['4_items', '6_items', '8_items'], {
      description: 'Test optimal number of recommendations',
      weights: [0.33, 0.33, 0.34]
    });

    // Test prewarm strategy
    this.register('prewarm_strategy', ['aggressive', 'moderate', 'conservative'], {
      description: 'Test recommendation prewarming strategies',
      weights: [0.3, 0.4, 0.3]
    });

    // Test discount triggers
    this.register('discount_threshold', ['low', 'medium', 'high'], {
      description: 'Test different discount thresholds',
      targetingRules: { minCartValue: 5000 }, // Only for carts > $50
      weights: [0.33, 0.33, 0.34]
    });
  }

  /**
   * Clean up expired experiments
   */
  cleanup() {
    const now = Date.now();
    const toRemove = [];
    
    this.experiments.forEach((experiment, id) => {
      if (experiment.endDate && now > experiment.endDate) {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => {
      this.experiments.delete(id);
      this.track('experiment_ended', { experiment_id: id });
    });
  }
}
