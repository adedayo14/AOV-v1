import { Page, Card, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function ABTesting() {
  return (
    <Page>
      <TitleBar title="A/B Testing v2" />
      <Card>
        <Text as="p">This is the A/B testing page. Navigation is working!</Text>
      </Card>
    </Page>
  );
}