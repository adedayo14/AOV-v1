import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop') || session.shop;

    // For now, return sample purchase patterns
    // In production, this would fetch real analytics data from Shopify or your database
    const purchasePatterns = {
      frequentPairs: {
        // Running Shoes
        "7234567890123": {
          "7234567890124": 0.35, // Athletic Socks
          "7234567890125": 0.28, // Insoles
          "7234567890126": 0.22, // Water Bottle
          "7234567890127": 0.18, // Fitness Tracker
        },
        // Dress Shirt
        "7234567890130": {
          "7234567890131": 0.42, // Ties
          "7234567890132": 0.31, // Cufflinks
          "7234567890133": 0.25, // Belt
          "7234567890134": 0.19, // Blazer
        },
        // Laptop
        "7234567890140": {
          "7234567890141": 0.65, // Laptop Case
          "7234567890142": 0.54, // Wireless Mouse
          "7234567890143": 0.38, // Keyboard
          "7234567890144": 0.29, // Monitor
        },
        // Coffee Maker
        "7234567890150": {
          "7234567890151": 0.58, // Coffee Beans
          "7234567890152": 0.45, // Coffee Filters
          "7234567890153": 0.37, // Coffee Mug
          "7234567890154": 0.24, // Milk Frother
        },
        // Yoga Mat
        "7234567890160": {
          "7234567890161": 0.33, // Yoga Blocks
          "7234567890162": 0.29, // Yoga Strap
          "7234567890163": 0.26, // Water Bottle
          "7234567890164": 0.21, // Yoga Pants
        },
        // Winter Boots
        "7234567890170": {
          "7234567890171": 0.48, // Wool Socks
          "7234567890172": 0.34, // Boot Spray
          "7234567890173": 0.27, // Insoles
          "7234567890174": 0.19, // Foot Warmers
        }
      },
      
      // Complement confidence scores by product category
      complementCategories: {
        "footwear": {
          "socks": 0.75,
          "insoles": 0.65,
          "shoe_care": 0.55,
          "accessories": 0.45
        },
        "electronics": {
          "cases_bags": 0.80,
          "cables_adapters": 0.70,
          "accessories": 0.60,
          "peripherals": 0.55
        },
        "apparel": {
          "accessories": 0.70,
          "undergarments": 0.60,
          "outerwear": 0.50,
          "jewelry": 0.40
        }
      },
      
      // Seasonal trending boosts
      seasonalBoosts: {
        "summer": ["beach", "vacation", "outdoor", "sun protection"],
        "winter": ["warm", "cozy", "holiday", "indoor"],
        "spring": ["fresh", "renewal", "exercise", "outdoor"],
        "fall": ["back to school", "cozy", "preparation", "indoor"]
      },
      
      // Price intelligence data
      priceIntelligence: {
        "averageOrderValue": 8500, // $85
        "recommendationPriceRanges": {
          "budget": { min: 500, max: 2000 },    // $5-$20
          "mid": { min: 2000, max: 6000 },      // $20-$60  
          "premium": { min: 6000, max: 15000 }  // $60-$150
        }
      },
      
      metadata: {
        lastUpdated: new Date().toISOString(),
        dataPoints: 12547,
        confidenceLevel: 87,
        shop: shop
      }
    };

    return json(purchasePatterns, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=3600" // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error("Error fetching purchase patterns:", error);
    
    // Return minimal fallback data
    return json({
      frequentPairs: {},
      complementCategories: {},
      seasonalBoosts: {},
      priceIntelligence: {
        averageOrderValue: 5000,
        recommendationPriceRanges: {
          budget: { min: 500, max: 2000 },
          mid: { min: 2000, max: 6000 },
          premium: { min: 6000, max: 15000 }
        }
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        dataPoints: 0,
        confidenceLevel: 0,
        shop: "unknown",
        error: "Failed to load purchase patterns"
      }
    }, {
      status: 200, // Still return 200 so the frontend gets fallback data
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
};

// Handle OPTIONS requests for CORS
export const action = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
};
