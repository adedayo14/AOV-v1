import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  try {
    await authenticate.admin(request);
    
    // If authentication succeeds, redirect to the app
    return redirect("/app");
  } catch (error) {
    // If authentication fails, redirect to Shopify auth
    const shop = url.searchParams.get("shop");
    
    if (shop) {
      return redirect(`/auth?shop=${shop}`);
    }
    
    // No shop parameter, show error or redirect to Shopify
    return redirect("/auth");
  }
};