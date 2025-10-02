import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { Page, Card, Button, BlockStack, Text, Banner } from "@shopify/polaris";
import { useEffect } from "react";

// NO AUTHENTICATION - Just log and return
export const action = async ({ request }: ActionFunctionArgs) => {
  const timestamp = new Date().toISOString();
  
  console.log("="

.repeat(80));
  console.log(`[NO AUTH TEST] 🎯 ACTION HIT! Time: ${timestamp}`);
  console.log(`[NO AUTH TEST] Method: ${request.method}`);
  console.log(`[NO AUTH TEST] URL: ${request.url}`);
  console.log(`[NO AUTH TEST] Headers:`, Object.fromEntries(request.headers.entries()));
  console.log("=".repeat(80));

  return json({
    success: true,
    message: "Action reached WITHOUT authentication!",
    timestamp,
    method: request.method,
    url: request.url,
  });
};

export default function NoAuthTest() {
  const fetcher = useFetcher<typeof action>();

  const handleTest = () => {
    console.log("[NO AUTH TEST CLIENT] 🚀 Submitting...");
    fetcher.submit({}, { method: "POST" });
  };

  useEffect(() => {
    console.log("[NO AUTH TEST CLIENT] Fetcher state:", fetcher.state);
    console.log("[NO AUTH TEST CLIENT] Fetcher data:", fetcher.data);
    
    if (fetcher.data?.success) {
      console.log("[NO AUTH TEST CLIENT] ✅ SUCCESS!", fetcher.data);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <Page title="No Auth Test">
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Test WITHOUT Authentication
            </Text>
            <Text as="p" variant="bodyMd">
              This bypasses `authenticate.admin()` completely to see if POST requests work at all.
            </Text>

            <Button
              variant="primary"
              onClick={handleTest}
              loading={fetcher.state === "submitting"}
            >
              Test POST (No Auth)
            </Button>

            <Text as="p" variant="bodySm" tone="subdued">
              Fetcher state: <strong>{fetcher.state}</strong>
            </Text>
          </BlockStack>
        </Card>

        {fetcher.data?.success && (
          <Banner tone="success" title="SUCCESS!">
            <BlockStack gap="200">
              <Text as="p">{fetcher.data.message}</Text>
              <Text as="p" variant="bodySm">Timestamp: {fetcher.data.timestamp}</Text>
              <Text as="p" variant="bodySm">Method: {fetcher.data.method}</Text>
              <Text as="p" variant="bodySm">URL: {fetcher.data.url}</Text>
            </BlockStack>
          </Banner>
        )}
      </BlockStack>
    </Page>
  );
}
