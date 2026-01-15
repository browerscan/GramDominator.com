-- Migration 001: Add optimized composite indexes and genre_lower column
-- This migration improves query performance by:
-- 1. Adding genre_lower and vibe_lower columns for case-insensitive searches without function calls
-- 2. Creating composite indexes for common query patterns
-- 3. Adding indexes for cache invalidation

-- Add genre_lower column for case-insensitive queries
ALTER TABLE audio_trends ADD COLUMN genre_lower TEXT;

-- Add vibe_lower column for case-insensitive queries
ALTER TABLE audio_trends ADD COLUMN vibe_lower TEXT;

-- Backfill genre_lower with existing data
UPDATE audio_trends SET genre_lower = lower(genre) WHERE genre IS NOT NULL;

-- Backfill vibe_lower with existing data
UPDATE audio_trends SET vibe_lower = lower(vibe) WHERE vibe IS NOT NULL;

-- Create composite index for platform + genre + rank queries
CREATE INDEX IF NOT EXISTS idx_audio_platform_genre_rank
ON audio_trends(platform, genre_lower, rank)
WHERE genre_lower IS NOT NULL;

-- Create composite index for platform + vibe + rank queries
CREATE INDEX IF NOT EXISTS idx_audio_platform_vibe_rank
ON audio_trends(platform, vibe_lower, rank)
WHERE vibe_lower IS NOT NULL;

-- Create composite index for platform + rank (general ranking queries)
CREATE INDEX IF NOT EXISTS idx_audio_platform_rank
ON audio_trends(platform, rank)
WHERE rank IS NOT NULL;

-- Create index for cache invalidation by updated_at
CREATE INDEX IF NOT EXISTS idx_audio_platform_updated
ON audio_trends(platform, updated_at DESC);

-- Create index for sitemap queries (platform + updated_at)
CREATE INDEX IF NOT EXISTS idx_audio_sitemap
ON audio_trends(platform, updated_at DESC);

-- Drop old single-column indexes (replaced by composite indexes)
DROP INDEX IF EXISTS idx_audio_genre;
DROP INDEX IF EXISTS idx_audio_vibe;
DROP INDEX IF EXISTS idx_audio_rank;

-- Optimize hashtag indexes with composite patterns
CREATE INDEX IF NOT EXISTS idx_hashtag_platform_volume
ON hashtags(platform, volume DESC)
WHERE volume IS NOT NULL;

DROP INDEX IF EXISTS idx_hashtag_volume;

-- Add index for hashtag cache invalidation
CREATE INDEX IF NOT EXISTS idx_hashtag_platform_updated
ON hashtags(platform, updated_at DESC);

-- Create covering index for audio listing queries (includes commonly accessed columns)
CREATE INDEX IF NOT EXISTS idx_audio_covering
ON audio_trends(platform, rank)
INCLUDE (id, title, author, play_count, genre_lower, vibe_lower, cover_url, updated_at);
