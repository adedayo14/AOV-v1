import { useState } from "react";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, TextField, Button, BlockStack, Text } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ message: "Input test page loaded" });
};

export default function InputTest() {
  const data = useLoaderData<typeof loader>();
  const [value, setValue] = useState("");
  return (
    <Page>
      <TitleBar title="Input Test" />
      <BlockStack gap="500">
        <Card>
          <Text variant="headingMd" as="h2">Minimal Input Test</Text>
          <Text as="p" variant="bodyMd" tone="subdued">{data.message}</Text>
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
