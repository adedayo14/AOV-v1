import { json } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";
import db from "../db.server";

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return json({ error: "Shop parameter required" }, { status: 400 });
    }

    // Update the shipping bar color to black for this shop
    await db.settings.updateMany({
      where: { 
        shop: shop
      },
      data: {
        shippingBarColor: "#121212"
      }
    });

    return json({ success: true, message: "Shipping bar color reset to black" });
  } catch (error) {
    console.error("Error resetting shipping color:", error);
    return json({ error: "Failed to reset shipping color" }, { status: 500 });
  }
};
