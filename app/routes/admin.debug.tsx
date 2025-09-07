import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    return json({
      status: "admin route reached",
      params: {
        shop: searchParams.get('shop'),
        host: searchParams.get('host'),
        hasHmac: !!searchParams.get('hmac'),
        hasIdToken: !!searchParams.get('id_token'),
        hasTimestamp: !!searchParams.get('timestamp')
      },
      url: request.url
    });
  } catch (error) {
    return json({ 
      status: "error in admin route", 
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
