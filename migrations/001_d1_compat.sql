-- D1 Compatibility Migration
-- D1 doesn't support GENERATED columns, so we add regular columns
-- and update them via triggers or application logic

-- Add lowercase columns (skip if already exists)
-- Note: D1 doesn't support IF NOT EXISTS for ALTER TABLE, so we catch errors

-- Add genre_lower column
ALTER TABLE audio_trends ADD COLUMN genre_lower TEXT;

-- Add vibe_lower column
ALTER TABLE audio_trends ADD COLUMN vibe_lower TEXT;

-- Backfill existing data
UPDATE audio_trends
SET genre_lower = lower(genre)
WHERE genre_lower IS NULL AND genre IS NOT NULL;

UPDATE audio_trends
SET vibe_lower = lower(vibe)
WHERE vibe_lower IS NULL AND vibe IS NOT NULL;

-- Create composite indexes for optimized query patterns
CREATE INDEX IF NOT EXISTS idx_audio_platform_genre_rank
ON audio_trends(platform, genre_lower, rank);

CREATE INDEX IF NOT EXISTS idx_audio_platform_vibe_rank
ON audio_trends(platform, vibe_lower, rank);

CREATE INDEX IF NOT EXISTS idx_audio_platform_rank
ON audio_trends(platform, rank);

CREATE INDEX IF NOT EXISTS idx_audio_platform_updated
ON audio_trends(platform, updated_at DESC);

-- Drop old indexes (ignore if they don't exist)
DROP INDEX IF EXISTS idx_audio_rank;
DROP INDEX IF EXISTS idx_audio_genre;
DROP INDEX IF EXISTS idx_audio_vibe;
DROP INDEX IF EXISTS idx_audio_updated_at;

-- Optimize hashtag indexes
CREATE INDEX IF NOT EXISTS idx_hashtag_platform_volume
ON hashtags(platform, volume DESC);

CREATE INDEX IF NOT EXISTS idx_hashtag_platform_updated
ON hashtags(platform, updated_at DESC);

-- Drop old hashtag indexes
DROP INDEX IF EXISTS idx_hashtag_volume;
DROP INDEX IF EXISTS idx_hashtag_updated_at;
