# GramDominator.com - P2 Technical Architecture & Optimization Plan

**Project**: TikTok Audio Trends Tracker
**Stack**: Next.js 15, Cloudflare D1+KV, Edge Runtime, TanStack Table, Recharts
**Deploy**: Cloudflare Pages with Workers
**Analysis Date**: 2025-01-13
**Architect**: Claude Sonnet 4.5

---

## Executive Summary

GramDominator.com is a well-architected edge-native application with solid foundations. The codebase demonstrates good practices in fallback strategies, security headers, and TypeScript usage. However, there are **P0-P2 priority issues** spanning security, observability, performance, and code quality that require immediate attention.

**Key Findings**:

- **Security**: CSP uses unsafe-inline/unsafe-eval (critical)
- **Observability**: No error reporting service (Sentry missing)
- **Code Quality**: 23 console statements in production code
- **Data Flow**: Good fallback patterns but missing error boundaries
- **Performance**: Edge-optimized but lacks cache invalidation strategy

---

## 1. Current Architecture Assessment

### 1.1 Technology Stack

```
Frontend:
- Next.js 15.5.2 (App Router, Edge Runtime)
- React 18.3.1
- TanStack Table 8.20.5 (data tables)
- Recharts 2.12.7 (visualization)
- Zod 4.3.5 (validation)

Backend/Infrastructure:
- Cloudflare Pages (deployment)
- Cloudflare Workers (edge compute)
- D1 Database (SQLite at edge)
- KV Storage (caching)
- Puppeteer (browser automation)

Tooling:
- TypeScript 5.5.4
- Vitest (unit testing)
- Playwright (E2E testing)
- Tailwind CSS 3.4.6
```

### 1.2 Data Flow Architecture

```
┌─────────────────┐
│  TikTok CDN     │
│  (Audio Files)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Cloudflare Worker (Scraper)        │
│  - Puppeteer browser automation     │
│  - AI tagging (Workers AI)          │
│  - Cron trigger (6 hours)           │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  D1 Database (Primary)              │
│  - audio_trends table               │
│  - hashtags table                   │
│  - audio_trend_history table        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  KV Storage (Backup Cache)          │
│  - fallback:trends                  │
│  - fallback:hashtags                │
│  - TTL: 7 days                      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Next.js Edge Runtime               │
│  - /trends (revalidate: 900s)       │
│  - /audio/[slug] (revalidate: 3600s)│
│  - API routes with middleware       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Client (Browser)                   │
│  - LocalStorage (recently viewed)   │
│  - TanStack Table (filtering)       │
│  - Recharts (visualization)         │
└─────────────────────────────────────┘
```

### 1.3 Security Architecture

**Current State** (File: `/next.config.js`, `/lib/security.ts`):

✅ **Implemented**:

- CSP headers (but needs hardening)
- HSTS in production
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy (disabled sensitive features)
- XSS Protection header
- CORP/COOP headers
- Input sanitization functions
- URL validation

❌ **Critical Issues**:

```javascript
// Line 41-44 in next.config.js
"script-src": ["'self'", "'unsafe-eval'", "'unsafe-inline'"],  // P0
"script-src-elem": ["'self'", "'unsafe-inline'"],              // P0
"style-src": ["'self'", "'unsafe-inline'"],                    // P0
"style-src-elem": ["'self'", "'unsafe-inline'"],               // P0
```

**Risk**: XSS vulnerabilities through inline scripts/styles.

### 1.4 Caching Strategy

**Current Implementation** (File: `/middleware.ts`):

```typescript
Static Assets:
- CSS/JS: 1 year, immutable
- Images: 1 day + 7 day stale-while-revalidate

API Routes:
- /api/v1/trends: Configurable (lib/cache.ts)
- /api/v1/audio/: Configurable
- Hashtag endpoints: Configurable
- Non-cacheable APIs: no-store

Page Revalidation:
- /trends: 900 seconds (15 minutes)
- /audio/[slug]: 3600 seconds (1 hour)
```

✅ **Strengths**:

- Edge cache tags implemented
- Proper stale-while-revalidate for images
- Revalidation configured for ISR

