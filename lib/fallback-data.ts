/**
 * Graceful Degradation with Fallback Data
 * Serves stale/cached data when primary sources fail
 */

import { getRequestContext } from "@cloudflare/next-on-pages";
import type { AudioTrendRow, HashtagRow } from "./types";
import {
  getAudioTrends,
  getTopHashtags,
  clearCache,
  getQueryMetrics,
  getCacheStats,
} from "./db";
import { logger } from "./logger";

type PagesEnv = Record<string, unknown> & {
  KV?: KVNamespace;
};

// Cache key prefixes
const CACHE_KEYS = {
  TRENDS_BACKUP: "fallback:trends",
  HASHTAGS_BACKUP: "fallback:hashtags",
  LAST_UPDATE: "fallback:last_update",
};

// In-memory cache for serverless scenarios
let inMemoryCache: {
  trends?: AudioTrendRow[];
  hashtags?: HashtagRow[];
  timestamp?: number;
} = {};

/**
 * Get KV namespace from request context
 */
function getKV(): KVNamespace | undefined {
  try {
    const context = getRequestContext();
    return (context?.env as PagesEnv | undefined)?.KV;
  } catch {
    return undefined;
  }
}

/**
 * Save data to KV backup (called by scheduled jobs)
 */
export async function saveBackupToKV(data: {
  trends: AudioTrendRow[];
  hashtags: HashtagRow[];
}): Promise<void> {
  const kv = getKV();
  if (!kv) {
    // Fall back to in-memory cache
    inMemoryCache = {
      trends: data.trends,
      hashtags: data.hashtags,
      timestamp: Date.now(),
    };
    return;
  }

  try {
    await kv.put(CACHE_KEYS.TRENDS_BACKUP, JSON.stringify(data.trends), {
      expirationTtl: 604800, // 7 days
    });
    await kv.put(CACHE_KEYS.HASHTAGS_BACKUP, JSON.stringify(data.hashtags), {
      expirationTtl: 604800,
    });
    await kv.put(CACHE_KEYS.LAST_UPDATE, Date.now().toString(), {
      expirationTtl: 604800,
    });
  } catch (error) {
    logger.warn("Failed to save backup to KV:", error);
    // Update in-memory cache as last resort
    inMemoryCache = {
      trends: data.trends,
      hashtags: data.hashtags,
      timestamp: Date.now(),
    };
  }
}

/**
 * Load trends with fallback strategy
 * Priority: 1. D1 Database, 2. KV Backup, 3. In-Memory Cache, 4. Empty array
 */
export async function getTrendsWithFallback(
  limit = 50,
): Promise<AudioTrendRow[]> {
  // Try primary data source (D1)
  try {
    const trends = await getAudioTrends(limit);
    if (trends.length > 0) {
      return trends;
    }
  } catch (error) {
    logger.warn("Primary database unavailable, trying fallback:", error);
  }

  // Try KV backup
  const kv = getKV();
  if (kv) {
    try {
      const backup = await kv.get<AudioTrendRow[]>(
        CACHE_KEYS.TRENDS_BACKUP,
        "json",
      );
      if (backup && backup.length > 0) {
        logger.info("Serving trends from KV backup");
        return backup.slice(0, limit);
      }
    } catch (error) {
      logger.warn("KV backup unavailable:", error);
    }
  }

  // Try in-memory cache
  if (inMemoryCache.trends && inMemoryCache.trends.length > 0) {
    const age = Date.now() - (inMemoryCache.timestamp ?? 0);
    if (age < 3600000) {
      // 1 hour
      logger.info("Serving trends from in-memory cache");
      return inMemoryCache.trends.slice(0, limit);
    }
  }

  // Return empty array rather than throwing
  logger.warn("All data sources exhausted, returning empty trends");
  return [];
}

/**
 * Load hashtags with fallback strategy
 */
