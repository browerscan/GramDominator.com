import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { HashtagPanel } from "@/components/HashtagPanel";
import { TrendChart } from "@/components/TrendChart";
import { JsonLd } from "@/components/JsonLd";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AudioViewTracker } from "@/components/AudioViewTracker";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { YouTubeTutorials } from "@/components/YouTubeTutorials";
import { CreatorExamples } from "@/components/CreatorExamples";
import { RedditDiscussions } from "@/components/RedditDiscussions";
import {
  fetchYouTubeVideos,
  fetchTikTokCreators,
  fetchRedditPosts,
} from "@/lib/proxy-grid";
import {
  getAudioById,
  getAudioHistory,
  getAudioTrends,
  getTopHashtags,
  getAudioByGenre,
  getAudioByVibe,
} from "@/lib/db";
import type { AudioTrendRow } from "@/lib/types";
import {
  formatDate,
  formatNumber,
  formatPercent,
  getGrowthLabel,
} from "@/lib/format";
import { buildAudioSlug, parseAudioSlug, slugify } from "@/lib/slug";
import { buildMusicRecordingSchema, getSiteUrl } from "@/lib/seo";

export const runtime = "edge";
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const id = parseAudioSlug(slug);
  if (!id) return {};
  const audio = await getAudioById(id);
  if (!audio) return {};

  const title = `${audio.title} TikTok Trends & Analytics`;
  const description = `Is "${audio.title}" viral? Track TikTok usage, growth rate, and get creator tips with GramDominator analytics.`;
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://gramdominator.com";
  const canonical = `${baseUrl}/audio/${buildAudioSlug(audio.title, audio.id)}`;
  const ogImage = `${baseUrl}/api/og/${buildAudioSlug(audio.title, audio.id)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

function getDynamicCta(growthRate: number | null): {
  label: string;
  description: string;
  tone: string;
} {
  if (!growthRate) {
    return {
      label: "Explore this sound",
      description: "Use this audio in your next TikTok.",
      tone: "text-black/70",
    };
  }

  if (growthRate > 50) {
    return {
      label: "Use now - Rocketing",
      description: "This sound is exploding. Jump on it before saturation.",
      tone: "text-emerald-600",
    };
  }

  if (growthRate > 20) {
    return {
      label: "Trending up",
      description: "Strong momentum. Good time to create with this audio.",
      tone: "text-mint",
    };
  }

  if (growthRate > 0) {
    return {
      label: "Steady growth",
      description: "Moderate momentum. Still viable for content.",
      tone: "text-black/70",
    };
  }

  if (growthRate > -10) {
    return {
      label: "Stabilizing",
      description: "Growth has slowed. Use if it fits your niche.",
      tone: "text-black/60",
    };
  }

  return {
    label: "Fading - Niche only",
    description: "This sound is declining. Consider alternatives.",
    tone: "text-black/50",
  };
}

export default async function AudioDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const id = parseAudioSlug(slug);
  if (!id) notFound();

  const audio = await getAudioById(id);
  if (!audio) notFound();

  const growthLabel = getGrowthLabel(audio.growth_rate ?? 0);
  const hashtags = await getHashtagsForAudio(
    audio.title,
    audio.author ?? "",
    10,
  );
  const history = await getAudioHistory(audio.id, 20);
  const chartData = history
    .slice()
    .reverse()
    .map((row) => ({
      date: formatShortDate(row.snapshot_at),
      rank: row.rank ?? 0,
    }));

  const cta = getDynamicCta(audio.growth_rate);

  let relatedByGenre: AudioTrendRow[] = [];
  let relatedByVibe: AudioTrendRow[] = [];

  if (audio.genre) {
    const genreResults = await getAudioByGenre(audio.genre, 8);
    relatedByGenre = genreResults
      .filter(
        (item): item is AudioTrendRow => item !== null && item.id !== audio.id,
      )
      .slice(0, 4);
  }

  if (audio.vibe) {
    const vibeResults = await getAudioByVibe(audio.vibe, 8);
    relatedByVibe = vibeResults
      .filter(
        (item): item is AudioTrendRow => item !== null && item.id !== audio.id,
      )
      .slice(0, 4);
  }

  const moreAudio = (await getAudioTrends(8))
    .filter((item) => item.id !== audio.id)
    .slice(0, 6);

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Trends", href: "/trends" },
    { label: audio.title },
  ];

  const youtubeQuery = `${audio.title} tiktok tutorial`;
  const youtubeResponse = await fetchYouTubeVideos(youtubeQuery, {
    maxResults: 5,
  });

  const creatorQuery = audio.title.split(" ")[0];
  const creatorsResponse = await fetchTikTokCreators(creatorQuery, {
    maxResults: 6,
  });

  const redditQuery = `${audio.title} tiktok`;
  const redditResponse = await fetchRedditPosts(redditQuery, { maxResults: 5 });

  const audioUrl = `${getSiteUrl()}/audio/${slug}`;
  const datePublished = audio.updated_at
    ? new Date(audio.updated_at).toISOString()
    : undefined;

  const musicRecordingSchema = buildMusicRecordingSchema({
    name: audio.title,
    author: audio.author,
    playCount: audio.play_count,
    genre: audio.genre,
    thumbnailUrl: audio.cover_url,
    url: audioUrl,
    datePublished,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12">
      <AudioViewTracker audio={audio} />
      <Breadcrumbs items={breadcrumbs} className="mb-6" />

      <section className="grid gap-8 md:grid-cols-[1.5fr_0.7fr]">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.3em] text-black/50">
                Audio intelligence
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">
                {audio.title}
              </h1>
              <p className="mt-2 text-sm text-black/60">
                By {audio.author ?? "Unknown artist"}
              </p>
            </div>
            <FavoriteButton audio={audio} variant="icon" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/60 shadow-glow">
            {audio.cover_url && audio.cover_url.startsWith("http") ? (
              <div className="relative aspect-square w-full md:aspect-[2/1]">
                <Image
                  src={audio.cover_url}
                  alt={`${audio.title} cover art`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-orange-50 to-emerald-50 md:aspect-[2/1]">
                <div className="text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mx-auto mb-2 h-12 w-12 text-black/20"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <p className="text-sm text-black/40">
                    Cover art not available
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Usage
              </p>
              <p className="mt-2 font-display text-xl font-semibold">
                {formatNumber(audio.play_count)}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Momentum
              </p>
              <p
                className={`mt-2 font-display text-xl font-semibold ${growthLabel.tone}`}
              >
                {growthLabel.label}
              </p>
              <p className="text-xs text-black/50">
                {formatPercent(audio.growth_rate ?? 0)}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-black/40">
                Updated
              </p>
              <p className="mt-2 text-sm font-semibold">
                {formatDate(audio.updated_at)}
              </p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  Trend curve
                </h2>
                <p className="mt-1 text-sm text-black/60">
                  Rank movement over the most recent snapshots.
                </p>
              </div>
              <ShareButton
                variant="link"
                title={`${audio.title} TikTok Trends & Analytics`}
              />
            </div>
            {chartData.length ? (
              <div className="mt-4">
                <TrendChart data={chartData} />
              </div>
            ) : (
              <p className="mt-4 text-xs text-black/50">
                Not enough history yet.
              </p>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="font-display text-lg font-semibold">
              Trend insight
            </h2>
            <p className="mt-3 text-sm text-black/70">
              {audio.title} is currently ranked #{audio.rank ?? "n/a"} on TikTok
              audio charts. It is showing {growthLabel.label.toLowerCase()}{" "}
              momentum with a growth rate of{" "}
              {formatPercent(audio.growth_rate ?? 0)}. Use this sound for
              creator hooks, product demos, or fast-paced edits.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-black/60">
              {audio.genre ? (
                <span className="rounded-full border border-black/10 px-3 py-1 font-semibold">
                  Genre: {audio.genre}
                </span>
              ) : null}
              {audio.vibe ? (
                <span className="rounded-full border border-black/10 px-3 py-1 font-semibold">
                  Vibe: {audio.vibe}
                </span>
              ) : null}
            </div>
            <div className="mt-5 rounded-xl border border-dashed border-black/20 bg-black/[0.02] p-4">
              <p className={`text-sm font-semibold ${cta.tone}`}>{cta.label}</p>
              <p className="mt-1 text-xs text-black/60">{cta.description}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`https://www.tiktok.com/music/${audio.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              >
                Use this audio
              </a>
              <Link
                href="/trends"
                className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-black/70 transition hover:border-black/20 hover:bg-black/5"
              >
                Back to trends
              </Link>
            </div>
          </div>

          {relatedByGenre.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-display text-lg font-semibold">
                Related by Genre: {audio.genre}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {relatedByGenre.map((item) => (
                  <Link
                    key={item.id}
                    href={`/audio/${buildAudioSlug(item.title, item.id)}`}
                    className="group flex items-center gap-3 rounded-xl border border-black/5 bg-white/60 p-3 transition hover:border-black/10 hover:bg-white/80"
                  >
                    {item.cover_url && item.cover_url.startsWith("http") ? (
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={item.cover_url}
                          alt={item.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-black/5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5 text-black/30"
                        >
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-black group-hover:text-blaze">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-black/50">
                        {item.author ?? "Unknown artist"}
                      </p>
                    </div>
                    <span className="text-xs text-black/40">
                      #{item.rank ?? "n/a"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {relatedByVibe.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h2 className="font-display text-lg font-semibold">
                Related by Vibe: {audio.vibe}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {relatedByVibe.map((item) => (
                  <Link
                    key={item.id}
                    href={`/audio/${buildAudioSlug(item.title, item.id)}`}
                    className="group flex items-center gap-3 rounded-xl border border-black/5 bg-white/60 p-3 transition hover:border-black/10 hover:bg-white/80"
                  >
                    {item.cover_url && item.cover_url.startsWith("http") ? (
                      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={item.cover_url}
                          alt={item.title}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-black/5">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-5 w-5 text-black/30"
                        >
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-black group-hover:text-blaze">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-black/50">
                        {item.author ?? "Unknown artist"}
                      </p>
                    </div>
                    <span className="text-xs text-black/40">
                      #{item.rank ?? "n/a"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <HashtagPanel hashtags={hashtags} />
          <RecentlyViewed />
          <div className="glass-card rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-black/40">
              Creator playbook
            </p>
            <ul className="mt-3 space-y-2 text-sm text-black/70">
              <li>Hook in the first 2 seconds with an on-screen question.</li>
              <li>Pair with jump cuts or sync-to-beat transitions.</li>
              <li>Caption with clear value plus one call to action.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-14 space-y-8">
        <YouTubeTutorials
          audioTitle={audio.title}
          videos={youtubeResponse.videos}
          error={youtubeResponse.error?.message}
        />

        <CreatorExamples
          hashtag={creatorQuery}
          posts={creatorsResponse.posts}
          error={creatorsResponse.error?.message}
        />

        <RedditDiscussions
          query={redditQuery}
          posts={redditResponse.posts}
          error={redditResponse.error?.message}
        />
      </section>

      <section className="mt-14">
        <h2 className="font-display text-xl font-semibold">
          More trending audio
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {moreAudio.map((item) => (
            <Link
              key={item.id}
              href={`/audio/${buildAudioSlug(item.title, item.id)}`}
              className="group glass-card rounded-2xl p-4 transition hover:-translate-y-1"
            >
              <div className="flex items-start gap-3">
                {item.cover_url && item.cover_url.startsWith("http") ? (
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={item.cover_url}
                      alt={item.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-black/5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6 text-black/20"
                    >
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-black group-hover:text-blaze">
                    {item.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-black/50">
                    {item.author ?? "Unknown artist"}
                  </p>
                  <p className="mt-2 text-xs text-black/60">
                    Rank #{item.rank ?? "n/a"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Structured Data */}
      <JsonLd data={musicRecordingSchema} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is this audio currently viral on TikTok?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `${audio.title} is ranked #${audio.rank ?? "n/a"} with a growth rate of ${formatPercent(audio.growth_rate ?? 0)}.`,
              },
            },
            {
              "@type": "Question",
              name: "How often is the data updated?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Trends refresh every six hours and this page reflects the latest snapshot.",
              },
            },
            {
              "@type": "Question",
              name: "What hashtags should I pair with this sound?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `Suggested tags: ${hashtags
                  .slice(0, 8)
                  .map((tag) => `#${tag}`)
                  .join(" ")}`,
              },
            },
          ],
        }}
      />
    </div>
  );
}

async function getHashtagsForAudio(
  title: string,
  author: string,
  limit: number,
) {
  const rows = await getTopHashtags(limit);
  const tagsFromDb = rows
    .map((row) => ({
      slug: row.slug,
      related: safeJsonArray(row.related_tags),
    }))
    .flatMap((row) => [row.slug, ...row.related]);

  const seed = [title, author]
    .join(" ")
    .split(/\s+/)
    .map((part) => slugify(part))
    .filter(Boolean);

  const baseTags = ["viral", "trending", "foryou", "creator"];
  const combined = [...new Set([...tagsFromDb, ...seed, ...baseTags])];

  return combined.slice(0, limit).filter(Boolean);
}

function safeJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function formatShortDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}
