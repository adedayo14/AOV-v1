// Enhanced iframe detection and escape utility
export class ShopifyIframeManager {
  private static instance: ShopifyIframeManager;
  private initialized = false;

  public static getInstance(): ShopifyIframeManager {
    if (!ShopifyIframeManager.instance) {
      ShopifyIframeManager.instance = new ShopifyIframeManager();
    }
    return ShopifyIframeManager.instance;
  }

  public initialize(): void {
    if (this.initialized || typeof window === 'undefined') return;
    
    this.initialized = true;
    this.setupIframeEscape();
    this.preventAdminIframeLoad();
    this.handleBeaconFailures();
  }

  private setupIframeEscape(): void {
    // Detect if we're in a blocked iframe
    const isBlocked = this.isIframeBlocked();
    
    if (isBlocked) {
      console.warn('Shopify admin iframe detected - implementing escape');
      this.executeIframeEscape();
    }
  }

  private isIframeBlocked(): boolean {
    try {
      // Check if we're in an iframe
      if (window.top === window.self) return false;
      
      // Try to access parent location - this will throw if blocked
      const parentUrl = window.top?.location?.href;
      
      // If we can access it, we're not blocked
      if (parentUrl) return false;
      
      // If we can't access it, we're likely blocked
      return true;
    } catch (error) {
      // Access blocked by X-Frame-Options
      return true;
    }
  }

  private executeIframeEscape(): void {
    // Strategy 1: Immediate redirect
    this.redirectToTopLevel();
    
    // Strategy 2: DOM manipulation
    setTimeout(() => this.manipulateDOM(), 100);
    
    // Strategy 3: PostMessage escape
    setTimeout(() => this.postMessageEscape(), 200);
    
    // Strategy 4: Force reload in top frame
    setTimeout(() => this.forceTopReload(), 500);
  }

  private redirectToTopLevel(): void {
    try {
      if (window.top && window.top.location) {
        window.top.location.href = window.location.href;
      }
    } catch (error) {
      // Fallback to self redirect
      window.location.replace(window.location.href);
    }
  }

  private manipulateDOM(): void {
    // Remove any existing refresh meta tags
    const existingMeta = document.querySelector('meta[http-equiv="refresh"]');
    if (existingMeta) existingMeta.remove();
    
    // Add new refresh meta tag
    const meta = document.createElement('meta');
    meta.httpEquiv = 'refresh';
    meta.content = `0; url=${window.location.href}`;
    document.head.appendChild(meta);
    
    // Also add base tag to prevent relative URL issues
    const base = document.createElement('base');
    base.target = '_top';
    document.head.appendChild(base);
  }

  private postMessageEscape(): void {
    const messages = [
      { message: 'SHOPIFY_IFRAME_ESCAPE', url: window.location.href },
      { message: 'Shopify.API.reauthorizeApplication' },
      { message: 'BREAK_IFRAME', target: window.location.href }
    ];

    messages.forEach(msg => {
      try {
        window.parent?.postMessage(msg, '*');
        window.top?.postMessage(msg, '*');
      } catch (error) {
        console.warn('PostMessage failed:', error);
      }
    });
  }

  private forceTopReload(): void {
    // Last resort: replace current window
    try {
      window.location.replace(window.location.href);
    } catch (error) {
      window.location.reload();
    }
  }

  private preventAdminIframeLoad(): void {
    // Prevent loading of admin.shopify.com resources in iframes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              this.checkAndBlockAdminResources(node);
            }
          });
        }
      });
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Also check existing elements
    this.checkAndBlockAdminResources(document.documentElement);
  }

  private checkAndBlockAdminResources(element: HTMLElement): void {
    // Block iframes pointing to admin.shopify.com
    const iframes = element.querySelectorAll('iframe[src*="admin.shopify.com"]');
    iframes.forEach((iframe) => {
      console.warn('Blocking admin.shopify.com iframe:', iframe);
      iframe.remove();
    });

    // Block scripts from admin.shopify.com that might cause issues
    const scripts = element.querySelectorAll('script[src*="admin.shopify.com"]');
    scripts.forEach((script) => {
      if (script instanceof HTMLScriptElement) {
        const src = script.src;
        if (src.includes('admin.shopify.com') && !src.includes('app-bridge')) {
          console.warn('Blocking problematic admin script:', src);
          script.remove();
        }
      }
    });
  }

  private handleBeaconFailures(): void {
    // Override navigator.sendBeacon to prevent failures
    if (window.navigator && window.navigator.sendBeacon) {
      const originalSendBeacon = window.navigator.sendBeacon.bind(window.navigator);
      
      window.navigator.sendBeacon = function(url: string | URL, data?: BodyInit | null): boolean {
        try {
          return originalSendBeacon(url, data);
        } catch (error) {
          console.warn('SendBeacon failed, ignoring:', error);
          return false; // Return false to indicate failure without throwing
        }
      };
    }

    // Also handle fetch requests to Shopify analytics
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const [resource] = args;
      const url = typeof resource === 'string' ? resource : 
                  resource instanceof URL ? resource.href : 
                  (resource as Request).url;
      
      if (url.includes('shopifycloud/web/assets') || url.includes('context-slice-metrics')) {
        // Suppress analytics requests that might cause beacon failures
        return Promise.resolve(new Response('', { status: 200 }));
      }
      
      return originalFetch.apply(this, args);
    };
  }
}

// Auto-initialize when imported
if (typeof window !== 'undefined') {
  const manager = ShopifyIframeManager.getInstance();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => manager.initialize());
  } else {
    manager.initialize();
  }
}