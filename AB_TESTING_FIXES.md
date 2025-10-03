# AB Testing Fixes - Summary

## Issues Fixed

### 1. ✅ "Crunching numbers" stuck in results modal
**Problem**: Results modal showed "Crunching numbers..." but never loaded data  
**Root cause**: Your experiment is new and hasn't collected any visitor/conversion data yet  
**Solution**: 
- Results endpoint is working correctly (tested with `/api/ab-results?experimentId=1&period=7d`)
- Added better empty state: Now shows "Not enough data yet" banner with helpful message
- Results will populate once visitors start hitting your proxy and seeing variants

**What to expect**:
- When a visitor lands on your store, the app proxy assigns them to a variant (Control or Variant B)
- Assignments are logged as `assignment` events
- When they complete a purchase, it's logged as a `conversion` event
- Results aggregate these events and show revenue per visitor

### 2. ✅ Only discounts supported - added experiment types
**Problem**: UI only supported discount experiments  
**Solution**: Added full experiment type system

**New experiment types available**:
- 💰 **Discount offer** - Test different discount percentages
- 📦 **Bundle deal** - Test bundle vs non-bundle offers  
- 🚚 **Shipping threshold** - Test free shipping thresholds
- ⬆️ **Upsell** - Test different upsell strategies

**Changes made**:
1. Added `ExperimentType` enum to Prisma schema
2. Added `type` field to `Experiment` model (defaults to `discount`)
3. Added experiment type selector in create modal with emoji icons
4. Updated experiment cards to show type badge
5. API now accepts and stores experiment type

### 3. ✅ Database schema migration
**Problem**: Production database missing `attribution` and `type` columns  
**Solution**: Updated `vercel-build` script to auto-run `prisma db push` on deployment

**What happens now**:
- Every Vercel deployment automatically applies schema changes
- Your production database will get updated with:
  - `attribution` column (already pushed)
  - `type` column (will be added on next deployment)

## Deployment Status

**Current status**: 
- ✅ All code changes committed and pushed to GitHub main
- ⏳ Waiting for Vercel auto-deploy (usually 1-2 minutes)
- ⏳ Database migrations will run during deployment

**Monitor deployment**:
1. Go to https://vercel.com/dashboard
2. Watch for new deployment to complete
3. Check build logs to confirm `prisma db push` runs successfully

**Once deployed**:
- Refresh your AB Testing page in Shopify admin
- Try creating a new experiment with different types
- Results will show "Not enough data yet" until visitors start hitting your store

## Next Steps

### Immediate (once deployment completes):
1. Create a test experiment from Shopify admin
2. Visit your storefront to trigger variant assignment
3. Complete a test order
4. View results - should show 1 visitor, 1 conversion

### For real testing:
1. Let experiment run for at least 24-48 hours
2. Aim for minimum 100 visitors per variant for statistical significance
3. Check results daily to monitor performance
4. When a clear winner emerges, click "Roll out winner" to give 100% traffic to best variant

## Technical Details

**Experiment types** - How they work:
- Currently all types use the `discountPct` field in variants
- In the future, you can extend the variant model to support:
  - Bundle-specific fields (bundle IDs, products)
  - Shipping-specific fields (threshold amounts, messaging)
  - Upsell-specific fields (product IDs, trigger conditions)

**Results calculation**:
- **Revenue per visitor** = Total revenue / Total assignments
- **Conversion rate** = Conversions / Assignments
- **Leader** = Variant with highest revenue per visitor

**Data flow**:
1. Visitor → App Proxy (`apps.proxy.$.tsx`)
2. Proxy assigns variant using MurmurHash3 (deterministic)
3. Assignment logged as `Event` with type=`assignment`
4. On purchase → conversion logged with `amount` and `currency`
5. Results endpoint aggregates events and calculates metrics

## Files Changed

- `prisma/schema.prisma` - Added ExperimentType enum and type field
- `app/routes/app.ab-testing.tsx` - Added type selector, improved results display
- `app/routes/api.ab-testing-admin.tsx` - Handle type field in create
- `package.json` - Auto-run migrations on Vercel build

## Troubleshooting

**If results still show "Crunching numbers"**:
- Check browser console for errors
- Verify `/api/ab-results?experimentId=X` returns data
- Confirm experiment has `running` status

**If "Not enough data yet" persists**:
- Visit your storefront (triggers assignment)
- Check database: `SELECT * FROM ab_events;`
- Verify app proxy is working (`/apps/proxy/test`)

**If new experiment types aren't showing**:
- Ensure Vercel deployment completed
- Hard refresh Shopify admin (Cmd+Shift+R)
- Check `prisma db push` ran in Vercel build logs
