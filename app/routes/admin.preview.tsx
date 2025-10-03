import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Box,
  Select,
  TextField,
  Checkbox,
  Grid
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getSettings } from "../models/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Get current settings for preview
  const settings = await getSettings(session.shop);
  
  return json({
    settings
  });
};

export default function PreviewCart() {
  const { settings } = useLoaderData<typeof loader>();
  const [previewMode, setPreviewMode] = useState("desktop");
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [showFreeShipping, setShowFreeShipping] = useState(true);

  // Mock cart data for preview
  const mockCartItems = [
    {
      id: "1",
      title: "Wireless Bluetooth Headphones",
      price: 79.99,
      quantity: 1,
      image: "https://via.placeholder.com/100x100"
    },
    {
      id: "2", 
      title: "Phone Case - Clear",
      price: 24.99,
      quantity: 1,
      image: "https://via.placeholder.com/100x100"
    }
  ];

  const mockRecommendations = [
    {
      id: "rec-1",
      title: "Wireless Charger",
      price: 34.99,
      image: "https://via.placeholder.com/80x80"
    },
    {
      id: "rec-2",
      title: "Screen Protector", 
      price: 19.99,
      image: "https://via.placeholder.com/80x80"
    },
    {
      id: "rec-3",
      title: "Car Mount",
      price: 29.99,
      image: "https://via.placeholder.com/80x80"
    }
  ];

  const cartTotal = mockCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const freeShippingThreshold = settings?.freeShippingThreshold || 100;
  const freeShippingProgress = Math.min((cartTotal / freeShippingThreshold) * 100, 100);
  const amountToFreeShipping = Math.max(freeShippingThreshold - cartTotal, 0);

  const cartStyles = {
    width: previewMode === "mobile" ? "375px" : "400px",
    maxHeight: "600px",
    backgroundColor: "#ffffff",
    border: "1px solid #e1e3e5",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  };

  return (
    <Page>
      <TitleBar title="👁️ Cart Preview" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Preview Controls */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h1">Live Cart Preview</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  See exactly how your cart drawer appears to customers with current settings
                </Text>
                
                <InlineStack gap="400">
                  <Select
                    label="Preview Mode"
                    options={[
                      {label: 'Desktop View', value: 'desktop'},
                      {label: 'Mobile View', value: 'mobile'},
                    ]}
                    value={previewMode}
                    onChange={setPreviewMode}
                  />
                  <Checkbox
                    label="Show Recommendations"
                    checked={showRecommendations}
                    onChange={setShowRecommendations}
                  />
                  <Checkbox
                    label="Show Free Shipping Bar"
                    checked={showFreeShipping}
                    onChange={setShowFreeShipping}
                  />
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Live Preview */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Cart Drawer Preview</Text>
                
                <Box paddingInline="800" paddingBlock="600" background="bg-surface-secondary">
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
                    <div style={cartStyles}>
                      {/* Cart Header */}
                      <div style={{ 
                        padding: "20px", 
                        borderBottom: "1px solid #e1e3e5",
                        backgroundColor: settings?.backgroundColor || "#000000",
                        color: settings?.textColor || "#ffffff",
                        borderRadius: "8px 8px 0 0"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                            {"Your Cart"}
                          </h3>
                          <span style={{ fontSize: "14px", opacity: 0.8 }}>
                            ({mockCartItems.length} {mockCartItems.length === 1 ? 'item' : 'items'})
                          </span>
                        </div>
                      </div>

                      {/* Free Shipping Progress */}
                      {showFreeShipping && settings?.enableFreeShipping && (
                        <div style={{ padding: "16px 20px", backgroundColor: "#f8f9fa", borderBottom: "1px solid #e1e3e5" }}>
                          <div style={{ marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                            {freeShippingProgress >= 100 
                              ? "🎉 You qualify for FREE shipping!"
                              : `Add $${amountToFreeShipping.toFixed(2)} more for FREE shipping`
                            }
                          </div>
                          <div style={{ 
                            width: "100%", 
                            height: "8px", 
                            backgroundColor: "#e1e3e5", 
                            borderRadius: "4px",
                            overflow: "hidden"
                          }}>
                            <div style={{
                              width: `${freeShippingProgress}%`,
                              height: "100%",
                              backgroundColor: settings?.shippingBarColor || "#00a047",
                              borderRadius: "4px",
                              transition: "width 0.3s ease"
                            }} />
                          </div>
                        </div>
                      )}

                      {/* Cart Items */}
                      <div style={{ padding: "20px", maxHeight: "200px", overflowY: "auto" }}>
                        {mockCartItems.map((item) => (
                          <div key={item.id} style={{ 
                            display: "flex", 
                            gap: "12px", 
                            marginBottom: "16px",
                            paddingBottom: "16px",
                            borderBottom: "1px solid #f0f0f0"
                          }}>
                            <img 
                              src={item.image} 
                              alt={item.title}
                              style={{ width: "60px", height: "60px", borderRadius: "4px" }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "14px", fontWeight: "500", marginBottom: "4px" }}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                                Qty: {item.quantity}
                              </div>
                              <div style={{ fontSize: "14px", fontWeight: "600" }}>
                                ${item.price.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Recommendations */}
                      {showRecommendations && (
                        <div style={{ 
                          padding: "16px 20px", 
                          backgroundColor: "#f8f9fa",
                          borderTop: "1px solid #e1e3e5" 
                        }}>
                          <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px" }}>
                            ✨ {settings?.recommendationsTitle || "Complete your purchase"}
                          </div>
                          <div style={{ display: "flex", gap: "12px", overflowX: "auto" }}>
                            {mockRecommendations.map((rec) => (
                              <div key={rec.id} style={{ 
                                minWidth: "120px",
                                textAlign: "center",
                                backgroundColor: "#ffffff",
                                padding: "12px",
                                borderRadius: "6px",
                                border: "1px solid #e1e3e5"
                              }}>
                                <img 
                                  src={rec.image} 
                                  alt={rec.title}
                                  style={{ width: "60px", height: "60px", margin: "0 auto 8px", borderRadius: "4px" }}
                                />
                                <div style={{ fontSize: "12px", fontWeight: "500", marginBottom: "4px" }}>
                                  {rec.title}
                                </div>
                                <div style={{ fontSize: "12px", fontWeight: "600", color: "#00a047" }}>
                                  ${rec.price}
                                </div>
                                <button style={{
                                  width: "100%",
                                  padding: "4px 8px",
                                  marginTop: "8px",
                                  backgroundColor: settings?.buttonColor || "#000000",
                                  color: settings?.buttonTextColor || "#ffffff",
                                  border: "none",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  cursor: "pointer"
                                }}>
                                  {settings?.addButtonText || "Add"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cart Footer */}
                      <div style={{ 
                        padding: "20px",
                        borderTop: "1px solid #e1e3e5",
                        backgroundColor: "#ffffff"
                      }}>
                        <div style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center",
                          marginBottom: "16px",
                          fontSize: "16px",
                          fontWeight: "600"
                        }}>
                          <span>Total:</span>
                          <span>${cartTotal.toFixed(2)}</span>
                        </div>
                        <button style={{
                          width: "100%",
                          padding: "14px",
                          backgroundColor: settings?.buttonColor || "#000000",
                          color: settings?.buttonTextColor || "#ffffff",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "16px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }}>
                          {settings?.checkoutButtonText || "Checkout"}
                        </button>
                      </div>
                    </div>
                  </div>
                </Box>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Preview Settings */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">Preview Settings</Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  The preview above reflects your current Cart Uplift configuration
                </Text>
                
                <BlockStack gap="200">
                  <TextField
                    label="Cart Title"
                    value={"Your Cart"}
                    autoComplete="off"
                    disabled
                    helpText="Configure in Settings"
                  />
                  <TextField
                    label="Free Shipping Threshold"
                    value={`$${settings?.freeShippingThreshold || 100}`}
                    autoComplete="off"
                    disabled
                    helpText="Configure in Settings"
                  />
                  <Checkbox
                    label="Free Shipping Enabled"
                    checked={settings?.enableFreeShipping || false}
                    disabled
                  />
                  <Checkbox
                    label="Recommendations Enabled"
                    checked={settings?.enableRecommendations !== false}
                    disabled
                  />
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Quick Actions */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">Customize Cart</Text>
                <BlockStack gap="200">
                  <Button fullWidth variant="primary" url="/admin/settings">
                    Edit Cart Settings
                  </Button>
                  <Button fullWidth url="/admin/settings">
                    Configure Free Shipping
                  </Button>
                  <Button fullWidth url="/admin/manage">
                    Manage Bundles
                  </Button>
                  <Button fullWidth url="/admin/dashboard">
                    View Performance
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Testing Tips */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">🧪 Testing Tips</Text>
                <BlockStack gap="200">
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text variant="bodySm" as="p">
                      <strong>Mobile First:</strong> 70% of customers use mobile - test mobile view frequently
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text variant="bodySm" as="p">
                      <strong>Free Shipping:</strong> Adjust threshold based on your AOV for optimal conversion
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="100">
                    <Text variant="bodySm" as="p">
                      <strong>Recommendations:</strong> Test different product combinations to maximize uptake
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Performance Impact */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">📈 Expected Impact</Text>
                <Grid>
                  <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <BlockStack gap="100">
                      <Text variant="bodySm" as="p" tone="subdued">AOV Increase</Text>
                      <Text variant="headingMd" as="p" tone="success">+15-25%</Text>
                    </BlockStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <BlockStack gap="100">
                      <Text variant="bodySm" as="p" tone="subdued">Conversion Rate</Text>
                      <Text variant="headingMd" as="p" tone="success">+8-12%</Text>
                    </BlockStack>
                  </Grid.Cell>
                </Grid>
                <Text variant="bodySm" as="p" tone="subdued">
                  Based on Cart Uplift optimization features
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
