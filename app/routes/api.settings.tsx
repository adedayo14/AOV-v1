import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getSettings, saveSettings, getDefaultSettings } from "../models/settings.server";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
  console.log('🔧 API Settings (admin) called:', request.url);
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
    
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
  console.log("=".repeat(80));
  console.log("[API SETTINGS ACTION] Called at:", new Date().toISOString());
  console.log("[API SETTINGS ACTION] Method:", request.method);
  console.log("[API SETTINGS ACTION] URL:", request.url);
  console.log("[API SETTINGS ACTION] Headers:", Object.fromEntries(request.headers.entries()));
  console.log("=".repeat(80));

  if (request.method !== "POST") {
    console.log("[API SETTINGS ACTION] ❌ Method not allowed");
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    console.log("[API SETTINGS ACTION] Attempting authentication...");
    const { session } = await authenticate.admin(request);
    console.log("[API SETTINGS ACTION] ✅ Authentication successful!");
    const shop = session.shop;
    console.log("[API SETTINGS ACTION] Shop:", shop);
    
    console.log("[API SETTINGS ACTION] Shop:", shop);
    
    const contentType = request.headers.get('content-type');
    console.log("[API SETTINGS ACTION] Content-Type:", contentType);
    let settings;
    
    if (contentType?.includes('application/json')) {
      console.log("[API SETTINGS ACTION] Parsing as JSON...");
      settings = await request.json();
    } else {
      console.log("[API SETTINGS ACTION] Parsing as form data...");
      // Handle form data (URL-encoded)
      const formData = await request.formData();
      settings = Object.fromEntries(formData);
    }
    
    console.log("[API SETTINGS ACTION] Settings count:", Object.keys(settings).length);
    console.log("[API SETTINGS ACTION] Saving to database...");
  const savedSettings = await saveSettings(shop, settings as any);
    console.log("[API SETTINGS ACTION] ✅ Successfully saved!");
    
    return json({ success: true, settings: savedSettings });
  } catch (error) {
    console.error("[API SETTINGS ACTION] ❌ Error:", error);
    console.error("[API SETTINGS ACTION] Error stack:", (error as Error).stack);
    return json({ error: "Failed to save settings", details: (error as Error).message }, { status: 500 });
  }
}