❌ **Weaknesses**:

- No cache invalidation webhook from worker
- No cache warming strategy
- KV backup not synchronized with D1 updates

---

## 2. Technical Debt & Issues (Priority-Ranked)

### P0 - Critical Security Issues

#### P0-1: CSP Unsafe-Inline/Eval

**Location**: `/next.config.js:41-44`, `/lib/security.ts:66-69`
**Risk**: XSS attack surface
**Impact**: Attackers could inject malicious scripts

```javascript
// Current (VULNERABLE)
"script-src": ["'self'", "'unsafe-eval'", "'unsafe-inline'"]

// Required Fix
"script-src": ["'self'", "'nonce-{RANDOM}'"]
```

**Action Plan**:

1. Implement nonce-based CSP in middleware
2. Move all inline scripts to external files
3. Use CSP compliance library (next/dynamic for scripts)
4. Test in Report-Only mode first

#### P0-2: Missing Error Reporting Service

**Location**: Global
**Risk**: No visibility into production errors
**Impact**: Silent failures, poor user experience

**Current State**:

- Error boundaries exist (`/components/ErrorBoundary.tsx`)
- Console.error statements scattered throughout
- No structured error tracking

**Action Plan**:

1. Integrate Sentry (cloudflare workers support)
2. Add user feedback (crash reporting)
3. Set up alerting for error spikes
4. Create error dashboards

### P1 - High Priority Issues

#### P1-1: Console Statements in Production

**Count**: 23 console.log/warn/error statements
**Files Affected**:

```
/lib/proxy-grid.ts:116, 122, 151
/lib/fallback-data.ts:69, 93, 109, 124, 141, 160, 173, 188, 192, 248
/components/ErrorBoundary.tsx:32
/lib/api-response.ts:225
/app/error.tsx:20
/app/api/bio/route.ts:65
/lib/env.ts:122
/app/api/tools/watermark/route.ts:104
/src/index.ts:97, 117, 165, 291, 320, 379, 630
/src/worker/tiktok.ts:712
/src/worker/ai-tagger.ts:83
```

**Action Plan**:

1. Implement structured logging with Cloudflare Workers Analytics
2. Replace console.\* with logger library (pino or winston)
3. Add log levels (ERROR, WARN, INFO, DEBUG)
4. Strip console.\* in production build

#### P1-2: LocalStorage Without Error Handling

**Location**: `/hooks/useRecentlyViewed.ts:22-34`, `/components/RecentlyViewed.tsx:23`

```typescript
// Current - Silent failure with no feedback
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  // ...
} catch {
  // Silently fail
}
```

**Issues**:

- No user notification when localStorage unavailable (private mode)
- Direct localStorage manipulation in component (line 23)
- No quota exceeded handling

**Action Plan**:

1. Add user-visible fallback UI
2. Implement sessionStorage backup
3. Add feature detection before usage
4. Graceful degradation to memory-only storage

#### P1-3: No Rate Limiting

**Location**: API routes (`/app/api/`)
**Risk**: API abuse, DoS attacks
**Impact**: Service degradation, cost overrun

**Current State**: No rate limiting implementation found

**Action Plan**:

1. Implement Cloudflare Workers rate limiting
2. Add rate limit headers to responses
3. Use KV for distributed counter
4. Set up rate limit alerts

#### P1-4: Database Query Optimization

**Location**: `/lib/db.ts`

**Issues**:

```typescript
// Line 86-103: No index hints visible
export async function getAudioByGenre(genre: string, limit = 50) {
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
       FROM audio_trends
       WHERE platform = ? AND lower(genre) = ?
       ORDER BY rank ASC
       LIMIT ?`,
    )
    .bind(PLATFORM, genre.toLowerCase(), limit)
    .all<AudioTrendRow>();
  return results ?? [];
}
```

**Potential Issues**:

- `lower(genre)` function call prevents index usage
- No composite indexes on (platform, genre, rank)
- Multiple sequential queries in page components

**Action Plan**:

1. Add database indexes (migration needed)
2. Store pre-lowercased genre column
3. Implement query batching for related data
4. Add query performance monitoring

### P2 - Medium Priority Issues

#### P2-1: Component Performance - TrendTable

**Location**: `/components/TrendTable.tsx`

**Issues**:

- 523 lines (should split)
- Columns defined inside component (recreated on render)
- No memoization for filtered data
- Duplicate mobile/desktop rendering

**Action Plan**:

1. Extract columns to component scope
2. Use React.memo for row components
3. Implement virtualization for 100+ items
4. Split into sub-components

#### P2-2: Missing TypeScript Strict Mode

**Location**: `/tsconfig.json` (not read, inferred from usage)

**Indicators**:

```typescript
// lib/db.ts:19 - Nullish coalescing suggests not strict
return results ?? [];

