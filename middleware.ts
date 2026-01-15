import { NextRequest, NextResponse } from "next/server";
import { CACHE_CONFIG, getCacheTagForPath } from "./lib/cache";
import {
  applyRateLimit,
  extractIdentifier,
  RATE_LIMIT_CONFIGS,
} from "./lib/rate-limit";

const STATIC_ASSET_PATTERNS = [
  /\.(css|js|woff|woff2|ttf|otf|eot)$/,
  /\/_next\/static\//,
  /\/static\//,
  /\.(png|jpg|jpeg|gif|webp|svg|ico)$/,
  /\.(mp4|webm|ogg)$/,
];

const API_PATTERNS = [/\/api\//, /\/api\/v1\//];

const CACHEABLE_PATHS = [
  "/api/v1/trends",
  "/api/v1/audio/",
  "/api/v1/genres",
  "/api/v1/vibes",
  "/api/v1/genre/",
  "/api/v1/vibe/",
];

/**
 * Rate limit configuration per endpoint
 * Health check and public endpoints have higher limits
 */
const RATE_LIMITS: Record<string, keyof typeof RATE_LIMIT_CONFIGS> = {
  "/api/health": "api", // 100 req/min
  "/api/bio": "strict", // 10 req/min - AI endpoint is expensive
  "/api/tools/watermark": "strict", // 10 req/min - expensive operation
  default: "api", // 100 req/min for most endpoints
};

/**
 * In-memory rate limit store for edge runtime
 * For production, consider using Cloudflare KV or D1
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Get rate limit configuration for a given path
 */
function getRateLimitConfig(pathname: string): keyof typeof RATE_LIMIT_CONFIGS {
  for (const [path, config] of Object.entries(RATE_LIMITS)) {
    if (path !== "default" && pathname.startsWith(path)) {
      return config;
    }
  }
  return RATE_LIMITS.default;
}

/**
 * Simple in-memory rate limiter for edge runtime
 * Uses sliding window with cleanup of expired entries
 */
function checkInMemoryRateLimit(
  identifier: string,
  config: { window: number; max: number },
): { allowed: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const key = identifier;

  // Clean up expired entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k);
    }
  }

  const entry = rateLimitStore.get(key);
  const resetTime = now + config.window * 1000;

  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      limit: config.max,
      remaining: config.max - 1,
      reset: resetTime,
    };
  }

  if (entry.count >= config.max) {
    return {
      allowed: false,
      limit: config.max,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    limit: config.max,
    remaining: config.max - entry.count,
    reset: entry.resetTime,
  };
}

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isStaticAsset(pathname)) {
    return addStaticAssetHeaders(request);
  }

  if (isApiRoute(pathname)) {
    return handleApiRoute(request);
  }

  return NextResponse.next();
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isApiRoute(pathname: string): boolean {
  return API_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isCacheableApiPath(pathname: string): boolean {
  return CACHEABLE_PATHS.some((pattern) => pathname.startsWith(pattern));
}

/**
 * Handle API routes with rate limiting
 */
function handleApiRoute(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;

  // Apply rate limiting
  const rateLimitKey = getRateLimitKey(request);
  const configKey = getRateLimitConfig(pathname);
  const config = RATE_LIMIT_CONFIGS[configKey];

  const rateLimitResult = checkInMemoryRateLimit(rateLimitKey, config);

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        error: "Rate limit exceeded",
        code: "RATE_LIMITED",
        retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
      },
      { status: 429 },
    );

    // Add rate limit headers to 429 response
    response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", String(rateLimitResult.reset));
    response.headers.set(
      "Retry-After",
      String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
    );
    response.headers.set("Cache-Control", "no-store");

    return response;
  }

  // Continue with cache headers
  return addApiCacheHeaders(request, rateLimitResult);
}

/**
 * Generate rate limit key from request
 */
function getRateLimitKey(request: NextRequest): string {
  const forwardedFor =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For");
  const ip = forwardedFor?.split(",")[0]?.trim() || "anonymous";

  const authHeader = request.headers.get("Authorization");
  const apiKey = authHeader?.replace(/^Bearer\s+/i, "") ?? "";

  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  return `ip:${ip}`;
}

function addStaticAssetHeaders(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  response.headers.set("Cache-Control", CACHE_CONFIG.edge.static);

  if (request.nextUrl.pathname.match(/\.(css|js)$/)) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  }

  if (request.nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
  }

  return response;
}

function addApiCacheHeaders(
  request: NextRequest,
  rateLimitResult?: { limit: number; remaining: number; reset: number },
): NextResponse {
  const response = NextResponse.next();
  const pathname = request.nextUrl.pathname;

  // Add rate limit headers
  if (rateLimitResult) {
    response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
    response.headers.set(
      "X-RateLimit-Remaining",
      String(rateLimitResult.remaining),
    );
    response.headers.set("X-RateLimit-Reset", String(rateLimitResult.reset));
  }

  if (!isCacheableApiPath(pathname)) {
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const cacheTags = getCacheTagForPath(pathname);
  if (cacheTags.length > 0) {
    response.headers.set("Edge-Cache-Tag", cacheTags.join(","));
  }

  if (pathname.startsWith("/api/v1/trends")) {
    response.headers.set("Cache-Control", CACHE_CONFIG.edge.trends);
  } else if (pathname.startsWith("/api/v1/audio/")) {
    response.headers.set("Cache-Control", CACHE_CONFIG.edge.audio);
  } else if (pathname.includes("hashtag")) {
    response.headers.set("Cache-Control", CACHE_CONFIG.edge.hashtags);
  } else {
    response.headers.set("Cache-Control", CACHE_CONFIG.edge.api);
  }

  response.headers.set("Vary", "Authorization,Accept-Encoding");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
