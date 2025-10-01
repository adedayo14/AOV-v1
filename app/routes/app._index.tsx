import { Page, Card, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function Index() {
  return (
    <Page>
      <TitleBar title="Welcome v2" />
      <Card>
        <Text as="p">
          Welcome to Cart Uplift v2. Select a page from the navigation to get started.
        </Text>
      </Card>
    </Page>
  );
}