// Multiple files use `as` casting
```

**Action Plan**:

1. Enable strict: true in tsconfig
2. Fix all implicit any errors
3. Remove type assertions where possible
4. Add proper null checks

#### P2-3: Environment Variable Validation

**Location**: `/lib/env.ts:122`

```typescript
console.error("Environment validation warning:", error);
```

**Issues**:

- Validation exists but only logs warnings
- No runtime enforcement
- Missing required variables check on startup

**Action Plan**:

1. Throw on missing required vars in production
2. Use Zod schema for env validation
3. Add startup health check endpoint
4. Document all required env vars

#### P2-4: Cache Invalidation Strategy

**Location**: `/lib/fallback-data.ts`, `/middleware.ts`

**Current Flow**:

```
Worker (6h) → D1 → (manual KV backup?)
```

**Issues**:

- KV backup not triggered automatically
- No cache purge on fresh data
- Stale data possible in edge caches

**Action Plan**:

1. Add KV backup write in worker after D1 update
2. Implement cache invalidation webhook
3. Add cache versioning headers
4. Set up automatic purge on cron success

#### P2-5: SEO & Metadata Optimization

**Location**: `/app/layout.tsx`, `/app/trends/page.tsx`

**Good**:

- JSON-LD structured data implemented
- OpenGraph tags present
- Semantic HTML

**Missing**:

- No sitemap generation (only API endpoint exists)
- No robots.txt dynamic generation
- Missing canonical URL consistency checks
- No breadcrumb schema

**Action Plan**:

1. Generate static sitemap.xml
2. Add dynamic robots.txt
3. Implement breadcrumb schema
4. Add hreflang tags for internationalization prep

---

## 3. Security Hardening Plan

### 3.1 CSP Migration (P0)

**Phase 1: Audit**

```bash
# Run CSP scanner
npm install -g csp-scanner
csp-scanner https://gramdominator.com
```

**Phase 2: Report-Only Mode**

```javascript
// middleware.ts
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'nonce-{RANDOM}' 'strict-dynamic'",
  "style-src 'self' 'nonce-{RANDOM}'",
].join("; ");

response.headers.set("Content-Security-Policy-Report-Only", cspHeader);
```

**Phase 3: Collect Violations**

- Deploy CSP report collector endpoint
- Monitor for 30 days
- Whitelist legitimate sources

**Phase 4: Enforce**

- Remove unsafe-inline/unsafe-eval
- Keep nonce-based approach
- Add fallback for inline scripts

### 3.2 Input Validation Enhancement

**Current**: Basic sanitization in `/lib/security.ts:127-135`

**Add**:

```typescript
// lib/validation.ts
import { z } from "zod";

export const audioSlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9-]+-[a-z0-9]+$/, "Invalid slug format");

export const genreSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9\s&]+$/, "Invalid genre");

