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
              (function() {
                if (typeof window !== 'undefined' && window.top !== window.self) {
                  try {
                    var parentUrl = window.top.location.href;
                  } catch (e) {
                    console.warn('X-Frame-Options blocking detected - escaping iframe');
                    var meta = document.createElement('meta');
                    meta.httpEquiv = 'refresh';
                    meta.content = '0; url=' + window.location.href;
                    document.head.appendChild(meta);
                    setTimeout(function() {
                      try {
                        window.top.location.href = window.location.href;
                      } catch (e2) {
                        window.location.replace(window.location.href);
                      }
                    }, 50);
                  }
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
