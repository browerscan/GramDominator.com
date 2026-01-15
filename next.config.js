/** @type {import('next').NextConfig} */
const nextConfig = {
  // Memory optimization for development
  onDemandEntries: {
    maxInactiveAge: 15 * 1000,
    pagesBufferLength: 3,
  },

  reactStrictMode: true,
  // Cloudflare Pages compatible output
  output: "export",

  // Images optimization for Cloudflare Pages
  images: {
    unoptimized: true, // Required for static export / CF Pages
    remotePatterns: [
      { protocol: "https", hostname: "*.tiktokcdn.com" },
      { protocol: "https", hostname: "p16-va.tiktokcdn.com" },
      { protocol: "https", hostname: "p16-sign.tiktokcdn.com" },
    ],
  },

  // Security Headers
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    const cspEnforce = process.env.CSP_ENFORCE === "true";

    // CSP Configuration - Report-Only by default for monitoring
    // Set CSP_ENFORCE=true to enable enforcement after migration
    const cspDirectives = [
      "default-src 'self'",
      "base-uri 'self'",
      "child-src 'self'",
      "connect-src 'self' *.tiktokcdn.com p16-va.tiktokcdn.com p16-sign.tiktokcdn.com",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'self'",
      "img-src 'self' data: blob: *.tiktokcdn.com p16-va.tiktokcdn.com p16-sign.tiktokcdn.com",
      "manifest-src 'self'",
      "media-src 'self' *.tiktokcdn.com p16-va.tiktokcdn.com",
      "object-src 'none'",
      // Removed 'unsafe-eval' - using strict mode
      // 'unsafe-inline' kept temporarily, will migrate to nonce-based CSP
      "script-src 'self' 'unsafe-inline'",
      "script-src-elem 'self'",
      "style-src 'self' 'unsafe-inline'",
      "style-src-elem 'self' 'unsafe-inline'",
      "worker-src 'self' blob:",
      "report-to csp-endpoint",
      "report-uri /api/security/csp-report",
    ].join("; ");

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://gramdominator.com";

    return [
      {
        source: "/:path*",
        headers: [
          // Content Security Policy - Report-Only or Enforced
          {
            key: cspEnforce
              ? "Content-Security-Policy"
              : "Content-Security-Policy-Report-Only",
            value: cspDirectives,
          },
          // Reporting Endpoints for CSP violation monitoring
          {
            key: "Reporting-Endpoints",
            value: `csp-endpoint="${siteUrl}/api/security/csp-report"`,
          },
          // DNS Prefetch Control
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          // HTTP Strict Transport Security (only enable in production with HTTPS)
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          // Frame Options
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Content Type Options
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Referrer Policy
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions Policy - Restrict sensitive features
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()",
          },
          // XSS Protection
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Cross Origin Opener Policy
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          // Cross Origin Resource Policy
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
        ],
      },
      // API routes - stricter security
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; connect-src 'self' *.tiktokcdn.com; object-src 'none'; base-uri 'self';",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // API rate limit headers (documenting limits for clients)
          {
            key: "X-RateLimit-Limit",
            value: "100",
          },
          {
            key: "X-RateLimit-Window",
            value: "60",
          },
        ],
      },
      // Health check endpoint - public, no rate limit info needed
      {
        source: "/api/health",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; object-src 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
