declare module '@shopify/app-bridge-utils' {
  export function authenticatedFetch(
    app: any
  ): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}
