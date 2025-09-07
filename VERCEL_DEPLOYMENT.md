# Vercel Deployment Instructions

## Environment Variables Required in Vercel

Add these environment variables in your Vercel dashboard:

### Required Variables:
```
SHOPIFY_API_KEY=06d17c445a3713f419add1e31894bcc3
SHOPIFY_API_SECRET=[Your secret from Partner Dashboard]
SCOPES=read_customers,read_discounts,read_orders,read_script_tags,read_themes,write_orders,write_products,write_script_tags,write_themes
DATABASE_URL=[Your database connection string]
SESSION_SECRET=[Random string for session encryption]
SHOPIFY_APP_URL=[Your Vercel app URL]
```

### Optional Variables:
```
NODE_ENV=production
```

## Deployment Steps:

1. **Push to GitHub** (already done ✅)
2. **Create Vercel Project**: Link your GitHub repository
3. **Configure Environment Variables**: Add the variables above
4. **Deploy**: Vercel will automatically build and deploy
5. **Update Shopify App URLs**: Update your `shopify.app.toml` with the Vercel URL
6. **Redeploy Shopify App**: Run `shopify app deploy`

## Post-Deployment:
- Your app will be available at: `https://[your-project-name].vercel.app`
- Update the `application_url` and `redirect_urls` in `shopify.app.toml`
- Test the app installation in a development store
# Trigger deployment with complete env vars
