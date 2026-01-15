import { calculateGrowthRate } from "./worker/growth";
import { tagAudioWithAI } from "./worker/ai-tagger";
import { scrapeTikTokTrends } from "./worker/tiktok";
import type { Env, HistoryRow, HashtagItem, TrendItem } from "./worker/types";
import {
  successResponse,
  errorResponse,
  generateRequestId,
  notFound,
  unauthorized,
  validationError,
} from "../lib/api-response";
import { CACHE_CONFIG } from "../lib/cache";
import { RATE_LIMIT_CONFIGS, applyRateLimit } from "../lib/rate-limit";
import { logger } from "../lib/logger";

const PLATFORM = "tiktok";

const CRON_EXECUTION_KEY = "cron:execution";
const METRICS_KEY = "metrics:daily";

interface CronExecution {
  lastRun: number;
  lastSuccess: number;
  lastFailure: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  totalRuns: number;
}

interface PipelineMetrics {
  timestamp: number;
  duration: number;
  status: "success" | "partial" | "error";
  itemCount: number;
  tagsGenerated: number;
  hashtagIngestCount?: number;
  source: "puppeteer" | "proxy-grid" | "stale";
  errorMessage?: string;
}

interface DailyMetrics {
  date: string;
  executions: PipelineMetrics[];
  totalRuns: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  averageItemCount: number;
}

const MOCK_KV = new Map<string, string>();

async function kvGet(key: string): Promise<string | null> {
  return MOCK_KV.get(key) ?? null;
}

async function kvPut(key: string, value: string, ttl?: number): Promise<void> {
  MOCK_KV.set(key, value);
  if (ttl) {
    setTimeout(() => MOCK_KV.delete(key), ttl * 1000);
  }
}

async function kvDelete(key: string): Promise<void> {
  MOCK_KV.delete(key);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    ctx.waitUntil(
      (async () => {
        try {
          const result = await runPipeline(env, { scheduled: true });
          const duration = Date.now() - startTime;

          await recordCronExecution(env, {
            lastRun: Date.now(),
            lastSuccess: Date.now(),
            lastFailure: 0,
            consecutiveFailures: 0,
            consecutiveSuccesses: 1,
            totalRuns: 1,
          });

          await recordMetrics(env, {
            timestamp: Date.now(),
            duration,
            status: result.status === "success" ? "success" : "partial",
            itemCount: result.count ?? 0,
            tagsGenerated: result.tags_generated ?? 0,
            source: result.source ?? "puppeteer",
          });

          logger.info(
            `[Cron] Pipeline completed in ${duration}ms`,
            JSON.stringify(result),
          );
        } catch (error) {
          const duration = Date.now() - startTime;

          await recordCronFailure(env);

          await recordMetrics(env, {
            timestamp: Date.now(),
            duration,
            status: "error",
            itemCount: 0,
            tagsGenerated: 0,
            source: "puppeteer",
            errorMessage:
              error instanceof Error ? error.message : String(error),
          });

          logger.error("[Cron] Pipeline failed", error);
        }
      })(),
    );
  },

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const requestId = generateRequestId();
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return successResponse(
        {
          status: "ok",
          timestamp: Date.now(),
          uptime: process.uptime?.() ?? 0,
        },
        { requestId, cache: "PUBLIC_SHORT" },
      );
    }

    if (url.pathname === "/api/v1/metrics") {
      return handleMetricsEndpoint(request, env, requestId);
    }

    if (url.pathname === "/api/v1/circuit-state") {
      return handleCircuitStateEndpoint(env, requestId);
    }

    if (url.pathname.startsWith("/api/v1")) {
      return handleApi(request, env, url, requestId);
    }

    if (!isAuthorized(request, env)) {
      return errorResponse("Unauthorized", {
        code: "UNAUTHORIZED",
        requestId,
      });
    }

    try {
      const result = await runPipeline(env, { manual: true });
      return successResponse(result, { requestId });
    } catch (error) {
      logger.error("Pipeline failed", error);
      return errorResponse(
        error instanceof Error ? error.message : String(error),
        {
          requestId,
        },
      );
    }
  },
};

