import { Page, Card, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

export default function Settings() {
  return (
    <Page>
      <TitleBar title="Settings v2" />
      <Card>
        <Text as="p">This is the settings page. Navigation is working!</Text>
      </Card>
    </Page>
  );
}