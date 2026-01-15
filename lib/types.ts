export interface AudioTrendRow {
  platform: string;
  id: string;
  title: string;
  author: string | null;
  play_count: number | null;
  rank: number | null;
  growth_rate: number | null;
  genre: string | null;
  genre_lower?: string | null;
  vibe: string | null;
  vibe_lower?: string | null;
  cover_url: string | null;
  updated_at: number | null;
}

export interface HashtagRow {
  platform: string;
  slug: string;
  volume: number | null;
  competition_score: number | null;
  related_tags: string | null;
  updated_at: number | null;
}

export type {
  YouTubeVideo,
  RedditPost,
  TikTokCreatorPost,
} from "@/lib/proxy-grid";
