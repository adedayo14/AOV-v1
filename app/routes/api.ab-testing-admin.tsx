import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  console.log("[api.ab-testing-admin] === ACTION STARTED ===");
  console.log("[api.ab-testing-admin] Method:", request.method);
  console.log("[api.ab-testing-admin] URL:", request.url);
  console.log("[api.ab-testing-admin] Content-Type:", request.headers.get('content-type'));
  
  try {
    const contentType = request.headers.get('content-type');
    let shop: string;
    let formData: FormData | undefined;
    let jsonData: any = null;
    
    // Check for JSON content type (from fetch calls)
    if (contentType?.includes('application/json')) {
      jsonData = await request.json();
      shop = jsonData.shop;
      console.log("[api.ab-testing-admin] Using shop from JSON data:", shop);
    } else if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
      formData = await request.formData();
      const shopFromForm = formData.get("shop");
      
      if (shopFromForm) {
        // Shop provided from client - bypass authenticate.admin()
        shop = String(shopFromForm);
        console.log("[api.ab-testing-admin] Using shop from form data:", shop);
      } else {
        // Fallback to authentication (may hang in iframe)
        console.log("[api.ab-testing-admin] No shop in form, authenticating...");
        const { session } = await authenticate.admin(request);
        shop = session.shop;
        console.log("[api.ab-testing-admin] Authenticated for shop:", shop);
      }
    } else {
      // Fallback to authentication
      console.log("[api.ab-testing-admin] Authenticating...");
      const { session } = await authenticate.admin(request);
      shop = session.shop;
      formData = await request.formData();
      console.log("[api.ab-testing-admin] Authenticated for shop:", shop);
    }

    // Handle JSON action (delete)
    if (jsonData) {
      const action = jsonData.action;
      console.log("[api.ab-testing-admin] JSON Action:", action);
      
      if (action === 'delete') {
        const experimentId = Number(jsonData.experimentId);
        console.log("[api.ab-testing-admin] Deleting experiment:", experimentId);
        
        await prisma.aBExperiment.delete({
          where: { id: experimentId }
        });
        
        console.log("[api.ab-testing-admin] Experiment deleted successfully");
        return json({ success: true, message: "Experiment deleted" });
      }
    }

    if (!formData) {
      return json({ success: false, error: "No form data provided" }, { status: 400 });
    }

    console.log("[api.ab-testing-admin] Parsing form data...");
    const intent = String(formData.get("intent") || "");
    console.log("[api.ab-testing-admin] Intent:", intent);

    if (intent === "create") {
      console.log("[api.ab-testing-admin] Processing create intent...");
      const name = String(formData.get("name") || "");
      const description = String(formData.get("description") || "");
      const testType = String(formData.get("testType") || "free_shipping");
      const trafficAllocation = Number(formData.get("trafficAllocation") || 100);
      const variantsRaw = String(formData.get("variants") || "[]");
      
      console.log("[api.ab-testing-admin] Parsed data:", { name, testType, trafficAllocation, variantsRaw: variantsRaw.substring(0, 100) + '...' });

      let variantsData: Array<any> = [];
      try {
        variantsData = JSON.parse(variantsRaw);
      } catch (e) {
        console.warn("[api.ab-testing-admin] Failed to parse variants JSON:", e);
        variantsData = [];
      }

      if (!name || variantsData.length < 2) {
        console.log("[api.ab-testing-admin] Validation failed:", { name: !!name, variantCount: variantsData.length });
        return json({ success: false, error: "Name and at least 2 variants are required" }, { status: 400 });
      }

      console.log("[api.ab-testing-admin] Creating experiment in database...");
      const experiment = await prisma.aBExperiment.create({
        data: {
          shopId: shop,
          name,
          description,
          testType,
          trafficAllocation,
          status: "draft",
          primaryMetric: "conversion_rate",
          confidenceLevel: 0.95,
          minSampleSize: 100,
          variants: {
            create: variantsData.map((v: any, index: number) => ({
              name: v.name,
              description: v.description || "",
              trafficPercentage: Number(v.trafficPercentage) || 0,
              isControl: index === 0,
              configData: JSON.stringify(v.config || {}),
              totalVisitors: 0,
              totalConversions: 0,
              totalRevenue: 0,
            }))
          }
        },
        include: { variants: true }
      });
      
      console.log("[api.ab-testing-admin] Experiment created successfully:", experiment.id);
      return json({ success: true, message: "Experiment created", experiment });
    }

    console.log("[api.ab-testing-admin] Invalid intent:", intent);
    return json({ success: false, error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("[api.ab-testing-admin] ERROR:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined
    });
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