function isAuthorized(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization");
  if (auth === `Bearer ${env.CRON_SECRET}`) return true;
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  return secret !== null && secret === env.CRON_SECRET;
}

function isApiAuthorized(request: Request, env: Env): boolean {
  if (!env.API_TOKEN) return false;
  const auth = request.headers.get("Authorization");
  if (auth === `Bearer ${env.API_TOKEN}`) return true;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  return key !== null && key === env.API_TOKEN;
}

async function handleMetricsEndpoint(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return errorResponse("Unauthorized", {
      code: "UNAUTHORIZED",
      requestId,
    });
  }

  try {
    const cronData = await kvGet(CRON_EXECUTION_KEY);
    const metricsData = await kvGet(METRICS_KEY);

    const cronState: CronExecution = cronData
      ? JSON.parse(cronData)
      : {
          lastRun: 0,
          lastSuccess: 0,
          lastFailure: 0,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          totalRuns: 0,
        };

    const dailyMetrics: DailyMetrics = metricsData
      ? JSON.parse(metricsData)
      : {
          date: new Date().toISOString().split("T")[0],
          executions: [],
          totalRuns: 0,
          successCount: 0,
          failureCount: 0,
          averageDuration: 0,
          averageItemCount: 0,
        };

    return successResponse(
      {
        cron: cronState,
        metrics: dailyMetrics,
        timestamp: Date.now(),
      },
      { requestId, cache: "PUBLIC_SHORT" },
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : String(error),
      { requestId },
    );
  }
}

async function handleCircuitStateEndpoint(
  env: Env,
  requestId: string,
): Promise<Response> {
  const { getPuppeteerCircuitState, getProxyGridCircuitState } =
    await import("./worker/tiktok");

  return successResponse(
    {
      puppeteer: getPuppeteerCircuitState(),
      proxyGrid: getProxyGridCircuitState(),
      timestamp: Date.now(),
    },
    { requestId, cache: "PUBLIC_SHORT" },
  );
}

async function recordCronExecution(
  env: Env,
  update: Partial<CronExecution>,
): Promise<void> {
  try {
    const existing = await kvGet(CRON_EXECUTION_KEY);
    const current: CronExecution = existing
      ? JSON.parse(existing)
      : {
          lastRun: 0,
          lastSuccess: 0,
          lastFailure: 0,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          totalRuns: 0,
        };

    const updated: CronExecution = {
      ...current,
      ...update,
      lastRun: update.lastRun ?? current.lastRun,
      totalRuns: current.totalRuns + 1,
    };

    await kvPut(CRON_EXECUTION_KEY, JSON.stringify(updated), 86400);
  } catch (error) {
    logger.error("Failed to record cron execution", error);
  }
}

async function recordCronFailure(env: Env): Promise<void> {
  try {
    const existing = await kvGet(CRON_EXECUTION_KEY);
    const current: CronExecution = existing
      ? JSON.parse(existing)
      : {
          lastRun: 0,
          lastSuccess: 0,
          lastFailure: 0,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          totalRuns: 0,
        };

    const updated: CronExecution = {
      ...current,
      lastRun: Date.now(),
      lastFailure: Date.now(),
      consecutiveFailures: current.consecutiveFailures + 1,
      consecutiveSuccesses: 0,
      totalRuns: current.totalRuns + 1,
    };

    await kvPut(CRON_EXECUTION_KEY, JSON.stringify(updated), 86400);
  } catch (error) {
    logger.error("Failed to record cron failure", error);
  }
}

