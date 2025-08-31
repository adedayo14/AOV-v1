# Cart Uplift - Shopify Cart Drawer App

A comprehensive Shopify app that provides an enhanced cart experience with a sliding cart drawer, upsells, free shipping progress bar, and more.

## Features

- **Sticky Cart Button**: Floating cart button that stays visible as users browse
- **Cart Drawer**: Beautiful sliding cart drawer with smooth animations
- **Free Shipping Bar**: Progress bar showing progress toward free shipping
- **Product Upsells**: Smart product recommendations in the cart
- **Fully Customizable**: Complete control over colors, positioning, and messaging
- **Mobile Responsive**: Optimized for all device types
- **Analytics Dashboard**: Track performance and conversions

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Make sure your `.env` file has the necessary Shopify app credentials:

```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET_KEY=your_api_secret
SCOPES=read_products,write_products,read_orders
```

### 3. Start Development

```bash
npm run dev
```

### 4. Enable App Embed in Theme

1. Go to your Shopify admin
2. Navigate to Online Store > Themes
3. Click "Customize" on your active theme
4. In the theme editor, look for "App embeds" in the left sidebar
5. Find "Cart Uplift Cart Drawer" and toggle it ON
6. Configure any theme-level settings
7. Save your theme

### 5. Configure App Settings

1. In your Shopify admin, go to Apps
2. Open the Cart Uplift app
3. Navigate to the "Cart Drawer" tab
4. Configure your settings:
   - Enable/disable features
   - Set free shipping threshold
   - Choose cart position and icon
   - Customize colors
   - Configure upsell settings

## File Structure

```
├── app/                          # Remix app (admin interface)
│   ├── routes/
│   │   ├── app._index.tsx       # Main dashboard
│   │   ├── app.settings.tsx      # Settings page
│   │   └── api.upsells.tsx      # Upsells API endpoint
├── extensions/
│   └── cart-uplift/             # Theme app extension
│       ├── assets/
│       │   ├── cart-uplift.js   # Main JavaScript functionality
│       │   ├── cart-uplift.css  # Styles
│       │   └── thumbs-up.png    # Assets
│       ├── blocks/
│       │   ├── app-embed.liquid # App embed block
│       │   └── star_rating.liquid
│       ├── locales/
│       │   └── en.default.json  # Localization
│       ├── snippets/
│       │   └── stars.liquid     # Rating snippets
│       └── shopify.extension.toml
```

## Theme App Extension

The cart drawer is implemented as a theme app extension with an app embed block. This means:

- ✅ Merchants can enable/disable it easily
- ✅ No theme modifications required
- ✅ Works with any theme
- ✅ Survives theme updates
- ✅ Configurable through theme editor

## Key Components

### App Embed Block (`app-embed.liquid`)
- Loads JavaScript and CSS assets
- Passes settings from theme editor to JavaScript
- Only loads when enabled by merchant

### JavaScript (`cart-uplift.js`)
- Creates sticky cart button
- Manages cart drawer interactions
- Handles add to cart interception
- Fetches and displays upsells
- Updates free shipping progress

### CSS (`cart-uplift.css`)
- Responsive design
- Smooth animations
- Dark mode support
- Mobile optimizations

### Admin Interface
- Dashboard with analytics
- Settings management
- Upsell configuration
- Real-time preview

## Customization

### Colors and Styling
Merchants can customize:
- Background colors
- Text colors
- Button colors
- Cart position
- Cart icon style

### Free Shipping Bar
- Set threshold amount
- Customize messages
- Enable/disable feature

### Upsells
- Enable/disable upsells
- Choose recommendation strategy
- Set maximum number of upsells

## API Endpoints

### `/api/upsells`
Returns product recommendations for the cart drawer.

**Parameters:**
- `shop`: Shop domain

**Response:**
```json
[
  {
    "id": "product_id",
    "title": "Product Name",
    "price": 2999,
    "image": "image_url",
    "variant_id": "variant_id",
    "handle": "product-handle"
  }
]
```

## Development

### Adding New Features

1. **Frontend (Theme Extension)**: Add to `cart-uplift.js` and `cart-uplift.css`
2. **Backend (Admin)**: Add routes in `app/routes/`
3. **Settings**: Update settings interface in `app.settings.tsx`
4. **Theme Settings**: Update schema in `app-embed.liquid`

### Testing

Test the app embed in your development store:

1. Install the app
2. Enable the app embed in theme editor
3. Add products to cart and test functionality
4. Verify mobile responsiveness
5. Test upsell functionality

## Deployment

```bash
npm run deploy
```

This will deploy both the Remix app and the theme extension.

## Analytics

The app tracks:
- Cart opens
- Upsell conversions
- Revenue from upsells
- Average order value
- Conversion rates

## Support

For support or feature requests, please contact the development team.

## License

This project is proprietary software. All rights reserved.
