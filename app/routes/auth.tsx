import type { LoaderFunctionArgs } from "@remix-run/node";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  let shop = url.searchParams.get("shop");
  
  // Try to extract shop from host parameter (used in embedded apps)
  if (!shop) {
    const host = url.searchParams.get("host");
    if (host) {
      try {
        // Decode the host parameter to get the shop domain
        const decodedHost = Buffer.from(host, 'base64').toString('utf-8');
        const shopFromHost = decodedHost.split('/')[0];
        if (shopFromHost && shopFromHost.includes('.myshopify.com')) {
          shop = shopFromHost;
          // Add shop to the request URL so login can use it
          url.searchParams.set("shop", shop);
        }
      } catch (error) {
        console.error('Failed to decode host parameter:', error);
      }
    }
  }
  
  // Check if this is an embedded app request
  const embedded = url.searchParams.get("embedded");
  const id_token = url.searchParams.get("id_token");
  
  // If we have embedded=1 or id_token, use the new embedded auth flow
  if (embedded === "1" || id_token) {
    // Let Shopify's login handle the embedded authentication
    return await login(request);
  }
  
  // If we have a shop parameter, proceed with login
  if (shop) {
    return await login(request);
  }
  
  // No shop parameter at all - show error page
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cart Uplift - Access Required</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
          }
          h1 { 
            color: #2c3e50; 
            margin-bottom: 20px;
            font-size: 28px;
          }
          p { 
            color: #7f8c8d; 
            line-height: 1.6;
            margin: 15px 0;
          }
          .btn {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            transition: background 0.3s;
          }
          .btn:hover { 
            background: #764ba2; 
          }
          .code {
            background: #f5f5f5;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Cart Uplift</h1>
          <p>Please access this app through your Shopify admin dashboard.</p>
          <p style="font-size: 14px;">Looking for <span class="code">?shop=</span> or <span class="code">?host=</span> parameter</p>
          <a href="https://admin.shopify.com" class="btn">Go to Shopify Admin</a>
        </div>
      </body>
    </html>
  `, {
    status: 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    }
  });
};