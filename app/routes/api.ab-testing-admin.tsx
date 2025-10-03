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
      console.log("[api.ab-testing-admin] Creating experiment (rich payload)");
      const exp = jsonData.experiment;
      const variants = jsonData.variants as Array<any>;

      if (!exp || !variants || variants.length < 2) {
        return json({ success: false, error: 'Invalid payload: experiment and 2 variants required' }, { status: 400 });
      }

      // Validate variant traffic sums to 100
      const sumPct = variants.reduce((acc, v) => acc + Number(v.trafficPercentage || 0), 0);
      if (sumPct !== 100) {
        return json({ success: false, error: 'Variant traffic must sum to 100' }, { status: 400 });
      }

      // Map inputs to Prisma fields (Decimal-capable fields will accept numbers)
      const created = await prisma.aBExperiment.create({
        data: {
          shopId: shop,
          name: String(exp.name),
          description: exp.description ?? null,
          testType: String(exp.testType || 'discount'),
          status: String(exp.status || 'draft'),
          trafficAllocation: Number(exp.trafficAllocationPct ?? 100),
          startDate: exp.startDate ? new Date(exp.startDate) : null,
          endDate: exp.endDate ? new Date(exp.endDate) : null,
          primaryMetric: String(exp.primaryMetric || 'conversion_rate'),
          confidenceLevel: Number(exp.confidenceLevelPct ?? 95) / 100, // store as decimal 0-1
          minSampleSize: Number(exp.minSampleSize ?? 100),
        },
      });

      // Insert variants
      for (const v of variants) {
        const cfg = v.config || {};
        await prisma.aBVariant.create({
          data: {
            experimentId: created.id,
            name: String(v.name),
            description: v.description ?? null,
            isControl: Boolean(v.isControl),
            trafficPercentage: Number(v.trafficPercentage),
            configData: JSON.stringify(cfg),
          },
        });
      }

      console.log("[api.ab-testing-admin] Experiment created successfully:", created.id);
      return json({ success: true, experimentId: created.id });
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
