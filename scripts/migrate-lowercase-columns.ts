/**
 * Data Migration Script: Lowercase Columns
 *
 * This script updates genre_lower and vibe_lower columns for existing records.
 * Run this after applying the schema migration.
 *
 * Usage:
 *   npx tsx scripts/migrate-lowercase-columns.ts
 */

import { getDB } from "../lib/d1";

const BATCH_SIZE = 1000;

async function migrateLowercaseColumns() {
  const db = getDB();

  // Get total count
  const countResult = await db
    .prepare("SELECT COUNT(*) as count FROM audio_trends")
    .first<{ count: number }>();
  const totalRecords = countResult?.count ?? 0;

  console.log(`Starting migration for ${totalRecords} records...`);

  let processed = 0;
  let offset = 0;

  while (offset < totalRecords) {
    // Fetch batch
    const { results } = await db
      .prepare(
        `SELECT platform, id, genre, vibe
         FROM audio_trends
         LIMIT ? OFFSET ?`,
      )
      .bind(BATCH_SIZE, offset)
      .all<{
        platform: string;
        id: string;
        genre: string | null;
        vibe: string | null;
      }>();

    if (!results || results.length === 0) {
      break;
    }

    // Update records that need migration
    for (const record of results) {
      const updates: string[] = [];
      const values: (string | number)[] = [];

      if (record.genre && record.genre.toLowerCase()) {
        updates.push("genre_lower = ?");
        values.push(record.genre.toLowerCase());
      }

      if (record.vibe && record.vibe.toLowerCase()) {
        updates.push("vibe_lower = ?");
        values.push(record.vibe.toLowerCase());
      }

      if (updates.length > 0) {
        values.push(record.platform, record.id);

        await db
          .prepare(
            `UPDATE audio_trends
             SET ${updates.join(", ")}
             WHERE platform = ? AND id = ?`,
          )
          .bind(...values)
          .run();
      }

      processed++;
    }

    console.log(`Processed ${processed}/${totalRecords} records...`);
    offset += BATCH_SIZE;
  }

  console.log("Migration complete!");
}

// Run migration
migrateLowercaseColumns().catch(console.error);
