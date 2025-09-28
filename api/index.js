// Remix Vercel handler for production deployment
import { createRequestHandler } from "@remix-run/vercel";

// Import the server build
let build;
try {
  build = await import("../build/server/index.js");
} catch (error) {
  console.error("Failed to import server build:", error);
  throw new Error("Server build not found. Make sure to run 'npm run build' first.");
}

export default createRequestHandler({ 
  build, 
  mode: process.env.NODE_ENV || "production"
});
