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
    // Find bundles that contain this product or are relevant to the product type
    relevantBundles = relevantBundles.filter(bundle => {
      // Direct ID match
      if (bundle.products.some(p => p.id === productId)) return true;
      
      // Keyword matching for product types
      const productIdLower = productId.toLowerCase();
      const bundleNameLower = bundle.name.toLowerCase();
      const bundleProductTitles = bundle.products.map(p => p.title.toLowerCase()).join(' ');
      
      // iPhone/phone matching
      if (productIdLower.includes('iphone') || productIdLower.includes('phone')) {
        return bundleNameLower.includes('iphone') || 
               bundleNameLower.includes('mobile') || 
               bundleNameLower.includes('phone') ||
               bundleProductTitles.includes('iphone') ||
               bundleProductTitles.includes('phone');
      }
      
      // MacBook matching
      if (productIdLower.includes('macbook') || productIdLower.includes('laptop')) {
        return bundleNameLower.includes('macbook') || 
               bundleNameLower.includes('laptop') ||
               bundleProductTitles.includes('macbook');
      }
      
      return false;
    });
    
    // If no specific matches, show the general mobile bundle for any product
    if (relevantBundles.length === 0) {
      relevantBundles = allBundles.filter(b => 
        b.status === 'active' && 
        (b.name.toLowerCase().includes('mobile') || b.name.toLowerCase().includes('setup'))
      );
    }
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
      name: 'iPhone Complete Setup',
      description: 'Everything you need for your new iPhone',
      products: [
        { id: 'gid://shopify/Product/8421394857164', title: 'iPhone 15 Pro', price: 999.00 },
        { id: 'gid://shopify/Product/8421394857165', title: 'AirPods Pro', price: 249.00 },
        { id: 'gid://shopify/Product/8421394857166', title: 'iPhone Case', price: 39.00 }
      ],
      regular_total: 1287.00,
      bundle_price: 1158.30,
      discount_percent: 10,
      savings_amount: 128.70,
      discount_code: 'BUNDLE_IPHONE_SETUP',
      status: 'active',
      source: 'ml', // 'ml' or 'manual'
      confidence: 0.87,
      created_at: '2024-01-15T10:30:00Z',
      performance: {
        views: 156,
        clicks: 23,
        conversions: 8,
        revenue: 9266.40
      }
    },
    {
      id: 'bundle_2',
      name: 'Complete Mobile Setup',
      description: 'Perfect starter bundle for any smartphone',
      products: [
        { id: 'smartphone_main', title: 'Latest Smartphone', price: 899.00 },
        { id: 'wireless_earbuds', title: 'Wireless Earbuds', price: 199.00 },
        { id: 'phone_case_premium', title: 'Premium Phone Case', price: 49.00 }
      ],
      regular_total: 1147.00,
      bundle_price: 1032.30,
      discount_percent: 10,
      savings_amount: 114.70,
      discount_code: 'BUNDLE_MOBILE_SETUP',
      status: 'active',
      source: 'ml',
      confidence: 0.92,
      created_at: '2024-01-10T09:15:00Z',
      performance: {
        views: 203,
        clicks: 31,
        conversions: 12,
        revenue: 12387.60
      }
    },
    {
      id: 'bundle_3',
      name: 'MacBook Pro Bundle',
      description: 'Complete productivity setup',
      products: [
        { id: 'prod_macbook', title: 'MacBook Air', price: 1199.00 },
        { id: 'prod_mouse', title: 'Wireless Mouse', price: 59.00 },
        { id: 'prod_mousepad', title: 'Premium Mousepad', price: 20.00 }
      ],
      regular_total: 1278.00,
      bundle_price: 1150.20,
      discount_percent: 10,
      savings_amount: 127.80,
      discount_code: 'BUNDLE_MACBOOK_PRO',
      status: 'draft',
      source: 'manual',
      confidence: null,
      created_at: '2024-01-20T14:20:00Z',
      performance: {
        views: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0
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
