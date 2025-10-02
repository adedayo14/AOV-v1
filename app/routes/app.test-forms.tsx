import { useState, useCallback } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  BlockStack,
  Text,
  Button,
  Banner,
  Divider,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// Loader
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ message: "Form Test Page Loaded" });
};

// Action
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  console.log('[TEST FORMS ACTION] ✅ Action function called!');
  console.log('[TEST FORMS ACTION] Shop:', session.shop);

  const formData = await request.formData();
  const testData = formData.get("testData");
  
  console.log('[TEST FORMS ACTION] Received data:', testData);
  
  return json({ 
    success: true, 
    message: "Form submitted successfully!",
    receivedData: testData,
  });
};

export default function TestFormsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  
  const [testInput, setTestInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string>("");
  const [showBanner, setShowBanner] = useState(false);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setShowBanner(false);
    
    console.log('[TEST FORMS UI] 🚀 Submitting form with data:', testInput);
    
    try {
      const formData = new FormData();
      formData.append('testData', testInput);
      
      console.log('[TEST FORMS UI] Sending POST request to /app/test-forms');
      
      const response = await fetch('/app/test-forms', {
        method: 'POST',
        body: formData,
      });
      
      console.log('[TEST FORMS UI] Response status:', response.status);
      
      const data = await response.json();
      
      console.log('[TEST FORMS UI] Response data:', data);
      
      if (data.success) {
        setResult(`✅ SUCCESS! Server received: "${data.receivedData}"`);
        setShowBanner(true);
        shopify.toast.show("Form submitted successfully!");
      } else {
        setResult(`❌ FAILED: ${data.message}`);
        shopify.toast.show("Form submission failed", { isError: true });
      }
    } catch (error) {
      console.error('[TEST FORMS UI] ❌ Error:', error);
      setResult(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      shopify.toast.show("An error occurred", { isError: true });
    } finally {
      setIsSubmitting(false);
    }
  }, [testInput, shopify]);

  return (
    <Page>
      <TitleBar title="Form Submission Test" />
      
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              🧪 Test Form Submissions
            </Text>
            <Text as="p" variant="bodyMd">
              This page tests if form submissions are working correctly with Shopify App Bridge.
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Loader message: {loaderData.message}
            </Text>
          </BlockStack>
        </Card>

        {showBanner && (
          <Banner tone="success" onDismiss={() => setShowBanner(false)}>
            Form submitted successfully!
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">Test Form</Text>
            
            <FormLayout>
              <TextField
                label="Test Input"
                value={testInput}
                onChange={setTestInput}
                placeholder="Enter some test data..."
                autoComplete="off"
                helpText="Enter anything and click submit to test"
              />
              
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={!testInput.trim()}
              >
                {isSubmitting ? "Submitting..." : "Submit Test"}
              </Button>
            </FormLayout>
          </BlockStack>
        </Card>

        {result && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Result</Text>
              <Divider />
              <Text as="p" variant="bodyMd" fontWeight="bold">
                {result}
              </Text>
            </BlockStack>
          </Card>
        )}

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">📋 Testing Instructions</Text>
            <Divider />
            <Text as="p" variant="bodyMd">
              1. Enter some text in the input field above
            </Text>
            <Text as="p" variant="bodyMd">
              2. Click the "Submit Test" button
            </Text>
            <Text as="p" variant="bodyMd">
              3. Check the browser console (F12) for detailed logs
            </Text>
            <Text as="p" variant="bodyMd">
              4. Check the terminal/VS Code for server logs
            </Text>
            <Text as="p" variant="bodyMd">
              5. You should see a success banner and result message below
            </Text>
            <Divider />
            <Text as="p" variant="bodyMd" tone="subdued">
              If this works, all your other forms can be fixed using the same pattern.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
