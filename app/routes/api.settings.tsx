import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getSettings, saveSettings, getDefaultSettings } from "../models/settings.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('🔧 API Settings called:', request.url);
    
    // Get shop from request (you might need to extract this from headers or params)
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop') || 'test-lab-101.myshopify.com'; // Use default for testing
    
    console.log('🔧 Loading settings for shop:', shop);
    
  const settings = await getSettings(shop);
    // Normalize layout for theme (row/column expected in CSS/JS)
  const layoutMap: Record<string, string> = { horizontal: 'row', vertical: 'column', grid: 'grid' };
    const normalized = {
      source: 'db',
      ...settings,
    // Ensure storefront has a caps flag for grid/header even if prod mirrors the global toggle
    enableRecommendationTitleCaps: (settings as any).enableRecommendationTitleCaps ?? (settings as any).enableTitleCaps ?? false,
      recommendationLayout: layoutMap[settings.recommendationLayout] || settings.recommendationLayout,
    };
    
    console.log('🔧 Settings loaded:', settings);

  return json(normalized, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Settings API error:", error);
    // Fail open: serve defaults so preview and storefront keep working
    const defaults = getDefaultSettings();
  const layoutMap: Record<string, string> = { horizontal: 'row', vertical: 'column', grid: 'grid' };
    const normalized = {
      source: 'defaults',
      ...defaults,
      recommendationLayout: layoutMap[defaults.recommendationLayout] || defaults.recommendationLayout,
    };
    return json(normalized, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }
}

export async function action({ request }: LoaderFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop') || 'default';
    
    const contentType = request.headers.get('content-type');
    let settings;
    
    if (contentType?.includes('application/json')) {
      settings = await request.json();
    } else {
      // Handle form data (URL-encoded)
      const formData = await request.formData();
      settings = Object.fromEntries(formData);
    }
    
    const savedSettings = await saveSettings(shop, settings);
    
    return json({ success: true, settings: savedSettings });
  } catch (error) {
    console.error("Save settings error:", error);
    return json({ error: "Failed to save settings" }, { status: 500 });
  }
}
