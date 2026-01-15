import { getDB } from "./d1";
import type { AudioTrendRow, HashtagRow } from "./types";

const PLATFORM = "tiktok";

// Cache configuration
const CACHE_VERSION = "v1";
const CACHE_TTL = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
};

// Query performance tracking
type QueryMetric = {
  query: string;
  duration: number;
  timestamp: number;
  cached: boolean;
};

const queryMetrics: QueryMetric[] = [];
const MAX_METRICS = 100;
const SLOW_QUERY_THRESHOLD = 100; // ms

// In-memory query cache
type CacheEntry<T> = {
  data: T;
  timestamp: number;
  version: string;
};

const queryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Record query performance metric
 */
function recordMetric(query: string, duration: number, cached: boolean): void {
  const metric: QueryMetric = {
    query:
      query.split("FROM")[0]?.split("--")[0]?.trim().slice(0, 50) + "..." ||
      query.slice(0, 50),
    duration,
    timestamp: Date.now(),
    cached,
  };

  queryMetrics.push(metric);

  if (queryMetrics.length > MAX_METRICS) {
    queryMetrics.shift();
  }

  if (duration > SLOW_QUERY_THRESHOLD && !cached) {
    console.warn(`[Slow Query] ${duration}ms: ${metric.query}`);
  }
}

/**
 * Get query performance statistics
 */
export function getQueryMetrics(): {
  slowQueries: number;
  avgDuration: number;
  cacheHitRate: number;
  recentQueries: QueryMetric[];
} {
  const totalQueries = queryMetrics.length;
  const slowQueries = queryMetrics.filter(
    (m) => m.duration > SLOW_QUERY_THRESHOLD && !m.cached,
  ).length;
  const cachedQueries = queryMetrics.filter((m) => m.cached).length;
  const totalDuration = queryMetrics.reduce((sum, m) => sum + m.duration, 0);

  return {
    slowQueries,
    avgDuration: totalQueries > 0 ? totalDuration / totalQueries : 0,
    cacheHitRate: totalQueries > 0 ? cachedQueries / totalQueries : 0,
    recentQueries: queryMetrics.slice(-20),
  };
}

/**
 * Generate cache key
 */
function cacheKey(prefix: string, ...args: (string | number)[]): string {
  return `${CACHE_VERSION}:${prefix}:${args.join(":")}`;
}

/**
 * Get from cache or execute query
 */
async function cachedQuery<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = queryCache.get(key) as CacheEntry<T> | undefined;

  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < ttl && cached.version === CACHE_VERSION) {
      recordMetric(key, 0, true);
      return cached.data;
    }
    // Cache expired, remove it
    queryCache.delete(key);
  }

  const startTime = performance.now();
  const result = await fn();
  const duration = performance.now() - startTime;

  queryCache.set(key, {
    data: result,
    timestamp: Date.now(),
    version: CACHE_VERSION,
  });

  recordMetric(key, duration, false);

  return result;
}

/**
 * Invalidate cache entries by pattern
 */
export function invalidateCache(pattern: string): void {
  const keysToDelete: string[] = [];

  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => queryCache.delete(key));
}

/**
 * Clear all cache (use after data updates)
 */
export function clearCache(): void {
  queryCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
  version: string;
} {
  return {
    size: queryCache.size,
    keys: Array.from(queryCache.keys()),
    version: CACHE_VERSION,
  };
}

/**
 * Batch multiple queries for related data
 */
export async function batchQueries<T>(
  queries: Array<() => Promise<T>>,
): Promise<T[]> {
  return Promise.all(queries.map((q) => q()));
}

/**
 * Get audio trends with caching
 */
