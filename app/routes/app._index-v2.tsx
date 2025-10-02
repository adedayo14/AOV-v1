import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  ProgressBar,
  Icon,
  List,
  Button,
  Banner,
  Divider,
} from "@shopify/polaris";
import {
  CheckCircleIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  // Calculate setup progress
  const setupSteps = {
    stylingCustomized: true,  // Only styling is complete
    stickyCartEnabled: false,
    analyticsEnabled: false,
    recommendationsConfigured: false,
    incentivesConfigured: false,
  };
  
  const completedSteps = Object.values(setupSteps).filter(Boolean).length;
  const totalSteps = Object.keys(setupSteps).length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);
  
  return json({
    setupSteps,
    completedSteps,
    totalSteps,
    progressPercent,
  });
};

export default function Index() {
  const { setupSteps, completedSteps, totalSteps, progressPercent } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Cart Uplift Dashboard" />
      
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Welcome Card */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h1">
                  Welcome to Cart Uplift 🚀
                </Text>
                <Text variant="bodyMd" as="p">
                  Boost your store's revenue with intelligent cart optimization and upselling features:
                </Text>
                <List type="bullet">
                  <List.Item>AI-powered product recommendations</List.Item>
                  <List.Item>Dynamic free shipping incentives</List.Item>
                  <List.Item>Automated cross-sell suggestions</List.Item>
                  <List.Item>Cart progress & abandonment tracking</List.Item>
                  <List.Item>Conversion rate optimization</List.Item>
                  <List.Item>Customizable layouts & styling</List.Item>
                </List>
              </BlockStack>
            </Card>

            {/* Setup Progress Card */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Setup Progress
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {completedSteps} of {totalSteps} completed
                </Text>
                <ProgressBar progress={progressPercent} size="small" />
                
                <BlockStack gap="200">
                  <InlineStack gap="200" align="start" blockAlign="center">
                    {setupSteps.stickyCartEnabled && <Icon source={CheckCircleIcon} tone="success" />}
                    {!setupSteps.stickyCartEnabled && <Text as="span">○</Text>}
                    <Text as="span" tone={setupSteps.stickyCartEnabled ? undefined : "subdued"}>
                      Sticky cart enabled
                    </Text>
                  </InlineStack>
                  
                  <InlineStack gap="200" align="start" blockAlign="center">
                    {setupSteps.analyticsEnabled && <Icon source={CheckCircleIcon} tone="success" />}
                    {!setupSteps.analyticsEnabled && <Text as="span">○</Text>}
                    <Text as="span" tone={setupSteps.analyticsEnabled ? undefined : "subdued"}>
                      Analytics enabled
                    </Text>
                  </InlineStack>
                  
                  <InlineStack gap="200" align="start" blockAlign="center">
                    {setupSteps.recommendationsConfigured && <Icon source={CheckCircleIcon} tone="success" />}
                    {!setupSteps.recommendationsConfigured && <Text as="span">○</Text>}
                    <Text as="span" tone={setupSteps.recommendationsConfigured ? undefined : "subdued"}>
                      Recommendations configured
                    </Text>
                  </InlineStack>
                  
                  <InlineStack gap="200" align="start" blockAlign="center">
                    {setupSteps.incentivesConfigured && <Icon source={CheckCircleIcon} tone="success" />}
                    {!setupSteps.incentivesConfigured && <Text as="span">○</Text>}
                    <Text as="span" tone={setupSteps.incentivesConfigured ? undefined : "subdued"}>
                      Incentives configured
                    </Text>
                  </InlineStack>
                  
                  <InlineStack gap="200" align="start" blockAlign="center">
                    {setupSteps.stylingCustomized && <Icon source={CheckCircleIcon} tone="success" />}
                    {!setupSteps.stylingCustomized && <Text as="span">○</Text>}
                    <Text as="span" tone={setupSteps.stylingCustomized ? "success" : "subdued"}>
                      Styling customized
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Initial Setup Card */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  🛠️ Initial Setup
                </Text>
                <Text variant="bodyMd" as="p">
                  Get Cart Uplift running on your store:
                </Text>
                
                <List type="number">
                  <List.Item>Go to your Shopify theme editor</List.Item>
                  <List.Item>Click "App embeds" in the left sidebar</List.Item>
                  <List.Item>Find "Cart Uplift" and toggle it ON</List.Item>
                  <List.Item>Configure your settings in the Settings tab</List.Item>
                  <List.Item>Save your theme changes</List.Item>
                </List>
                
                <Banner tone="info">
                  <Text as="p" fontWeight="bold">
                    ✅ The app embed must be enabled first before Cart Uplift will work on your store.
                  </Text>
                </Banner>
              </BlockStack>
            </Card>

            {/* Dashboard Card */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  📊 Dashboard
                </Text>
                <Text variant="bodyMd" as="p">
                  Monitor your Cart Uplift performance in real-time:
                </Text>
                
                <Divider />
                
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd">
                    <Text as="span" fontWeight="bold">Revenue Impact:</Text> Track additional revenue generated by Cart Uplift
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <Text as="span" fontWeight="bold">Conversion Metrics:</Text> Monitor cart abandonment reduction and upsell success
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <Text as="span" fontWeight="bold">Product Performance:</Text> See which recommendations drive the most sales
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <Text as="span" fontWeight="bold">Customer Insights:</Text> Understand shopping behavior and preferences
                  </Text>
                </BlockStack>
                
                <Divider />
                
                <Banner tone="success">
                  <Text as="p">
                    💡 <Text as="span" fontWeight="bold">Tip:</Text> Use dashboard insights to optimize your cart settings and maximize ROI.
                  </Text>
                </Banner>
              </BlockStack>
            </Card>

            {/* Quick Actions */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  ⚡ Quick Actions
                </Text>
                <InlineStack gap="300">
                  <Button url="/app/settings-new">Configure Settings</Button>
                  <Button url="/app/ab-testing">A/B Testing</Button>
                  <Button url="/app/dashboard">View Analytics</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
