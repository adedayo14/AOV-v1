import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop as string;

    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    const body = await request.json().catch(() => null) as { experimentId?: number; winnerVariantId?: number } | null;
    if (!body || !body.experimentId || !body.winnerVariantId) {
      return json({ success: false, error: "experimentId and winnerVariantId are required" }, { status: 400 });
    }

    const experiment = await prisma.experiment.findFirst({
      where: { id: Number(body.experimentId), shopId: shop },
      include: { variants: true },
    });
    if (!experiment) {
      return json({ success: false, error: "Experiment not found" }, { status: 404 });
    }

    const winner = experiment.variants.find((v) => v.id === Number(body.winnerVariantId));
    if (!winner) {
      return json({ success: false, error: "Winner variant not found for this experiment" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Set winner traffic to 100 and others to 0
      for (const v of experiment.variants) {
        await tx.variant.update({
          where: { id: v.id },
          data: { trafficPct: new Prisma.Decimal(v.id === winner.id ? 100 : 0) },
        });
      }
      // Mark experiment completed and set activeVariantId
      await tx.experiment.update({
        where: { id: experiment.id },
        data: { activeVariantId: winner.id, status: "completed" },
      });
    });

    return json({ success: true });
  } catch (error) {
    console.error("[api.ab-rollout] error", error);
    return json({ success: false, error: "Server error" }, { status: 500 });
  }
}