export async function getHashtagsWithFallback(
  limit = 12,
): Promise<HashtagRow[]> {
  // Try primary data source (D1)
  try {
    const hashtags = await getTopHashtags(limit);
    if (hashtags.length > 0) {
      return hashtags;
    }
  } catch (error) {
    logger.warn(
      "Primary database unavailable for hashtags, trying fallback:",
      error,
    );
  }

  // Try KV backup
  const kv = getKV();
  if (kv) {
    try {
      const backup = await kv.get<HashtagRow[]>(
        CACHE_KEYS.HASHTAGS_BACKUP,
        "json",
      );
      if (backup && backup.length > 0) {
        logger.info("Serving hashtags from KV backup");
        return backup.slice(0, limit);
      }
    } catch (error) {
      logger.warn("KV backup unavailable for hashtags:", error);
    }
  }

  // Try in-memory cache
  if (inMemoryCache.hashtags && inMemoryCache.hashtags.length > 0) {
    const age = Date.now() - (inMemoryCache.timestamp ?? 0);
    if (age < 3600000) {
      logger.info("Serving hashtags from in-memory cache");
      return inMemoryCache.hashtags.slice(0, limit);
    }
  }

  logger.warn("All data sources exhausted, returning empty hashtags");
  return [];
}

/**
 * Generic wrapper for data fetching with fallback
 */
export async function withFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  errorMessage = "Primary data source failed",
): Promise<T> {
  try {
    return await primaryFn();
  } catch (error) {
    logger.warn(`${errorMessage}:`, error);
    try {
      return await fallbackFn();
    } catch (fallbackError) {
      logger.error("Fallback also failed:", fallbackError);
      throw new Error(`${errorMessage} and fallback unavailable`);
    }
  }
}

/**
 * Get last successful update timestamp
 */
export async function getLastBackupTimestamp(): Promise<number | null> {
  const kv = getKV();
  if (kv) {
    try {
      const timestamp = await kv.get<string>(CACHE_KEYS.LAST_UPDATE);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch {
      return null;
    }
  }
  return inMemoryCache.timestamp ?? null;
}

/**
 * Check if fallback data is stale (older than specified minutes)
 */
export async function isFallbackDataStale(
  maxAgeMinutes = 30,
): Promise<boolean> {
  const timestamp = await getLastBackupTimestamp();
  if (!timestamp) return true;

  const ageMs = Date.now() - timestamp;
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  return ageMs > maxAgeMs;
}

/**
 * Warm up the cache by loading data into memory
 * Call this during build or on server startup
 * Enhanced version that also warms up the query cache
 */
export async function warmupCache(): Promise<void> {
  try {
    const [trends, hashtags] = await Promise.all([
      getAudioTrends(100),
      getTopHashtags(50),
    ]);

    inMemoryCache = {
      trends,
      hashtags,
      timestamp: Date.now(),
    };

    logger.info("Fallback cache warmed up successfully");
  } catch (error) {
    logger.warn("Failed to warm up fallback cache:", error);
  }
}

/**
 * Invalidate all caches after data updates
 * Call this after updating audio trends or hashtags
 */
export function invalidateAllCaches(): void {
  clearCache();
  inMemoryCache = {};
  logger.info("All caches invalidated");
}

/**
 * Get cache health status (enhanced with query metrics)
 */
export async function getCacheHealth(): Promise<{
  hasKV: boolean;
  hasInMemory: boolean;
  lastUpdate: number | null;
  isStale: boolean;
  queryMetrics: ReturnType<typeof getQueryMetrics>;
  cacheStats: ReturnType<typeof getCacheStats>;
}> {
  const kv = getKV();
  const lastUpdate = await getLastBackupTimestamp();
  const isStale = await isFallbackDataStale();

  return {
    hasKV: !!kv,
    hasInMemory: !!inMemoryCache.trends || !!inMemoryCache.hashtags,
    lastUpdate,
    isStale,
    queryMetrics: getQueryMetrics(),
    cacheStats: getCacheStats(),
  };
}
