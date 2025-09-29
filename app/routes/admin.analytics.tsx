import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
  Box,
  Divider,
  Grid,
  ProgressBar
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// Sample analytics data - replace with real data from your models
const mockAnalyticsData = {
  totalRevenue: "$45,230.50",
  totalOrders: 1247,
  averageOrderValue: "$36.28",
  conversionRate: "3.2%",
  bundlePerformance: {
    totalBundlesSold: 324,
    bundleRevenue: "$15,680.00",
    topBundles: [
      { name: "Summer Essentials", sales: 89, revenue: "$4,230.50" },
      { name: "Tech Starter Pack", sales: 67, revenue: "$3,890.20" },
      { name: "Fitness Bundle", sales: 52, revenue: "$2,840.30" }
    ]
  },
  mlRecommendations: {
    totalRecommendations: 5672,
    acceptedRecommendations: 1834,
    acceptanceRate: "32.3%",
    revenueFromML: "$18,920.40"
  },
  shippingProgress: {
    averageCartValue: "$28.45",
    freeShippingThreshold: "$50.00",
    progressBarInteractions: 892,
    conversionsFromProgress: 234
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  
  // TODO: Replace with real analytics queries from your database
  // You can use your cartAnalytics.server.ts model here
  
  return json({ analytics: mockAnalyticsData });
};

export default function Analytics() {
  const { analytics } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Analytics Dashboard" />
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Key Metrics Overview */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Key Performance Metrics
                </Text>
                <Grid>
                  <Grid.Cell columnSpan={{xs: 6, sm: 3, md: 3, lg: 3, xl: 3}}>
                    <Card>
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h3">Total Revenue</Text>
                        <Text variant="heading2xl" as="p">{analytics.totalRevenue}</Text>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, sm: 3, md: 3, lg: 3, xl: 3}}>
                    <Card>
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h3">Total Orders</Text>
                        <Text variant="heading2xl" as="p">{analytics.totalOrders.toLocaleString()}</Text>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, sm: 3, md: 3, lg: 3, xl: 3}}>
                    <Card>
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h3">Average Order Value</Text>
                        <Text variant="heading2xl" as="p">{analytics.averageOrderValue}</Text>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, sm: 3, md: 3, lg: 3, xl: 3}}>
                    <Card>
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h3">Conversion Rate</Text>
                        <Text variant="heading2xl" as="p">{analytics.conversionRate}</Text>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                </Grid>
              </BlockStack>
            </Card>

            {/* Bundle Performance */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Bundle Performance
                </Text>
                <InlineStack gap="400" wrap={false}>
                  <Box minWidth="200px">
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h3">Total Bundles Sold</Text>
                      <Text variant="headingLg" as="p">{analytics.bundlePerformance.totalBundlesSold}</Text>
                    </BlockStack>
                  </Box>
                  <Box minWidth="200px">
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h3">Bundle Revenue</Text>
                      <Text variant="headingLg" as="p">{analytics.bundlePerformance.bundleRevenue}</Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
                <Divider />
                <Text variant="headingSm" as="h3">Top Performing Bundles</Text>
                <BlockStack gap="300">
                  {analytics.bundlePerformance.topBundles.map((bundle, index) => (
                    <Card key={index}>
                      <InlineStack align="space-between">
                        <BlockStack gap="100">
                          <Text variant="bodySm" as="p">{bundle.name}</Text>
                          <Text variant="bodyXs" tone="subdued" as="p">{bundle.sales} sales</Text>
                        </BlockStack>
                        <Text variant="bodyMd" as="p">{bundle.revenue}</Text>
                      </InlineStack>
                    </Card>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>

            {/* ML Recommendations */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  ML Recommendation Performance
                </Text>
                <Grid>
                  <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h3">Total Recommendations Shown</Text>
                      <Text variant="headingLg" as="p">{analytics.mlRecommendations.totalRecommendations.toLocaleString()}</Text>
                    </BlockStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h3">Accepted Recommendations</Text>
                      <Text variant="headingLg" as="p">{analytics.mlRecommendations.acceptedRecommendations.toLocaleString()}</Text>
                    </BlockStack>
                  </Grid.Cell>
                </Grid>
                <Box>
                  <Text variant="bodyMd" as="p">Acceptance Rate</Text>
                  <Text variant="headingMd" as="p">{analytics.mlRecommendations.acceptanceRate}</Text>
                  <Box paddingBlockStart="200">
                    <ProgressBar progress={32.3} />
                  </Box>
                </Box>
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p">Revenue from ML Recommendations</Text>
                  <Badge tone="success">{analytics.mlRecommendations.revenueFromML}</Badge>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Shipping Progress Bar Analytics */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Free Shipping Progress Analytics
                </Text>
                <Grid>
                  <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h3">Average Cart Value</Text>
                      <Text variant="headingLg" as="p">{analytics.shippingProgress.averageCartValue}</Text>
                    </BlockStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h3">Free Shipping Threshold</Text>
                      <Text variant="headingLg" as="p">{analytics.shippingProgress.freeShippingThreshold}</Text>
                    </BlockStack>
                  </Grid.Cell>
                </Grid>
                <InlineStack gap="400" wrap={false}>
                  <Box minWidth="200px">
                    <BlockStack gap="200">
                      <Text variant="bodySm" as="p">Progress Bar Views</Text>
                      <Text variant="bodyMd" as="p">{analytics.shippingProgress.progressBarInteractions}</Text>
                    </BlockStack>
                  </Box>
                  <Box minWidth="200px">
                    <BlockStack gap="200">
                      <Text variant="bodySm" as="p">Conversions from Progress</Text>
                      <Text variant="bodyMd" as="p">{analytics.shippingProgress.conversionsFromProgress}</Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
