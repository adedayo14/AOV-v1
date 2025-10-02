// Ultra-simple test - no Polaris, no App Bridge, just raw Remix
export async function action() {
  console.log("=".repeat(80));
  console.log("[ULTRA SIMPLE] ACTION WAS HIT!");
  console.log("[ULTRA SIMPLE] Time:", new Date().toISOString());
  console.log("=".repeat(80));

  return new Response(
    JSON.stringify({
      success: true,
      message: "Ultra simple test worked!",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

export default function UltraSimpleTest() {
  return (
    <html>
      <head>
        <title>Ultra Simple Test</title>
        <style>{`
          body {
            font-family: system-ui, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
          }
          button {
            padding: 12px 24px;
            font-size: 16px;
            background: #5c6ac4;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          button:hover {
            background: #4a5aa8;
          }
          .result {
            margin-top: 20px;
            padding: 15px;
            background: #f0f0f0;
            border-radius: 4px;
          }
        `}</style>
      </head>
      <body>
        <h1>Ultra Simple POST Test</h1>
        <p>This has NO Shopify auth, NO Polaris, NO App Bridge.</p>
        <button id="testBtn">Test POST Request</button>
        <div id="result"></div>

        <script dangerouslySetInnerHTML={{__html: `
          document.getElementById('testBtn').addEventListener('click', async () => {
            console.log('[CLIENT] Button clicked');
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = 'Sending...';
            
            try {
              const response = await fetch('/ultra-simple-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: 'data' })
              });
              
              console.log('[CLIENT] Response status:', response.status);
              
              const data = await response.json();
              console.log('[CLIENT] Response data:', data);
              
              resultDiv.innerHTML = '<div class="result">✅ SUCCESS!<br>Message: ' + data.message + '<br>Time: ' + data.timestamp + '</div>';
            } catch (error) {
              console.error('[CLIENT] Error:', error);
              resultDiv.innerHTML = '<div class="result" style="background: #ffdddd;">❌ FAILED: ' + error.message + '</div>';
            }
          });
        `}} />
      </body>
    </html>
  );
}
