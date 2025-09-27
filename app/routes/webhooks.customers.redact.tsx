import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// GDPR: customers/redact - delete customer data. We don't store PII; best-effort cleanup of analytics rows by shop if any.
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.webhook(request);
  // No PII stored; ensure any customer-linked analytics are removed if implemented in future.
  try {
    // Example cleanup if a cartEvent table exists and had customerId (we don't currently).
    // await (db as any).cartEvent.deleteMany({ where: { shop, customerId: payload.customer?.id } })
  } catch (_e) {
    /* No-op */
  }
  return new Response();
};
