/**
 * Database Utilities for Data Updates
 * Helper functions to maintain lowercase columns when updating records
 */

import { getDB } from "./d1";
import type { AudioTrendRow } from "./types";

/**
 * Update or insert an audio trend record with lowercase columns
 */
export async function upsertAudioTrend(
  record: Omit<AudioTrendRow, "genre_lower" | "vibe_lower">,
): Promise<void> {
  const db = getDB();

  const genreLower = record.genre?.toLowerCase() ?? null;
  const vibeLower = record.vibe?.toLowerCase() ?? null;

  await db
    .prepare(
      `INSERT INTO audio_trends (
        platform, id, title, author, play_count, rank, growth_rate,
        genre, genre_lower, vibe, vibe_lower, cover_url, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, id) DO UPDATE SET
        title = excluded.title,
        author = excluded.author,
        play_count = excluded.play_count,
        rank = excluded.rank,
        growth_rate = excluded.growth_rate,
        genre = excluded.genre,
        genre_lower = excluded.genre_lower,
        vibe = excluded.vibe,
        vibe_lower = excluded.vibe_lower,
        cover_url = excluded.cover_url,
        updated_at = excluded.updated_at`,
    )
    .bind(
      record.platform,
      record.id,
      record.title,
      record.author,
      record.play_count,
      record.rank,
      record.growth_rate,
      record.genre,
      genreLower,
      record.vibe,
      vibeLower,
      record.cover_url,
      record.updated_at,
    )
    .run();
}

/**
 * Batch upsert multiple audio trends
 */
export async function batchUpsertAudioTrends(
  records: Array<Omit<AudioTrendRow, "genre_lower" | "vibe_lower">>,
): Promise<void> {
  const BATCH_SIZE = 100;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map((record) => upsertAudioTrend(record)));
  }
}

/**
 * Truncate and reload audio trends (for full data refresh)
 * Invalidates all caches after completion
 */
export async function reloadAudioTrends(
  records: Array<Omit<AudioTrendRow, "genre_lower" | "vibe_lower">>,
): Promise<void> {
  const db = getDB();

  // Delete all existing records for the platform
  await db
    .prepare("DELETE FROM audio_trends WHERE platform = ?")
    .bind("tiktok")
    .run();

  // Insert new records
  await batchUpsertAudioTrends(records);

  // Invalidate caches
  const { invalidateCache } = await import("./db");
  invalidateCache("");
}
