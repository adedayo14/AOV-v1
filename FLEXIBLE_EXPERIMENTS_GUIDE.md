# Flexible Experiment Values + Analytics Tracking

## ✅ What Got Fixed

### 1. **Experiment Types Now Have Appropriate Fields**

**Before**: All experiments only had "Discount %" field  
**After**: Dynamic fields based on experiment type

| Experiment Type | Control/Variant Field | Example Values |
|----------------|----------------------|----------------|
| 💰 Discount | Discount % | 10% off vs 20% off |
| 🚚 Shipping | Threshold $ | Free at $50 vs Free at $100 |
| 📦 Bundle | Bundle Price $ | $29.99 vs $24.99 |
| ⬆️ Upsell | Upsell Value $ | $15 upsell vs $20 upsell |

### 2. **AnalyticsEvent Model for Real Dashboard Data**

**Before**: Analytics dashboard queried wrong model (AB testing Event)  
**After**: Dedicated AnalyticsEvent model for cart/bundle tracking

```typescript
model AnalyticsEvent {
  shop        String    // Which store
  eventType   String    // cart_view | cart_abandon | purchase | etc.
  sessionId   String?   // Anonymous tracking
  customerId  String?   // Logged-in customer
  orderId     String?   // Shopify order ID
  orderValue  Decimal?  // Order total
  bundleId    String?   // Bundle reference
  timestamp   DateTime  // When it happened
  metadata    Json?     // Extra data
}
```

## 🎨 UI Improvements

### Create Modal - Dynamic Fields

When you select **"💰 Discount offer"**:
```
Control (current offer)
├─ Discount %: [0] %
└─ Help: "Percentage off (e.g., 10 for 10% off)"

Challenger (new offer)
├─ Name: [Stronger Discount]
├─ Discount %: [20] %
└─ Help: "Percentage off (e.g., 20 for 20% off)"
```

When you select **"🚚 Shipping threshold"**:
```
Control (current offer)
├─ Shipping Threshold $: [0] $
└─ Help: "Free shipping at this cart value (e.g., 50 for $50)"

Challenger (new offer)
├─ Name: [Lower Threshold]
├─ Shipping Threshold $: [100] $
└─ Help: "Free shipping at this cart value (e.g., 100 for $100)"
```

### Experiment Cards - Smart Formatting

The experiment list now shows values correctly:

**Discount experiment**:
- Control: `10% off` | Traffic: 50%
- Variant B: `20% off` | Traffic: 50%

**Shipping experiment**:
- Control: `$50 threshold` | Traffic: 50%
- Variant B: `$100 threshold` | Traffic: 50%

**Bundle experiment**:
- Control: `$29.99 bundle price` | Traffic: 50%
- Variant B: `$24.99 bundle price` | Traffic: 50%

## 🗄️ Schema Changes

### Variant Model - Old vs New

**Before**:
```prisma
model Variant {
  discountPct  Decimal   @default(0.0)  // Only for discounts!
  trafficPct   Decimal   @default(50.0)
}
```

**After**:
```prisma
model Variant {
  value       Decimal   @default(0.0)  // Flexible: discount % | shipping $ | bundle $ | etc.
  trafficPct  Decimal   @default(50.0)
}
```

### New AnalyticsEvent Model

```prisma
model AnalyticsEvent {
  id          String   @id @default(cuid())
  shop        String
  eventType   String   // cart_view | purchase | bundle_conversion | etc.
  sessionId   String?
  customerId  String?
  orderId     String?
  orderValue  Decimal?
  currency    String?  @default("USD")
  bundleId    String?
  productIds  String?  // JSON array
  pageUrl     String?
  timestamp   DateTime @default(now())
  metadata    Json?
  
  @@index([shop, timestamp(sort: Desc)])
  @@index([shop, eventType, timestamp(sort: Desc)])
  @@map("analytics_events")
}
```

## 🔄 Migration Strategy

### Backward Compatibility

The API accepts **both** old and new field names during migration:

```typescript
// API accepts both:
value: 10        // New schema
discountPct: 10  // Legacy schema (auto-converted)

// Priority: value > discountPct
const variantValue = v.value ?? v.discountPct ?? 0;
```

### Vercel Auto-Migration

Your `vercel-build` script runs `prisma db push` which will:
1. Rename `discount_pct` column to `value` in `ab_variants` table
2. Create new `analytics_events` table
3. Keep all existing experiment data intact

## 📊 Analytics Dashboard - Now Real Data

### Before
```typescript
const analytics: any[] = []; // Empty mock data
```

