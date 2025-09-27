import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { IframeBreaker } from "./components/IframeBreaker";

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY || ""} />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Immediate iframe escape - runs before any other scripts
              (function() {
                console.log('CartUplift: Checking iframe context...');
                
                if (typeof window !== 'undefined' && window.top !== window.self) {
                  try {
                    // Try to access parent location - will throw if X-Frame-Options blocks
                    var parentUrl = window.top.location.href;
                    console.log('CartUplift: Valid iframe context detected');
                  } catch (e) {
                    console.warn('CartUplift: X-Frame-Options blocking detected - escaping iframe immediately');
                    
                    // Strategy 1: Immediate location replacement
                    try {
                      window.top.location.replace(window.location.href);
                    } catch (e2) {
                      // Strategy 2: Parent postMessage
                      try {
                        window.parent.postMessage({
                          message: 'CARTUPLIFT_IFRAME_ESCAPE',
                          url: window.location.href
                        }, '*');
                      } catch (e3) {}
                      
                      // Strategy 3: Self redirect
                      window.location.replace(window.location.href);
                    }
                    
                    // Strategy 4: Meta refresh as backup
                    var meta = document.createElement('meta');
                    meta.httpEquiv = 'refresh';
                    meta.content = '0; url=' + window.location.href;
                    document.head.appendChild(meta);
                    
                    // Strategy 5: Stop all script execution
                    throw new Error('CartUplift: Iframe escape initiated');
                  }
                } else {
                  console.log('CartUplift: Direct access detected - no iframe escape needed');
                }
                
                // Override sendBeacon immediately to prevent errors
                if (window.navigator && window.navigator.sendBeacon) {
                  var originalSendBeacon = window.navigator.sendBeacon.bind(window.navigator);
                  window.navigator.sendBeacon = function(url, data) {
                    try {
                      return originalSendBeacon(url, data);
                    } catch (error) {
                      console.warn('CartUplift: SendBeacon blocked:', error);
                      return false;
                    }
                  };
                }
              })();
            `
          }}
        />
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