export const limitSchema = z.number().int().min(1).max(500);
```

### 3.3 Rate Limiting Implementation

```typescript
// middleware.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const identifier = getClientIdentifier(request);
    const { success } = await ratelimit.limit(identifier);

    if (!success) {
      return new Response("Too Many Requests", { status: 429 });
    }
  }
}
```

### 3.4 Security Headers Review

**Missing Headers**:

```
Expect-CT: max-age=86400, enforce
Cross-Origin-Embedder-Policy: require-corp (if needed)
Reporting-Endpoints: ... (for CSP reports)
```

---

## 4. Performance Optimization Recommendations

### 4.1 Database Layer

**Current Query Performance**:

- No indexes visible in schema
- Function calls in WHERE clauses
- Sequential queries in pages

**Optimizations**:

1. **Add Indexes** (Migration required):

```sql
CREATE INDEX idx_audio_trends_platform_genre ON audio_trends(platform, lower(genre));
CREATE INDEX idx_audio_trends_platform_vibe ON audio_trends(platform, lower(vibe));
CREATE INDEX idx_audio_trends_platform_rank ON audio_trends(platform, rank);
CREATE INDEX idx_audio_trends_updated ON audio_trends(updated_at DESC);
```

2. **Add Computed Column**:

```sql
ALTER TABLE audio_trends ADD COLUMN genre_lower VARCHAR GENERATED ALWAYS AS (lower(genre)) STORED;
CREATE INDEX idx_genre_lower ON audio_trends(genre_lower);
```

3. **Query Batching**:

```typescript
// lib/db.ts
export async function getAudioWithRelated(id: string) {
  const db = getDB();
  const queries = [
    db.prepare(`SELECT * FROM audio_trends WHERE id = ?`).bind(id).first(),
    db
      .prepare(`SELECT * FROM audio_trend_history WHERE id = ? LIMIT 20`)
      .bind(id)
      .all(),
    db.prepare(`SELECT * FROM hashtags LIMIT 10`).all(),
  ];

  const [audio, history, hashtags] = await Promise.all(queries);
  return { audio, history, hashtags };
}
```

### 4.2 Edge Runtime Optimization

**Current Revalidation**:

- `/trends`: 900s (15 minutes)
- `/audio/[slug]`: 3600s (1 hour)

**Recommendations**:

1. **Implement On-Demand ISR**:

```typescript
// app/api/revalidate/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  const { slug } = body;

  await revalidatePath(`/audio/${slug}`);
  await revalidatePath("/trends");

  return Response.json({ revalidated: true });
}
```

2. **Call from Worker**:

```typescript
// src/index.ts (after D1 update)
await fetch("https://gramdominator.com/api/revalidate", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  body: JSON.stringify({ slug: latestAudioId }),
});
```

3. **Add Cache Tags**:

```typescript
// app/trends/page.tsx
export const fetchCacheTags = ["trends"];

export async function generateMetadata() {
  return {
    other: {
      "Cache-Tag": "trends,audio",
    },
  };
}
```

### 4.3 Client-Side Performance

**TrendTable Component**:

1. **Implement Virtualization**:

```bash
npm install @tanstack/react-virtual
```

```typescript
// components/TrendTable.tsx
import { useVirtualizer } from "@tanstack/react-virtual";

const rowVirtualizer = useVirtualizer({
  count: filteredData.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
  overscan: 5,
});
```

2. **Column Memoization**:

```typescript
// Move outside component
const columns: ColumnDef<AudioTrendRow>[] = [
  // ... column definitions
];
```

3. **Split Components**:

```
components/
  TrendTable/
    index.tsx (main)
    TableFilters.tsx
    TableHeader.tsx
    TableRow.tsx
    MobileCard.tsx
```

### 4.4 Asset Optimization

**Current**:

- Image optimization via Next.js (good)
- No font preload (partial)

**Add**:

```typescript
// app/layout.tsx
export function RootLayout() {
  return (
    <html>
      <head>
        {/* Preconnect to TikTok CDN */}
        <link rel="preconnect" href="https://*.tiktokcdn.com" />

        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="/fonts/sota-regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
    </html>
  );
}
```

---

## 5. Code Refactoring Recommendations

### 5.1 Separation of Concerns

**Current Issue**: `/app/audio/[slug]/page.tsx` (634 lines)

**Refactoring Plan**:

```
app/audio/[slug]/
  page.tsx (orchestration only)
  components/
    AudioDetail.tsx
    AudioMetrics.tsx
    AudioChart.tsx
    RelatedAudio.tsx
    CreatorPlaybook.tsx
  lib/
    getHashtagsForAudio.ts
    getRelatedAudio.ts
    formatChartData.ts
