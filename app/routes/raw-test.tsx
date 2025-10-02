import type { ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  console.log("=".repeat(80));
  console.log("[RAW TEST] ACTION CALLED!");
  console.log("[RAW TEST] Method:", request.method);
  console.log("[RAW TEST] URL:", request.url);
  console.log("[RAW TEST] Headers:", Object.fromEntries(request.headers));
  console.log("=".repeat(80));

  return new Response(
    JSON.stringify({
      success: true,
      message: "Raw test worked!",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function loader() {
  console.log("[RAW TEST] LOADER CALLED - Page Load");
  return new Response("Raw test loader works", { status: 200 });
}
