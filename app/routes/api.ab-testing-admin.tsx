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
    let jsonData: any = null;
    
    // Always expect JSON (like Settings does)
    if (contentType?.includes('application/json')) {
      jsonData = await request.json();
      shop = jsonData.shop;
      console.log("[api.ab-testing-admin] Using shop from JSON data:", shop);
      console.log("[api.ab-testing-admin] Full JSON payload:", jsonData);
    } else {
      // Fallback to authentication (will hang)
      console.log("[api.ab-testing-admin] No JSON, authenticating (will likely hang)...");
      const { session } = await authenticate.admin(request);
      shop = session.shop;
    }

    // Handle actions
    const action = jsonData?.action;
    console.log("[api.ab-testing-admin] Action:", action);
    
    if (action === 'create') {
      const name = jsonData.name;
      console.log("[api.ab-testing-admin] Creating experiment:", name);
      
      const experiment = await prisma.aBExperiment.create({
        data: {
          shopId: shop,
          name: name,
          description: '',
          testType: 'discount',
          status: 'draft',
          trafficAllocation: 100,
        },
      });
      
      console.log("[api.ab-testing-admin] Experiment created successfully:", experiment.id);
      return json({ success: true, experiment });
    }
    
    if (action === 'delete') {
      const experimentId = Number(jsonData.experimentId);
      console.log("[api.ab-testing-admin] Deleting experiment:", experimentId);
      
      await prisma.aBExperiment.delete({
        where: { id: experimentId }
      });
      
      console.log("[api.ab-testing-admin] Experiment deleted successfully");
      return json({ success: true, message: "Experiment deleted" });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("[api.ab-testing-admin] Error:", error);
    return json({ success: false, error: String(error) }, { status: 500 });
  }
}
