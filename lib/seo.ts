import type { Metadata } from "next";

// Next.js doesn't export OpenGraph type directly, define locally
interface OpenGraphImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

interface OpenGraph {
  title: string;
  description: string;
  url: string;
  siteName?: string;
  type?: string;
  images?: OpenGraphImage[];
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
    tags?: string[];
  };
}

// ============================================================================
// Constants
// ============================================================================

const FALLBACK_SITE = "https://gramdominator.com";

export const REVALIDATE_FAST = 300; // 5 minutes
export const REVALIDATE_HOURLY = 3600; // 1 hour
export const REVALIDATE_DAILY = 86400; // 24 hours
export const REVALIDATE_WEEKLY = 604800; // 7 days

const SITE_NAME = "GramDominator";
const SITE_TAGLINE = "Viral Audio Intelligence";

const DEFAULT_OG_IMAGE = "/og-default.jpg";
const DEFAULT_OG_IMAGE_WIDTH = 1200;
const DEFAULT_OG_IMAGE_HEIGHT = 630;

// ============================================================================
// URL Helpers
// ============================================================================

export function getSiteUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (typeof envUrl === "string" && envUrl.trim().length) {
    return envUrl.replace(/\/+$/, "");
  }
  return FALLBACK_SITE;
}

export function buildCanonical(pathname: string): string {
  const base = getSiteUrl();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

export function buildOgUrl(pathname: string): string {
  return buildCanonical(pathname);
}

// ============================================================================
// Metadata Builders
// ============================================================================

export interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  ogType?: "website" | "article" | "music.song";
  noindex?: boolean;
  keywords?: string[];
  modifiedTime?: string;
  publishedTime?: string;
  section?: string;
  tags?: string[];
}

export function buildPageMetadata(options: PageMetadataOptions): Metadata {
  const {
    title,
    description,
    path,
    ogImage,
    ogImageWidth = DEFAULT_OG_IMAGE_WIDTH,
    ogImageHeight = DEFAULT_OG_IMAGE_HEIGHT,
    ogType = "website",
    noindex = false,
    keywords,
    modifiedTime,
    publishedTime,
    section,
    tags,
  } = options;

  const canonicalUrl = buildCanonical(path);
  const fullOgImage = ogImage
    ? ogImage.startsWith("http")
      ? ogImage
      : `${getSiteUrl()}${ogImage}`
    : `${getSiteUrl()}${DEFAULT_OG_IMAGE}`;

  const openGraph: OpenGraph = {
    title,
    description,
    url: canonicalUrl,
    siteName: SITE_NAME,
    type: ogType,
    images: [
      {
        url: fullOgImage,
        width: ogImageWidth,
        height: ogImageHeight,
        alt: title,
      },
    ],
  };

  // Add article-specific fields if type is article
  if (ogType === "article") {
    openGraph.article = {
      publishedTime,
      modifiedTime,
      section,
      tags,
    };
  }

  return {
    title,
    description,
    keywords: keywords?.join(", "),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [fullOgImage],
    },
    robots: {
      index: !noindex,
      follow: !noindex,
      googleBot: {
        index: !noindex,
        follow: !noindex,
      },
    },
  };
}

export interface AudioMetadataOptions {
  title: string;
  author?: string | null;
  description?: string;
  playCount?: number | null;
  growthRate?: number | null;
  genre?: string | null;
  vibe?: string | null;
  slug: string;
}

export function buildAudioMetadata(options: AudioMetadataOptions): Metadata {
  const {
    title,
    author,
    description,
    playCount,
    growthRate,
    genre,
    vibe,
    slug,
  } = options;

  const baseDescription =
    description ??
    `Is ${title} viral right now? Track usage, growth rate, and creator tips on ${SITE_NAME}.`;

  const path = `/audio/${slug}`;
  const ogImage = `${getSiteUrl()}/api/og/${slug}`;

  const keywords: string[] = [
    "TikTok audio",
    "TikTok trends",
    "viral sound",
    title,
    "music trends",
  ];

  if (author) keywords.push(author);
  if (genre) keywords.push(genre, `${genre} TikTok songs`);
  if (vibe) keywords.push(vibe, `${vibe} TikTok sounds`);

  return buildPageMetadata({
    title: `${title} TikTok Trends & Analytics`,
    description: baseDescription,
    path,
    ogImage,
    ogType: "music.song",
    keywords: [...new Set(keywords)],
    section: genre ?? "TikTok Trends",
    tags: [genre, vibe].filter(Boolean) as string[],
  });
}

// ============================================================================
// Structured Data Builders
// ============================================================================

export interface FAQItem {
  question: string;
  answer: string;
}

export function buildFaqSchema(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.href.startsWith("http")
        ? item.href
        : buildCanonical(item.href),
    })),
  };
}

export interface OrganizationSchemaOptions {
  name?: string;
  description?: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
}

export function buildOrganizationSchema(
  options: OrganizationSchemaOptions = {},
) {
  const {
    name = SITE_NAME,
    description = `${SITE_TAGLINE}. Track TikTok audio trends, measure growth, and ship viral content faster.`,
    url = getSiteUrl(),
    logo = `${getSiteUrl()}/logo.png`,
    sameAs = [],
  } = options;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    description,
    url,
    logo,
    sameAs,
  };
}

export interface WebSiteSchemaOptions {
  name?: string;
  description?: string;
  url?: string;
  searchPath?: string;
}

