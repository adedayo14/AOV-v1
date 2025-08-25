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
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Default settings - in production, load from database
  const settings = {
    enableApp: true,
    enableStickyCart: true,
    showOnlyOnCartPage: false,
    cartPosition: "bottom-right",
    cartIcon: "cart",
    backgroundColor: "#ffffff",
    freeShippingText: "You're {amount} away from free shipping!",
    freeShippingAchievedText: "🎉 Congratulations! You've unlocked free shipping!",
    enableRecommendations: true,
    recommendationLayout: "column",
    maxRecommendations: 4,
    enableAddons: false,
    enableDiscountCode: false,
    enableNotes: false,
    enableExpressCheckout: true,
    enableAnalytics: false,
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

  return (
    <Page
      title="Cart Uplift Settings"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSubmit,
        loading: fetcher.state === "submitting",
      }}
    >
      {fetcher.data?.success && (
        <Banner status="success" onDismiss={() => {}}>
          {fetcher.data.message}
        </Banner>
      )}
      
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <Text variant="headingLg" as="h2">General Settings</Text>
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
                />
                
                <Checkbox
                  label="Show only on cart page"
                  checked={formSettings.showOnlyOnCartPage}
                  onChange={(value) => updateSetting("showOnlyOnCartPage", value)}
                  helpText="If enabled, the cart drawer will only appear on the cart page"
                />
                
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
            </Card>

            <Card>
              <Text variant="headingLg" as="h2">Appearance</Text>
              <FormLayout>
                <TextField
                  label="Background Color"
                  value={formSettings.backgroundColor}
                  onChange={(value) => updateSetting("backgroundColor", value)}
                  type="color"
                />
              </FormLayout>
            </Card>

            <Card>
              <Text variant="headingLg" as="h2">Messages</Text>
              <FormLayout>
                <TextField
                  label="Shipping Message"
                  value={formSettings.freeShippingText}
                  onChange={(value) => updateSetting("freeShippingText", value)}
                  helpText="Use {amount} as placeholder for remaining amount"
                  multiline={2}
                />
                
                <TextField
                  label="Free Shipping Success Message"
                  value={formSettings.freeShippingAchievedText}
                  onChange={(value) => updateSetting("freeShippingAchievedText", value)}
                  multiline={2}
                />
              </FormLayout>
            </Card>

            <Card>
              <Text variant="headingLg" as="h2">Features</Text>
              <FormLayout>
                <Checkbox
                  label="Enable Product Recommendations"
                  checked={formSettings.enableRecommendations}
                  onChange={(value) => updateSetting("enableRecommendations", value)}
                />
                
                <Checkbox
                  label="Enable Add-ons"
                  checked={formSettings.enableAddons}
                  onChange={(value) => updateSetting("enableAddons", value)}
                />
                
                <Checkbox
                  label="Enable Discount Code Field"
                  checked={formSettings.enableDiscountCode}
                  onChange={(value) => updateSetting("enableDiscountCode", value)}
                />
                
                <Checkbox
                  label="Enable Order Notes"
                  checked={formSettings.enableNotes}
                  onChange={(value) => updateSetting("enableNotes", value)}
                />
                
                <Checkbox
                  label="Enable Express Checkout"
                  checked={formSettings.enableExpressCheckout}
                  onChange={(value) => updateSetting("enableExpressCheckout", value)}
                />
                
                <Checkbox
                  label="Enable Analytics"
                  checked={formSettings.enableAnalytics}
                  onChange={(value) => updateSetting("enableAnalytics", value)}
                />
              </FormLayout>
            </Card>
          </BlockStack>
        </Layout.Section>
        
        <Layout.Section variant="oneThird">
          <Card>
            <Text variant="headingMd" as="h3">Theme Customizer Settings</Text>
            <BlockStack gap="300">
              <Text variant="bodyMd" color="subdued">
                The following settings can be adjusted directly in your theme customizer for easy access:
              </Text>
              <List type="bullet">
                <List.Item>Auto-open cart on add</List.Item>
                <List.Item>Free shipping progress</List.Item>
                <List.Item>Free shipping threshold</List.Item>
                <List.Item>Button & accent color</List.Item>
                <List.Item>Text color</List.Item>
              </List>
              <Text variant="bodyMd" color="subdued">
                These settings are perfect for merchants who want to quickly adjust the most commonly changed options without accessing the app dashboard.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