export async function getAudioTrends(limit = 50): Promise<AudioTrendRow[]> {
  const key = cacheKey("trends", limit);

  return cachedQuery(key, CACHE_TTL.SHORT, async () => {
    const db = getDB();
    const { results } = await db
      .prepare(
        `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
         FROM audio_trends
         WHERE platform = ?
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .bind(PLATFORM, limit)
      .all<AudioTrendRow>();

    return results ?? [];
  });
}

/**
 * Get audio by ID with caching
 */
export async function getAudioById(id: string): Promise<AudioTrendRow | null> {
  const key = cacheKey("audio", id);

  return cachedQuery(key, CACHE_TTL.LONG, async () => {
    const db = getDB();
    const result = await db
      .prepare(
        `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
         FROM audio_trends
         WHERE platform = ? AND id = ?
         LIMIT 1`,
      )
      .bind(PLATFORM, id)
      .first<AudioTrendRow>();

    return result ?? null;
  });
}

/**
 * Get top hashtags with caching
 */
export async function getTopHashtags(limit = 12): Promise<HashtagRow[]> {
  const key = cacheKey("hashtags", limit);

  return cachedQuery(key, CACHE_TTL.MEDIUM, async () => {
    const db = getDB();
    const { results } = await db
      .prepare(
        `SELECT platform, slug, volume, competition_score, related_tags, updated_at
         FROM hashtags
         WHERE platform = ?
         ORDER BY volume DESC
         LIMIT ?`,
      )
      .bind(PLATFORM, limit)
      .all<HashtagRow>();

    return results ?? [];
  });
}

/**
 * Get audio sitemap entries with caching
 */
export async function getAudioSitemapEntries(
  limit = 500,
  offset = 0,
): Promise<AudioTrendRow[]> {
  const key = cacheKey("sitemap", limit, offset);

  return cachedQuery(key, CACHE_TTL.LONG, async () => {
    const db = getDB();
    const { results } = await db
      .prepare(
        `SELECT platform, id, title, genre, vibe, updated_at
         FROM audio_trends
         WHERE platform = ?
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(PLATFORM, limit, offset)
      .all<AudioTrendRow>();

    return results ?? [];
  });
}

/**
 * Get audio sitemap count with caching
 */
export async function getAudioSitemapCount(): Promise<number> {
  const key = cacheKey("sitemap-count");

  return cachedQuery(key, CACHE_TTL.LONG, async () => {
    const db = getDB();
    const result = await db
      .prepare(
        `SELECT COUNT(*) as count
         FROM audio_trends
         WHERE platform = ?`,
      )
      .bind(PLATFORM)
      .first<{ count: number }>();

    return result?.count ?? 0;
  });
}

/**
 * Get audio by genre (optimized using genre_lower column)
 */
export async function getAudioByGenre(
  genre: string,
  limit = 50,
): Promise<AudioTrendRow[]> {
  const key = cacheKey("genre", genre.toLowerCase(), limit);

  return cachedQuery(key, CACHE_TTL.MEDIUM, async () => {
    const db = getDB();
    const genreLower = genre.toLowerCase();

    const { results } = await db
      .prepare(
        `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
         FROM audio_trends
         WHERE platform = ? AND genre_lower = ?
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .bind(PLATFORM, genreLower, limit)
      .all<AudioTrendRow>();

    return results ?? [];
  });
}

/**
 * Get audio by vibe (optimized using vibe_lower column)
 */
export async function getAudioByVibe(
  vibe: string,
  limit = 50,
): Promise<AudioTrendRow[]> {
  const key = cacheKey("vibe", vibe.toLowerCase(), limit);

  return cachedQuery(key, CACHE_TTL.MEDIUM, async () => {
    const db = getDB();
    const vibeLower = vibe.toLowerCase();

    const { results } = await db
      .prepare(
        `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
         FROM audio_trends
         WHERE platform = ? AND vibe_lower = ?
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .bind(PLATFORM, vibeLower, limit)
      .all<AudioTrendRow>();

    return results ?? [];
  });
}

/**
 * Get audio history with caching
 */
export async function getAudioHistory(id: string, limit = 20) {
  const key = cacheKey("history", id, limit);

  return cachedQuery(key, CACHE_TTL.LONG, async () => {
    const db = getDB();
    const { results } = await db
      .prepare(
        `SELECT snapshot_at, rank, play_count
         FROM audio_trend_history
         WHERE platform = ? AND id = ?
         ORDER BY snapshot_at DESC
         LIMIT ?`,
      )
      .bind(PLATFORM, id, limit)
      .all<{
        snapshot_at: number;
        rank: number | null;
        play_count: number | null;
      }>();

    return results ?? [];
  });
}

/**
 * Get distinct genres with caching
 */
export async function getDistinctGenres(limit = 20) {
  const key = cacheKey("genres", limit);

  return cachedQuery(key, CACHE_TTL.LONG, async () => {
    const db = getDB();
    const { results } = await db
      .prepare(
        `SELECT DISTINCT genre_lower as genre
         FROM audio_trends
         WHERE platform = ? AND genre_lower IS NOT NULL AND genre_lower != ''
         LIMIT ?`,
      )
      .bind(PLATFORM, limit)
      .all<{ genre: string }>();

    return results?.map((row) => row.genre) ?? [];
  });
}

/**
 * Get distinct vibes with caching
 */
export async function getDistinctVibes(limit = 20) {
  const key = cacheKey("vibes", limit);

  return cachedQuery(key, CACHE_TTL.LONG, async () => {
    const db = getDB();
    const { results } = await db
      .prepare(
        `SELECT DISTINCT vibe_lower as vibe
         FROM audio_trends
         WHERE platform = ? AND vibe_lower IS NOT NULL AND vibe_lower != ''
         LIMIT ?`,
      )
      .bind(PLATFORM, limit)
      .all<{ vibe: string }>();

    return results?.map((row) => row.vibe) ?? [];
  });
}

/**
 * Batch load related audio data (genre + vibe queries)
 */
export async function getAudioByGenreAndVibe(
  genre: string | null,
  vibe: string | null,
  limit = 50,
): Promise<AudioTrendRow[]> {
  const key = cacheKey("genre-vibe", genre ?? "all", vibe ?? "all", limit);

  return cachedQuery(key, CACHE_TTL.MEDIUM, async () => {
    const db = getDB();

    let whereClause = "platform = ?";
    const bindings: (string | number)[] = [PLATFORM];

    if (genre) {
      whereClause += " AND genre_lower = ?";
      bindings.push(genre.toLowerCase());
    }
    if (vibe) {
      whereClause += " AND vibe_lower = ?";
      bindings.push(vibe.toLowerCase());
    }

    const { results } = await db
      .prepare(
        `SELECT platform, id, title, author, play_count, rank, growth_rate, genre, vibe, cover_url, updated_at
         FROM audio_trends
         WHERE ${whereClause}
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .bind(...bindings, limit)
      .all<AudioTrendRow>();

    return results ?? [];
  });
}

/**
 * Warm up cache by loading frequently accessed data
 */
export async function warmupCache(): Promise<void> {
  const queries = [
    () => getAudioTrends(100),
    () => getTopHashtags(50),
    () => getDistinctGenres(50),
    () => getDistinctVibes(50),
  ];

  await Promise.all(queries.map((q) => q().catch(() => {})));
}

/**
 * Get audio with related data (batched for efficiency)
 */
export async function getAudioWithRelated(id: string): Promise<{
  audio: AudioTrendRow | null;
  history: Awaited<ReturnType<typeof getAudioHistory>>;
  sameGenre: Promise<AudioTrendRow[]>;
  sameVibe: Promise<AudioTrendRow[]>;
}> {
  const db = getDB();

  // Load audio and history in parallel
  const [audio, history] = await Promise.all([
    getAudioById(id),
    getAudioHistory(id, 20),
  ]);

  if (!audio) {
    return {
      audio: null,
      history: [],
      sameGenre: Promise.resolve([]),
      sameVibe: Promise.resolve([]),
    };
  }

  // Load related data based on audio's genre and vibe
  return {
    audio,
    history,
    sameGenre: audio.genre
      ? getAudioByGenre(audio.genre, 10)
      : Promise.resolve([]),
    sameVibe: audio.vibe ? getAudioByVibe(audio.vibe, 10) : Promise.resolve([]),
  };
}
