# Security Hardening Plan - GramDominator.com

**Audit Date:** 2025-01-13
**Auditor:** Security Agent (Claude)
**Stack:** Next.js 15, Cloudflare D1+KV, Edge Runtime
**Severity Levels:** CRITICAL | HIGH | MEDIUM | LOW | INFO

---

## Executive Summary

**Overall Security Posture: MODERATE**

The application demonstrates strong security fundamentals with proper input validation, parameterized queries, and security headers. However, there are **CRITICAL vulnerabilities** requiring immediate attention, particularly around CSP configuration and dependency management.

**Immediate Actions Required:**

1. Upgrade Next.js to v15.5.8 (CRITICAL RCE vulnerability)
2. Implement API rate limiting (HIGH)
3. Migrate CSP to nonce-based (MEDIUM)
4. Add error tracking (MEDIUM)

---

## 1. OWASP Top 10 Vulnerability Assessment

### 1.1 A01:2021 - Broken Access Control

**Status:** ✅ MITIGATED

**Findings:**

- No authentication system present (public data only)
- API routes use proper input validation
- No sensitive endpoints exposed

**Recommendations:**

- If adding authentication in future, use Cloudflare Access or NextAuth.js
- Implement proper session management

---

### 1.2 A02:2021 - Cryptographic Failures

**Status:** ✅ MITIGATED

**Findings:**

- No PII stored in database
- No sensitive data transmission
- HTTPS enforced via HSTS header
- LocalStorage contains only non-sensitive public data

**Recommendations:**

- Continue minimal data collection
- Consider clearing localStorage on logout if auth is added

---

### 1.3 A03:2021 - Injection (SQL, XSS, Command)

**Status:** ⚠️ PARTIALLY MITIGATED

#### SQL Injection

**Status:** ✅ MITIGATED

**Evidence:**

```typescript
// /lib/db.ts - All queries use parameterized statements
await db
  .prepare(
    `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
   FROM audio_trends
   WHERE platform = ? AND id = ?
   LIMIT 1`,
  )
  .bind(PLATFORM, id) // ✅ Proper parameterization
  .first<AudioTrendRow>();
```

#### Cross-Site Scripting (XSS)

**Status:** ⚠️ NEEDS IMPROVEMENT

**HIGH RISK Areas:**

1. **CSP 'unsafe-inline' and 'unsafe-eval'**
   - **File:** `/lib/security.ts` lines 66-69
   - **Issue:** Inline scripts allowed, enabling XSS if user input reaches DOM
   - **Severity:** MEDIUM
   - **Remediation:** See Section 2

2. **dangerouslySetInnerHTML Usage**
   - **Files:** `/app/audio/[slug]/page.tsx` (lines 543-586), `/components/JsonLd.tsx`
   - **Issue:** Structured data injected directly
   - **Risk:** Currently safe (static data), but fragile
   - **Severity:** LOW
   - **Remediation:**
     ```typescript
     // Sanitize JSON-LD data before injection
     function sanitizeJsonLd(data: unknown): string {
       const sanitized = JSON.stringify(data);
       // Validate no script tags or event handlers
       if (/<script|on\w+\s*=/i.test(sanitized)) {
         throw new Error("Invalid JSON-LD content");
       }
       return sanitized;
     }
     ```

3. **User Input in Bio Generator**
   - **File:** `/app/api/bio/route.ts` line 73-78
   - **Current Mitigation:** Basic character stripping
   - **Severity:** LOW (mitigated by input validation)
   - **Status:** ✅ Acceptable

**Recommendations:**

- Migrate to nonce-based CSP (see Section 2)
- Add DOMPurify library for any HTML content
- Implement Content-Security-Policy-Report-Only for monitoring

---

### 1.4 A04:2021 - Insecure Design

**Status:** ⚠️ NEEDS IMPROVEMENT

**Findings:**

- No rate limiting on API routes
- No circuit breaker for user-initiated requests
- No request throttling

**Severity:** HIGH

**Remediation:** See Section 3

---

### 1.5 A05:2021 - Security Misconfiguration

**Status:** ⚠️ NEEDS IMPROVEMENT

**Findings:**