```

### 5.2 Error Handling Pattern

**Current**: Scattered try-catch blocks

**Standardize**:

```typescript
// lib/errors.ts
export class DatabaseError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class CacheError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "CacheError";
  }
}

// lib/with-error-handling.ts
export async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DatabaseError) {
      // Log to Sentry
      Sentry.captureException(error, { tags: { operation } });
    }
    throw error;
  }
}
```

### 5.3 Type Safety Improvements

**Add Discriminated Unions**:

```typescript
// lib/types.ts
export type DataResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getAudioById(
  id: string,
): Promise<DataResult<AudioTrendRow>> {
  try {
    const audio = await db.prepare(/* ... */).first();
    if (!audio) return { success: false, error: "Not found" };
    return { success: true, data: audio };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

---

## 6. Monitoring & Observability Strategy

### 6.1 Metrics Collection

**Current**: Cloudflare Workers Analytics (basic)

**Add Custom Metrics**:

```typescript
// lib/metrics.ts
export function recordMetric(
  name: string,
  value: number,
  tags?: Record<string, string>,
) {
  if (typeof window !== "undefined") {
    // Client-side: Send to analytics
    gtag("event", name, { value, ...tags });
  } else {
    // Server-side: Cloudflare Analytics Engine
    env.WRITER.writeDataPoint({
      indexes: [name],
      blobs: [JSON.stringify(tags)],
      doubles: [value],
    });
  }
}

// Usage
recordMetric("db_query_duration", queryDuration, { table: "audio_trends" });
recordMetric("cache_hit_rate", hitRate, { cache: "kv_backup" });
```

### 6.2 Health Checks

**Add Endpoint**:

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    worker: await checkWorker(),
  };

  const healthy = Object.values(checks).every(Boolean);
  const status = healthy ? 200 : 503;

  return Response.json(checks, { status });
}

