import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// GDPR: shop/redact - delete all store data that the app has stored
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);
  try {
    await db.settings.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
    // Optional tables cleanup
    await (db as any).cartEvent?.deleteMany?.({ where: { shop } }).catch(() => {});
  } catch (e) {
    // Ignore errors to ensure webhook 200s
  }
  return new Response();
};
