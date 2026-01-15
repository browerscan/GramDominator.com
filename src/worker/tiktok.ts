import puppeteer from "@cloudflare/puppeteer";
import type { Env, TrendItem } from "./types";

// Import logger conditionally for worker environment
let logger: typeof import("../../lib/logger").logger;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loggerModule = require("../../lib/logger");
  logger = loggerModule.logger;
} catch {
  // Fallback to console if logger module not available in worker context
  logger = {
    error: (...args: unknown[]) => console.error("[TikTokScraper]", ...args),
    warn: (...args: unknown[]) => console.warn("[TikTokScraper]", ...args),
    info: (...args: unknown[]) => console.info("[TikTokScraper]", ...args),
    debug: (...args: unknown[]) => console.log("[TikTokScraper]", ...args),
    exception: (error: Error, context?: Record<string, unknown>) => {
      console.error("[TikTokScraper]", error.message, context);
    },
  };
}

const TARGET_URL =
  "https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/en";

const ROW_SELECTORS = [
  'div[class*="RankingList_item"]',
  'div[class*="ranking-item"]',
  'div[data-e2e*="ranking"]',
  'div[class*="RankingItem"]',
];

const TITLE_SELECTORS = [
  '[class*="MusicInfo_title"]',
  '[class*="music-title"]',
  '[data-e2e="music-title"]',
  '[class*="MusicTitle"]',
];

const AUTHOR_SELECTORS = [
  '[class*="MusicInfo_author"]',
  '[class*="author"]',
  '[data-e2e="music-author"]',
  '[class*="MusicAuthor"]',
];

const USAGE_SELECTORS = [
  '[class*="Usage"]',
  '[data-e2e="music-usage"]',
  '[class*="VideoCount"]',
];

const MAX_ITEMS = 50;
const DEFAULT_PROXY_BASE = "http://google.savedimage.com";
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_TIMEOUT = 300000;

interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

const puppeteerBreaker: CircuitBreakerState = {
  isOpen: false,
  failureCount: 0,
  lastFailureTime: 0,
  nextAttemptTime: 0,
};

const proxyGridBreaker: CircuitBreakerState = {
  isOpen: false,
  failureCount: 0,
  lastFailureTime: 0,
  nextAttemptTime: 0,
};

interface ScrapeContext {
  source: "puppeteer" | "proxy-grid" | "stale";
  attempt: number;
  totalAttempts: number;
  duration: number;
}

function calculateRetryDelay(attempt: number): number {
  return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), 10000);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logWithContext(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>,
) {
  const contextStr = Object.entries(context)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ");
  const logFn =
    level === "error"
      ? logger.error
      : level === "warn"
        ? logger.warn
        : logger.info;
  logFn(`[TikTokScraper] ${message} ${contextStr}`);
}

function canExecuteCircuit(breaker: CircuitBreakerState): boolean {
  if (!breaker.isOpen) return true;

  const now = Date.now();
  if (now >= breaker.nextAttemptTime) {
    breaker.isOpen = false;
    breaker.failureCount = 0;
    return true;
  }

  return false;
}

function recordCircuitSuccess(breaker: CircuitBreakerState): void {
  breaker.failureCount = 0;
  breaker.isOpen = false;
}

function recordCircuitFailure(breaker: CircuitBreakerState): void {
  breaker.failureCount += 1;
  breaker.lastFailureTime = Date.now();

  if (breaker.failureCount >= CIRCUIT_THRESHOLD) {
    breaker.isOpen = true;
    breaker.nextAttemptTime = Date.now() + CIRCUIT_TIMEOUT;
    logWithContext("warn", "Circuit breaker opened", {
      failureCount: breaker.failureCount,
      nextAttemptTime: new Date(breaker.nextAttemptTime).toISOString(),
    });
  }
}

function getCircuitState(breaker: CircuitBreakerState) {
  return {
    isOpen: breaker.isOpen,
    failureCount: breaker.failureCount,
    timeUntilReset: Math.max(0, breaker.nextAttemptTime - Date.now()),
  };
}

export function getPuppeteerCircuitState() {
  return getCircuitState(puppeteerBreaker);
}

export function getProxyGridCircuitState() {
  return getCircuitState(proxyGridBreaker);
}

