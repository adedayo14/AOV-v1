import { useState } from "react";
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
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

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

  return json({ settings });
};

export default function LivePreviewPage() {
  const { settings } = useLoaderData<typeof loader>();
  const [cartTotal, setCartTotal] = useState(45.99);

  const remainingForShipping = Math.max(0, settings.freeShippingThreshold - cartTotal);
  const hasReachedFreeShipping = remainingForShipping === 0;

  const mockCartItems = [
    { id: 1, title: "Wireless Headphones", price: 29.99, quantity: 1, image: "/placeholder-product.jpg" },
    { id: 2, title: "Phone Case", price: 15.99, quantity: 1, image: "/placeholder-product.jpg" },
  ];

  const mockRecommendations = [
    { id: 3, title: "Bluetooth Speaker", price: 49.99, image: "/placeholder-product.jpg" },
    { id: 4, title: "Wireless Charger", price: 24.99, image: "/placeholder-product.jpg" },
    { id: 5, title: "USB Cable", price: 12.99, image: "/placeholder-product.jpg" },
  ];

  return (
    <Page>
      <TitleBar title="Live Cart Preview" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Live Cart Preview</Text>
                <Text variant="bodyMd" as="p">
                  Use the preview below to see how your cart drawer will look and behave with your current settings.
                </Text>
                
                <InlineStack gap="300">
                  <Button 
                    onClick={() => setCartTotal(25.99)} 
                    variant={cartTotal < 50 ? "primary" : "secondary"}
                  >
                    Set Low Cart ($25.99)
                  </Button>
                  <Button 
                    onClick={() => setCartTotal(75.50)} 
                    variant={cartTotal >= 50 && cartTotal < 100 ? "primary" : "secondary"}
                  >
                    Set Medium Cart ($75.50)
                  </Button>
                  <Button 
                    onClick={() => setCartTotal(125.00)} 
                    variant={cartTotal >= 100 ? "primary" : "secondary"}
                  >
                    Set High Cart ($125.00)
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" align="space-between">
                  <Text variant="headingMd" as="h3">Cart Preview</Text>
                  <Badge tone={cartTotal >= 100 ? "success" : "attention"}>
                    Settings: {settings.cartPosition}, {settings.recommendationLayout}
                  </Badge>
                </InlineStack>
                
                {/* Mock Cart Drawer */}
                <Box
                  background="bg-surface-secondary"
                  padding="400"
                  borderRadius="200"
                  borderWidth="025"
                  borderColor="border"
                >
                  <div 
                    style={{ 
                      backgroundColor: settings.backgroundColor,
                      color: settings.textColor,
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #e1e3e5',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
                    }}
                  >
                    {/* Cart Header */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                        🛒 Cart ({mockCartItems.length}) • ${cartTotal.toFixed(2)}
                      </h3>
                      <button style={{ 
                        background: 'none', 
                        border: 'none', 
                        fontSize: '20px', 
                        cursor: 'pointer',
                        color: settings.textColor
                      }}>×</button>
                    </div>

                    {/* Free Shipping Progress */}
                    {settings.enableFreeShipping && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ 
                          fontSize: '14px', 
                          marginBottom: '8px',
                          color: hasReachedFreeShipping ? '#008060' : settings.textColor
                        }}>
                          {hasReachedFreeShipping 
                            ? "🎉 Congratulations! You've unlocked free shipping!"
                            : settings.freeShippingText.replace('{amount}', `$${remainingForShipping.toFixed(2)}`)
                          }
                        </div>
                        <div style={{ 
                          backgroundColor: '#f0f0f0', 
                          height: '8px', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            backgroundColor: settings.buttonColor,
                            height: '100%',
                            width: `${Math.min(100, (cartTotal / settings.freeShippingThreshold) * 100)}%`,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Cart Items */}
                    <div style={{ marginBottom: '16px' }}>
                      {mockCartItems.map((item) => (
                        <div key={item.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '40px', 
                              height: '40px', 
                              backgroundColor: '#f8f8f8',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              color: '#999'
                            }}>IMG</div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: '500' }}>{item.title}</div>
                              <div style={{ fontSize: '12px', color: '#666' }}>Qty: {item.quantity}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600' }}>${item.price}</div>
                        </div>
                      ))}
                    </div>

                    {/* Recommendations */}
                    {settings.enableRecommendations && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: '600', 
                          marginBottom: '12px' 
                        }}>
                          You might also like
                        </div>
                        <div style={{ 
                          display: settings.recommendationLayout === 'horizontal' ? 'flex' : 'block',
                          gap: settings.recommendationLayout === 'horizontal' ? '12px' : '8px',
                          overflowX: settings.recommendationLayout === 'horizontal' ? 'auto' : 'visible'
                        }}>
                          {mockRecommendations.slice(0, 3).map((product) => (
                            <div key={product.id} style={{ 
                              flex: settings.recommendationLayout === 'horizontal' ? '0 0 120px' : 'none',
                              border: '1px solid #e1e3e5',
                              borderRadius: '6px',
                              padding: '8px',
                              textAlign: 'center',
                              marginBottom: settings.recommendationLayout === 'vertical' ? '8px' : '0'
                            }}>
                              <div style={{ 
                                width: '100%', 
                                height: '60px', 
                                backgroundColor: '#f8f8f8',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                color: '#999',
                                marginBottom: '6px'
                              }}>IMG</div>
                              <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                                {product.title}
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: settings.buttonColor }}>
                                ${product.price}
                              </div>
                              <button style={{
                                backgroundColor: settings.buttonColor,
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                marginTop: '6px',
                                cursor: 'pointer',
                                width: '100%'
                              }}>
                                Add
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checkout Button */}
                    <button style={{
                      backgroundColor: settings.buttonColor,
                      color: 'white',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '6px',
                      fontSize: '16px',
                      fontWeight: '600',
                      width: '100%',
                      cursor: 'pointer'
                    }}>
                      Checkout • ${cartTotal.toFixed(2)}
                    </button>
                  </div>
                </Box>

                <Text variant="bodyMd" as="p" tone="subdued">
                  <strong>Position:</strong> {settings.cartPosition} | <strong>Free shipping at:</strong> ${settings.freeShippingThreshold}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  <strong>Colors:</strong> {settings.backgroundColor} background, {settings.textColor} text, {settings.buttonColor} accent
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">Quick Test Actions</Text>
                <Text variant="bodyMd" as="p">
                  Make sure the app embed is enabled in your theme editor first.
                </Text>
                <Button variant="primary" size="large" url="https://test-lab-101.myshopify.com" external>
                  Visit Storefront
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">Configuration</Text>
                <Text variant="bodyMd" as="p">
                  Current cart settings:
                </Text>
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    • <strong>Position:</strong> {settings.cartPosition}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • <strong>Free shipping:</strong> ${settings.freeShippingThreshold}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • <strong>Recommendations:</strong> {settings.recommendationLayout} layout
                  </Text>
                </BlockStack>
                <Button url="/app/settings">
                  Modify Settings
                </Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