1. **Vulnerable Dependencies** (CRITICAL)
   - **Issue:** Next.js v15.5.2 has CRITICAL RCE vulnerability (GHSA-9qr9-h5gf-34mp)
   - **CVSS Score:** 10.0 (CRITICAL)
   - **Affected Files:** `/package.json`
   - **Remediation:**
     ```bash
     npm update next@15.5.8
     ```
   - **Timeline:** IMMEDIATE

2. **Dependency Vulnerabilities Summary:**
   - CRITICAL: 2 (Next.js RCE, DoS)
   - HIGH: 4 (path-to-regexp ReDoS, undici, @vercel/node)
   - MEDIUM: 9 (esbuild, vite, undici)
   - LOW: 1 (cookie package)

3. **Missing Security Headers**
   - **File:** `/next.config.js` and `/lib/security.ts`
   - **Current:** Good coverage
   - **Missing:**
     - `Content-Security-Policy-Report-Only` for monitoring
     - `NEL` (Network Error Logging)
     - `Report-To` header

4. **Verbose Error Messages**
   - **File:** `/app/api/bio/route.ts` line 66
   - **Issue:** Stack traces may leak in development
   - **Remediation:** Ensure production error handler

**Recommendations:**

- Immediate upgrade of Next.js to v15.5.8
- Run `npm audit fix` weekly
- Implement error reporting (Sentry/Cloudflare analytics)
- Add CSP violation reporting

---

### 1.6 A06:2021 - Vulnerable and Outdated Components

**Status:** 🚨 CRITICAL

**Details:** See Section 5 (Dependency Vulnerabilities)

---

### 1.7 A07:2021 - Identification and Authentication Failures

**Status:** ✅ N/A (No authentication)

---

### 1.8 A08:2021 - Software and Data Integrity Failures

**Status:** ⚠️ NEEDS REVIEW

**Findings:**

1. **Proxy Grid Integration**
   - **File:** `/lib/proxy-grid.ts`
   - **Issue:** Secret validation only via header (`x-grid-secret`)
   - **Severity:** MEDIUM
   - **Recommendation:**

     ```typescript
     // Add request signing
     import { verifySignature } from "@/lib/crypto";

     const signature = request.headers.get("x-grid-signature");
     const timestamp = request.headers.get("x-grid-timestamp");

     if (!signature || !verifySignature(body, signature, timestamp)) {
       return new Response("Invalid signature", { status: 401 });
     }
     ```

2. **External API Calls**
   - **File:** `/app/api/tools/watermark/route.ts`
   - **Issue:** No response validation from upstream API
   - **Severity:** LOW
   - **Recommendation:** Validate response structure

---

### 1.9 A09:2021 - Security Logging and Monitoring Failures

**Status:** ❌ NOT IMPLEMENTED

**Findings:**

- No error tracking (Sentry, etc.)
- No security event logging
- No intrusion detection
- No audit trails

**Severity:** MEDIUM

**Remediation:** See Section 6

---

### 1.10 A10:2021 - Server-Side Request Forgery (SSRF)

**Status:** ⚠️ PARTIALLY MITIGATED

**Findings:**

1. **Watermark Tool URL Validation**
   - **File:** `/app/api/tools/watermark/route.ts` lines 46-57
   - **Mitigation:** HTTPS-only enforcement ✅
   - **Gap:** No IP address restriction, no private network filtering
   - **Severity:** LOW
   - **Recommendation:**
     ```typescript
     function isPrivateNetwork(url: URL): boolean {
       const hostname = url.hostname;
       // Block private IPs, localhost, internal domains
       return /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|localhost|\.local$)/.test(
         hostname,
       );
     }
     ```

2. **Proxy Grid Configuration**
   - **File:** `/lib/proxy-grid.ts` line 4
   - **Issue:** Hardcoded fallback URL
   - **Severity:** INFO
   - **Recommendation:** Use environment variable only

---

## 2. Content Security Policy (CSP) Migration Plan

### Current State

**File:** `/lib/security.ts` and `/next.config.js`

**Issues:**

- `script-src 'unsafe-inline' 'unsafe-eval'` (lines 66)
- `style-src 'unsafe-inline'` (lines 68-69)
- Enables XSS attacks if user input reaches DOM

### Migration to Nonce-Based CSP

#### Phase 1: Preparation (Week 1)

