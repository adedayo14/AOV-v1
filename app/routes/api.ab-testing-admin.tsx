import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const formData = await request.formData();
    const intent = String(formData.get("intent") || "");

    if (intent === "create") {
      const name = String(formData.get("name") || "");
      const description = String(formData.get("description") || "");
      const testType = String(formData.get("testType") || "free_shipping");
      const trafficAllocation = Number(formData.get("trafficAllocation") || 100);
      const variantsRaw = String(formData.get("variants") || "[]");

      let variantsData: Array<any> = [];
      try {
        variantsData = JSON.parse(variantsRaw);
      } catch (e) {
        console.warn("[api.ab-testing-admin] Failed to parse variants JSON:", e);
        variantsData = [];
      }

      if (!name || variantsData.length < 2) {
        return json({ success: false, error: "Name and at least 2 variants are required" }, { status: 400 });
      }

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

      return json({ success: true, message: "Experiment created", experiment });
    }

    return json({ success: false, error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("[api.ab-testing-admin] error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
