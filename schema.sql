-- D1 schema for GramDominator.com
-- Current snapshot of audio trends (fast reads)
CREATE TABLE IF NOT EXISTS audio_trends (
    platform TEXT NOT NULL DEFAULT 'tiktok',
    id TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    play_count INTEGER,
    rank INTEGER,
    growth_rate REAL,
    genre TEXT,
    genre_lower TEXT GENERATED ALWAYS AS (lower(genre)) STORED,
    vibe TEXT,
    vibe_lower TEXT GENERATED ALWAYS AS (lower(vibe)) STORED,
    cover_url TEXT,
    updated_at INTEGER,
    PRIMARY KEY (platform, id)
);

-- Historical snapshots for growth calculations
CREATE TABLE IF NOT EXISTS audio_trend_history (
    platform TEXT NOT NULL DEFAULT 'tiktok',
    id TEXT NOT NULL,
    snapshot_at INTEGER NOT NULL,
    play_count INTEGER,
    rank INTEGER,
    PRIMARY KEY (platform, id, snapshot_at)
);

-- Hashtag intelligence
CREATE TABLE IF NOT EXISTS hashtags (
    platform TEXT NOT NULL DEFAULT 'tiktok',
    slug TEXT NOT NULL,
    volume INTEGER,
    competition_score INTEGER,
    related_tags TEXT,
    updated_at INTEGER,
    PRIMARY KEY (platform, slug)
);

-- Composite indexes for optimized query patterns
-- Index for genre-based queries with ranking
CREATE INDEX IF NOT EXISTS idx_audio_platform_genre_rank
ON audio_trends(platform, genre_lower, rank)
WHERE genre_lower IS NOT NULL;

-- Index for vibe-based queries with ranking
CREATE INDEX IF NOT EXISTS idx_audio_platform_vibe_rank
ON audio_trends(platform, vibe_lower, rank)
WHERE vibe_lower IS NOT NULL;

-- Index for platform ranking queries
CREATE INDEX IF NOT EXISTS idx_audio_platform_rank
ON audio_trends(platform, rank)
WHERE rank IS NOT NULL;

-- Index for cache invalidation and sitemap queries
CREATE INDEX IF NOT EXISTS idx_audio_platform_updated
ON audio_trends(platform, updated_at DESC);

-- History snapshot index
CREATE INDEX IF NOT EXISTS idx_audio_history_snapshot ON audio_trend_history(snapshot_at);

-- Hashtag indexes
CREATE INDEX IF NOT EXISTS idx_hashtag_platform_volume
ON hashtags(platform, volume DESC)
WHERE volume IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hashtag_platform_updated
ON hashtags(platform, updated_at DESC);