1. **Add nonce generation middleware**
   - **File:** Create `/lib/csp-nonce.ts`

   ```typescript
   import { randomBytes } from "crypto";

   export function generateNonce(): string {
     return randomBytes(16).toString("base64");
   }

   export function getCSPWithNonce(nonce: string): string {
     return [
       `default-src 'self'`,
       `script-src 'self' 'nonce-${nonce}'`, // Remove 'unsafe-inline'
       `style-src 'self' 'nonce-${nonce}'`, // Remove 'unsafe-inline'
       // ... rest of directives
     ].join("; ");
   }
   ```

2. **Update middleware to pass nonce**
   - **File:** `/middleware.ts`

   ```typescript
   import { generateNonce } from "@/lib/csp-nonce";

   export function middleware(request: NextRequest) {
     const nonce = generateNonce();
     const response = NextResponse.next();
     response.headers.set("x-nonce", nonce);
     response.headers.set("Content-Security-Policy", getCSPWithNonce(nonce));
     return response;
   }
   ```

#### Phase 2: Update Templates (Week 2)

1. **Add nonce to inline scripts**
   - **File:** `/app/layout.tsx`

   ```typescript
   export default function RootLayout({ children }: { children: React.ReactNode }) {
     const nonce = headers().get('x-nonce') || '';
     return (
       <html>
         <head>
           <script nonce={nonce} src="/scripts/analytics.js" />
         </head>
         <body>{children}</body>
       </html>
     );
   }
   ```

2. **Refactor styled-jsx to CSS modules**
   - Current inline styles require 'unsafe-inline'
   - Migrate to Tailwind CSS (already used) or CSS modules

#### Phase 3: Testing (Week 3)

1. **Enable CSP-Report-Only first**

   ```typescript
   response.headers.set(
     "Content-Security-Policy-Report-Only",
     getCSPWithNonce(nonce),
   );
   response.headers.set(
     "Report-To",
     JSON.stringify({
       url: "https://your-csp-endpoint.com/report",
       group: "csp",
       max_age: 10886400,
     }),
   );
   ```

2. **Set up CSP violation endpoint**
   - **File:** Create `/app/api/csp-report/route.ts`
   ```typescript
   export async function POST(request: Request) {
     const report = await request.json();
     // Log to Sentry or logging service
     console.error("CSP Violation:", report);
     return Response.json({ success: true });
   }
   ```

#### Phase 4: Enforcement (Week 4)

1. **Switch to enforce mode**
2. **Monitor for 24 hours**
3. **Roll back if issues arise**

### Success Criteria

- ✅ No 'unsafe-inline' or 'unsafe-eval' in CSP
- ✅ All scripts use nonce or strict-dynamic
- ✅ CSP report endpoint receiving < 5 violations/day
- ✅ No functionality broken

---

## 3. API Security Hardening

### 3.1 Rate Limiting Strategy

**Current Status:** ❌ NOT IMPLEMENTED

**Implementation Plan:**

#### Option A: Cloudflare Workers KV (Recommended)

**File:** Create `/lib/rate-limit.ts`

```typescript
interface RateLimitConfig {
  limit: number;
  window: number; // milliseconds
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/bio": { limit: 10, window: 60000 }, // 10/min
  "/api/tools/watermark": { limit: 5, window: 300000 }, // 5/5min
  "/api/health": { limit: 60, window: 60000 }, // 60/min
};

export async function checkRateLimit(
  request: Request,
  env: { KV?: KVNamespace },
): Promise<{ allowed: boolean; resetTime?: number }> {
  const url = new URL(request.url);
  const key = `ratelimit:${getClientIdentifier(request)}:${url.pathname}`;

  const config = RATE_LIMITS[url.pathname] || { limit: 60, window: 60000 };

  if (!env?.KV) {
    console.warn("KV not configured, rate limiting disabled");
    return { allowed: true };
  }

  const current = await env.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= config.limit) {
    return { allowed: false, resetTime: Date.now() + config.window };
  }

  await env.put(key, String(count + 1), {
    expirationTtl: config.window / 1000,
  });
  return { allowed: true };
}

function getClientIdentifier(request: Request): string {
  // Use Cloudflare's CF-Connecting-IP header
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "anonymous"
  );
}
```

**Integration:**

```typescript
// /app/api/bio/route.ts
export async function POST(request: Request) {
  const rateLimit = await checkRateLimit(request, env);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  // ... rest of handler
}
```

