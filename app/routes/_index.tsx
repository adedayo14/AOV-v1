import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

// Redirect any visit to the root (/) to the embedded app layout at /app
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  url.pathname = "/app";
  return redirect(url.toString());
};

export default function RedirectToAdmin() {
  return null;
}
