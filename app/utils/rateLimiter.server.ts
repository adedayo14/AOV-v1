import { LRUCache } from 'lru-cache';

const rateLimitCache = new LRUCache<string, number>({
  max: 500,
  ttl: 60 * 1000, // 1 minute window
});

export async function rateLimit(shop: string, limit = 100) {
  const key = `rate-limit:${shop}`;
  const current = rateLimitCache.get(key) || 0;
  
  if (current >= limit) {
    throw new Response('Too Many Requests', { 
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
      }
    });
  }
  
  rateLimitCache.set(key, current + 1);
  return {
    remaining: limit - current - 1,
    reset: new Date(Date.now() + 60000).toISOString()
  };
}

export async function rateLimitByIP(ip: string, limit = 10) {
  const key = `rate-limit-ip:${ip}`;
  const current = rateLimitCache.get(key) || 0;
  
  if (current >= limit) {
    throw new Response('Too Many Requests from IP', { status: 429 });
  }
  
  rateLimitCache.set(key, current + 1);
}