#### Option B: Cloudflare D1 (Alternative)

Store rate limit data in D1 for more advanced analytics.

### 3.2 Input Validation Enhancements

**Current Status:** ✅ GOOD (Zod validation present)

**Improvements Needed:**

1. **Add content-type validation**

   ```typescript
   // /app/api/bio/route.ts
   if (request.headers.get("content-type") !== "application/json") {
     return Response.json({ error: "Invalid content type" }, { status: 415 });
   }
   ```

2. **Add request size limits**

   ```typescript
   // middleware.ts
   const MAX_REQUEST_SIZE = 1_000_000; // 1MB

   export function middleware(request: NextRequest) {
     const contentLength = request.headers.get("content-length");
     if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
       return new Response("Request too large", { status: 413 });
     }
   }
   ```

3. **Sanitize AI prompts more thoroughly**
   ```typescript
   // /app/api/bio/route.ts
   function sanitizeInput(input: string): string {
     return input
       .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
       .replace(/[<>{}]/g, "") // Remove potentially dangerous characters
       .replace(/--/g, "") // Remove SQL comment markers
       .replace(/;/g, "") // Remove statement separators
       .trim()
       .slice(0, 100); // Limit length
   }
   ```

### 3.3 API Security Checklist

- [ ] Implement rate limiting on all API routes
- [ ] Add CORS policy (if needed)
- [ ] Add API versioning
- [ ] Add request ID tracing
- [ ] Add API authentication (if needed)
- [ ] Add request/response logging
- [ ] Add API documentation (OpenAPI)
- [ ] Add API key rotation strategy

---

## 4. Security Headers Review

### Current Headers (from `/lib/security.ts`)

| Header                       | Status               | Value                                        |
| ---------------------------- | -------------------- | -------------------------------------------- |
| Content-Security-Policy      | ⚠️ Needs Improvement | Has 'unsafe-inline'                          |
| X-DNS-Prefetch-Control       | ✅ Good              | off                                          |
| Strict-Transport-Security    | ✅ Good              | max-age=31536000; includeSubDomains; preload |
| X-Frame-Options              | ✅ Good              | DENY                                         |
| X-Content-Type-Options       | ✅ Good              | nosniff                                      |
| Referrer-Policy              | ✅ Good              | strict-origin-when-cross-origin              |
| Permissions-Policy           | ✅ Good              | Restrictive                                  |
| X-XSS-Protection             | ⚠️ Deprecated        | 1; mode=block                                |
| Cross-Origin-Opener-Policy   | ✅ Good              | same-origin                                  |
| Cross-Origin-Resource-Policy | ✅ Good              | same-origin                                  |

### Missing Headers

**Add to `/lib/security.ts`:**

```typescript
export function getSecurityHeaders(): Record<string, string> {
  return {
    // ... existing headers ...

    // Network Error Logging
    NEL: `{"report_to":"default","max_age":31536000,"include_subdomains":true}`,
    "Report-To": JSON.stringify({
      group: "default",
      max_age: 31536000,
      endpoints: [{ url: "https://your-reports-endpoint.com/reports" }],
    }),

    // Expect-CT (Certificate Transparency)
    "Expect-CT": "max-age=86400, enforce",

    // Remove X-XSS-Protection (deprecated)
    // "X-XSS-Protection": "1; mode=block", // ❌ Remove
  };
}
```

### Headers to Remove

- `X-XSS-Protection`: Deprecated in favor of CSP
- `X-Frame-Options`: Redundant when CSP `frame-ancestors` is used (but keep for older browsers)

---

## 5. Dependency Vulnerabilities

### Critical - Immediate Action Required

#### 1. Next.js v15.5.2 RCE (GHSA-9qr9-h5gf-34mp)

**CVSS:** 10.0 CRITICAL
**Impact:** Remote Code Execution via React Flight Protocol

**Remediation:**

```bash
npm update next@15.5.8
```

**Timeline:** IMMEDIATE (within 24 hours)

---

#### 2. Next.js DoS (GHSA-mwv6-3258-q52c)

**CVSS:** 7.5 HIGH
**Impact:** Denial of Service with Server Components

**Remediation:**

```bash
npm update next@15.5.8
```

**Timeline:** IMMEDIATE (within 24 hours)

---

### High Priority

#### 3. path-to-regexp ReDoS (GHSA-9wv6-86v2-598j)