export async function scrapeTikTokTrends(
  env: Env,
  options: { forceProxyGrid?: boolean; useStaleFallback?: boolean } = {},
): Promise<TrendItem[]> {
  const startTime = Date.now();
  const context: ScrapeContext[] = [];

  const staleData = await getStaleData(env);
  if (staleData.length > 0 && options.useStaleFallback) {
    logWithContext("info", "Using stale data fallback", {
      count: staleData.length,
    });
    return staleData.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  if (!canExecuteCircuit(puppeteerBreaker)) {
    logWithContext(
      "warn",
      "Puppeteer circuit breaker open, skipping to Proxy Grid",
      {
        state: getCircuitState(puppeteerBreaker),
      },
    );
    return await scrapeWithProxyGridFallback(env, context, startTime);
  }

  if (options.forceProxyGrid) {
    return await scrapeWithProxyGridFallback(env, context, startTime);
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const attemptStart = Date.now();

    try {
      const data = await scrapeWithPuppeteer(env.MYBROWSER);

      const attemptContext: ScrapeContext = {
        source: "puppeteer",
        attempt,
        totalAttempts: MAX_RETRIES,
        duration: Date.now() - attemptStart,
      };
      context.push(attemptContext);

      if (data.length > 0) {
        recordCircuitSuccess(puppeteerBreaker);

        await cacheResults(env, data);

        logWithContext("info", "Puppeteer scrape successful", {
          ...attemptContext,
          itemCount: data.length,
          totalDuration: Date.now() - startTime,
        });

        return data;
      }

      logWithContext("warn", "Puppeteer scrape returned empty results", {
        ...attemptContext,
      });
    } catch (error) {
      const attemptContext: ScrapeContext = {
        source: "puppeteer",
        attempt,
        totalAttempts: MAX_RETRIES,
        duration: Date.now() - attemptStart,
      };
      context.push(attemptContext);

      recordCircuitFailure(puppeteerBreaker);

      logWithContext("warn", "Puppeteer scrape attempt failed", {
        ...attemptContext,
        error: error instanceof Error ? error.message : String(error),
        circuitState: getCircuitState(puppeteerBreaker),
      });

      if (attempt < MAX_RETRIES) {
        const delay = calculateRetryDelay(attempt - 1);
        logWithContext("info", "Retrying after delay", {
          delay,
          nextAttempt: attempt + 1,
        });
        await sleep(delay);
      }
    }
  }

  return await scrapeWithProxyGridFallback(env, context, startTime);
}

async function scrapeWithProxyGridFallback(
  env: Env,
  context: ScrapeContext[],
  startTime: number,
): Promise<TrendItem[]> {
  if (!env.PROXY_GRID_SECRET) {
    logWithContext(
      "error",
      "Proxy Grid not configured, no fallback available",
      {
        context,
      },
    );

    if (env.SLACK_WEBHOOK_URL) {
      void sendAlert(env, "TikTok scrape failed: Proxy Grid not configured.");
    }

    return [];
  }

  if (!canExecuteCircuit(proxyGridBreaker)) {
    logWithContext("error", "Proxy Grid circuit breaker open", {
      state: getCircuitState(proxyGridBreaker),
      context,
    });

    const staleData = await getStaleData(env);
    if (staleData.length > 0) {
      logWithContext("info", "Falling back to stale data", {
        count: staleData.length,
      });
      void sendAlert(
        env,
        `TikTok scrape failed, using stale data. count=${staleData.length}`,
      );
      return staleData.map((item, idx) => ({ ...item, rank: idx + 1 }));
    }

    if (env.SLACK_WEBHOOK_URL) {
      void sendAlert(env, "TikTok scrape failed: All circuits open.");
    }

    return [];
  }

  const attemptStart = Date.now();

  try {
    const data = await scrapeWithProxyGrid(env);

    const attemptContext: ScrapeContext = {
      source: "proxy-grid",
      attempt: 1,
      totalAttempts: 1,
      duration: Date.now() - attemptStart,
    };
    context.push(attemptContext);

    if (data.length > 0) {
      recordCircuitSuccess(proxyGridBreaker);

      await cacheResults(env, data);

      logWithContext("info", "Proxy Grid scrape successful", {
        ...attemptContext,
        itemCount: data.length,
        totalDuration: Date.now() - startTime,
      });

      void sendAlert(
        env,
        `ProxyGrid fallback used for TikTok trends. count=${data.length}`,
      );

      return data;
    }

    recordCircuitFailure(proxyGridBreaker);

    logWithContext("warn", "Proxy Grid returned empty results", {
      ...attemptContext,
    });
  } catch (error) {
    recordCircuitFailure(proxyGridBreaker);

    const attemptContext: ScrapeContext = {
      source: "proxy-grid",
      attempt: 1,
      totalAttempts: 1,
      duration: Date.now() - attemptStart,
    };
    context.push(attemptContext);

    logWithContext("error", "Proxy Grid scrape failed", {
      ...attemptContext,
      error: error instanceof Error ? error.message : String(error),
      circuitState: getCircuitState(proxyGridBreaker),
    });
  }

  const staleData = await getStaleData(env);
  if (staleData.length > 0) {
    logWithContext(
      "info",
      "Falling back to stale data after Proxy Grid failure",
      {
        count: staleData.length,
      },
    );
    void sendAlert(env, "TikTok scrape failed, using stale data fallback.");
    return staleData.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  if (env.SLACK_WEBHOOK_URL) {
    void sendAlert(env, "TikTok scrape failed: All methods exhausted.");
  }

  return [];
}

async function scrapeWithPuppeteer(
  browserBinding: Fetcher,
): Promise<TrendItem[]> {
  const browser = await puppeteer.launch(browserBinding);
  const page = await browser.newPage();

  await page.setViewport({ width: 1440, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  try {
    await page.goto(TARGET_URL, { waitUntil: "networkidle0", timeout: 30000 });

    const rowSelector = ROW_SELECTORS.join(",");
    await page.waitForSelector(rowSelector, { timeout: 20000 });

    const data = await page.evaluate(
      (
        rowSelector,
        titleSelectors,
        authorSelectors,
        usageSelectors,
        maxItems,
      ) => {
        const pickText = (root: Element | Document, selectors: string[]) => {
          for (const selector of selectors) {
            const el = root.querySelector(selector);
            if (el && el.textContent) return el.textContent.trim();
          }
          return "";
        };

        const parseCount = (value: string) => {
          if (!value) return 0;
          const cleaned = value.replace(/[,\s]/g, "").toUpperCase();
          const number = parseFloat(cleaned);
          if (Number.isNaN(number)) return 0;
          if (cleaned.endsWith("K")) return Math.round(number * 1000);
          if (cleaned.endsWith("M")) return Math.round(number * 1000000);
          if (cleaned.endsWith("B")) return Math.round(number * 1000000000);
          return Math.round(number);
        };

        const slugify = (value: string) =>
          value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 64);

        type Item = {
          id: string;
          rank: number;
          title: string;
          author: string;
          play_count: number;
          cover_url: string;
        };

        const rows = Array.from(document.querySelectorAll(rowSelector));
        const items: Item[] = [];
        const seen = new Set<string>();

        const extractFromRow = (row: Element, index: number) => {
          const linkEl = row.querySelector('a[href*="/music/"]');
          const href = linkEl ? linkEl.getAttribute("href") || "" : "";
          const match = href.match(/\/music\/(\d+)/);
          const title =
            pickText(row, titleSelectors) || linkEl?.textContent?.trim() || "";
          const author = pickText(row, authorSelectors);
          const usageText = pickText(row, usageSelectors);
          const playCount = parseCount(usageText);
          const img = row.querySelector("img");
          const cover = img ? img.getAttribute("src") || "" : "";

          const id =
            match?.[1] ||
            slugify(`${title}-${author}-${index}`) ||
            `unknown-${index}`;
          if (seen.has(id)) return null;
          seen.add(id);

          return {
            id,
            rank: index + 1,
            title: title || "Unknown",
            author: author || "Unknown",
            play_count: playCount,
            cover_url: cover,
          };
        };

        rows.forEach((row, index) => {
          if (items.length >= maxItems) return;
          const item = extractFromRow(row, index);
          if (item) items.push(item);
        });

        if (!items.length) {
          const links = Array.from(
            document.querySelectorAll('a[href*="/music/"]'),
          );
          links.forEach((link, index) => {
            if (items.length >= maxItems) return;
            const row = link.closest("div");
            if (!row) return;
            const item = extractFromRow(row, index);
            if (item) items.push(item);
          });
        }

        return items;
      },
      rowSelector,
      TITLE_SELECTORS,
      AUTHOR_SELECTORS,
      USAGE_SELECTORS,
      MAX_ITEMS,
    );

    return data as TrendItem[];
  } finally {
    await browser.close();
  }
}

async function scrapeWithProxyGrid(env: Env): Promise<TrendItem[]> {
  const base = env.PROXY_GRID_BASE || DEFAULT_PROXY_BASE;
  const url = `${base.replace(/\/+$/, "")}/api/search`;

  const requestBody = {
    type: "tiktok",
    query: "trending",
  };

  logWithContext("info", "Proxy Grid request", { url });

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (env.PROXY_GRID_SECRET) {
      headers["x-grid-secret"] = env.PROXY_GRID_SECRET;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Proxy Grid request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = (await response.json()) as Record<string, unknown>;
      const data = parseTikTokResponse(json);

      if (data.length > 0) {
        return data;
      }

      const body =
        typeof json.body === "string"
          ? json.body
          : typeof json.html === "string"
            ? json.html
            : typeof json.data === "string"
              ? json.data
              : JSON.stringify(json);

      return parseFallbackHtml(body);
    }

    const body = await response.text();
    return parseFallbackHtml(body);
  } catch (error) {
    logWithContext("error", "Proxy Grid fetch error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function parseTikTokResponse(json: Record<string, unknown>): TrendItem[] {
  const items: TrendItem[] = [];
  const seen = new Set<string>();

  const data = (json.data as Array<Record<string, unknown>>) ?? json;
  const dataArray = Array.isArray(data) ? data : [];

  for (const [index, item] of dataArray.entries()) {
    const record = item as Record<string, unknown>;
    const id = String(record.id ?? record.music_id ?? `tiktok-${index}`);

    if (seen.has(id)) continue;
    seen.add(id);

    items.push({
      id,
      rank: Number(record.rank ?? index + 1),
      title: String(record.title ?? record.name ?? "Unknown"),
      author: String(record.author ?? record.artist ?? "Unknown"),
      play_count: Number(record.play_count ?? record.video_count ?? 0),
      cover_url: String(record.cover_url ?? record.cover ?? ""),
    });

    if (items.length >= MAX_ITEMS) break;
  }

  return items;
}

function parseFallbackHtml(html: string): TrendItem[] {
  if (!html) return [];
  const items: TrendItem[] = [];
  const seen = new Set<string>();

  const decode = (value: string) =>
    value
      .replace(/\\"/g, '"')
      .replace(/\\u([\dA-Fa-f]{4})/g, (_, g) =>
        String.fromCharCode(parseInt(g, 16)),
      )
      .trim();

  const jsonMatches = html.matchAll(
    /"music_id":"?(\d+)"?[^}]*?"title":"([^"]+)"[^}]*?"author":"([^"]*)"/g,
  );
  for (const match of jsonMatches) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const title = decode(match[2]);
    const author = decode(match[3] || "Unknown");
    const playCount = extractPlayCount(match[0]);
    items.push({
      id,
      rank: items.length + 1,
      title: title || "Unknown",
      author: author || "Unknown",
      play_count: playCount,
      cover_url: "",
    });
    if (items.length >= MAX_ITEMS) break;
  }

  if (!items.length) {
    const linkMatches = html.matchAll(
      /href="[^"]*\/music\/(\d+)[^"]*".*?>([^<]+)</g,
    );
    for (const match of linkMatches) {
      const id = match[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const title = decode(match[2]);
      items.push({
        id,
        rank: items.length + 1,
        title: title || "Unknown",
        author: "Unknown",
        play_count: 0,
        cover_url: "",
      });
      if (items.length >= MAX_ITEMS) break;
    }
  }

  return items;
}

function extractPlayCount(snippet: string): number {
  const playMatch =
    snippet.match(/"video_count":(\d+)/) || snippet.match(/"videoCnt":(\d+)/);
  if (playMatch) return Number(playMatch[1]) || 0;
  return 0;
}

async function getStaleData(env: Env): Promise<TrendItem[]> {
  try {
    const result = await env.DB.prepare(
      `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url
       FROM audio_trends
       WHERE platform = ?
       ORDER BY updated_at DESC
       LIMIT ?`,
    )
      .bind("tiktok", MAX_ITEMS)
      .all<TrendItem>();

    return (result.results ?? []) as TrendItem[];
  } catch {
    return [];
  }
}

async function cacheResults(env: Env, data: TrendItem[]): Promise<void> {
  try {
    const timestamp = Date.now();
    const statements: D1PreparedStatement[] = [];

    for (const item of data) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO audio_trends (platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(platform, id) DO UPDATE SET
             title = excluded.title,
             author = excluded.author,
             play_count = excluded.play_count,
             rank = excluded.rank,
             cover_url = excluded.cover_url,
             updated_at = excluded.updated_at`,
        ).bind(
          "tiktok",
          item.id,
          item.title,
          item.author,
          item.play_count,
          item.rank,
          null,
          null,
          null,
          item.cover_url,
          timestamp,
        ),
      );
    }

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }
  } catch (error) {
    logWithContext("error", "Failed to cache results", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function sendAlert(env: Env, message: string) {
  if (!env.SLACK_WEBHOOK_URL) return;
  try {
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `GramDominator alert: ${message}`,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    logger.error("Failed to send Slack alert", error);
  }
}
