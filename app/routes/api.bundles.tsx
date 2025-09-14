import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withAuth } from "../utils/auth.server";

/**
 * Bundle Management API
 * Handles CRUD operations for manual bundles and ML-discovered bundles
 */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id');
  const collectionId = url.searchParams.get('collection_id');
  const context = url.searchParams.get('context') || 'admin';
  const shop = url.searchParams.get('shop');
  
  try {
    // Handle frontend requests (no shop param, coming from storefront)
    if (!shop && (productId || collectionId || context !== 'admin')) {
      return await handleStorefrontBundleRequest({ productId, collectionId, context });
    }
    
    // Handle admin requests (with shop param)
    if (!shop) {
      return json({ error: 'Shop parameter required for admin requests' }, { status: 400 });
    }
    
    // Get all bundles for the shop (admin interface)
    const bundles = await getBundlesForShop(shop);
    
    return json({
      success: true,
      bundles,
      stats: {
        total: bundles.length,
        active: bundles.filter(b => b.status === 'active').length,
        ml_discovered: bundles.filter(b => b.source === 'ml').length,
        manual: bundles.filter(b => b.source === 'manual').length
      }
    });
    
  } catch (error) {
    console.error('Bundle fetch error:', error);
    return json({ error: 'Failed to fetch bundles' }, { status: 500 });
  }
};