**CVSS:** 7.5 HIGH
**Impact:** Regular Expression Denial of Service
**Affected:** @vercel/node, @vercel/remix-builder

**Remediation:**

```bash
npm update @vercel/node
```

**Timeline:** Within 1 week

---

### Medium Priority

#### 4. esbuild Development Server (GHSA-67mh-4wv8-2f99)

**CVSS:** 5.3 MODERATE
**Impact:** Any website can read dev server responses
**Affected:** Development only

**Remediation:**

- Ensure `next dev` is NOT exposed publicly
- Update when fix available

**Timeline:** Within 2 weeks

---

#### 5. undici Random Values (GHSA-c76h-2ccp-4975)

**CVSS:** 6.8 MODERATE
**Impact:** Insufficiently random values
**Affected:** @vercel/node (transitive)

**Remediation:**

```bash
npm update @vercel/node
```

**Timeline:** Within 1 week

---

### Vulnerability Remediation Plan

1. **Immediate (Today):**

   ```bash
   npm update next@15.5.8
   npm audit fix --force
   ```

2. **Week 1:**
   - Update all @vercel/\* packages
   - Run full audit: `npm audit`
   - Review and fix high/critical issues

3. **Ongoing:**
   - Enable Dependabot
   - Run `npm audit` weekly in CI/CD
   - Subscribe to security advisories
   - Use `npm ci` in production

---

## 6. Error Tracking & Monitoring

### Current Status

❌ No error tracking implemented

### Implementation Plan

#### Option A: Sentry (Recommended)

1. **Install Sentry SDK**

   ```bash
   npm install @sentry/nextjs
   npx @sentry/wizard -i nextjs
   ```

2. **Configure Sentry**
   - **File:** Create `sentry.client.config.ts`

   ```typescript
   import * as Sentry from "@sentry/nextjs";

   Sentry.init({
     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
     tracesSampleRate: 0.1,
     replaysSessionSampleRate: 0.1,
     replaysOnErrorSampleRate: 1.0,

     beforeSend(event, hint) {
       // Sanitize sensitive data
       if (event.request) {
         delete event.request.cookies;
         delete event.request.headers;
       }
       return event;
     },
   });
   ```

3. **Add error boundaries**
   - **File:** Update `/app/error.tsx`

   ```typescript
   'use client';
   import * as Sentry from '@sentry/nextjs';
   import { useEffect } from 'react';

   export default function Error({
     error,
     reset,
   }: {
     error: Error & { digest?: string };
     reset: () => void;
   }) {
     useEffect(() => {
       Sentry.captureException(error);
     }, [error]);

     return (
       <div>
         <h2>Something went wrong!</h2>
         <button onClick={() => reset()}>Try again</button>
       </div>
     );
   }
   ```

#### Option B: Cloudflare Analytics (Lightweight)

```typescript
// Add to middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Track errors
  try {
    return response;
  } catch (error) {
    // Send to Cloudflare Analytics
    request.cf?.analytics?.log?.("error", {
      url: request.url,
      error: error.message,
    });
    throw error;
  }
}
```

### Monitoring Checklist

- [ ] Set up Sentry or similar
- [ ] Configure alerting (email/Slack)
- [ ] Track API errors
- [ ] Track CSP violations
- [ ] Track rate limit hits
- [ ] Track slow requests (> 5s)
- [ ] Set up uptime monitoring
- [ ] Configure log retention (30+ days)

---

## 7. Data Privacy & LocalStorage

### Current LocalStorage Usage

**File:** `/hooks/useRecentlyViewed.ts`

**Data Stored:**

- Audio trend IDs
- Titles
- Authors
- Cover URLs
- View timestamps

**Risk Assessment:** LOW

- No PII stored
- No sensitive data
- Public data only

### Recommendations

1. **Add privacy notice**
   - Update privacy policy to mention localStorage usage
   - Add "Clear Data" button in settings

2. **Implement data expiration**

   ```typescript
   // /hooks/useRecentlyViewed.ts
   const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

   function cleanOldData(items: RecentlyViewedItem[]): RecentlyViewedItem[] {
     const now = Date.now();
     return items.filter((item) => now - item.viewedAt < MAX_AGE);
   }
   ```

3. **Add consent management** (if adding analytics)
   - Use Cloudflare Analytics (cookie-free)
   - Or implement consent banner

