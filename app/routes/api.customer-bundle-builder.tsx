import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate, unauthenticated } from "../shopify.server";
import { getSettings } from "../models/settings.server";

/**
 * Customer Bundle Builder API
 * Enables customers to create their own bundles based on category rules
 * Example: "Pick 5 supplements, get 20% off"
 */

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);
    const shop = session?.shop;
    
    if (!shop) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'get_bundle_rules') {
      return await getBundleRules(shop);
    }

    if (action === 'get_products_for_rule') {
      const ruleId = url.searchParams.get('rule_id');
      return await getProductsForRule(shop, ruleId);
    }

    return json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Bundle builder loader error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);
    const shop = session?.shop;
    
    if (!shop) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const actionType = data.action;

    switch (actionType) {
      case 'create_bundle_session':
        return await createBundleSession(shop, data);
      
      case 'update_bundle_selection':
        return await updateBundleSelection(shop, data);
      
      case 'calculate_bundle_price':
        return await calculateBundlePrice(shop, data);
      
      case 'finalize_bundle':
        return await finalizeBundle(shop, data);
      
      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bundle builder action error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getBundleRules(shop: string) {
  // In production, this would query the manual_bundles table
  // For now, return example rules based on settings
  
  const settings = await getSettings(shop);
  
  // Mock bundle rules - in production these come from database
  const bundleRules = [
    {
      id: 'skincare_5_for_20',
      name: 'Skincare Bundle',
      description: 'Pick any 5 skincare products and save 20%',
      category: 'Skincare',
      min_items: 5,
      max_items: 10,
      discount_type: 'percentage',
      discount_value: 20,
      badge_text: '20% OFF Bundle',
      is_active: true
    },
    {
      id: 'supplements_3_for_15',
      name: 'Supplement Saver',
      description: 'Choose 3 or more supplements for 15% off',
      category: 'Supplements',
      min_items: 3,
      max_items: 8,
      discount_type: 'percentage', 
      discount_value: 15,
      badge_text: 'Multi-Buy Discount',
      is_active: settings?.enableSmartBundles
    },
    {
      id: 'accessories_fixed_10',
      name: 'Accessory Pack',
      description: 'Any 2 accessories - $10 off total',
      category: 'Accessories',
      min_items: 2,
      max_items: 5,
      discount_type: 'fixed_amount',
      discount_value: 10,
      badge_text: '$10 OFF',
      is_active: true
    }
  ];

  const activeRules = bundleRules.filter(rule => rule.is_active);

  return json({
    success: true,
    bundle_rules: activeRules,
    ml_enabled: settings?.enableMLRecommendations || false
  });
}

async function getProductsForRule(shop: string, ruleId: string | null) {
  if (!ruleId) {
    return json({ error: 'Rule ID required' }, { status: 400 });
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    
    // In production, get category from rule configuration
    // For now, fetch products and simulate category filtering
    const productsResp = await admin.graphql(`
      #graphql
      query getProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              handle
              vendor
              productType
              tags
              variants(first: 3) {
                edges {
                  node {
                    id
                    title
                    price
                    availableForSale
                    inventoryQuantity
                  }
                }
              }
              media(first: 1) {
                edges {
                  node {
                    ... on MediaImage {
                      image {
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `, { variables: { first: 50 } });

    if (!productsResp.ok) {
      throw new Error(`GraphQL error: ${productsResp.status}`);
    }

    const productsData = await productsResp.json();
    const allProducts = productsData?.data?.products?.edges || [];

    // Filter products by rule (simulate category filtering)
    const filteredProducts = allProducts.filter((edge: any) => {
      const product = edge.node;
      
      // Simple category matching based on rule ID
      if (ruleId.includes('skincare')) {
        return product.productType?.toLowerCase().includes('skincare') || 
               product.tags.some((tag: string) => tag.toLowerCase().includes('skincare'));
      }
      
      if (ruleId.includes('supplements')) {
        return product.productType?.toLowerCase().includes('supplement') || 
               product.tags.some((tag: string) => tag.toLowerCase().includes('supplement'));
      }
      
      if (ruleId.includes('accessories')) {
        return product.productType?.toLowerCase().includes('accessory') || 
               product.tags.some((tag: string) => tag.toLowerCase().includes('accessory'));
      }
      
      return true; // Default: include all products
    });

    const products = filteredProducts.map((edge: any) => {
      const product = edge.node;
      const defaultVariant = product.variants?.edges?.[0]?.node;
      
      return {
        id: product.id.replace('gid://shopify/Product/', ''),
        title: product.title,
        handle: product.handle,
        vendor: product.vendor,
        productType: product.productType,
        tags: product.tags,
        price: parseFloat(defaultVariant?.price || '0'),
        available: defaultVariant?.availableForSale || false,
        inventory: defaultVariant?.inventoryQuantity || 0,
        variant_id: defaultVariant?.id?.replace('gid://shopify/ProductVariant/', '') || '',
        image: product.media?.edges?.[0]?.node?.image?.url || ''
      };
    });

    return json({
      success: true,
      products: products.slice(0, 24), // Limit for performance
      rule_id: ruleId
    });

  } catch (error) {
    console.error('Error fetching products for rule:', error);
    return json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

async function createBundleSession(shop: string, data: any) {
  const { rule_id, session_id } = data;
  
  if (!rule_id || !session_id) {
    return json({ error: 'Rule ID and session ID required' }, { status: 400 });
  }

  // In production, save to database
  const bundleSession = {
    id: `bundle_${session_id}_${Date.now()}`,
    shop_id: shop,
    session_id,
    rule_id,
    selected_products: [],
    total_value: 0,
    discount_applied: 0,
    final_price: 0,
    status: 'building',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
  };

  console.log('🛒 Created bundle session:', bundleSession);

  return json({
    success: true,
    bundle_session: bundleSession
  });
}

async function updateBundleSelection(shop: string, data: any) {
  const { bundle_session_id, selected_products } = data;
  
  if (!bundle_session_id || !Array.isArray(selected_products)) {
    return json({ error: 'Bundle session ID and products required' }, { status: 400 });
  }

  // Calculate totals
  const totalValue = selected_products.reduce((sum: number, item: any) => 
    sum + (parseFloat(item.price) * (item.quantity || 1)), 0
  );

  // In production, update database record
  console.log('📝 Updated bundle selection:', {
    bundle_session_id,
    product_count: selected_products.length,
    total_value: totalValue
  });

  return json({
    success: true,
    selected_products,
    total_value: totalValue,
    product_count: selected_products.length
  });
}

async function calculateBundlePrice(shop: string, data: any) {
  const { rule_id, selected_products } = data;
  
  if (!rule_id || !Array.isArray(selected_products)) {
    return json({ error: 'Rule ID and products required' }, { status: 400 });
  }

  // Get rule configuration (in production, from database)
  const rule = await getBundleRuleById(rule_id);
  
  if (!rule) {
    return json({ error: 'Bundle rule not found' }, { status: 404 });
  }

  const itemCount = selected_products.length;
  const subtotal = selected_products.reduce((sum: number, item: any) => 
    sum + (parseFloat(item.price) * (item.quantity || 1)), 0
  );

  let discountAmount = 0;
  let finalPrice = subtotal;
  let isEligible = itemCount >= rule.min_items;

  if (isEligible) {
    if (rule.discount_type === 'percentage') {
      discountAmount = subtotal * (rule.discount_value / 100);
    } else if (rule.discount_type === 'fixed_amount') {
      discountAmount = Math.min(rule.discount_value, subtotal);
    }
    finalPrice = Math.max(0, subtotal - discountAmount);
  }

  return json({
    success: true,
    calculation: {
      rule_id,
      item_count: itemCount,
      min_items_required: rule.min_items,
      is_eligible: isEligible,
      subtotal,
      discount_amount: discountAmount,
      final_price: finalPrice,
      savings_percentage: subtotal > 0 ? Math.round((discountAmount / subtotal) * 100) : 0,
      rule_name: rule.name,
      badge_text: rule.badge_text
    }
  });
}

async function finalizeBundle(shop: string, data: any) {
  const { bundle_session_id, selected_products, final_price } = data;
  
  if (!bundle_session_id || !selected_products || typeof final_price !== 'number') {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  // In production, update database and create cart line items
  const bundleData = {
    id: bundle_session_id,
    status: 'completed',
    completed_at: new Date().toISOString(),
    products: selected_products,
    final_price
  };

  // Track bundle completion analytics
  console.log('✅ Bundle finalized:', bundleData);

  return json({
    success: true,
    bundle: bundleData,
    message: 'Bundle created successfully! Add to cart to complete your order.'
  });
}

// Helper function to get bundle rule configuration
async function getBundleRuleById(ruleId: string) {
  // Mock rules - in production, query database
  const rules: Record<string, any> = {
    'skincare_5_for_20': {
      id: 'skincare_5_for_20',
      name: 'Skincare Bundle',
      min_items: 5,
      discount_type: 'percentage',
      discount_value: 20,
      badge_text: '20% OFF Bundle'
    },
    'supplements_3_for_15': {
      id: 'supplements_3_for_15', 
      name: 'Supplement Saver',
      min_items: 3,
      discount_type: 'percentage',
      discount_value: 15,
      badge_text: 'Multi-Buy Discount'
    },
    'accessories_fixed_10': {
      id: 'accessories_fixed_10',
      name: 'Accessory Pack',
      min_items: 2,
      discount_type: 'fixed_amount',
      discount_value: 10,
      badge_text: '$10 OFF'
    }
  };

  return rules[ruleId] || null;
}