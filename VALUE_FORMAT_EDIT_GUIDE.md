# Value Format Selector & Edit Experiments

## ✅ What Got Fixed

### 1. User Chooses Value Format (% | $ | #)

**Before**: Format was forced by experiment type
- Discount experiments → Always showed "%"
- Shipping experiments → Always showed "$"
- No flexibility

**After**: You choose how to measure ANY experiment!

```
"How do you want to measure values?"

[Dropdown options:]
- % Percentage (e.g., 10% off)
- $ Currency (e.g., $50 threshold)
- # Number (e.g., 2 items)
```

**Examples**:

| Experiment Type | Format Choice | Control | Challenger | Use Case |
|----------------|---------------|---------|------------|----------|
| Discount | % Percentage | 10% | 20% | Percentage off |
| Discount | $ Currency | $5 | $10 | Fixed dollar discount |
| Shipping | $ Currency | $50 | $100 | Free shipping threshold |
| Shipping | % Percentage | 0% | 100% | Percentage of shipping cost |
| Bundle | $ Currency | $29.99 | $24.99 | Bundle price |
| Bundle | % Percentage | 10% | 20% | Bundle discount % |
| Upsell | $ Currency | $15 | $25 | Upsell offer amount |
| Upsell | # Number | 1 | 2 | Number of free items |

### 2. Edit Experiments ✏️

**Before**: No edit button - had to delete and recreate  
**After**: Edit button opens modal to modify experiment!

**What you can edit**:
- ✅ Experiment name
- ✅ Variant values (Control & Challenger)
- ✅ Variant names

**What you cannot edit** (requires new experiment):
- ❌ Experiment type (discount/bundle/shipping/upsell)
- ❌ Value format (% / $ / #)
- ❌ Attribution window

**Why the restriction?**  
Changing type or format mid-experiment would invalidate existing data and confuse results interpretation.

### 3. View Results Fixed 📊

**Before**: Results API returned old `discountPct` field  
**After**: Results API returns `value` + `valueFormat`

**What this means**:
- Results modal now shows correct values
- "Not enough data yet" banner appears when no visitors
- Once you have traffic, results show properly formatted values

## 🎨 New UI Flow

### Create Experiment

1. **Name your test**: "Free Shipping Test"
2. **Choose type**: 🚚 Shipping threshold
3. **Choose format**: $ Currency
4. **Set attribution**: Orders within 24 hours
5. **Start now?**: Yes
6. **Define variants**:
   - Control: Value ($) = **50**  
     ↳ Shows as "$50" on card
   - Challenger: Value ($) = **100**  
     ↳ Shows as "$100" on card

### Edit Experiment

1. Click **Edit** button on experiment card
2. Modal opens with pre-filled values
3. Change experiment name or variant values
4. Click **Save Changes**
5. Experiment updates without losing data

### View Results

1. Click **View results** button
2. If no data yet: Shows "Not enough data yet" banner
3. If has data: Shows formatted results table:

```
Window: Mar 1, 2025 - Mar 7, 2025

Control
Value: $50 | Traffic: 50%
Visitors: 150 | Orders: 12 | Revenue: $1,200
Revenue/visitor: $8.00 | Conversion: 8.00%

Variant B
Value: $100 | Traffic: 50%  ⭐ Recommended
Visitors: 148 | Orders: 18 | Revenue: $2,160
Revenue/visitor: $14.59 | Conversion: 12.16%
```

## 🗄️ Schema Changes

### New Field: `valueFormat`

```prisma
model Variant {
  value        Decimal   // The numeric value
  valueFormat  String    @default("percent") // "percent" | "currency" | "number"
  trafficPct   Decimal   @default(50.0)
}
```

**Storage**:
- `value = 10`, `valueFormat = "percent"` → Displays as "10%"
- `value = 50`, `valueFormat = "currency"` → Displays as "$50"
- `value = 2`, `valueFormat = "number"` → Displays as "2"

## 🔄 Migration

### Automatic Migration

When Vercel deploys, `prisma db push` will:
1. Add `value_format` column to `ab_variants` table
2. Default existing rows to `"percent"` (backward compatible)
3. Your existing experiments will display as percentages

### Manual Fix for Existing Experiments

If you have experiments that should be "$" instead of "%":
1. Click **Edit** on the experiment
2. Save it (this will update to new schema)
3. If needed, adjust values (e.g., convert 50% → $50)

## 💡 Pro Tips

### When to Use Each Format

**% Percentage**:
- Discount experiments (10% off vs 20% off)
- Conversion rate goals
- Shipping cost percentages

**$ Currency**:
- Free shipping thresholds ($50 vs $100)
- Bundle pricing ($29.99 vs $24.99)
- Fixed dollar discounts ($5 off vs $10 off)
- Upsell amounts ($15 upsell vs $25 upsell)

**# Number**:
- Quantity thresholds (Buy 2 get 1 vs Buy 3 get 1)
- Free items (1 free item vs 2 free items)
- Points/rewards (100 points vs 200 points)

### Best Practices

1. **Keep format consistent within experiment**
   - Both Control and Challenger should use same format
   - Makes comparison easier to understand

2. **Name experiments clearly**
   - ✅ "Free Shipping: $50 vs $100"
   - ❌ "Test 1"

3. **Use Edit for minor tweaks only**
   - Typos in names
   - Small value adjustments
   - Don't drastically change values mid-test (invalidates data)

4. **Create new experiment for major changes**
   - Different format (% → $)
   - Different type (discount → shipping)
   - Completely different values (10% → $50)

## 🚀 What's Next

### Test Your New Features

1. **Create a flexible experiment**:
   ```
   Name: "Discount Test"
   Type: 💰 Discount
   Format: $ Currency  ← New choice!
   Control: $5
   Challenger: $10
   ```

2. **Edit an existing experiment**:
   - Click Edit on any experiment
   - Change the name
   - Save and see it update

3. **Check View Results**:
   - Click "View results" on running experiment
   - Should show "Not enough data yet" (if no traffic)
   - Or show formatted results (if has traffic)

### Need to Track Analytics?

Remember: View Results only works if you're tracking conversions!

See `FLEXIBLE_EXPERIMENTS_GUIDE.md` for:
- How to track cart views
- How to track purchases
- How to track bundle conversions
- Analytics dashboard setup

## 🐛 Troubleshooting

**Issue**: Can't see value format selector  
**Fix**: Wait for Vercel deployment, then refresh page

**Issue**: Existing experiments still show wrong format  
**Fix**: Click Edit → Save to migrate to new schema

**Issue**: View results shows "Not enough data yet"  
**Fix**: Normal! Need to track events from storefront (see analytics guide)

**Issue**: Edit button doesn't work  
**Fix**: Hard refresh (Cmd+Shift+R) to clear cached JavaScript

**Issue**: Values display as "10" instead of "$10"  
**Fix**: valueFormat might be "number" - Edit and re-save to fix
