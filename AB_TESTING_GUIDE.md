# A/B Testing System - User Guide

## Overview

The A/B Testing system is now fully activated and integrated with your ML recommendation engine and bundle pricing system. You can test different algorithms, discount percentages, and personalization strategies to optimize conversion rates.

## Quick Start

### 1. Access the Admin Interface
Visit `/admin/ab-testing` in your Shopify admin to manage experiments.

### 2. Create Your First Experiment

**ML Algorithm Test:**
- **Name**: "ML Personalization Comparison"
- **Type**: ml_algorithm
- **Variants**:
  - Control: `{"personalizationMode": "basic", "mlEnabled": true}`
  - Advanced ML: `{"personalizationMode": "advanced", "mlEnabled": true}`
  - ML Disabled: `{"mlEnabled": false}`

**Bundle Discount Test:**
- **Name**: "Bundle Discount Optimization"
- **Type**: discount_percentage  
- **Variants**:
  - 10% Discount: `{"discountPercent": 10}`
  - 15% Discount: `{"discountPercent": 15}`
  - 20% Discount: `{"discountPercent": 20}`

### 3. Monitor Results
- Statistical significance appears automatically
- P-values and confidence intervals calculated in real-time
- Revenue impact tracked per variant

## Integration Points

### ML Recommendations API (`/apps/proxy`)
The recommendations API automatically checks for active A/B experiments:

```javascript
// Automatic A/B test detection
if (abTestVariant && abTestConfig) {
  if (abTestConfig.personalizationMode) {
    effectivePersonalizationMode = abTestConfig.personalizationMode;
  }
  if ('mlEnabled' in abTestConfig) {
    effectiveMlEnabled = abTestConfig.mlEnabled;
  }
}
```

### Bundle Pricing API (`/api/bundles`)
Bundle creation checks for discount experiments:

```javascript
// A/B test override for discount percentage
const abResponse = await fetch('/api/ab-testing?action=get_variant&experiment_type=bundle_discount');
if (abResponse.ok) {
  const abData = await abResponse.json();
  if (abData.config.discountPercent) {
    discountPercent = abData.config.discountPercent;
  }
}
```

## Database Schema

### Core Tables
- **ab_experiments**: Experiment definitions and configuration
- **ab_variants**: Different versions being tested
- **ab_assignments**: User-to-variant mappings (sticky)
- **ab_events**: Conversion tracking and analytics
- **ab_results_cache**: Pre-computed statistical results

### Key Features
- **Deterministic Assignment**: Same user always gets same variant
- **Real-time Stats**: Triggers update performance metrics automatically
- **GDPR Compliance**: Configurable data retention and anonymization
- **Statistical Significance**: Built-in Z-test calculations

## API Reference

### Get Active Experiments
```
GET /api/ab-testing?action=get_active_experiments
Headers: X-Shopify-Shop-Domain: your-shop.myshopify.com
```

### Get User Variant
```
GET /api/ab-testing?action=get_variant&experiment_id=123&user_id=user_123
Headers: X-Shopify-Shop-Domain: your-shop.myshopify.com
```

### Track Conversion Event
```
POST /api/ab-testing
Content-Type: application/json

{
  "action": "track_event",
  "experiment_id": 123,
  "user_id": "user_123", 
  "event_type": "purchase",
  "event_value": 99.99
}
```

## Best Practices

### Experiment Design
1. **Single Variable**: Test one thing at a time
2. **Sufficient Sample Size**: Aim for 100+ conversions per variant
3. **Statistical Significance**: Wait for p-value < 0.05 before making decisions
4. **Business Impact**: Focus on metrics that matter (conversion rate, AOV)

### ML Algorithm Testing
- **Basic vs Advanced**: Test personalization complexity
- **ML On/Off**: Validate ML effectiveness vs simple algorithms
- **Hybrid Approaches**: Combine rule-based and ML recommendations

### Bundle Pricing Strategy
- **Discount Levels**: Test 5%, 10%, 15%, 20% discounts
- **Bundle Size**: Test 2-item vs 3-item vs 4-item bundles
- **Pricing Strategy**: Fixed discount vs percentage-based

## Statistical Interpretation

### Key Metrics
- **Conversion Rate**: Primary success metric
- **Revenue Per Visitor**: Secondary optimization target
- **Confidence Interval**: Range of likely true effect
- **P-Value**: Statistical significance (< 0.05 = significant)

### Example Results
```
Variant A (Control): 2.3% conversion rate ±0.4%
Variant B (Advanced ML): 3.1% conversion rate ±0.5%
Lift: +34.8% (p=0.002) ✅ Statistically Significant
```

## Premium Feature Integration

The A/B testing system is perfect for validating your $100/month premium offering:

1. **Test ML Features**: Prove advanced personalization increases conversions
2. **Optimize Bundle Pricing**: Find the discount level that maximizes revenue
3. **Validate Copy Changes**: Test different recommendation text and CTAs
4. **Layout Experiments**: Test cart drawer layouts and positioning

## Troubleshooting

### Common Issues
- **No Variant Assignment**: Check experiment status is 'running'
- **Missing Statistics**: Ensure sufficient sample size (100+ events)
- **Inconsistent Results**: Verify sticky assignment is working

### Debug Mode
Add `?debug=1` to any A/B testing API call for detailed logging:
```
GET /api/ab-testing?action=get_variant&user_id=123&debug=1
```

---

🎉 **Your A/B Testing System is Ready!** 

Start with a simple ML personalization test to validate the system, then expand to bundle pricing optimization. The statistical engine will guide your decisions with confidence intervals and significance testing.