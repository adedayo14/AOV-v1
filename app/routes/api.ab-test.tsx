import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// Simple test API route to diagnose the issue
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("=== API ROUTE HIT ===");
  console.log("Method:", request.method);
  console.log("URL:", request.url);
  
  return json({
    success: true,
    message: "API route is working!",
    timestamp: new Date().toISOString(),
    method: request.method
  });
};

// Also support GET for testing
export const loader = async () => {
  return json({
    success: true,
    message: "API route GET is working!",
    timestamp: new Date().toISOString()
  });
};
