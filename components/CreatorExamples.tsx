"use client";

import { useState } from "react";
import Image from "next/image";
import type { TikTokCreatorPost } from "@/lib/proxy-grid";

interface CreatorExamplesProps {
  hashtag: string;
  posts: TikTokCreatorPost[];
  error?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

export function CreatorExamples({
  hashtag,
  posts,
  error,
}: CreatorExamplesProps) {
  const [showAll, setShowAll] = useState(false);

  if (error) {
    return null;
  }

  if (posts.length === 0) {
    return null;
  }

  const displayPosts = showAll ? posts : posts.slice(0, 3);

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">
            Creator examples
          </h2>
          <p className="mt-1 text-sm text-black/60">
            See how others are using this sound.
          </p>
        </div>
        {posts.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-semibold text-blaze hover:underline"
          >
            {showAll ? "Show less" : `See all (${posts.length})`}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayPosts.map((post) => (
          <a
            key={post.id}
            href={post.authorUrl || post.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white/60 transition hover:border-black/10 hover:bg-white/80"
          >
            <div className="relative aspect-[9/16] w-full overflow-hidden bg-black/5">
              {post.thumbnail ? (
                <Image
                  src={post.thumbnail}
                  alt={post.description}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 text-black/20"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="truncate text-xs font-medium text-white">
                  @{post.author}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-black/5 p-3">
              <div className="flex gap-3 text-xs text-black/60">
                <span className="flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                  </svg>
                  {formatNumber(post.stats.plays)}
                </span>
                <span className="flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  {formatNumber(post.stats.likes)}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
