import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { TrendTable } from "@/components/TrendTable";
import { JsonLd } from "@/components/JsonLd";
import { GENRE_OPTIONS } from "@/lib/categories";
import { getAudioByGenre } from "@/lib/db";
import {
  buildCanonical,
  buildFaqSchema,
  buildCollectionSchema,
  getSiteUrl,
} from "@/lib/seo";
import { buildAudioSlug } from "@/lib/slug";
import { fetchSimilarTrends } from "@/lib/proxy-grid";
import { formatNumber } from "@/lib/format";

export const runtime = "edge";
export const revalidate = 900;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const genre = GENRE_OPTIONS.find((option) => option.slug === slug);
  if (!genre) return {};

  return {
    title: `${genre.label} TikTok Songs & Trends`,
    description: genre.description,
    keywords: [
      `${genre.label} TikTok songs`,
      `${genre.label} music trends`,
      `TikTok ${genre.label} audio`,
      `viral ${genre.label} songs`,
      "TikTok trends",
      "viral sounds",
    ],
    alternates: {
      canonical: buildCanonical(`/genre/${slug}`),
    },
    openGraph: {
      title: `${genre.label} TikTok Songs & Trends`,
      description: genre.description,
      url: buildCanonical(`/genre/${slug}`),
      type: "website",
      images: [
        {
          url: `/og-genre-${slug}.jpg`,
          width: 1200,
          height: 630,
          alt: `${genre.label} TikTok Songs & Trends`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${genre.label} TikTok Songs & Trends`,
      description: genre.description,
      images: [`/og-genre-${slug}.jpg`],
    },
  };
}

export default async function GenrePage({ params }: PageProps) {
  const { slug } = await params;
  const genre = GENRE_OPTIONS.find((option) => option.slug === slug);
  if (!genre) notFound();

  const trends = await getAudioByGenre(genre.slug, 50);
  const siteUrl = getSiteUrl();

  const similarResponse = await fetchSimilarTrends(genre.label, genre.slug, {
    maxResults: 6,
  });

  // Build collection schema
  const collectionSchema = buildCollectionSchema({
    name: `${genre.label} TikTok Songs & Trends`,
    description: genre.description,
    url: buildCanonical(`/genre/${slug}`),
    itemCount: trends.length,
    items: trends.slice(0, 20).map((trend) => ({
      name: trend.title,
      url: `${siteUrl}/audio/${buildAudioSlug(trend.title, trend.id)}`,
      thumbnailUrl: trend.cover_url ?? undefined,
    })),
  });

  // Build FAQ schema
  const faqSchema = buildFaqSchema([
    {
      question: `How do you classify ${genre.label} tracks?`,
      answer:
        "Tracks are tagged by AI analysis and heuristics; we normalize genre tokens and only list sounds with clear genre signals.",
    },
    {
      question: "How frequently is this genre page updated?",
      answer:
        "Data refreshes every six hours; the static page revalidates every 15 minutes to keep caches warm.",
    },
    {
      question: "Can I sort or filter further?",
      answer:
        "Use the table sort controls or combine with vibe filters on the main trends page for cross-genre discovery.",
    },
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12">
      <section className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-black/50">
          Genre collection
        </p>
        <h1 className="font-display text-3xl font-semibold md:text-4xl">
          {genre.emoji} {genre.label} audio trends
        </h1>
        <p className="max-w-2xl text-sm text-black/60">{genre.description}</p>
      </section>

      <section className="mt-10">
        <TrendTable data={trends} />
      </section>

      {similarResponse.trends.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">
            Related {genre.label} discoveries
          </h2>
          <p className="mt-1 text-sm text-black/60">
            Explore more sounds in the {genre.label} space.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {similarResponse.trends.map((item) => (
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
                      {formatNumber(item.play_count)} uses
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <JsonLd data={collectionSchema} />
      <JsonLd data={faqSchema} />
    </div>
  );
}
