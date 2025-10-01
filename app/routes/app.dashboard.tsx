import { Page, Card, Text, Layout, BlockStack, InlineStack, Badge } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function Dashboard() {
  return (
    <Page>
      <TitleBar title="📊 Analytics & Performance Dashboard" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Welcome to Cart Uplift v2</Text>
              <Text as="p">Your cart optimization dashboard is ready! Here you can monitor your app's performance and analytics.</Text>
              
              <InlineStack gap="400">
                <Badge tone="success">✅ App Running</Badge>
                <Badge tone="info">🔧 Settings Available</Badge>
                <Badge tone="attention">🧪 A/B Testing Ready</Badge>
                <Badge tone="success">📦 Bundle Management Active</Badge>
              </InlineStack>
              
              <Text as="p" tone="subdued">
                Navigate to Settings to configure your cart drawer, A/B Testing to create experiments, 
                or Manage Products & Bundles to set up product recommendations.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}