async function recordMetrics(
  env: Env,
  metrics: PipelineMetrics,
): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const existing = await kvGet(METRICS_KEY);

    let daily: DailyMetrics = existing
      ? JSON.parse(existing)
      : {
          date: today,
          executions: [],
          totalRuns: 0,
          successCount: 0,
          failureCount: 0,
          averageDuration: 0,
          averageItemCount: 0,
        };

    if (daily.date !== today) {
      daily = {
        date: today,
        executions: [],
        totalRuns: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
        averageItemCount: 0,
      };
    }

    daily.executions.push(metrics);
    daily.totalRuns += 1;

    if (metrics.status === "success") {
      daily.successCount += 1;
    } else {
      daily.failureCount += 1;
    }

    const totalDuration = daily.executions.reduce(
      (sum, m) => sum + m.duration,
      0,
    );
    daily.averageDuration = totalDuration / daily.executions.length;

    const totalItems = daily.executions.reduce(
      (sum, m) => sum + m.itemCount,
      0,
    );
    daily.averageItemCount = totalItems / daily.executions.length;

    await kvPut(METRICS_KEY, JSON.stringify(daily), 86400 * 7);
  } catch (error) {
    logger.error("Failed to record metrics", error);
  }
}

interface PipelineOptions {
  scheduled?: boolean;
  manual?: boolean;
  forceProxyGrid?: boolean;
  useStaleFallback?: boolean;
}

interface PipelineResult {
  status: "success" | "warning" | "error";
  message?: string;
  count: number;
  top_song?: string | null;
  tags_generated: number;
  hashtag_ingest?: Record<string, unknown>;
  source?: "puppeteer" | "proxy-grid" | "stale";
  duration?: number;
}

