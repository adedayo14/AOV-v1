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

    if (action === 'update') {
      const experimentId = Number(jsonData.experimentId);
      const exp = jsonData.experiment || {};
      const variants = (jsonData.variants || []) as Array<any>;
      console.log("[api.ab-testing-admin] Updating experiment:", experimentId);

      if (!experimentId) {
        return json({ success: false, error: 'experimentId is required' }, { status: 400 });
      }

      if (variants && variants.length > 0) {
        const sumPct = variants.reduce((acc, v) => acc + Number(v.trafficPercentage || 0), 0);
        if (sumPct !== 100) {
          return json({ success: false, error: 'Variant traffic must sum to 100' }, { status: 400 });
        }
      }

      // Update experiment metadata (only provided fields)
      const expData: any = {};
      if (typeof exp.name === 'string') expData.name = exp.name;
      if (typeof exp.description !== 'undefined') expData.description = exp.description ?? null;
      if (typeof exp.status === 'string') expData.status = exp.status;
      if (typeof exp.trafficAllocationPct !== 'undefined') expData.trafficAllocation = Number(exp.trafficAllocationPct);
      if (typeof exp.primaryMetric === 'string') expData.primaryMetric = exp.primaryMetric;
      if (typeof exp.confidenceLevelPct !== 'undefined') expData.confidenceLevel = Number(exp.confidenceLevelPct) / 100;
      if (typeof exp.minSampleSize !== 'undefined') expData.minSampleSize = Number(exp.minSampleSize);
      if (typeof exp.startDate !== 'undefined') expData.startDate = exp.startDate ? new Date(exp.startDate) : null;
      if (typeof exp.endDate !== 'undefined') expData.endDate = exp.endDate ? new Date(exp.endDate) : null;

      if (Object.keys(expData).length > 0) {
        await prisma.aBExperiment.update({
          where: { id: experimentId },
          data: expData,
        });
      }

      // Update variants if provided
      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          if (!v.id) continue;
          const data: any = {};
          if (typeof v.name === 'string') data.name = v.name;
          if (typeof v.description !== 'undefined') data.description = v.description ?? null;
          if (typeof v.isControl !== 'undefined') data.isControl = !!v.isControl;
          if (typeof v.trafficPercentage !== 'undefined') data.trafficPercentage = Number(v.trafficPercentage);
          if (typeof v.config !== 'undefined') data.configData = JSON.stringify(v.config || {});

          if (Object.keys(data).length > 0) {
            await prisma.aBVariant.update({
              where: { id: Number(v.id) },
              data,
            });
          }
        }
      }

      console.log("[api.ab-testing-admin] Experiment updated successfully");
      return json({ success: true, message: 'Experiment updated' });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("[api.ab-testing-admin] Error:", error);
    return json({ success: false, error: String(error) }, { status: 500 });
  }
}
