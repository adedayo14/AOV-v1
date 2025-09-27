import { useEffect } from "react";

export function IframeBreaker() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Check if we're in an iframe and if parent is accessible
    const isInIframe = window.top !== window.self;
    
    if (isInIframe) {
      try {
        // Try to access parent - this will fail if X-Frame-Options blocks it
        const parentUrl = window.top?.location.href;
        
        // If we can access parent URL, we're in a valid iframe context
        if (parentUrl) {
          console.log('Valid iframe context detected');
          return;
        }
      } catch (error) {
        // X-Frame-Options is blocking access to parent
        console.warn('X-Frame-Options detected, attempting iframe escape');
        
        // Try different escape strategies
        
        // Strategy 1: Use meta refresh to break out
        const meta = document.createElement('meta');
        meta.httpEquiv = 'refresh';
        meta.content = '0; url=' + window.location.href;
        document.head.appendChild(meta);
        
        // Strategy 2: Use JavaScript to break out
        setTimeout(() => {
          try {
            if (window.top && window.top.location) {
              window.top.location.href = window.location.href;
            }
          } catch (e) {
            // If that fails, replace current window
            window.location.replace(window.location.href);
          }
        }, 100);
        
        // Strategy 3: Post message to parent requesting navigation
        try {
          window.parent.postMessage({
            message: 'SHOPIFY_IFRAME_ESCAPE',
            url: window.location.href
          }, '*');
        } catch (e) {
          console.warn('Could not post message to parent');
        }
      }
    }

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