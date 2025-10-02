import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { IframeBreaker } from "./components/IframeBreaker";
import { useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { useEffect, useState } from "react";

export default function App() {
  // Hard-code the API key to avoid hydration mismatch
  const apiKey = "06d17c445a3713f419add1e31894bcc3";
  
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="shopify-api-key" content={apiKey} />
        <meta name="no-browser-extensions" content="true" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        {/* Removed custom iframe script to avoid interfering with Shopify embedding */}
        <Meta />
        <Links />
      </head>
      <body>
        <IframeBreaker />
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const [errorId] = useState(() => Math.random().toString(36).substr(2, 9));
  
  // Log to monitoring service
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Log to Sentry if available
      if ((window as any).Sentry) {
        (window as any).Sentry.captureException(error);
      }
      
      // Also log to console for debugging
      console.error('App Error:', {
        errorId,
        error,
        timestamp: new Date().toISOString()
      });
    }
  }, [error, errorId]);

  // Check if it's a known error type
  if (isRouteErrorResponse(error)) {
    return (
      <html>
        <head>
          <title>{error.status} {error.statusText}</title>
          <Meta />
          <Links />
        </head>
        <body>
          <div className="error-page">
            <h1 className="error-status">{error.status}</h1>
            <p className="error-message">{error.statusText}</p>
            {error.data?.message && (
              <p className="error-details">{error.data.message}</p>
            )}
            <p className="error-id">Error ID: {errorId}</p>
          </div>
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <html>
      <head>
        <title>Something went wrong | Cart Uplift</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="error-page">
          <h1 className="error-title">Oops! Something went wrong</h1>
          <p className="error-description">
            We're working on fixing this issue. Please try refreshing the page.
          </p>
          {error instanceof Error && (
            <details className="error-details-dev">
              <summary className="error-summary">Error Details</summary>
              <pre className="error-stack">
                {error.stack || error.message}
              </pre>
            </details>
          )}
          <p className="error-id">Error ID: {errorId}</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
