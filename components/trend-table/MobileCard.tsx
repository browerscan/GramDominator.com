import Image from "next/image";
import Link from "next/link";
import { buildAudioSlug } from "@/lib/slug";
import { formatNumber, getGrowthLabel } from "@/lib/format";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CopyTikTokButton } from "@/components/CopyTikTokButton";
import type { AudioTrendRow } from "@/lib/types";

interface MobileCardProps {
  item: AudioTrendRow;
}

export function MobileCard({ item }: MobileCardProps) {
  const slug = buildAudioSlug(item.title, item.id);
  const growth = item.growth_rate ?? 0;
  const badge = getGrowthLabel(growth);

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="flex gap-3">
        <CoverImage src={item.cover_url} alt={item.title} />
        <div className="min-w-0 flex-1">
          <AudioInfo item={item} />
          <Stats playCount={item.play_count ?? 0} badge={badge} />
          <Tags genre={item.genre} vibe={item.vibe} />
        </div>
      </div>
      <Actions slug={slug} audioId={item.id} />
    </div>
  );
}

interface CoverImageProps {
  src: string | null;
  alt: string;
}

function CoverImage({ src, alt }: CoverImageProps) {
  if (src && src.startsWith("http")) {
    return (
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-black/5">
        <Image
          src={src}
          alt={alt + " cover art"}
          fill
          sizes="64px"
          className="object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-black/5">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 text-black/40"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    </div>
  );
}

interface AudioInfoProps {
  item: AudioTrendRow;
}

function AudioInfo({ item }: AudioInfoProps) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-black">
          {item.title}
        </p>
        <p className="truncate text-xs text-black/50">
          {item.author ?? "Unknown artist"}
        </p>
      </div>
      <FavoriteButton audio={item} variant="icon" />
    </div>
  );
}

interface StatsProps {
  playCount: number;
  badge: { label: string; tone: string };
}

function Stats({ playCount, badge }: StatsProps) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs font-mono text-black/60">
        {formatNumber(playCount)} uses
      </span>
      <span className={"text-xs font-semibold " + badge.tone}>
        {badge.label}
      </span>
    </div>
  );
}

interface TagsProps {
  genre: string | null;
  vibe: string | null;
}

function Tags({ genre, vibe }: TagsProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {genre ? (
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-black/60">
          {genre}
        </span>
      ) : null}
      {vibe ? (
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-black/60">
          {vibe}
        </span>
      ) : null}
    </div>
  );
}

interface ActionsProps {
  slug: string;
  audioId: string;
}

function Actions({ slug, audioId }: ActionsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Link
        href={"/audio/" + slug}
        className="flex-1 rounded-full bg-ink px-3 py-2 text-center text-xs font-semibold text-white transition hover:opacity-90"
      >
        Details
      </Link>
      <a
        href={"https://www.tiktok.com/music/" + audioId}
        target="_blank"
        rel="noreferrer"
        className="flex-1 rounded-full border border-black/10 px-3 py-2 text-center text-xs font-semibold text-black/70 transition hover:border-black/20 hover:bg-black/5"
      >
        Use audio
      </a>
      <CopyTikTokButton audioId={audioId} />
    </div>
  );
}
