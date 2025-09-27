import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  // If no shop is provided, show an error page
  if (!shop) {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Required</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Shop Parameter Missing</h1>
          <p>Please access this app through your Shopify admin.</p>
          <script>
            // If we're in an iframe, try to break out and redirect parent
            if (window.top !== window.self) {
              window.top.location.href = 'https://admin.shopify.com';
            }
          </script>
        </body>
      </html>
    `, {
      status: 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN"
      }
    });
  }

  // Redirect to Shopify OAuth with proper parameters
  const authUrl = new URL("/admin/oauth/authorize", `https://${shop}`);
  authUrl.searchParams.set("client_id", process.env.SHOPIFY_API_KEY || "");
  authUrl.searchParams.set("scope", process.env.SCOPES || "");
  authUrl.searchParams.set("redirect_uri", `${process.env.SHOPIFY_APP_URL}/auth/callback`);
  authUrl.searchParams.set("state", "auth-redirect");

  return redirect(authUrl.toString());
};