### After
```typescript
const analytics = await prisma.analyticsEvent.findMany({
  where: {
    shop,
    timestamp: { gte: startDate, lte: endDate }
  }
});

const cartViews = analytics.filter(a => a.eventType === 'cart_view');
const purchases = analytics.filter(a => a.eventType === 'purchase');
const bundleConversions = analytics.filter(a => 
  a.eventType === 'bundle_conversion' && a.bundleId
);
```

### Event Types Supported

| Event Type | When It's Tracked | Data Captured |
|-----------|------------------|---------------|
| `cart_view` | User opens cart | sessionId, productIds |
| `cart_abandon` | User leaves with items | sessionId, cartValue |
| `purchase` | Order completed | orderId, orderValue, customerId |
| `bundle_impression` | Bundle shown to user | bundleId, pageUrl |
| `bundle_click` | User clicks bundle | bundleId, sessionId |
| `bundle_conversion` | Bundle purchased | bundleId, orderId, orderValue |

## 🚀 Next Steps

### 1. Wait for Deployment
- Vercel will auto-deploy in ~1-2 minutes
- Check build logs to confirm `prisma db push` runs successfully
- Database will be migrated automatically

### 2. Test Flexible Experiments
```
1. Go to AB Testing page
2. Click "Create experiment"
3. Select "🚚 Shipping threshold"
4. Control: $50
5. Challenger: $100
6. Save and run
```

### 3. Implement Analytics Tracking

You need to add tracking code to your storefront to populate AnalyticsEvent:

**Example - Track cart views** (in your cart drawer component):
```typescript
// When cart opens
await fetch('/api/analytics-track', {
  method: 'POST',
  body: JSON.stringify({
    eventType: 'cart_view',
    sessionId: getSessionId(),
    productIds: cart.items.map(i => i.product.id)
  })
});
```

**Example - Track purchases** (in your order confirmation):
```typescript
// After checkout
await fetch('/api/analytics-track', {
  method: 'POST',
  body: JSON.stringify({
    eventType: 'purchase',
    orderId: order.id,
    orderValue: order.total_price,
    customerId: customer?.id,
    sessionId: getSessionId()
  })
});
```

**Example - Track bundle conversions**:
```typescript
// When bundle item purchased
await fetch('/api/analytics-track', {
  method: 'POST',
  body: JSON.stringify({
    eventType: 'bundle_conversion',
    bundleId: bundle.id,
    orderId: order.id,
    orderValue: bundleTotal,
    sessionId: getSessionId()
  })
});
```

### 4. Create Analytics Tracking API

You'll need to create `/api/analytics-track` route:

```typescript
// app/routes/api.analytics-track.tsx
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.public.appProxy(request);
  const shop = session?.shop || 'unknown';
  const data = await request.json();
  
  await prisma.analyticsEvent.create({
    data: {
      shop,
      eventType: data.eventType,
      sessionId: data.sessionId,
      customerId: data.customerId,
      orderId: data.orderId,
      orderValue: data.orderValue,
      bundleId: data.bundleId,
      productIds: data.productIds ? JSON.stringify(data.productIds) : null,
      pageUrl: data.pageUrl,
      metadata: data.metadata,
      timestamp: new Date(),
    }
  });
  
  return json({ success: true });
}
```

## 🔍 How to Verify

### Check Experiment Value Display
1. Go to AB Testing page
2. Create shipping experiment: $50 vs $100
3. Card should show: `$50 threshold` and `$100 threshold` (not percentages!)

### Check Analytics Table
```sql
-- After deployment, verify table exists
SELECT * FROM analytics_events LIMIT 5;

-- Check event types being tracked
SELECT event_type, COUNT(*) 
FROM analytics_events 
GROUP BY event_type;
```

### Check Dashboard Shows Real Data
1. Add some analytics tracking to your storefront
2. Generate a few cart views and purchases
3. Open Analytics Dashboard
4. Should show real metrics instead of mocks

## 🐛 Troubleshooting

**Issue**: Experiment still shows "Discount: X%"  
**Fix**: Refresh page after deployment completes, database needs migration

**Issue**: Analytics dashboard still empty  
**Fix**: Need to implement tracking code in storefront (see step 3 above)

**Issue**: TypeScript errors about 'value' field  
**Fix**: Restart VS Code TypeScript server (Cmd+Shift+P → "Restart TS Server")

**Issue**: Old experiments show wrong values  
**Fix**: They'll display as-is (old discountPct becomes value). To fix, edit and re-save them.
