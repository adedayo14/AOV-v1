import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Select,
  Text,
  Banner,
  BlockStack,
  Tabs,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Default settings - in production, load from database
  const settings = {
    // Core Features
    enableApp: true,
    enableStickyCart: true,
    enableFreeShippingBar: true,
    freeShippingThreshold: 100,
    
    // Cart Behavior
    autoOpenCart: true,
    showOnlyOnCartPage: false,
    cartPosition: "bottom-right",
    cartIcon: "cart",
    
    // Appearance (these should move to theme customizer)
    backgroundColor: "#000000",
    textColor: "#ffffff",
    buttonColor: "#4CAF50",
    
    // Messages
    freeShippingText: "You're {amount} away from free shipping!",
    freeShippingAchievedText: "🎉 Congratulations! You've unlocked free shipping!",
    
    // Advanced Features
    enableRecommendations: true,
    recommendationStrategy: "related",
    maxRecommendations: 4,
    recommendationsTitle: "You might also like",
    enableQuantityBreaks: false,
    enableDiscountCode: true,
    enableOrderNotes: false,
    enableExpressCheckout: true,
    
    // Analytics & Tracking
    enableAnalytics: true,
  };

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  
  const formData = await request.formData();
  const settings = Object.fromEntries(formData);
  
  // In production, save to database
  console.log("Saving settings:", settings);
  
  return json({ success: true, message: "Settings saved successfully!" });
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  const [formSettings, setFormSettings] = useState(settings);
  const [selectedTab, setSelectedTab] = useState(0);

  const handleSubmit = () => {
    const formData = new FormData();
    Object.entries(formSettings).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    fetcher.submit(formData, { method: "post" });
  };

  const updateSetting = (key: string, value: any) => {
    setFormSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    {
      id: 'general',
      content: 'General',
    },
    {
      id: 'upsells',
      content: 'Upsells & Recommendations',
    },
    {
      id: 'advanced',
      content: 'Advanced',
    },
  ];

  const cartPositionOptions = [
    { label: "Bottom Right", value: "bottom-right" },
    { label: "Bottom Left", value: "bottom-left" },
    { label: "Top Right", value: "top-right" },
    { label: "Top Left", value: "top-left" },
  ];

  const cartIconOptions = [
    { label: "Shopping Cart", value: "cart" },
    { label: "Shopping Bag", value: "bag" },
    { label: "Basket", value: "basket" },
  ];

  const recommendationStrategies = [
    { label: "Related Products", value: "related" },
    { label: "Best Sellers", value: "bestsellers" },
    { label: "Recently Viewed", value: "recent" },
    { label: "Manual Selection", value: "manual" },
  ];

  return (
    <Page
      title="Settings"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSubmit,
        loading: fetcher.state === "submitting",
      }}
    >
      <TitleBar title="Settings" />
      
      {fetcher.state === "submitting" && (
        <Banner tone="info">
          Saving settings...
        </Banner>
      )}

      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        <BlockStack gap="500">
          
          {selectedTab === 0 && (
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Core Features</Text>
                    <FormLayout>
                      <Checkbox
                        label="Enable Cart Uplift"
                        checked={formSettings.enableApp}
                        onChange={(value) => updateSetting("enableApp", value)}
                        helpText="Master toggle for the entire cart functionality"
                      />
                      
                      <Checkbox
                        label="Enable Sticky Cart Button"
                        checked={formSettings.enableStickyCart}
                        onChange={(value) => updateSetting("enableStickyCart", value)}
                        helpText="Show floating cart button on all pages"
                      />
                      
                      <Checkbox
                        label="Show only on cart page"
                        checked={formSettings.showOnlyOnCartPage}
                        onChange={(value) => updateSetting("showOnlyOnCartPage", value)}
                        helpText="If enabled, the cart drawer will only appear on the cart page"
                      />
                      
                      <Checkbox
                        label="Auto-open cart when item added"
                        checked={formSettings.autoOpenCart}
                        onChange={(value) => updateSetting("autoOpenCart", value)}
                        helpText="Automatically show cart drawer when customers add items"
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
                
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Free Shipping</Text>
                    <FormLayout>
                      <Checkbox
                        label="Enable Free Shipping Bar"
                        checked={formSettings.enableFreeShippingBar}
                        onChange={(value) => updateSetting("enableFreeShippingBar", value)}
                        helpText="Display progress bar and messages for free shipping threshold"
                      />
                      
                      <TextField
                        label="Free Shipping Threshold"
                        type="number"
                        value={formSettings.freeShippingThreshold.toString()}
                        onChange={(value) => updateSetting("freeShippingThreshold", parseInt(value) || 0)}
                        helpText="Minimum order amount for free shipping (in shop currency)"
                        prefix="$"
                        autoComplete="off"
                      />
                      
                      <TextField
                        label="Free Shipping Message"
                        value={formSettings.freeShippingText}
                        onChange={(value) => updateSetting("freeShippingText", value)}
                        helpText="Use {amount} as placeholder for remaining amount"
                        autoComplete="off"
                      />
                      
                      <TextField
                        label="Free Shipping Achieved Message"
                        value={formSettings.freeShippingAchievedText}
                        onChange={(value) => updateSetting("freeShippingAchievedText", value)}
                        autoComplete="off"
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
              </Layout.Section>
              
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Cart Position & Icon</Text>
                    <FormLayout>
                      <Select
                        label="Cart Position"
                        options={cartPositionOptions}
                        value={formSettings.cartPosition}
                        onChange={(value) => updateSetting("cartPosition", value)}
                      />
                      
                      <Select
                        label="Cart Icon Style"
                        options={cartIconOptions}
                        value={formSettings.cartIcon}
                        onChange={(value) => updateSetting("cartIcon", value)}
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
                
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Note</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Colors and styling options are available in your Theme Customizer under "App embeds" → "UpCart Cart Drawer" for easy access.
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          )}
          
          {selectedTab === 1 && (
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Product Recommendations</Text>
                    <FormLayout>
                      <Checkbox
                        label="Enable Product Recommendations"
                        checked={formSettings.enableRecommendations}
                        onChange={(value) => updateSetting("enableRecommendations", value)}
                        helpText="Show recommended products in cart drawer"
                      />
                      
                      <Select
                        label="Recommendation Strategy"
                        options={recommendationStrategies}
                        value={formSettings.recommendationStrategy}
                        onChange={(value) => updateSetting("recommendationStrategy", value)}
                      />
                      
                      <TextField
                        label="Max Recommendations"
                        type="number"
                        value={formSettings.maxRecommendations.toString()}
                        onChange={(value) => updateSetting("maxRecommendations", parseInt(value) || 4)}
                        min={1}
                        max={12}
                        autoComplete="off"
                      />
                      
                      <TextField
                        label="Recommendations Title"
                        value={formSettings.recommendationsTitle}
                        onChange={(value) => updateSetting("recommendationsTitle", value)}
                        helpText="Title shown above recommendations"
                        autoComplete="off"
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
              </Layout.Section>
              
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Additional Features</Text>
                    <FormLayout>
                      <Checkbox
                        label="Enable Quantity Breaks"
                        checked={formSettings.enableQuantityBreaks}
                        onChange={(value) => updateSetting("enableQuantityBreaks", value)}
                        helpText="Show bulk pricing discounts"
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          )}
          
          {selectedTab === 2 && (
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Checkout Features</Text>
                    <FormLayout>
                      <Checkbox
                        label="Enable Discount Code Field"
                        checked={formSettings.enableDiscountCode}
                        onChange={(value) => updateSetting("enableDiscountCode", value)}
                        helpText="Allow customers to enter discount codes in cart"
                      />
                      
                      <Checkbox
                        label="Enable Order Notes"
                        checked={formSettings.enableOrderNotes}
                        onChange={(value) => updateSetting("enableOrderNotes", value)}
                        helpText="Allow customers to add special instructions"
                      />
                      
                      <Checkbox
                        label="Enable Express Checkout"
                        checked={formSettings.enableExpressCheckout}
                        onChange={(value) => updateSetting("enableExpressCheckout", value)}
                        helpText="Show express payment options (Shop Pay, Apple Pay, etc.)"
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
                
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Analytics & Tracking</Text>
                    <FormLayout>
                      <Checkbox
                        label="Enable Analytics"
                        checked={formSettings.enableAnalytics}
                        onChange={(value) => updateSetting("enableAnalytics", value)}
                        helpText="Track cart drawer performance and user interactions"
                      />
                    </FormLayout>
                  </BlockStack>
                </Card>
              </Layout.Section>
              
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">Legacy Settings</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Some advanced styling options have been moved to the Theme Customizer for easier merchant access. This provides better performance and a more intuitive experience.
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          )}
          
        </BlockStack>
      </Tabs>
    </Page>
  );
}
