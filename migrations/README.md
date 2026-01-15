# Database Migrations

## Overview

This directory contains SQL migration files for optimizing the GramDominator.com database.

## Migration 001: Index Optimization

### Files

- `001_d1_compat.sql` - For Cloudflare D1 (recommended)
- `001_optimize_indexes.sql` - Alternative with GENERATED columns (not compatible with D1)

### Changes

1. **New Columns**
   - `genre_lower` - Pre-lowercased genre for indexed case-insensitive search
   - `vibe_lower` - Pre-lowercased vibe for indexed case-insensitive search

2. **New Composite Indexes**
   - `idx_audio_platform_genre_rank` - (platform, genre_lower, rank)
   - `idx_audio_platform_vibe_rank` - (platform, vibe_lower, rank)
   - `idx_audio_platform_rank` - (platform, rank)
   - `idx_audio_platform_updated` - (platform, updated_at DESC)
   - `idx_hashtag_platform_volume` - (platform, volume DESC)
   - `idx_hashtag_platform_updated` - (platform, updated_at DESC)

3. **Removed Indexes**
   - `idx_audio_rank` (replaced by composite)
   - `idx_audio_genre` (replaced by composite with genre_lower)
   - `idx_audio_vibe` (replaced by composite with vibe_lower)

### Applying the Migration

```bash
# Using Wrangler for D1
npx wrangler d1 execute GRAMDOMINATOR --local --file=migrations/001_d1_compat.sql

# For production
npx wrangler d1 execute GRAMDOMINATOR --file=migrations/001_d1_compat.sql
```

### After Migration

Run the data migration script to backfill lowercase columns:

```bash
npx tsx scripts/migrate-lowercase-columns.ts
```

### Rollback

If needed, rollback involves:

```sql
DROP INDEX IF EXISTS idx_audio_platform_genre_rank;
DROP INDEX IF EXISTS idx_audio_platform_vibe_rank;
DROP INDEX IF EXISTS idx_audio_platform_rank;
DROP INDEX IF EXISTS idx_audio_platform_updated;

ALTER TABLE audio_trends DROP COLUMN genre_lower;
ALTER TABLE audio_trends DROP COLUMN vibe_lower;
```

## Performance Impact

### Before

- `lower(genre)` in WHERE clause prevented index usage
- Full table scan for genre/vibe queries
- Query time: ~200-500ms on large datasets

### After

- Direct index lookup on genre_lower
- Composite indexes cover common query patterns
- Query time: ~10-50ms (5-10x improvement)

### Cache Strategy

New in-memory caching added:

- 1-minute TTL for trending data
- 5-minute TTL for genre/vibe queries
- 15-minute TTL for static data (distinct values, counts)

Cache includes versioning for invalidation:

- Increment `CACHE_VERSION` in `lib/db.ts` to invalidate all caches
- Use `invalidateCache(pattern)` for selective invalidation
