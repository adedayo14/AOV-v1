import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  List,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
          handle: `${color.toLowerCase()}-snowboard`,
          status: "ACTIVE",
          variants: [
            {
              price: "10.00",
              inventoryQuantity: 100,
              requiresShipping: true,
            },
          ],
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data?.productCreate?.product;
  const userErrors = responseJson.data?.productCreate?.userErrors;

  return json({ product, userErrors });
};

export default function Index() {
  return (
    <Page>
      <TitleBar title="UpCart - Cart Drawer App" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Welcome to UpCart Cart Drawer 🛒
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Transform your store's cart experience with our powerful cart drawer that includes:
                  </Text>
                  <List>
                    <List.Item>Sticky cart button for easy access</List.Item>
                    <List.Item>Free shipping progress bar</List.Item>
                    <List.Item>Smart upsells and cross-sells</List.Item>
                    <List.Item>Fully customizable design</List.Item>
                    <List.Item>Mobile responsive</List.Item>
                  </List>
                </BlockStack>
                <InlineStack gap="300">
                  <Link to="/app/settings">
                    <Button variant="primary">Settings & Preview</Button>
                  </Link>
                  <Link to="/app/dashboard">
                    <Button>Dashboard & Analytics</Button>
                  </Link>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    🚀 Quick Setup Guide
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Follow these steps to enable your cart drawer:
                  </Text>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p">
                      <strong>1.</strong> Go to your theme editor
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>2.</strong> Click on "App embeds" in the left sidebar
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>3.</strong> Find "UpCart Cart Drawer" and toggle it on
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>4.</strong> Configure your settings in the Settings tab
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>5.</strong> Save your theme
                    </Text>
                  </BlockStack>
                  <Text variant="bodyMd" as="p" tone="success">
                    ✅ Make sure the app embed is enabled in your theme editor first.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    ⚡ Theme Embed Settings
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Frequently Used - Available in your theme customizer for quick access:
                  </Text>
                  <List>
                    <List.Item>Auto-open cart on add - Behavior setting</List.Item>
                    <List.Item>Free shipping progress - Enable/disable</List.Item>
                    <List.Item>Free shipping threshold - Dollar amount</List.Item>
                    <List.Item>Button & accent color - Color picker</List.Item>
                    <List.Item>Text color - Color picker</List.Item>
                    <List.Item>Recommendation layout - Layout options</List.Item>
                  </List>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    💡 <strong>Tip:</strong> Use the theme customizer for quick styling changes, and the Settings page for detailed configuration.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    📈 Key Benefits
                  </Text>
                  <List>
                    <List.Item>Increase conversion rates</List.Item>
                    <List.Item>Boost average order value</List.Item>
                    <List.Item>Improve user experience</List.Item>
                    <List.Item>Drive more sales</List.Item>
                    <List.Item>Reduce cart abandonment</List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
