// Phase 3: Advanced security utilities
import crypto from "crypto";

export const SecurityHeaders = {
  // Content Security Policy
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://*.shopifycdn.com https://cdn.shopify.com https://cdn.shopifycdn.net",
    "style-src 'self' 'unsafe-inline' https://*.shopify.com https://*.shopifycdn.com https://cdn.shopify.com https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.shopify.com https://*.shopifycdn.com https://cdn.shopify.com",
    "font-src 'self' https://fonts.gstatic.com https://*.shopify.com https://*.shopifycdn.com",
    "connect-src 'self' https://*.shopify.com https://*.myshopify.com https://cdn.shopify.com wss://*.shopify.com wss://*.myshopify.com",
    "frame-src 'self' https://*.shopify.com https://*.myshopify.com",
  "frame-ancestors https://admin.shopify.com https://*.myshopify.com https://*.shopify.com",
  ].join("; "),
  
  // Additional security headers
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
} as const;

/**
 * Input sanitization for user-provided data
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Validate shop domain format
 */
export function validateShopDomain(shop: string): boolean {
  if (!shop || typeof shop !== 'string') return false;
  
  const shopPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]\.myshopify\.com$/i;
  return shopPattern.test(shop);
}

/**
 * Generate secure random tokens
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Time-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Extract and validate IP address from request
 */
export function getClientIP(request: { headers: { get: (name: string) => string | null } }): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('x-remote-addr');
  
  // Parse forwarded header (format: "client, proxy1, proxy2")
  if (forwarded) {
    const ips = forwarded.split(',').map((ip: string) => ip.trim());
    const clientIP = ips[0];
    
    // Basic IP validation
    if (isValidIP(clientIP)) {
      return clientIP;
    }
  }
  
  if (realIP && isValidIP(realIP)) {
    return realIP;
  }
  
  if (remoteAddr && isValidIP(remoteAddr)) {
    return remoteAddr;
  }
  
  return '127.0.0.1'; // Fallback
}

function isValidIP(ip: string): boolean {
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;
  
  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

/**
 * Request fingerprinting for additional security
 */
export function generateRequestFingerprint(request: { headers: { get: (name: string) => string | null } }): string {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  
  const fingerprint = `${userAgent}|${acceptLanguage}|${acceptEncoding}`;
  
  return crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex')
    .substring(0, 16);
}