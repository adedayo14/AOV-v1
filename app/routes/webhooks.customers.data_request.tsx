import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// GDPR: customers/data_request - provide customer data if stored. We don't store PII, so we acknowledge.
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.webhook(request);
  // If we ever store customer-level data, collect and return to Shopify via their channel.
  return new Response();
};