4. **Consider alternatives to localStorage**
   - Use IndexedDB for larger datasets
   - Use session storage for temporary data
   - Keep in memory if persistence not needed

---

## 8. Cloudflare Security Configuration

### WAF Rules (Recommended)

**Create in Cloudflare Dashboard:**

```javascript
// Rule 1: Block SQL injection attempts
(http.request.uri contains "SELECT" || http.request.uri contains "UNION" || http.request.uri contains "DROP") && http.request.uri.params contains "OR"

// Rule 2: Block XSS attempts
http.request.uri contains "<script" || http.request.uri contains "javascript:"

// Rule 3: Rate limiting (backup)
(http.request.uri.path matches "^/api/.*")
```

### Bot Protection

```yaml
# Cloudflare Bot Fight Mode (Free)
Super Bot Fight Mode: On
- Block verified bots
- Challenge AI scrapers
- Allow good bots (Google, Facebook, etc.)
```

### DDoS Protection

```
HTTP DDoS Protection: ON
Under Attack Mode: Auto (when rate limit exceeded)
```

### Additional Cloudflare Features

| Feature                     | Status            | Recommendation         |
| --------------------------- | ----------------- | ---------------------- |
| SSL/TLS                     | ✅ Full (strict)  | Current                |
| Brotli Compression          | ✅ Enabled        | Current                |
| HTTP/3                      | ✅ Enabled        | Current                |
| 0-RTT Connection Resumption | ⚠️ Check          | Enable for performance |
| Email Obfuscation           | ❌ Not configured | Recommended            |
| Hotlink Protection          | ⚠️ Not configured | Recommended for images |

### Hotlink Protection Configuration

```javascript
// Cloudflare Transform Rule - Page Rules
if (http.request.uri.path matches "\.(jpg|jpeg|png|gif|webp)$" &&
    http.referer !~ "^https?://(www\.)?gramdominator\.com") {
  action: block
}
```

---

## 9. Incident Response Plan

### Severity Levels

| Level       | Description                                        | Response Time |
| ----------- | -------------------------------------------------- | ------------- |
| P0 CRITICAL | Active exploit, data breach, RCE                   | 1 hour        |
| P1 HIGH     | Privilege escalation, DoS, sensitive data exposure | 4 hours       |
| P2 MEDIUM   | XSS, CSRF, misconfiguration                        | 24 hours      |
| P3 LOW      | Information disclosure, missing headers            | 1 week        |

### Response Procedures

#### P0 CRITICAL Incident

1. **Immediate (0-1 hour):**
   - Shut down affected systems (if safe)
   - Enable maintenance mode
   - Alert security team via Slack/Email
   - Preserve logs and evidence

2. **Short-term (1-4 hours):**
   - Identify root cause
   - Patch vulnerability
   - Restore from backup if needed
   - Verify patch

3. **Post-incident:**
   - Document timeline
   - Update security procedures
   - Conduct post-mortem
   - Notify users if data exposed

#### Contact Information

```
Security Lead: [EMAIL]
Infrastructure Lead: [EMAIL]
On-Call Rotation: [PHONE]
Cloudflare Support: https://support.cloudflare.com
```

### Evidence Collection

```bash
# Preserve logs
curl -H "X-Auth-Email: $EMAIL" \
     -H "X-Auth-Key: $KEY" \
     "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/logs/requests?start=$START&end=$END" \
     > incident-logs.json

# Database snapshot
wrangler d1 export DB_NAME --output=incident-snapshot.sql

# KV backup
wrangler kv:bulk get --namespace-id=NAMESPACE_ID --path=incident-kv-backup.json
```

### Communication Templates

**Internal Slack:**

```
🚨 SECURITY INCIDENT - P0 CRITICAL

Service: GramDominator.com
Severity: CRITICAL
Status: INVESTIGATING
Impact: [DESCRIBE]
Next Update: 1 hour

#incident-response
```

**Public Statement (if needed):**

```
We experienced a security incident affecting [SERVICE].
We have [CONTAINMENT ACTION].
No user data was [COMPROMISED/PRESERVED].
We are continuing to investigate.
```

---

## 10. Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)

- [ ] Upgrade Next.js to v15.5.8
- [ ] Fix critical/high dependency vulnerabilities
- [ ] Implement basic rate limiting
- [ ] Add request ID logging

