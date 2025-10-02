// This is a plain API route that bypasses all Remix/Shopify logic
export async function action() {
  console.log("=== SIMPLE API HIT ===");
  
  return new Response(
    JSON.stringify({
      success: true,
      message: "Simple API works!",
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

export async function loader() {
  return new Response("Simple API GET works", { status: 200 });
}
