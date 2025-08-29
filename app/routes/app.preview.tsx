import { useState, useEffect } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// Type declarations for window objects
declare global {
  interface Window {
    mockCartData: any;
    mockRecommendations: any;
    CartUpliftSettings: any;
    CartUpliftDrawer: any;
    cartUpliftDrawer: any;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // In production, load settings from database
  const settings = {
    cartPosition: "bottom-right",
    backgroundColor: "#ffffff",
    textColor: "#1A1A1A",
    buttonColor: "#000000",
    freeShippingThreshold: 100,
    enableFreeShipping: true,
    freeShippingText: "You're {amount} away from free shipping!",
    recommendationLayout: "horizontal",
    enableRecommendations: true,
  };

  return json({ 
    settings,
    shop: session.shop,
  });
};

export default function LivePreviewPage() {
  const { settings, shop } = useLoaderData<typeof loader>();
  const [isDrawerLoaded, setIsDrawerLoaded] = useState(false);

  useEffect(() => {
    // Load the actual cart drawer scripts and styles
    const loadCartDrawer = () => {
      // Load CSS
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = `https://${shop}/apps/cart-uplift/assets/cart-uplift.css`;
      document.head.appendChild(cssLink);

      // Load JS
      const script = document.createElement('script');
      script.src = `https://${shop}/apps/cart-uplift/assets/cart-uplift.js`;
      script.onload = () => {
        // Mock cart data for preview
        window.mockCartData = {
          items: [
            {
              id: 1,
              product_id: 123,
              variant_id: 456,
              product_title: "Wireless Headphones",
              variant_title: "Black / Medium",
              quantity: 1,
              final_price: 2999,
              image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-6_large.png",
              url: "/products/wireless-headphones",
              options_with_values: [
                { name: "Color", value: "Black" },
                { name: "Size", value: "Medium" }
              ]
            },
            {
              id: 2,
              product_id: 124,
              variant_id: 457,
              product_title: "Phone Case",
              variant_title: "Clear",
              quantity: 1,
              final_price: 1599,
              image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-5_large.png",
              url: "/products/phone-case",
              options_with_values: [
                { name: "Style", value: "Clear" }
              ]
            }
          ],
          item_count: 2,
          total_price: 4598
        };

        // Mock recommendations
        window.mockRecommendations = [
          {
            id: 789,
            title: "Bluetooth Speaker",
            price: 4999,
            image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png",
            variant_id: 101,
            url: "/products/bluetooth-speaker",
            variants: [{ id: 101, title: "Default", price: 4999, available: true }],
            options: []
          },
          {
            id: 790,
            title: "Wireless Charger",
            price: 2499,
            image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png",
            variant_id: 102,
            url: "/products/wireless-charger",
            variants: [{ id: 102, title: "White", price: 2499, available: true }],
            options: []
          },
          {
            id: 791,
            title: "USB Cable",
            price: 1299,
            image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-3_large.png",
            variant_id: 103,
            url: "/products/usb-cable",
            variants: [{ id: 103, title: "3ft", price: 1299, available: true }],
            options: []
          }
        ];

        // Override fetch for preview mode
        const originalFetch = window.fetch;
        window.fetch = async function(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
          const urlStr = typeof url === 'string' ? url : url.toString();
          
          if (urlStr.includes('/cart.js')) {
            return {
              ok: true,
              json: () => Promise.resolve(window.mockCartData),
              headers: new Headers(),
              redirected: false,
              status: 200,
              statusText: 'OK',
              type: 'basic' as ResponseType,
              url: urlStr,
              clone: () => ({} as Response),
              body: null,
              bodyUsed: false,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
              blob: () => Promise.resolve(new Blob()),
              formData: () => Promise.resolve(new FormData()),
              text: () => Promise.resolve(''),
            } as Response;
          }
          
          if (urlStr.includes('/recommendations/products.json') || urlStr.includes('/products.json')) {
            return {
              ok: true,
              json: () => Promise.resolve({ products: window.mockRecommendations }),
              headers: new Headers(),
              redirected: false,
              status: 200,
              statusText: 'OK',
              type: 'basic' as ResponseType,
              url: urlStr,
              clone: () => ({} as Response),
              body: null,
              bodyUsed: false,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
              blob: () => Promise.resolve(new Blob()),
              formData: () => Promise.resolve(new FormData()),
              text: () => Promise.resolve(''),
            } as Response;
          }
          
          return originalFetch.call(this, url, options);
        };

        // Set up cart settings with current theme settings
        window.CartUpliftSettings = {
          enableApp: true,
          enableRecommendations: settings.enableRecommendations,
          recommendationLayout: settings.recommendationLayout === 'horizontal' ? 'row' : 'column',
          maxRecommendations: 4,
          recommendationsTitle: "You might also like",
          enableFreeShipping: settings.enableFreeShipping,
          freeShippingThreshold: settings.freeShippingThreshold,
          freeShippingText: settings.freeShippingText,
          buttonColor: settings.buttonColor,
          backgroundColor: settings.backgroundColor,
          textColor: settings.textColor,
          autoOpenCart: false,
          enableStickyCart: false // Disable sticky cart for preview
        };

        // Initialize cart drawer
        if (window.CartUpliftDrawer) {
          window.cartUpliftDrawer = new window.CartUpliftDrawer(window.CartUpliftSettings);
          setIsDrawerLoaded(true);
        }
      };
      document.head.appendChild(script);
    };

    // Load after component mounts
    if (!isDrawerLoaded) {
      loadCartDrawer();
    }
  }, [shop, settings, isDrawerLoaded]);

  const openCartDrawer = () => {
    if (window.cartUpliftDrawer) {
      window.cartUpliftDrawer.openDrawer();
    }
  };

  return (
    <Page>
      <TitleBar title="Live Cart Preview" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">🛒 Live Cart Drawer Preview</Text>
                <Text variant="bodyMd" as="p">
                  This preview shows your actual cart drawer exactly as customers will see it on your storefront,
                  using your current theme settings and the real cart uplift extension.
                </Text>
                
                <InlineStack gap="300">
                  <Button 
                    onClick={openCartDrawer}
                    variant="primary"
                    size="large"
                    disabled={!isDrawerLoaded}
                  >
                    {isDrawerLoaded ? '🛒 Open Cart Drawer' : 'Loading Cart...'}
                  </Button>
                  {isDrawerLoaded && (
                    <Badge tone="success">Cart Drawer Ready</Badge>
                  )}
                </InlineStack>

                <Text variant="bodyMd" as="p" tone="subdued">
                  <strong>Settings Applied:</strong> Free shipping at ${settings.freeShippingThreshold}, 
                  {settings.enableRecommendations ? ` ${settings.recommendationLayout} recommendations,` : ' no recommendations,'} 
                  {settings.buttonColor} accent color
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">🎛️ Test Your Settings Live</Text>
                <Text variant="bodyMd" as="p">
                  Make changes to your settings and refresh this page to see the updates immediately:
                </Text>
                
                <InlineStack gap="300">
                  <Button url="/app/settings" variant="primary">
                    ⚙️ Modify Settings
                  </Button>
                  <Button 
                    url={`https://${shop}/admin/themes/current/editor`}
                    external
                  >
                    🎨 Theme Editor
                  </Button>
                  <Button 
                    url={`https://${shop}/`}
                    external
                  >
                    🏪 View Storefront
                  </Button>
                </InlineStack>

                <Divider />

                <Text variant="bodyMd" as="p">
                  <strong>Preview includes:</strong> Mock cart with 2 items ($45.98 total), 
                  3 recommendation products, and live free shipping progress bar.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">📋 Current Configuration</Text>
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    • <strong>Position:</strong> {settings.cartPosition}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • <strong>Free shipping threshold:</strong> ${settings.freeShippingThreshold}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • <strong>Recommendations:</strong> {settings.enableRecommendations ? `${settings.recommendationLayout} layout` : 'Disabled'}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • <strong>Colors:</strong> {settings.buttonColor} accent
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">🚀 Quick Actions</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Test your cart drawer in different environments:
                </Text>
                <BlockStack gap="200">
                  <Button 
                    variant="primary" 
                    size="large" 
                    url={`https://${shop}`} 
                    external
                  >
                    Visit Storefront
                  </Button>
                  <Button 
                    url={`https://${shop}/admin/themes/current/editor`}
                    external
                  >
                    Open Theme Editor
                  </Button>
                  <Button 
                    onClick={() => window.location.reload()}
                  >
                    Refresh Preview
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
