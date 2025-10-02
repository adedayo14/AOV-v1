import { useEffect } from "react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
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
  return json({ message: "Form Test Page Loaded Successfully" });
};

// Action
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  console.log('[TEST FORMS ACTION] ✅✅✅ Action function called!');
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
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  
  const isSubmitting = navigation.state === "submitting";

  // Handle action response
  useEffect(() => {
    if (actionData) {
      console.log('[TEST FORMS UI] ✅ Received action data:', actionData);
      if (actionData.success) {
        shopify.toast.show("✅ Form submitted successfully!");
      } else {
        shopify.toast.show("❌ Form submission failed", { isError: true });
      }
    }
  }, [actionData, shopify]);

  return (
    <Page>
      <TitleBar title="Form Submission Test" />
      
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">
              🧪 Test Form Submissions with Remix Form
            </Text>
            <Text as="p" variant="bodyMd">
              This page tests if form submissions are working correctly using Remix's native Form component.
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Loader message: {loaderData.message}
            </Text>
          </BlockStack>
        </Card>

        {actionData && (
          <Banner 
            tone={actionData.success ? "success" : "critical"}
            onDismiss={() => window.location.reload()}
          >
            {actionData.success 
              ? `✅ SUCCESS! Server received: "${actionData.receivedData}"`
              : `❌ FAILED: ${actionData.message}`
            }
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">Test Form</Text>
            
            <Form method="post">
              <FormLayout>
                <TextField
                  label="Test Input"
                  name="testData"
                  placeholder="Enter some test data..."
                  autoComplete="off"
                  helpText="Enter anything and click submit to test"
                />
                
                <Button
                  variant="primary"
                  submit
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Test"}
                </Button>
              </FormLayout>
            </Form>
          </BlockStack>
        </Card>

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
              4. Check the terminal/VS Code for server logs starting with [TEST FORMS ACTION]
            </Text>
            <Text as="p" variant="bodyMd">
              5. You should see a success banner and toast notification
            </Text>
            <Divider />
            <Text as="p" variant="bodyMd" tone="subdued">
              If this works, we know Remix Forms work correctly and can apply this pattern everywhere.
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">🔍 Current Status</Text>
            <Divider />
            <Text as="p" variant="bodyMd">
              Navigation State: <Text as="span" fontWeight="bold">{navigation.state}</Text>
            </Text>
            <Text as="p" variant="bodyMd">
              Is Submitting: <Text as="span" fontWeight="bold">{isSubmitting ? "Yes" : "No"}</Text>
            </Text>
            <Text as="p" variant="bodyMd">
              Action Data: <Text as="span" fontWeight="bold">{actionData ? "Received" : "None"}</Text>
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
