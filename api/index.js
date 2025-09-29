import { createRequestHandler } from "@remix-run/vercel";

let handler;

export default async function (request, response) {
  if (!handler) {
    // Lazy load the build on first request
    try {
      const build = await import("../build/server/index.js");
      handler = createRequestHandler({ 
        build, 
        mode: process.env.NODE_ENV || "production" 
      });
    } catch (error) {
      console.error("Failed to load Remix build:", error);
      return response.status(500).json({ 
        error: "Server configuration error",
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  return handler(request, response);
}
