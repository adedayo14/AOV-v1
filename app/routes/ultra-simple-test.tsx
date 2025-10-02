import { useState } from "react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  console.log("=".repeat(80));
  console.log("[ULTRA SIMPLE] ACTION WAS HIT!");
  console.log("[ULTRA SIMPLE] Time:", new Date().toISOString());
  console.log("=".repeat(80));

  return json({
    success: true,
    message: "Ultra simple test worked!",
    timestamp: new Date().toISOString(),
  });
}

export default function UltraSimpleTest() {
  const [result, setResult] = useState<string>("");

  const handleClick = async () => {
    console.log("[CLIENT] Button clicked");
    setResult("Sending...");

    try {
      // Add ?_data parameter to get JSON response instead of HTML
      const response = await fetch("/ultra-simple-test?_data=routes/ultra-simple-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: "data" }),
      });

      console.log("[CLIENT] Response status:", response.status);
      console.log("[CLIENT] Response headers:", Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log("[CLIENT] Response text (first 500 chars):", responseText.substring(0, 500));

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("[CLIENT] Response data:", data);
        setResult(
          `✅ SUCCESS!\nMessage: ${data.message}\nTime: ${data.timestamp}`
        );
      } catch (parseError) {
        console.error("[CLIENT] JSON parse error:", parseError);
        setResult(`❌ FAILED: Got HTML instead of JSON\nStatus: ${response.status}\nResponse: ${responseText.substring(0, 200)}`);
      }
    } catch (error: any) {
      console.error("[CLIENT] Error:", error);
      setResult(`❌ FAILED: ${error.message}`);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "600px", margin: "50px auto", padding: "20px" }}>
      <h1>Ultra Simple POST Test</h1>
      <p>This has NO Shopify auth, NO Polaris, NO App Bridge.</p>
      <button
        onClick={handleClick}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          background: "#5c6ac4",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Test POST Request
      </button>
      {result && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: result.includes("FAILED") ? "#ffdddd" : "#f0f0f0",
            borderRadius: "4px",
            whiteSpace: "pre-wrap",
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
}