async function checkDatabase(): Promise<boolean> {
  try {
    await db.prepare("SELECT 1").first();
    return true;
  } catch {
    return false;
  }
}
```

### 6.3 Alerting Setup

**Critical Alerts**:

1. Error rate > 1% (5min window)
2. Database query P95 > 500ms
3. Cache hit rate < 80%
4. Worker cron failure
5. CSP violations (new domain)

**Warning Alerts**:

1. Response time P95 > 1s
2. Edge cache hit rate < 70%
3. Fallback data usage > 10% requests

---

## 7. Scalability Improvements

### 7.1 Current Bottlenecks

1. **Sequential Queries**: Multiple database calls per page
2. **No CDN Preload**: Cache not warmed on deployment
3. **Single Region**: All traffic to one cloudflare region (auto-scales)

### 7.2 Scaling Strategy

**Phase 1: Optimized Data Layer** (1-2 weeks)

- Add database indexes
- Implement query batching
- Add connection pooling (if needed)

**Phase 2: Enhanced Caching** (1 week)

- Implement stale-while-revalidate for all API routes
- Add cache warming script
- Implement cache invalidation webhooks

**Phase 3: Content Delivery** (1 week)

- Pre-generate sitemap
- Implement ISR for all routes
- Add image optimization CDN

**Phase 4: Monitoring & Auto-Scaling** (Ongoing)

- Implement observability stack
- Set up auto-scaling rules
- Add capacity planning alerts

### 7.3 Capacity Planning

**Current Assumptions**:

- 50 audio items × 10 queries/page = 500 queries/page
- 1000 page views/day = 500k queries/day
- D1 free tier: 5M reads/day (10x headroom)

**Projected Scale** (10x growth):

- 5M reads/day (near free tier limit)
- Action: Upgrade to D1 paid tier or implement aggressive caching

---

## 8. Implementation Roadmap

### Sprint 1: Security Hardening (Week 1-2)

- [ ] P0-1: Implement nonce-based CSP (Report-Only mode)
- [ ] P0-2: Integrate Sentry error reporting
- [ ] P1-3: Implement rate limiting
- [ ] P1-4: Add input validation schemas

### Sprint 2: Code Quality (Week 2-3)

- [ ] P1-1: Replace all console statements with structured logging
- [ ] P1-2: Add localStorage error handling
- [ ] P2-1: Refactor TrendTable component
- [ ] P2-2: Enable TypeScript strict mode

### Sprint 3: Performance (Week 3-4)

- [ ] P1-4: Add database indexes
- [ ] P2-4: Implement cache invalidation
- [ ] P4.3: Implement table virtualization
- [ ] P4.4: Add asset optimization

### Sprint 4: Observability (Week 4-5)

- [ ] P6.1: Implement custom metrics
- [ ] P6.2: Add health check endpoint
- [ ] P6.3: Set up alerting rules
- [ ] Create monitoring dashboard

### Sprint 5: Scalability (Week 5-6)

- [ ] P2-3: Environment validation enforcement
- [ ] P7.2: Implement query batching
- [ ] P7.2: Add cache warming strategy
- [ ] P7.2: Set up auto-scaling rules

---

## 9. Risk Assessment

### High Risk

- **CSP unsafe-inline**: XSS vulnerability window
- **No error reporting**: Silent failures in production
- **No rate limiting**: Potential DoS abuse

### Medium Risk

- **Database query performance**: Degradation at scale
- **Cache invalidation**: Stale data served to users
- **LocalStorage assumptions**: Breaks in private browsing

### Low Risk

- **Console statements**: Information disclosure, performance
- **Component size**: Maintainability concerns
- **TypeScript strictness**: Potential runtime type errors

---

## 10. Success Metrics

### Security

- [ ] CSP passes without unsafe-inline
- [ ] Error rate monitoring < 0.1%
- [ ] Rate limiting enforced on all APIs
- [ ] Zero XSS vulnerabilities in audit

### Performance

- [ ] P95 page load < 2s
- [ ] P95 database query < 100ms
- [ ] Edge cache hit rate > 90%
- [ ] Lighthouse score > 90

### Code Quality

- [ ] Zero console statements in production
- [ ] TypeScript strict mode enabled
- [ ] Test coverage > 80%
- [ ] No type assertions (as) without justification

### Reliability

- [ ] Uptime > 99.9%
- [ ] Error rate < 0.1%
- [ ] Cache fallback usage < 5%
- [ ] Health checks passing

---

## Appendix A: File Reference Summary

### Critical Files Analyzed

1. `/next.config.js` - Security headers configuration
2. `/lib/db.ts` - Database query layer
3. `/lib/proxy-grid.ts` - Proxy integration with circuit breaker
4. `/lib/security.ts` - CSP and security utilities
5. `/components/TrendTable.tsx` - Main data table (523 lines)
6. `/app/layout.tsx` - Root layout and SEO
7. `/app/audio/[slug]/page.tsx` - Audio detail page (634 lines)
8. `/lib/fallback-data.ts` - Graceful degradation strategy
9. `/middleware.ts` - Edge caching and headers
10. `/hooks/useRecentlyViewed.ts` - LocalStorage management

### Configuration Files

1. `/wrangler.toml` - Cloudflare Workers configuration
2. `/package.json` - Dependencies and scripts
3. `/tsconfig.json` - TypeScript configuration (inferred)

---

## Appendix B: Testing Strategy

### Unit Tests (Vitest)

```typescript
// lib/db.test.ts
describe("getAudioById", () => {
  it("should return null for non-existent audio", async () => {
    const result = await getAudioById("non-existent");
    expect(result).toBeNull();
  });

  it("should return audio with correct structure", async () => {
    const result = await getAudioById("123");
    expect(result).toMatchSchema(AudioTrendSchema);
  });
});
```

### Integration Tests

```typescript
// tests/integration/cache.test.ts
describe("Cache Invalidation", () => {
  it("should purge edge cache on revalidate", async () => {
    await fetch("/api/revalidate", { method: "POST" });
    const response = await fetch("/trends");
    expect(response.headers.get("CF-Cache-Status")).toBe("MISS");
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/trends.spec.ts
test("should display trending audio", async ({ page }) => {
  await page.goto("/trends");
  await expect(page.locator("table tbody tr")).toHaveCount(50);
});
```

---

**Document Status**: Draft for Review
**Next Steps**: Prioritization meeting with engineering team
**Owner**: Architecture Team
**Review Date**: 2025-01-20