export function buildWebSiteSchema(options: WebSiteSchemaOptions = {}) {
  const {
    name = SITE_NAME,
    description = SITE_TAGLINE,
    url = getSiteUrl(),
    searchPath = "/search?q={search_term_string}",
  } = options;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    description,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${url}${searchPath}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export interface MusicRecordingSchemaOptions {
  name: string;
  author?: string | null;
  playCount?: number | null;
  genre?: string | null;
  thumbnailUrl?: string | null;
  url?: string;
  datePublished?: string | null;
  aggregateRating?: {
    ratingValue: number;
    ratingCount: number;
    bestRating?: number;
    worstRating?: number;
  };
}

export function buildMusicRecordingSchema(
  options: MusicRecordingSchemaOptions,
) {
  const {
    name,
    author,
    playCount,
    genre,
    thumbnailUrl,
    url,
    datePublished,
    aggregateRating,
  } = options;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name,
  };

  if (author) {
    schema.byArtist = {
      "@type": "MusicGroup",
      name: author,
    };
  }

  if (playCount !== null && playCount !== undefined) {
    schema.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/ListenAction",
      userInteractionCount: playCount,
    };
  }

  if (genre) {
    schema.genre = genre;
  }

  if (thumbnailUrl) {
    schema.thumbnailUrl = thumbnailUrl;
  }

  if (url) {
    schema.url = url;
  }

  if (datePublished) {
    schema.datePublished = datePublished;
  }

  if (aggregateRating) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: aggregateRating.ratingValue,
      ratingCount: aggregateRating.ratingCount,
      bestRating: aggregateRating.bestRating ?? 5,
      worstRating: aggregateRating.worstRating ?? 1,
    };
  }

  return schema;
}

export interface CollectionSchemaOptions {
  name: string;
  description: string;
  url: string;
  itemCount?: number;
  items?: Array<{
    name: string;
    url: string;
    thumbnailUrl?: string;
  }>;
}

export function buildCollectionSchema(options: CollectionSchemaOptions) {
  const { name, description, url, itemCount, items = [] } = options;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
  };

  if (itemCount !== undefined) {
    schema.numberOfItems = itemCount;
  }

  if (items.length > 0) {
    schema.itemListElement = items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "MusicRecording",
        name: item.name,
        url: item.url,
        ...(item.thumbnailUrl && { thumbnailUrl: item.thumbnailUrl }),
      },
    }));
  }

  return schema;
}

export interface CollectionPageSchemaOptions {
  name: string;
  description: string;
  url: string;
  breadcrumbs: BreadcrumbItem[];
  itemCount?: number;
  faqs?: FAQItem[];
}

export function buildCollectionPageSchema(
  options: CollectionPageSchemaOptions,
) {
  const { name, description, url, breadcrumbs, itemCount, faqs } = options;

  const schemas = [
    buildCollectionSchema({
      name,
      description,
      url,
      itemCount,
    }),
    buildBreadcrumbSchema(breadcrumbs),
  ];

  if (faqs && faqs.length > 0) {
    schemas.push(buildFaqSchema(faqs));
  }

  return schemas;
}

// ============================================================================
// Category-specific Schema
// ============================================================================

export interface CategoryPageSchemaOptions {
  type: "genre" | "vibe";
  name: string;
  emoji: string;
  description: string;
  slug: string;
  itemCount?: number;
}

export function buildCategoryPageSchema(options: CategoryPageSchemaOptions) {
  const { type, name, emoji, description, slug, itemCount } = options;

  const breadcrumbs: BreadcrumbItem[] = [
    { name: "Home", href: "/" },
    { name: "Trends", href: "/trends" },
    { name: `${emoji} ${name}`, href: `/${type}/${slug}` },
  ];

  const faqs: FAQItem[] =
    type === "genre"
      ? [
          {
            question: `How do you classify ${name} tracks?`,
            answer:
              "Tracks are tagged by AI analysis and heuristics; we normalize genre tokens and only list sounds with clear genre signals.",
          },
          {
            question: "How frequently is this genre page updated?",
            answer:
              "Data refreshes every six hours; the static page revalidates every 15 minutes to keep caches warm.",
          },
        ]
      : [
          {
            question: `What qualifies a sound as ${name}?`,
            answer:
              "We map vibe tokens from AI tags and heuristic keywords, then filter the leaderboard to those matches.",
          },
          {
            question: "How often is the vibe page refreshed?",
            answer:
              "Every six hours at the data layer with page cache revalidation every 15 minutes.",
          },
          {
            question: "Can I use these sounds commercially?",
            answer:
              "Always check TikTok licensing terms for each track; GramDominator reports trend data only and does not grant rights.",
          },
        ];

  return buildCollectionPageSchema({
    name: `${name} TikTok ${type === "genre" ? "Songs" : "Sounds"} & Trends`,
    description,
    url: buildCanonical(`/${type}/${slug}`),
    breadcrumbs,
    itemCount,
    faqs,
  });
}

// ============================================================================
// Tool Page Schema
// ============================================================================

export interface ToolPageSchemaOptions {
  name: string;
  description: string;
  url: string;
  toolType: string;
  faqs: FAQItem[];
}

export function buildToolPageSchema(options: ToolPageSchemaOptions) {
  const { name, description, url, toolType, faqs } = options;

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    url,
    applicationCategory: toolType,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const schemas: Array<Record<string, unknown>> = [softwareApplication];

  if (faqs.length > 0) {
    schemas.push(buildFaqSchema(faqs));
  }

  return schemas;
}
