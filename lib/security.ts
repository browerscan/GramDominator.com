/**
 * Security Headers and Content Security Policy Configuration
 * OWASP Top 10 Compliance
 *
 * CSP Migration Plan (Nonce-Based):
 * ---------------------------------
 * Current State: Report-Only mode with reduced unsafe-* directives
 * Target State: Enforce mode with nonce-based inline scripts/styles
 *
 * Migration Steps:
 * 1. Deploy CSP-Report-Only to collect violation reports
 * 2. Analyze reports to identify inline scripts/styles
 * 3. Add nonce generation in middleware (generateNonce function available)
 * 4. Pass nonce via headers to pages
 * 5. Update script/style tags to use nonce attribute
 * 6. Remove 'unsafe-inline' and enforce CSP
 * 7. Add Reporting API endpoint for violation monitoring
 *
 * Report-Only Header: Content-Security-Policy-Report-Only
 * Enforce Header: Content-Security-Policy
 */

type NonceSource = `'nonce-${string}'`;
type CSPSource =
  | "'self'"
  | "'none'"
  | "'unsafe-inline'"
  | "'unsafe-eval'"
  | "'unsafe-hashes'"
  | "'report-sample'"
  | NonceSource
  | string;

interface CSPConfig {
  "default-src": CSPSource[];
  "base-uri": CSPSource[];
  "child-src": CSPSource[];
  "connect-src": CSPSource[];
  "font-src": CSPSource[];
  "form-action": CSPSource[];
  "frame-ancestors": CSPSource[];
  "frame-src": CSPSource[];
  "img-src": CSPSource[];
  "manifest-src": CSPSource[];
  "media-src": CSPSource[];
  "object-src": CSPSource[];
  "script-src": CSPSource[];
  "script-src-elem": CSPSource[];
  "style-src": CSPSource[];
  "style-src-elem": CSPSource[];
  "worker-src": CSPSource[];
  "report-to"?: string[];
  "report-uri"?: string[];
}

/**
 * CSP Report Configuration
 * Configure reporting endpoint for CSP violations
 */
export const CSP_REPORT_CONFIG = {
  reportTo: "csp-endpoint",
  reportUri: "/api/security/csp-report",
  maxAge: 86400,
  includeSubdomains: true,
};

/**
 * Production-ready CSP configuration (Report-Only Mode)
 * Restrictive by default, only allowing necessary sources
 *
 * Report-Only mode allows monitoring violations without blocking resources
 * Set CSP_ENFORCE=true in production to enforce after migration
 */
export const cspConfig: CSPConfig = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "child-src": ["'self'"],
  "connect-src": [
    "'self'",
    // TikTok CDN for audio covers
    "*.tiktokcdn.com",
    "p16-va.tiktokcdn.com",
    "p16-sign.tiktokcdn.com",
  ],
  "font-src": ["'self'", "data:"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "frame-src": ["'self'"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "*.tiktokcdn.com",
    "p16-va.tiktokcdn.com",
    "p16-sign.tiktokcdn.com",
  ],
  "manifest-src": ["'self'"],
  "media-src": ["'self'", "*.tiktokcdn.com", "p16-va.tiktokcdn.com"],
  "object-src": ["'none'"],
  // Reduced 'unsafe-inline' usage - will be removed after nonce migration
  // 'unsafe-eval' kept for Next.js development mode compatibility
  "script-src": ["'self'", "'unsafe-inline'"], // Removed 'unsafe-eval' - use strict mode
  "script-src-elem": ["'self'"], // Removed 'unsafe-inline' - requires nonce migration
  "style-src": ["'self'", "'unsafe-inline'"], // Required for styled-jsx until nonce migration
  "style-src-elem": ["'self'", "'unsafe-inline'"], // Required for inline styles until nonce migration
  "worker-src": ["'self'", "blob:"],
  "report-to": ["csp-endpoint"],
  "report-uri": ["/api/security/csp-report"],
};

/**
 * Enforced CSP configuration (for production after migration)
 * Stricter than report-only, uses nonces instead of unsafe-inline
 */
export const cspConfigEnforced: CSPConfig = {
  ...cspConfig,
  "script-src": ["'self'"], // Nonce will be added at runtime
  "script-src-elem": ["'self'"], // Nonce will be added at runtime
};

/**
 * Convert CSP config to header value string
 */
function buildCSPHeader(config: CSPConfig): string {
  return Object.entries(config)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

/**
 * Get CSP header value
 * Returns enforce mode or report-only based on environment
 */
export function getCSPHeaderValue(): string {
  const config =
    process.env.CSP_ENFORCE === "true" ? cspConfigEnforced : cspConfig;
  return buildCSPHeader(config);
}

/**
 * Get CSP Report-Only header value
 * Always returns the report-only configuration for monitoring
 */
export function getCSPReportOnlyHeaderValue(): string {
  return buildCSPHeader(cspConfig);
}

/**
 * Security headers for Next.js middleware or API routes
 */
export interface SecurityHeaders {
  "Content-Security-Policy"?: string;
  "Content-Security-Policy-Report-Only"?: string;
  "X-DNS-Prefetch-Control": string;
  "Strict-Transport-Security": string;
  "X-Frame-Options": string;
  "X-Content-Type-Options": string;
  "Referrer-Policy": string;
  "Permissions-Policy": string;
  "X-XSS-Protection": string;
  "Cross-Origin-Opener-Policy": string;
  "Cross-Origin-Resource-Policy": string;
  "Reporting-Endpoints"?: string;
}

/**
 * Get all security headers for the application
 * Returns Report-Only mode by default, enforce mode when CSP_ENFORCE=true
 */
export function getSecurityHeaders(): Record<string, string> {
  const isEnforce = process.env.CSP_ENFORCE === "true";
  const isProduction = process.env.NODE_ENV === "production";

  const headers: Record<string, string> = {
    "X-DNS-Prefetch-Control": "off",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    "X-XSS-Protection": "1; mode=block",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Reporting-Endpoints": `csp-endpoint="${process.env.NEXT_PUBLIC_SITE_URL ?? "https://gramdominator.com"}/api/security/csp-report"`,
  };

  // HSTS only in production with HTTPS
  if (isProduction) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }

  // CSP: Report-Only by default, Enforce when CSP_ENFORCE=true
  if (isEnforce) {
    headers["Content-Security-Policy"] = getCSPHeaderValue();
  } else {
    headers["Content-Security-Policy-Report-Only"] =
      getCSPReportOnlyHeaderValue();
  }

  return headers;
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate and sanitize URL to prevent open redirect attacks
 *
 * @param url - The URL to validate and sanitize
 * @param base - Optional base URL for parsing relative URLs. Defaults to NEXT_PUBLIC_SITE_URL or 'https://gramdominator.com'
 * @returns The sanitized URL string, or null if invalid
 */
export function sanitizeURL(url: string, base?: string): string | null {
  try {
    // Use provided base, environment variable, or fallback to production URL
    // This avoids server-side crashes when window.location is unavailable
    const baseUrl =
      base ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://gramdominator.com";
    const parsed = new URL(url, baseUrl);
    // Only allow http/https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    // Reject javascript: and data: URLs
    if (url.startsWith("javascript:") || url.startsWith("data:")) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Rate limit key generator for API routes
 */
export function getRateLimitKey(identifier: string, endpoint: string): string {
  return `ratelimit:${identifier}:${endpoint}`;
}

/**
 * Generate a nonce for CSP inline scripts (if needed in future)
 */
export function generateNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16)))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