async function runPipeline(
  env: Env,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const startTime = Date.now();
  const { forceProxyGrid = false, useStaleFallback = false } = options;

  const trends =
    (await scrapeTikTokTrends(env, {
      forceProxyGrid,
      useStaleFallback,
    })) ?? [];

  if (!trends.length) {
    return {
      status: "warning",
      message: "No trends found, using stale data fallback",
      count: 0,
      tags_generated: 0,
      source: "stale",
      duration: Date.now() - startTime,
    };
  }

  const normalized = normalizeTrends(trends);

  if (!normalized.length) {
    return {
      status: "warning",
      message: "No trends found after normalization",
      count: 0,
      tags_generated: 0,
      source: "puppeteer",
      duration: Date.now() - startTime,
    };
  }

  const timestamp = Date.now();
  const historyMap = await getLatestHistoryMap(
    env,
    PLATFORM,
    normalized.map((item) => item.id),
  );
  const tagMap = await getExistingTagMap(
    env,
    PLATFORM,
    normalized.map((item) => item.id),
  );
  const statements: D1PreparedStatement[] = [];
  const maxTags = parseTagLimit(env.AI_TAG_LIMIT);
  let tagsGenerated = 0;

  for (const item of normalized) {
    const history = historyMap.get(item.id);
    const growthRate = calculateGrowthRate(item, history);
    const existingTags = tagMap.get(item.id);
    let genre = existingTags?.genre ?? null;
    let vibe = existingTags?.vibe ?? null;

    if (shouldTag(genre, vibe) && tagsGenerated < maxTags) {
      const aiTags = await tagAudioWithAI(env, item.title, item.author);
      genre = aiTags.genre;
      vibe = aiTags.vibe;
      tagsGenerated += 1;
    }

    statements.push(
      env.DB.prepare(
        `INSERT INTO audio_trends (platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, id) DO UPDATE SET
           title = excluded.title,
           author = excluded.author,
           play_count = excluded.play_count,
           rank = excluded.rank,
           growth_rate = excluded.growth_rate,
           genre = excluded.genre,
           vibe = excluded.vibe,
           cover_url = excluded.cover_url,
           updated_at = excluded.updated_at`,
      ).bind(
        PLATFORM,
        item.id,
        item.title,
        item.author,
        item.play_count,
        item.rank,
        growthRate,
        genre,
        vibe,
        item.cover_url,
        timestamp,
      ),
    );

    statements.push(
      env.DB.prepare(
        `INSERT INTO audio_trend_history (platform, id, snapshot_at, play_count, rank)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(PLATFORM, item.id, timestamp, item.play_count, item.rank),
    );
  }

  await env.DB.batch(statements);

  const hashtagResult = await maybeIngestHashtags(env, timestamp);

  return {
    status: "success",
    count: normalized.length,
    top_song: normalized[0]?.title ?? null,
    tags_generated: tagsGenerated,
    hashtag_ingest: hashtagResult,
    source: forceProxyGrid ? "proxy-grid" : "puppeteer",
    duration: Date.now() - startTime,
  };
}

function normalizeTrends(items: TrendItem[]): TrendItem[] {
  const deduped = new Map<string, TrendItem>();
  items.forEach((item) => {
    if (!deduped.has(item.id)) deduped.set(item.id, item);
  });

  return Array.from(deduped.values())
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 50)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

async function getLatestHistoryMap(
  env: Env,
  platform: string,
  ids: string[],
): Promise<Map<string, HistoryRow>> {
  const map = new Map<string, HistoryRow>();
  if (!ids.length) return map;

  const placeholders = ids.map(() => "?").join(",");
  const stmt = env.DB.prepare(
    `SELECT id, play_count, rank, snapshot_at
     FROM audio_trend_history
     WHERE platform = ? AND id IN (${placeholders})
       AND snapshot_at = (
         SELECT MAX(snapshot_at) FROM audio_trend_history h2
         WHERE h2.platform = audio_trend_history.platform
           AND h2.id = audio_trend_history.id
       )`,
  ).bind(platform, ...ids);

  const { results } = await stmt.all<HistoryRow>();
  results?.forEach((row) => map.set(row.id, row));
  return map;
}

async function getExistingTagMap(env: Env, platform: string, ids: string[]) {
  const map = new Map<string, { genre: string | null; vibe: string | null }>();
  if (!ids.length) return map;

  const placeholders = ids.map(() => "?").join(",");
  const stmt = env.DB.prepare(
    `SELECT id, genre, vibe FROM audio_trends WHERE platform = ? AND id IN (${placeholders})`,
  ).bind(platform, ...ids);

  const { results } = await stmt.all<{
    id: string;
    genre: string | null;
    vibe: string | null;
  }>();
  results?.forEach((row) =>
    map.set(row.id, { genre: row.genre, vibe: row.vibe }),
  );
  return map;
}

function shouldTag(genre: string | null, vibe: string | null) {
  const missingGenre = !genre || genre === "unknown";
  const missingVibe = !vibe || vibe === "mixed";
  return missingGenre || missingVibe;
}

function parseTagLimit(value?: string) {
  const parsed = Number(value ?? "15");
  if (!Number.isFinite(parsed) || parsed <= 0) return 15;
  return Math.min(parsed, 50);
}

async function maybeIngestHashtags(env: Env, timestamp: number) {
  if (!env.HASHTAG_API_URL) return { status: "skipped" };

  try {
    const response = await fetch(env.HASHTAG_API_URL, {
      headers: { "User-Agent": "GramDominatorBot/1.0" },
    });

    if (!response.ok) {
      return { status: "error", code: response.status };
    }

    const payload = (await response.json()) as { hashtags?: HashtagItem[] };
    const hashtags = payload.hashtags ?? [];
    if (!hashtags.length) return { status: "empty" };

    const statements: D1PreparedStatement[] = [];
    hashtags.forEach((tag) => {
      statements.push(
        env.DB.prepare(
          `INSERT INTO hashtags (platform, slug, volume, competition_score, related_tags, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(platform, slug) DO UPDATE SET
             volume = excluded.volume,
             competition_score = excluded.competition_score,
             related_tags = excluded.related_tags,
             updated_at = excluded.updated_at`,
        ).bind(
          PLATFORM,
          tag.slug,
          tag.volume,
          tag.competition_score,
          JSON.stringify(tag.related_tags ?? []),
          timestamp,
        ),
      );
    });

    await env.DB.batch(statements);

    return { status: "success", count: hashtags.length };
  } catch (error) {
    logger.error("Hashtag ingest failed", error);
    return { status: "error", message: (error as Error).message };
  }
}

async function handleApi(
  request: Request,
  env: Env,
  url: URL,
  requestId: string,
): Promise<Response> {
  if (!env.API_TOKEN) {
    return errorResponse("API_TOKEN not configured", {
      code: "SERVICE_UNAVAILABLE",
      requestId,
    });
  }

  if (!isApiAuthorized(request, env)) {
    return errorResponse(unauthorized());
  }

  const rateLimitResult = await applyRateLimit(request, RATE_LIMIT_CONFIGS.api);

  if (!rateLimitResult.allowed && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  if (url.pathname === "/api/v1/trends") {
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

    if (limit < 1 || limit > 100) {
      return errorResponse(validationError("Limit must be between 1 and 100"));
    }

    const stmt = env.DB.prepare(
      `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
       FROM audio_trends
       WHERE platform = ?
       ORDER BY rank ASC
       LIMIT ?`,
    ).bind(PLATFORM, limit);

    const { results } = await stmt.all();

    return successResponse(
      { data: results ?? [], count: results?.length ?? 0 },
      { requestId, cache: "trends" },
    );
  }

  if (url.pathname.startsWith("/api/v1/audio/")) {
    const id = url.pathname.replace("/api/v1/audio/", "");

    if (!id) {
      return errorResponse(notFound("Audio ID is required"));
    }

    const result = await env.DB.prepare(
      `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
       FROM audio_trends
       WHERE platform = ? AND id = ?
       LIMIT 1`,
    )
      .bind(PLATFORM, id)
      .first();

    if (!result) {
      return errorResponse(notFound("Audio track not found"));
    }

    return successResponse({ data: result }, { requestId, cache: "audio" });
  }

  if (url.pathname === "/api/v1/genres") {
    const result = await env.DB.prepare(
      `SELECT DISTINCT lower(genre) as genre
       FROM audio_trends
       WHERE platform = ? AND genre IS NOT NULL AND genre != ''
       ORDER BY genre ASC`,
    )
      .bind(PLATFORM)
      .all<{ genre: string }>();

    return successResponse(
      { data: result.results?.map((r) => r.genre) ?? [] },
      { requestId, cache: "trends" },
    );
  }

  if (url.pathname === "/api/v1/vibes") {
    const result = await env.DB.prepare(
      `SELECT DISTINCT lower(vibe) as vibe
       FROM audio_trends
       WHERE platform = ? AND vibe IS NOT NULL AND vibe != ''
       ORDER BY vibe ASC`,
    )
      .bind(PLATFORM)
      .all<{ vibe: string }>();

    return successResponse(
      { data: result.results?.map((r) => r.vibe) ?? [] },
      { requestId, cache: "trends" },
    );
  }

  if (url.pathname.startsWith("/api/v1/genre/")) {
    const genre = url.pathname.replace("/api/v1/genre/", "");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

    if (!genre) {
      return errorResponse(validationError("Genre is required"));
    }

    const result = await env.DB.prepare(
      `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
       FROM audio_trends
       WHERE platform = ? AND lower(genre) = ?
       ORDER BY rank ASC
       LIMIT ?`,
    )
      .bind(PLATFORM, genre.toLowerCase(), limit)
      .all();

    return successResponse(
      {
        data: result.results ?? [],
        count: result.results?.length ?? 0,
        genre,
      },
      { requestId, cache: "trends" },
    );
  }

  if (url.pathname.startsWith("/api/v1/vibe/")) {
    const vibe = url.pathname.replace("/api/v1/vibe/", "");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);

    if (!vibe) {
      return errorResponse(validationError("Vibe is required"));
    }

    const result = await env.DB.prepare(
      `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
       FROM audio_trends
       WHERE platform = ? AND lower(vibe) = ?
       ORDER BY rank ASC
       LIMIT ?`,
    )
      .bind(PLATFORM, vibe.toLowerCase(), limit)
      .all();

    return successResponse(
      {
        data: result.results ?? [],
        count: result.results?.length ?? 0,
        vibe,
      },
      { requestId, cache: "trends" },
    );
  }

  return errorResponse(notFound("API endpoint not found"));
}
