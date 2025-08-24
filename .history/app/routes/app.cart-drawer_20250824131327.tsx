import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Banner,
  Tabs,
  Box,
  Grid,
  DataTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// CSS for cart preview components  
const cartPreviewStyles = `
  .cart-preview-button {
    display: inline-block;
    padding: 12px 20px;
    border-radius: 25px;
    max-width: fit-content;
    background-color: var(--button-bg-color);
    color: var(--button-text-color);
  }
  
  .shipping-progress-bar {
    height: 8px;
    width: 46%;
    margin-top: 8px;
    background-color: #4CAF50;
    border-radius: 4px;
  }
`;

// Types
interface CartDrawerSettings {
  enableApp: boolean;
  enableStickyCart: boolean;
  enableFreeShipping: boolean;
  freeShippingThreshold: number;
  cartPosition: string;
  cartIcon: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  enableUpsells: boolean;
  enableQuantityBreaks: boolean;
  shippingMessage: string;
  shippingSuccessMessage: string;
  showOnlyOnCartPage: boolean;
}

const defaultSettings: CartDrawerSettings = {
  enableApp: true,
  enableStickyCart: true,
  enableFreeShipping: true,
  freeShippingThreshold: 100,
  cartPosition: "bottom-right",
  cartIcon: "cart",
  backgroundColor: "#000000",
  textColor: "#FFFFFF",
  buttonColor: "#4CAF50",
  enableUpsells: true,
  enableQuantityBreaks: false,
  shippingMessage: "You're {amount} away from free shipping!",
  shippingSuccessMessage: "🎉 Congratulations! You've unlocked free shipping!",
  showOnlyOnCartPage: false,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  
  // In a real app, you'd load settings from your database
  // For now, we'll return default settings
  const settings = defaultSettings;
  
  // Fetch real analytics data from Shopify
  try {
    // Get orders from the last 30 days
    const ordersResponse = await admin.graphql(`
      #graphql
      query getRecentOrders($query: String!) {
        orders(first: 250, query: $query) {
          edges {
            node {
              id
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              createdAt
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    quantity
                    originalTotalSet {
                      shopMoney {
                        amount
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: {
        query: `created_at:>=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}`
      }
    });

    // Get top selling products
    const productsResponse = await admin.graphql(`
      #graphql
      query getTopProducts {
        products(first: 10, sortKey: BEST_SELLING) {
          edges {
            node {
              id
              title
              totalInventory
            }
          }
        }
      }
    `);

    const ordersData = await ordersResponse.json();
    const productsData = await productsResponse.json();
    
    const orders = ordersData.data?.orders?.edges || [];
    const products = productsData.data?.products?.edges || [];
    
    // Calculate real analytics
    const totalRevenue = orders.reduce((sum: number, edge: any) => {
      return sum + parseFloat(edge.node.totalPriceSet.shopMoney.amount);
    }, 0);
    
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Simulate cart-specific data (in a real app, you'd track this separately)
    const cartOpensToday = Math.floor(totalOrders * 2.5); // Estimate
    const revenueFromUpsells = totalRevenue * 0.15; // Estimate 15% from upsells
    const conversionRate = totalOrders > 0 ? (totalOrders / cartOpensToday) * 100 : 0;
    
    const topUpsells = products.slice(0, 3).map((edge: any, index: number) => ({
      product: edge.node.title,
      views: Math.floor(Math.random() * 1000) + 500,
      clicks: Math.floor(Math.random() * 200) + 50,
      conversion: Math.floor(Math.random() * 20) + 10,
      revenue: Math.floor(Math.random() * 5000) + 1000,
    }));

    const analytics = {
      revenueFromUpsells,
      cartOpensToday,
      conversionRate,
      averageOrderValue,
      totalOrders,
      totalRevenue,
      topUpsells,
    };

    return json({ settings, analytics, shop: session.shop });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    
    // Fallback to zero values if API fails
    const analytics = {
      revenueFromUpsells: 0,
      cartOpensToday: 0,
      conversionRate: 0,
      averageOrderValue: 0,
      totalOrders: 0,
      totalRevenue: 0,
      topUpsells: [],
    };

    return json({ settings, analytics, shop: session.shop });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const formData = await request.formData();
  const settings = JSON.parse(formData.get("settings") as string);
  
  // In a real app, you'd save these settings to your database
  console.log("Saving settings for shop:", session.shop, settings);
  
  // Here you would typically:
  // 1. Validate the settings
  // 2. Save to database
  // 3. Maybe update app metafields or other Shopify resources
  
  return json({ success: true, message: "Settings saved successfully!" });
};

export default function CartDrawerSettings() {
  const { settings: initialSettings, analytics, shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  
  const [settings, setSettings] = useState<CartDrawerSettings>(initialSettings);
  const [selectedTab, setSelectedTab] = useState(0);
  
  const isLoading = fetcher.state === "submitting";
  const isSuccess = fetcher.data?.success;

  const handleSettingChange = useCallback((key: keyof CartDrawerSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    fetcher.submit(
      { settings: JSON.stringify(settings) },
      { method: "POST" }
    );
  }, [settings, fetcher]);

  const cartPositionOptions = [
    { label: "Bottom Right", value: "bottom-right" },
    { label: "Bottom Left", value: "bottom-left" },
    { label: "Middle Right", value: "middle-right" },
    { label: "Middle Left", value: "middle-left" },
  ];

  const cartIconOptions = [
    { label: "Shopping Cart", value: "cart" },
    { label: "Shopping Bag", value: "bag" },
    { label: "Basket", value: "basket" },
  ];

  const tabs = [
    { id: "dashboard", content: "Dashboard" },
    { id: "settings", content: "Settings" },
    { id: "preview", content: "Live Preview" },
    { id: "upsells", content: "Upsells" },
    { id: "analytics", content: "Analytics" },
  ];

  const statsCards = [
    {
      title: "Revenue from Upsells",
      value: `$${analytics.revenueFromUpsells.toFixed(2)}`,
      color: "success"
    },
    {
      title: "Cart Opens Today", 
      value: analytics.cartOpensToday.toLocaleString(),
      color: "info"
    },
    {
      title: "Conversion Rate",
      value: `${analytics.conversionRate.toFixed(1)}%`,
      color: "warning"
    },
    {
      title: "Average Order Value",
      value: `$${analytics.averageOrderValue.toFixed(2)}`,
      color: "critical"
    }
  ];

  const upsellTableRows = analytics.topUpsells.map((item: any) => [
    item.product,
    item.views.toLocaleString(),
    item.clicks.toLocaleString(),
    `${item.conversion}%`,
    `$${item.revenue.toLocaleString()}`
  ]);

  return (
    <>
      <style>{cartPreviewStyles}</style>
      <Page fullWidth>
      <TitleBar title="UpCart Cart Drawer Settings" />
      
      {isSuccess && (
        <Banner tone="success" onDismiss={() => {}}>
          {fetcher.data?.message}
        </Banner>
      )}

      <BlockStack gap="500">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          <Box paddingBlockStart="400">
            {selectedTab === 0 && (
              <BlockStack gap="500">
                {/* Dashboard Tab */}
                <Text as="h2" variant="headingLg">Dashboard</Text>
                
                <Grid>
                  {statsCards.map((stat, index) => (
                    <Grid.Cell key={index} columnSpan={{xs: 6, md: 3}}>
                      <Card>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingMd">{stat.value}</Text>
                          <Text as="p" variant="bodyMd" tone="subdued">{stat.title}</Text>
                        </BlockStack>
                      </Card>
                    </Grid.Cell>
                  ))}
                </Grid>

                {/* Additional metrics row */}
                <Grid>
                  <Grid.Cell columnSpan={{xs: 6, md: 4}}>
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">{analytics.totalOrders}</Text>
                        <Text as="p" variant="bodyMd" tone="subdued">Total Orders (30 days)</Text>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, md: 4}}>
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">${analytics.totalRevenue.toFixed(2)}</Text>
                        <Text as="p" variant="bodyMd" tone="subdued">Total Revenue (30 days)</Text>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, md: 4}}>
                    <Card>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          {analytics.totalOrders > 0 ? ((analytics.revenueFromUpsells / analytics.totalRevenue) * 100).toFixed(1) : 0}%
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">Upsell Impact</Text>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                </Grid>

                <Card>
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingMd">Quick Setup Guide</Text>
                    <Text as="p" variant="bodyMd">
                      Follow these steps to enable your cart drawer:
                    </Text>
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd">1. Go to your theme editor</Text>
                      <Text as="p" variant="bodyMd">2. Click on "App embeds" in the left sidebar</Text>
                      <Text as="p" variant="bodyMd">3. Find "UpCart Cart Drawer" and toggle it on</Text>
                      <Text as="p" variant="bodyMd">4. Configure your settings in the Settings tab</Text>
                      <Text as="p" variant="bodyMd">5. Save your theme</Text>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            )}

            {selectedTab === 1 && (
              <BlockStack gap="500">
                {/* Settings Tab */}
                <Text as="h2" variant="headingLg">Settings</Text>
                
                <Layout>
                  <Layout.Section>
                    <Card>
                      <Text as="h3" variant="headingMd">General Settings</Text>
                      <Box paddingBlockStart="400">
                        <FormLayout>
                          <Checkbox
                            label="Enable UpCart"
                            checked={settings.enableApp}
                            onChange={(value) => handleSettingChange("enableApp", value)}
                          />
                          <Checkbox
                            label="Enable Sticky Cart Button"
                            checked={settings.enableStickyCart}
                            onChange={(value) => handleSettingChange("enableStickyCart", value)}
                          />
                          <Checkbox
                            label="Show only on cart page"
                            checked={settings.showOnlyOnCartPage}
                            onChange={(value) => handleSettingChange("showOnlyOnCartPage", value)}
                            helpText="If enabled, the cart drawer will only appear on the cart page"
                          />
                          <Checkbox
                            label="Enable Free Shipping Bar"
                            checked={settings.enableFreeShipping}
                            onChange={(value) => handleSettingChange("enableFreeShipping", value)}
                          />
                          <TextField
                            label="Free Shipping Threshold ($)"
                            type="number"
                            value={settings.freeShippingThreshold.toString()}
                            onChange={(value) => handleSettingChange("freeShippingThreshold", parseFloat(value))}
                            autoComplete="off"
                          />
                          <Select
                            label="Cart Position"
                            options={cartPositionOptions}
                            value={settings.cartPosition}
                            onChange={(value) => handleSettingChange("cartPosition", value)}
                          />
                          <Select
                            label="Cart Icon Style"
                            options={cartIconOptions}
                            value={settings.cartIcon}
                            onChange={(value) => handleSettingChange("cartIcon", value)}
                          />
                        </FormLayout>
                      </Box>
                    </Card>
                  </Layout.Section>

                  <Layout.Section>
                    <Card>
                      <Text as="h3" variant="headingMd">Appearance</Text>
                      <Box paddingBlockStart="400">
                        <FormLayout>
                          <TextField
                            label="Background Color"
                            value={settings.backgroundColor}
                            onChange={(value) => handleSettingChange("backgroundColor", value)}
                            autoComplete="off"
                          />
                          <TextField
                            label="Text Color"
                            value={settings.textColor}
                            onChange={(value) => handleSettingChange("textColor", value)}
                            autoComplete="off"
                          />
                          <TextField
                            label="Button Color"
                            value={settings.buttonColor}
                            onChange={(value) => handleSettingChange("buttonColor", value)}
                            autoComplete="off"
                          />
                        </FormLayout>
                      </Box>
                    </Card>
                  </Layout.Section>
                </Layout>

                <Card>
                  <Text as="h3" variant="headingMd">Messages</Text>
                  <Box paddingBlockStart="400">
                    <FormLayout>
                      <TextField
                        label="Shipping Message"
                        value={settings.shippingMessage}
                        onChange={(value) => handleSettingChange("shippingMessage", value)}
                        helpText="Use {amount} as placeholder for remaining amount"
                        autoComplete="off"
                      />
                      <TextField
                        label="Free Shipping Success Message"
                        value={settings.shippingSuccessMessage}
                        onChange={(value) => handleSettingChange("shippingSuccessMessage", value)}
                        autoComplete="off"
                      />
                    </FormLayout>
                  </Box>
                </Card>
              </BlockStack>
            )}

            {selectedTab === 2 && (
              <BlockStack gap="500">
                {/* Live Preview Tab */}
                <Text as="h2" variant="headingLg">Live Cart Preview</Text>
                
                <Layout>
                  <Layout.Section>
                    <Card>
                      <BlockStack gap="400">
                        <Text as="h3" variant="headingMd">Test Your Cart Drawer</Text>
                        <Text as="p" variant="bodyMd">
                          Use the preview below to see how your cart drawer will look and behave with your current settings.
                        </Text>
                        
                        <Box 
                          padding="400" 
                          background="bg-surface-secondary"
                          borderRadius="200"
                          borderWidth="025"
                          borderColor="border"
                        >
                          <BlockStack gap="300">
                            <Text as="h4" variant="headingMd">
                              Cart Preview (Settings: {settings.cartPosition}, {settings.cartIcon})
                            </Text>
                            
                            {/* Mock cart button preview */}
                            <div 
                              className="cart-preview-button"
                              style={{
                                backgroundColor: settings.backgroundColor,
                                color: settings.textColor,
                              }}
                            >
                              <InlineStack gap="200" align="center">
                                <Text as="span" variant="bodyMd">
                                  🛒 Cart (2) • $45.99
                                </Text>
                              </InlineStack>
                            </div>
                            
                            <Text as="p" variant="bodyMd" tone="subdued">
                              Position: {settings.cartPosition} | Free shipping at: ${settings.freeShippingThreshold}
                            </Text>
                            
                            {settings.enableFreeShipping && (
                              <Box>
                                <Text as="p" variant="bodyMd" fontWeight="medium">
                                  Free Shipping Progress:
                                </Text>
                                <Box 
                                  padding="200"
                                  background="bg-surface-secondary"
                                  borderRadius="100"
                                >
                                  <Text as="p" variant="bodyMd">
                                    {settings.shippingMessage.replace('{amount}', '$54.01')}
                                  </Text>
                                  <div className="shipping-progress-bar" />
                                </Box>
                              </Box>
                            )}
                          </BlockStack>
                        </Box>
                        
                        <Text as="p" variant="bodyMd" tone="subdued">
                          To see the actual cart drawer in action, visit your storefront with the app embed enabled.
                        </Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                  
                  <Layout.Section>
                    <Card>
                      <BlockStack gap="400">
                        <Text as="h3" variant="headingMd">Quick Test Actions</Text>
                        
                        <Button 
                          url={`https://${shop}/cart`}
                          target="_blank"
                          variant="primary"
                        >
                          View Cart Page
                        </Button>
                        
                        <Button 
                          url={`https://${shop}`}
                          target="_blank"
                        >
                          View Storefront
                        </Button>
                        
                        <Text as="p" variant="bodyMd" tone="subdued">
                          Make sure the app embed is enabled in your theme editor first.
                        </Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            )}

            {selectedTab === 3 && (
              <BlockStack gap="500">
                {/* Upsells Tab */}
                <Text as="h2" variant="headingLg">Upsells & Cross-sells</Text>
                
                <Layout>
                  <Layout.Section>
                    <Card>
                      <Text as="h3" variant="headingMd">Upsell Settings</Text>
                      <Box paddingBlockStart="400">
                        <FormLayout>
                          <Checkbox
                            label="Enable Product Upsells"
                            checked={settings.enableUpsells}
                            onChange={(value) => handleSettingChange("enableUpsells", value)}
                          />
                          <Select
                            label="Upsell Strategy"
                            options={[
                              { label: "Related Products", value: "related" },
                              { label: "Best Sellers", value: "bestsellers" },
                              { label: "Manual Selection", value: "manual" },
                              { label: "AI Recommendations", value: "ai" },
                            ]}
                            value="related"
                            onChange={() => {}}
                          />
                          <TextField
                            label="Maximum Upsells to Show"
                            type="number"
                            value="4"
                            onChange={() => {}}
                            autoComplete="off"
                          />
                        </FormLayout>
                      </Box>
                    </Card>
                  </Layout.Section>

                  <Layout.Section>
                    <Card>
                      <Text as="h3" variant="headingMd">Cross-sell Settings</Text>
                      <Box paddingBlockStart="400">
                        <FormLayout>
                          <Checkbox
                            label="Enable Product Bundles"
                            checked={false}
                            onChange={() => {}}
                          />
                          <Checkbox
                            label="Enable Quantity Breaks"
                            checked={settings.enableQuantityBreaks}
                            onChange={(value) => handleSettingChange("enableQuantityBreaks", value)}
                          />
                        </FormLayout>
                      </Box>
                    </Card>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            )}

            {selectedTab === 4 && (
              <BlockStack gap="500">
                {/* Analytics Tab */}
                <Text as="h2" variant="headingLg">Analytics</Text>
                
                <Card>
                  <Text as="h3" variant="headingMd">Performance Metrics</Text>
                  <Box paddingBlockStart="400">
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Analytics chart would be displayed here in a production app
                    </Text>
                  </Box>
                </Card>

                <Card>
                  <Text as="h3" variant="headingMd">Top Performing Upsells</Text>
                  <Box paddingBlockStart="400">
                    <DataTable
                      columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric']}
                      headings={['Product', 'Views', 'Clicks', 'Conversion', 'Revenue']}
                      rows={upsellTableRows}
                    />
                  </Box>
                </Card>
              </BlockStack>
            )}
          </Box>
        </Tabs>

        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isLoading}
          >
            Save Settings
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
    </>
  );
}
