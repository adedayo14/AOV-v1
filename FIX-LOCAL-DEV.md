# Fix Local Development - Cart Uplift

## Problem
The app shows a blank page because `SHOPIFY_API_SECRET` in `.env` has a placeholder value instead of the real secret.

## Solution

### Step 1: Get Your Shopify API Secret
1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Click on **Apps** in the left sidebar
3. Select **cart-uplift-app**
4. Go to **Configuration** tab
5. Under **Client credentials**, copy the **Client secret** value

### Step 2: Update Local Environment
Open `.env` file and replace the line:
```bash
SHOPIFY_API_SECRET="your_api_secret_here"
```

With your actual secret:
```bash
SHOPIFY_API_SECRET="your-actual-secret-from-shopify-partners"
```

### Step 3: Start Development Server
```bash
npm run dev
```

The server should now start successfully and the app will be accessible at:
- **Admin URL**: https://admin.shopify.com/store/test-lab-101/apps/cart-uplift-app-7
- **Local Dev**: The Shopify CLI will show the tunnel URL

## Alternative: Pull from Vercel (if linked)
If your project is linked to Vercel:
```bash
vercel link
vercel env pull .env.local
```

Then copy the values from `.env.local` to `.env`.

## Verify Setup
Run this to check your environment:
```bash
node check-env.js
```

All variables should show ✅ with actual values (not placeholders).
