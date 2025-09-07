import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Basic health check
    return json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: {
        hasApiKey: !!process.env.SHOPIFY_API_KEY,
        hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasSessionSecret: !!process.env.SESSION_SECRET,
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    return json({ 
      status: "error", 
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
