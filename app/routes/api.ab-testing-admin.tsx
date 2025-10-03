import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  console.log("[api.ab-testing-admin] === ACTION STARTED ===");
  console.log("[api.ab-testing-admin] Method:", request.method);
  console.log("[api.ab-testing-admin] URL:", request.url);
  console.log("[api.ab-testing-admin] Content-Type:", request.headers.get('content-type'));
  
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;
    const jsonData: any = await request.json().catch(() => ({}));
    console.log("[api.ab-testing-admin] Authenticated shop:", shop);
    console.log("[api.ab-testing-admin] Full JSON payload:", jsonData);

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
      const sumPct = variants.reduce((acc, v) => acc + Number(v.trafficPercentage ?? 0), 0);
      if (sumPct !== 100) {
        return json({ success: false, error: 'Variant traffic must sum to 100' }, { status: 400 });
      }

      const created = await prisma.experiment.create({
        data: {
          shopId: shop,
          name: String(exp.name ?? 'Untitled Experiment'),
          status: exp.status ?? 'running',
          startDate: exp.startDate ? new Date(exp.startDate) : new Date(),
          endDate: exp.endDate ? new Date(exp.endDate) : null,
          attribution: exp.attributionWindow ?? 'session',
        },
      });

      await prisma.variant.createMany({
        data: variants.map((v: any, idx: number) => ({
          experimentId: created.id,
          name: String(v.name ?? (idx === 0 ? 'Control' : `Variant ${idx}`)),
          isControl: Boolean(v.isControl ?? idx === 0),
          discountPct: new Prisma.Decimal(v.discountPct ?? 0),
          trafficPct: new Prisma.Decimal((v.trafficPct ?? v.trafficPercentage) ?? 0),
        })),
      });

      console.log("[api.ab-testing-admin] Experiment created successfully:", created.id);
      return json({ success: true, experimentId: created.id });
    }
    
    if (action === 'delete') {
      const experimentId = Number(jsonData.experimentId);
      console.log("[api.ab-testing-admin] Deleting experiment:", experimentId);
      
      await prisma.experiment.delete({
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
        const sumPct = variants.reduce((acc, v) => acc + Number((v.trafficPct ?? v.trafficPercentage) || 0), 0);
        if (sumPct !== 100) {
          return json({ success: false, error: 'Variant traffic must sum to 100' }, { status: 400 });
        }
      }

      // Update experiment metadata (only fields that exist on lean schema)
      const expData: Record<string, unknown> = {};
      if (typeof exp.name === 'string') expData.name = exp.name;
      if (typeof exp.status === 'string') expData.status = exp.status;
      if (typeof exp.startDate !== 'undefined') expData.startDate = exp.startDate ? new Date(exp.startDate) : null;
      if (typeof exp.endDate !== 'undefined') expData.endDate = exp.endDate ? new Date(exp.endDate) : null;
      if (typeof exp.attributionWindow === 'string') expData.attribution = exp.attributionWindow;
      if (typeof exp.activeVariantId !== 'undefined') expData.activeVariantId = exp.activeVariantId ?? null;

      if (Object.keys(expData).length > 0) {
        await prisma.experiment.update({
          where: { id: experimentId },
          data: expData,
        });
      }

      // Update variants if provided
      if (Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          if (!v.id) continue;
          const data: Record<string, unknown> = {};
          if (typeof v.name === 'string') data.name = v.name;
          if (typeof v.isControl !== 'undefined') data.isControl = !!v.isControl;
          if (typeof v.trafficPct !== 'undefined') data.trafficPct = new Prisma.Decimal(v.trafficPct);
          else if (typeof v.trafficPercentage !== 'undefined') data.trafficPct = new Prisma.Decimal(v.trafficPercentage);
          if (typeof v.discountPct !== 'undefined') data.discountPct = new Prisma.Decimal(v.discountPct);

          if (Object.keys(data).length > 0) {
            await prisma.variant.update({
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
