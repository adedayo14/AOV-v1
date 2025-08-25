import { json, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle /apps/proxy/api/settings
  if (path.includes('/api/settings')) {
    try {
      // Default backend settings (these are the "General Settings" from your management page)
      const settings = {
        // Core functionality
        enableApp: true,
        enableStickyCart: true,
        showOnlyOnCartPage: false,
        
        // Cart appearance
        cartPosition: "bottom-right",
        cartIcon: "cart",
        backgroundColor: "#ffffff",
        
        // Messages
        freeShippingText: "You're {amount} away from free shipping!",
        freeShippingAchievedText: "🎉 Congratulations! You've unlocked free shipping!",
        
        // Features
        enableRecommendations: true,
        recommendationLayout: "column",
        maxRecommendations: 4,
        enableAddons: false,
        enableDiscountCode: false,
        enableNotes: false,
        enableExpressCheckout: true,
        
        // Advanced
        drawerWidth: 480,
        borderRadius: 8,
        showBrandBadge: true,
        enableQuantitySelectors: true,
        enableItemRemoval: true,
        enableAnalytics: false
      };

      return json(settings, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    } catch (error) {
      console.error("Settings API error:", error);
      return json({ error: "Failed to load settings" }, { status: 500 });
    }
  }

  // Default response for other proxy requests
  return json({ message: "Cart Uplift App Proxy" });
}

export async function action({ request }: LoaderFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const settings = await request.json();
    
    // Here you would save the settings to your database
    // For now, we'll just return success
    console.log("Saving settings:", settings);
    
    return json({ success: true, settings });
  } catch (error) {
    console.error("Save settings error:", error);
    return json({ error: "Failed to save settings" }, { status: 500 });
  }
}
