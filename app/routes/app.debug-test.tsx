import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  Button,
  BlockStack,
  Text,
  Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  console.log("[DEBUG TEST LOADER] ✅ Loader called");
  return json({ message: "Loader works!" });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("[DEBUG TEST ACTION] 🔥🔥🔥 ACTION WAS CALLED!");
  
  try {
    const { session } = await authenticate.admin(request);
    console.log("[DEBUG TEST ACTION] ✅ Auth successful, shop:", session.shop);
    
    const formData = await request.formData();
    const testValue = formData.get('testValue');
    console.log("[DEBUG TEST ACTION] 📝 Received testValue:", testValue);
    
    // Just return immediately - don't do ANY database work
    console.log("[DEBUG TEST ACTION] ✅ Returning success");
    return json({ 
      success: true, 
      message: `Received: ${testValue}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[DEBUG TEST ACTION] ❌ Error:", error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
};

export default function DebugTest() {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";

  useEffect(() => {
    console.log("[DEBUG TEST COMPONENT] Fetcher state:", fetcher.state);
    console.log("[DEBUG TEST COMPONENT] Fetcher data:", fetcher.data);
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.state === "idle") {
      console.log("[DEBUG TEST COMPONENT] ✅ Success! Showing toast");
      const msg = 'message' in fetcher.data ? fetcher.data.message : "Success!";
      shopify.toast.show(msg);
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const handleTest = () => {
    console.log("[DEBUG TEST COMPONENT] 🚀 Button clicked, submitting...");
    const formData = new FormData();
    formData.append('testValue', 'Hello from debug test!');
    fetcher.submit(formData, { method: "POST" });
    console.log("[DEBUG TEST COMPONENT] 📤 Submit called");
  };

  const showError = fetcher.data && 'error' in fetcher.data;

  return (
    <Page>
      <TitleBar title="Debug Test - Minimal Form" />
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Debug Form Submission Test
            </Text>
            
            <Text as="p" variant="bodyMd">
              This page tests the absolute minimum form submission with useFetcher.
              Check the browser console and Vercel logs for debug output.
            </Text>

            {showError && fetcher.data && 'error' in fetcher.data && (
              <Banner tone="critical" title="Error">
                <p>{fetcher.data.error}</p>
              </Banner>
            )}

            {fetcher.data?.success && 'message' in fetcher.data && (
              <Banner tone="success" title="Success!">
                <p>{fetcher.data.message}</p>
                {'timestamp' in fetcher.data && <p>Timestamp: {fetcher.data.timestamp}</p>}
              </Banner>
            )}

            <BlockStack gap="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Current fetcher state: <strong>{fetcher.state}</strong>
              </Text>
              
              <Button 
                variant="primary" 
                onClick={handleTest}
                loading={isLoading}
              >
                {isLoading ? "Testing..." : "Test Form Submission"}
              </Button>
            </BlockStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h3" variant="headingMd">
              What should happen:
            </Text>
            <Text as="p" variant="bodyMd">
              1. Click the button above<br/>
              2. Button shows "Testing..." with loading spinner<br/>
              3. Within 1-2 seconds: Green success banner appears<br/>
              4. Toast notification shows "Received: Hello from debug test!"<br/>
              5. Console shows all debug logs
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
