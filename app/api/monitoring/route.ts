import { NextResponse } from "next/server";
import { getQueryMetrics, getCacheStats } from "@/lib/db";
import { getCacheHealth } from "@/lib/fallback-data";

export const runtime = "edge";

/**
 * API endpoint for monitoring database and cache performance
 * Returns query metrics, cache statistics, and health status
 */
export async function GET() {
  try {
    const [queryMetrics, cacheStats, cacheHealth] = await Promise.all([
      Promise.resolve(getQueryMetrics()),
      Promise.resolve(getCacheStats()),
      getCacheHealth(),
    ]);

    return NextResponse.json({
      timestamp: Date.now(),
      query: {
        slowQueries: queryMetrics.slowQueries,
        avgDuration: Math.round(queryMetrics.avgDuration * 100) / 100,
        cacheHitRate: Math.round(queryMetrics.cacheHitRate * 1000) / 10, // percentage
        recentQueries: queryMetrics.recentQueries,
      },
      cache: {
        size: cacheStats.size,
        version: cacheStats.version,
        keys: cacheStats.keys,
      },
      health: {
        hasKV: cacheHealth.hasKV,
        hasInMemory: cacheHealth.hasInMemory,
        lastUpdate: cacheHealth.lastUpdate,
        isStale: cacheHealth.isStale,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch monitoring data",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