### Phase 2: Security Hardening (Week 2-3)

- [ ] Migrate CSP to nonce-based
- [ ] Add CSP violation monitoring
- [ ] Implement Sentry error tracking
- [ ] Add WAF rules in Cloudflare

### Phase 3: Monitoring & Response (Week 4)

- [ ] Set up alerting (Sentry, Cloudflare)
- [ ] Document incident response procedures
- [ ] Conduct security review
- [ ] Create security runbook

### Phase 4: Ongoing Maintenance

- [ ] Weekly dependency audits
- [ ] Monthly security reviews
- [ ] Quarterly penetration testing
- [ ] Annual security training

---

## 11. Security Testing Checklist

### Automated Testing

- [ ] **Unit Tests:** Validate input sanitization
- [ ] **Integration Tests:** API security tests
- [ ] **E2E Tests:** XSS injection attempts
- [ ] **DAST:** OWASP ZAP or Burp Suite scans
- [ ] **SAST:** CodeQL or Semgrep analysis

### Manual Testing

- [ ] **Penetration Testing:** Hire firm for annual test
- [ ] **Threat Modeling:** Review attack surface quarterly
- [ ] **Code Review:** Security-focused PR reviews

### Example Test Cases

```typescript
// /tests/security/rate-limit.test.ts
describe("Rate Limiting", () => {
  it("should block requests after limit exceeded", async () => {
    for (let i = 0; i < 11; i++) {
      const response = await fetch("/api/bio", { method: "POST" });
      if (i < 10) {
        expect(response.status).toBe(200);
      } else {
        expect(response.status).toBe(429);
      }
    }
  });
});

// /tests/security/xss.test.ts
describe("XSS Prevention", () => {
  it("should sanitize script tags in bio generator", async () => {
    const response = await fetch("/api/bio", {
      method: "POST",
      body: JSON.stringify({
        name: '<script>alert("XSS")</script>',
      }),
    });
    const data = await response.json();
    expect(data.text).not.toContain("<script>");
  });
});
```

---

## 12. Compliance & Legal

### GDPR Compliance

- ✅ No PII stored
- ✅ No tracking cookies
- ⚠️ Add privacy policy page
- ⚠️ Add data deletion endpoint (if auth added)

### CCPA Compliance

- ✅ No personal data sold
- ⚠️ Add "Do Not Sell My Info" link

### COPPA Compliance

- ✅ No data collection from children
- ✅ No user accounts

### Recommended Actions

1. Add `/privacy` page (already have `/about` and `/contact`)
2. Add `/terms` page
3. Add cookie notice (if adding analytics)

---

## Summary & Key Takeaways

### Immediate Actions (Today)

1. **UPGRADE NEXT.JS TO v15.5.8** (CRITICAL RCE vulnerability)
2. Run `npm audit fix` to patch dependencies
3. Review Cloudflare WAF rules

### This Week

1. Implement rate limiting on API routes
2. Set up basic error tracking
3. Add CSP violation monitoring

### This Month

1. Migrate CSP to nonce-based approach
2. Conduct security review
3. Document incident response procedures

### Ongoing

1. Weekly dependency audits
2. Monthly security reviews
3. Quarterly penetration testing
4. Annual security training

---

## Appendix: File Changes Required

### Critical Files to Modify

1. **/package.json** - Update Next.js version
2. **/lib/security.ts** - Migrate to nonce-based CSP
3. **/middleware.ts** - Add rate limiting checks
4. **/app/api/bio/route.ts** - Add rate limiting integration
5. **/app/api/tools/watermark/route.ts** - Add rate limiting
6. **/lib/proxy-grid.ts** - Add request signing
7. **/.env.example** - Add Sentry DSN

### New Files to Create

1. **/lib/rate-limit.ts** - Rate limiting implementation
2. **/lib/csp-nonce.ts** - Nonce generation for CSP
3. **/app/api/csp-report/route.ts** - CSP violation endpoint
4. **/sentry.client.config.ts** - Sentry configuration
5. **/sentry.server.config.ts** - Sentry server config
6. **/.github/workflows/security-audit.yml** - CI/CD security checks

---

**Audit Completed:** 2025-01-13
**Next Review:** 2025-02-13
**Auditor:** Security Agent (Claude)
