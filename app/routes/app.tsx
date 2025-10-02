import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";
import { SessionStatus } from "../components/SessionStatus";
import { AppBridgeInitializer } from "../components/AppBridgeInitializer";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Use the client_id from shopify.app.toml as fallback
  const apiKey = process.env.SHOPIFY_API_KEY || "06d17c445a3713f419add1e31894bcc3";
  
  return { apiKey };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey || "06d17c445a3713f419add1e31894bcc3"}>
      <AppBridgeInitializer apiKey={apiKey} />
      <SessionStatus />
      <NavMenu>
        <a href="/app" rel="home">
          Home
        </a>
        <a href="/app/dashboard">📊 Analytics & Performance</a>
        <a href="/app/ab-testing">🧪 A/B Testing</a>
        <a href="/app/settings">⚙️ Settings</a>
        <a href="/app/manage">🎛️ Manage Products & Bundles</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  
  // Handle session-related errors more gracefully
  if (error && typeof error === 'object' && 'status' in error) {
    const responseError = error as { status: number; statusText?: string };
    
    if (responseError.status === 401) {
      // For embedded apps, use App Bridge for re-authentication
      if (typeof window !== 'undefined') {
        if (window.top !== window.self) {
          // In iframe - use App Bridge reauth
          window.parent.postMessage({ 
            message: 'Shopify.API.reauthorizeApplication' 
          }, '*');
        } else {
          // Not in iframe - redirect to auth
          window.location.href = '/auth';
        }
      }
      
      return (
                <div>
          <h2>Cart Uplift App</h2>
          <p>Unable to load embedded app. You can access the dashboard directly:</p>
          <a href="/admin" target="_top">Open Dashboard</a>
        </div>
      );
    }
  }

  return boundary.error(error);
};

export const headers: HeadersFunction = (headersArgs) => {
  const headers = boundary.headers(headersArgs);
  
  // Allow embedding in Shopify admin
  headers.set("X-Frame-Options", "ALLOW-FROM https://admin.shopify.com");
  headers.set("Content-Security-Policy", "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com");
  
  return headers;
};