export const action = withAuth(async ({ request }: ActionFunctionArgs) => {
  try {
    const data = await request.json();
    const { action: actionType, shop, bundle } = data;
    
    switch (actionType) {
      case 'create':
        return await createBundle(shop, bundle);
      case 'update':
        return await updateBundle(shop, bundle);
      case 'delete':
        return await deleteBundle(shop, bundle.id);
      case 'toggle_status':
        return await toggleBundleStatus(shop, bundle.id);
      case 'generate_discount_code':
        return await generateBundleDiscountCode(shop, bundle);
      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Bundle management error:', error);
    return json({ error: 'Bundle operation failed' }, { status: 500 });
  }
});

// Storefront bundle request handler (no auth required)
async function handleStorefrontBundleRequest({ productId, collectionId, context }: {
  productId?: string | null;
  collectionId?: string | null;
  context?: string;
}) {
  console.log('Storefront bundle request:', { productId, collectionId, context });
  
  // Get all available bundles
  const allBundles = await getBundlesForShop('any'); // Mock shop for demo
  
  // Filter bundles based on request
  let relevantBundles = allBundles.filter(b => b.status === 'active');
  
  if (productId && context === 'product') {
    console.log('Filtering bundles for product:', productId);
    
    // Find bundles that contain this product or are relevant to the product type
    relevantBundles = relevantBundles.filter(bundle => {
      // Direct ID match (check both Shopify GID format and plain ID)
      const hasDirectMatch = bundle.products.some(p => 
        p.id === productId || 
        p.id === `gid://shopify/Product/${productId}` ||
        p.id.endsWith(`/${productId}`)
      );
      if (hasDirectMatch) {
        console.log('Found direct ID match in bundle:', bundle.name);
        return true;
      }
      
      // For demo purposes, show relevant bundles for any product on PDP
      // This makes the demo work regardless of which product is viewed
      return true;
    });
    
    // Limit to first 2 bundles for clean display
    relevantBundles = relevantBundles.slice(0, 2);
    
    console.log(`Found ${relevantBundles.length} relevant bundles for product ${productId}`);
  }
  
  if (collectionId && context === 'collection') {
    // Return featured bundles for collection pages
    relevantBundles = relevantBundles.slice(0, 2);
  }
  
  return json({
    success: true,
    bundles: relevantBundles,
    context,
    debug: { productId, collectionId, totalFound: relevantBundles.length }
  });
}

// Bundle management functions
async function getBundlesForShop(shop: string) {
  // Mock data with realistic product IDs that might match real products
  return [
    {
      id: 'bundle_1',
      name: 'Complete Footwear Bundle',
      description: 'Everything you need for your active lifestyle',
      products: [
        { id: '51714487091539', title: 'Mens Strider', price: 89.99 },
        { id: 'athletic_socks_001', title: 'Performance Athletic Socks', price: 19.99 },
        { id: 'shoe_care_kit_001', title: 'Premium Shoe Care Kit', price: 29.99 }
      ],
      regular_total: 139.97,
      bundle_price: 125.97,
      discount_percent: 10,
      savings_amount: 13.97,
      discount_code: 'BUNDLE_FOOTWEAR_COMPLETE',
      status: 'active',
      source: 'ml', // 'ml' or 'manual'
      confidence: 0.87,
      created_at: '2024-01-15T10:30:00Z',
      performance: {
        views: 156,
        clicks: 23,
        conversions: 8,
        revenue: 1007.76
      }
    },
    {
      id: 'bundle_2',
      name: 'Athletic Performance Bundle',
      description: 'Complete gear for athletes and fitness enthusiasts',
      products: [
        { id: '51714487091539', title: 'Mens Strider', price: 89.99 },
        { id: 'water_bottle_premium', title: 'Insulated Water Bottle', price: 34.99 },
        { id: 'workout_towel', title: 'Quick-Dry Workout Towel', price: 24.99 }
      ],
      regular_total: 149.97,
      bundle_price: 134.97,
      discount_percent: 10,
      savings_amount: 15.00,
      discount_code: 'BUNDLE_ATHLETIC_PERFORMANCE',
      status: 'active',
      source: 'ml',
      confidence: 0.92,
      created_at: '2024-01-10T09:15:00Z',
      performance: {
        views: 203,
        clicks: 31,
        conversions: 12,
        revenue: 1619.64
      }
    },
    {
      id: 'bundle_3',
      name: 'Running Essentials Bundle',
      description: 'Everything you need for your running routine',
      products: [
        { id: 'running_shoes_premium', title: 'Premium Running Shoes', price: 149.99 },
        { id: 'running_shorts', title: 'Performance Running Shorts', price: 39.99 },
        { id: 'fitness_tracker', title: 'Fitness Activity Tracker', price: 99.99 }
      ],
      regular_total: 289.97,
      bundle_price: 260.97,
      discount_percent: 10,
      savings_amount: 29.00,
      discount_code: 'BUNDLE_RUNNING_ESSENTIALS',
      status: 'active',
      source: 'manual',
      confidence: null,
      created_at: '2024-01-20T14:20:00Z',
      performance: {
        views: 89,
        clicks: 12,
        conversions: 4,
        revenue: 1043.88
      }
    }
  ];
}

async function createBundle(shop: string, bundleData: any) {
  console.log('Creating new bundle for shop:', shop);
  
  // Validate bundle data
  if (!bundleData.name || !bundleData.products || bundleData.products.length < 2) {
    return json({ error: 'Bundle must have a name and at least 2 products' }, { status: 400 });
  }
  
  // Calculate pricing
  const regularTotal = bundleData.products.reduce((sum: number, product: any) => 
    sum + parseFloat(product.price), 0);
  const discountPercent = parseFloat(bundleData.discount_percent || '10');
  const bundlePrice = regularTotal * (1 - discountPercent / 100);
  const savingsAmount = regularTotal - bundlePrice;
  
  // Generate discount code
  const discountCode = `BUNDLE_${bundleData.name.toUpperCase().replace(/\s+/g, '_')}`;
  
  const newBundle = {
    id: `bundle_${Date.now()}`,
    name: bundleData.name,
    description: bundleData.description || '',
    products: bundleData.products,
    regular_total: regularTotal,
    bundle_price: bundlePrice,
    discount_percent: discountPercent,
    savings_amount: savingsAmount,
    discount_code: discountCode,
    status: 'draft',
    source: 'manual',
    confidence: null,
    created_at: new Date().toISOString(),
    performance: {
      views: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0
    }
  };
  
  // In production, save to database
  console.log('Created bundle:', newBundle);
  
  // Create Shopify discount code
  const shopifyDiscountResult = await createShopifyDiscountCode(shop, {
    code: discountCode,
    discount_percent: discountPercent,
    minimum_amount: regularTotal * 0.95, // Require most of bundle items
    product_ids: bundleData.products.map((p: any) => p.id)
  });
  
  return json({
    success: true,
    bundle: newBundle,
    shopify_discount: shopifyDiscountResult
  });
}

async function updateBundle(shop: string, bundleData: any) {
  console.log('Updating bundle for shop:', shop, 'bundle:', bundleData.id);
  
  // In production, update in database
  const updatedBundle = {
    ...bundleData,
    updated_at: new Date().toISOString()
  };
  
  return json({
    success: true,
    bundle: updatedBundle
  });
}

async function deleteBundle(shop: string, bundleId: string) {
  console.log('Deleting bundle for shop:', shop, 'bundle:', bundleId);
  
  // In production, delete from database and Shopify discount
  
  return json({
    success: true,
    deleted_bundle_id: bundleId
  });
}

async function toggleBundleStatus(shop: string, bundleId: string) {
  console.log('Toggling bundle status for shop:', shop, 'bundle:', bundleId);
  
  // In production, update status in database
  const newStatus = 'active'; // Would check current status and toggle
  
  return json({
    success: true,
    bundle_id: bundleId,
    new_status: newStatus
  });
}

async function generateBundleDiscountCode(shop: string, bundleData: any) {
  console.log('Generating discount code for bundle:', bundleData.id);
  
  const discountCode = `BUNDLE_${bundleData.name.toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;
  
  // Create in Shopify
  const shopifyResult = await createShopifyDiscountCode(shop, {
    code: discountCode,
    discount_percent: bundleData.discount_percent,
    minimum_amount: bundleData.regular_total * 0.95,
    product_ids: bundleData.products.map((p: any) => p.id)
  });
  
  return json({
    success: true,
    discount_code: discountCode,
    shopify_result: shopifyResult
  });
}

async function createShopifyDiscountCode(shop: string, discountData: any) {
  // Mock Shopify discount creation - would be real GraphQL/REST API call
  console.log('Creating Shopify discount code:', discountData.code);
  
  // In production, this would create actual Shopify discount codes:
  /*
  const discountInput = {
    basicCodeDiscount: {
      title: discountData.code,
      code: discountData.code,
      startsAt: new Date().toISOString(),
      customerSelection: {
        all: true
      },
      customerGets: {
        value: {
          percentage: discountData.discount_percent / 100
        },
        items: {
          products: {
            productsToAdd: discountData.product_ids
          }
        }
      },
      minimumRequirement: {
        subtotal: {
          greaterThanOrEqualToSubtotal: discountData.minimum_amount
        }
      },
      usageLimit: null
    }
  };
  
  const mutation = `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const response = await admin.graphql(mutation, { variables: { basicCodeDiscount: discountInput } });
  */
  
  return {
    success: true,
    shopify_discount_id: 'gid://shopify/DiscountCodeNode/fake_id',
    code: discountData.code,
    created_at: new Date().toISOString()
  };
}
