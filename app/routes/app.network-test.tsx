import { useState } from "react";
import { Page, Card, Button, BlockStack, Text, Banner } from "@shopify/polaris";

export default function NetworkTest() {
  const [result, setResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const testRawEndpoint = async () => {
    setIsLoading(true);
    setResult("");
    setError("");

    try {
      console.log("[NETWORK TEST] Testing raw-test endpoint...");
      
      const response = await fetch('https://cartuplift.vercel.app/raw-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data from network test page' })
      });

      console.log("[NETWORK TEST] Response status:", response.status);
      
      const data = await response.json();
      console.log("[NETWORK TEST] Response data:", data);
      
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("[NETWORK TEST] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const testDebugEndpoint = async () => {
    setIsLoading(true);
    setResult("");
    setError("");

    try {
      console.log("[NETWORK TEST] Testing app/debug-test endpoint...");
      
      const formData = new FormData();
      formData.append('testValue', 'Hello from network test!');
      
      const response = await fetch('https://cartuplift.vercel.app/app/debug-test', {
        method: 'POST',
        body: formData
      });

      console.log("[NETWORK TEST] Response status:", response.status);
      console.log("[NETWORK TEST] Response headers:", Object.fromEntries(response.headers));
      
      const text = await response.text();
      console.log("[NETWORK TEST] Response text:", text);
      
      try {
        const data = JSON.parse(text);
        setResult(JSON.stringify(data, null, 2));
      } catch {
        setResult(`Raw response:\n${text}`);
      }
    } catch (err) {
      console.error("[NETWORK TEST] Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Page title="Network Connectivity Test">
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Test 1: Raw Endpoint (No Auth)
            </Text>
            <Text as="p" variant="bodyMd">
              This tests if POST requests work at all on Vercel.
            </Text>
            <Button 
              onClick={testRawEndpoint} 
              loading={isLoading}
              variant="primary"
            >
              Test Raw Endpoint
            </Button>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Test 2: Debug Test Endpoint (With Auth)
            </Text>
            <Text as="p" variant="bodyMd">
              This tests if POST requests work with Shopify authentication.
            </Text>
            <Button 
              onClick={testDebugEndpoint} 
              loading={isLoading}
            >
              Test Debug Endpoint
            </Button>
          </BlockStack>
        </Card>

        {error && (
          <Banner tone="critical" title="Error">
            <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
          </Banner>
        )}

        {result && (
          <Banner tone="success" title="Success!">
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{result}</pre>
          </Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <Text as="h3" variant="headingMd">
              Instructions
            </Text>
            <Text as="p" variant="bodyMd">
              1. Open browser console (F12)<br/>
              2. Click "Test Raw Endpoint" button above<br/>
              3. Check console for logs<br/>
              4. Look for success or error message below
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
