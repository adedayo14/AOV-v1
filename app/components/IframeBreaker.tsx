import { useEffect } from "react";
import { ShopifyIframeManager } from "../utils/shopify-iframe-manager";

export function IframeBreaker() {
  useEffect(() => {
    // Use the robust iframe manager
    const manager = ShopifyIframeManager.getInstance();
    manager.initialize();

    // Listen for escape confirmation from parent
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.message === 'SHOPIFY_IFRAME_ESCAPED') {
        console.log('Successfully escaped iframe');
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return null;
}