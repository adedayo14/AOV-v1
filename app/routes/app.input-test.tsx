import { useState } from "react";
import { Page, Card, TextField, Button, BlockStack, Text } from "@shopify/polaris";

export default function InputTest() {
  const [value, setValue] = useState("");
  return (
    <Page>
      <BlockStack gap="500">
        <Card>
          <Text variant="headingMd" as="h2">Minimal Input Test</Text>
          <Text as="p" variant="bodyMd">If you can type in the box below, React and Polaris are working.</Text>
          <TextField
            label="Type here"
            value={value}
            onChange={setValue}
            autoComplete="off"
            placeholder="Try typing..."
          />
          <Button onClick={() => alert(`Value: ${value}`)}>Show Value</Button>
        </Card>
      </BlockStack>
    </Page>
  );
}
