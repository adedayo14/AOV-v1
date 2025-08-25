import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  List,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
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
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
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
                    <Button variant="primary">General Settings</Button>
                  </Link>
                  <Link to="/app/cart-drawer">
                    <Button>Dashboard</Button>
                  </Link>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Quick Setup
                  </Text>
                  <Text variant="bodyMd" as="p">
                    1. Go to your theme editor
                  </Text>
                  <Text variant="bodyMd" as="p">
                    2. Enable the "UpCart Cart Drawer" app embed
                  </Text>
                  <Text variant="bodyMd" as="p">
                    3. Configure settings in this app
                  </Text>
                  <Text variant="bodyMd" as="p">
                    4. Save and preview!
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Features
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Increase conversion rates
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Boost average order value
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Improve user experience
                  </Text>
                  <Text variant="bodyMd" as="p">
                    • Drive more sales
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
        
        {fetcher.data?.product && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Product Created Successfully!
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Your sample product "{fetcher.data.product.title}" has been created.
                  </Text>
                  <Box>
                    <Button
                      url={`shopify:admin/products/${productId}`}
                      target="_blank"
                    >
                      View Product in Admin
                    </Button>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>
    </Page>
  );
}