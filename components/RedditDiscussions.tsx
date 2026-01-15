"use client";

import { useState } from "react";
import type { RedditPost } from "@/lib/proxy-grid";

interface RedditDiscussionsProps {
  query: string;
  posts: RedditPost[];
  error?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

function timeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function RedditDiscussions({
  query,
  posts,
  error,
}: RedditDiscussionsProps) {
  const [showAll, setShowAll] = useState(false);

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">
          Community discussions
        </h2>
        <p className="mt-3 text-sm text-black/60">
          Discussions will be available soon.
        </p>
      </div>
    );
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
            Community discussions
          </h2>
          <p className="mt-1 text-sm text-black/60">
            What people are saying about this trend.
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

      <div className="mt-4 space-y-3">
        {displayPosts.map((post) => (
          <a
            key={post.id}
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-black/5 bg-white/60 p-4 transition hover:border-black/10 hover:bg-white/80"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-semibold text-black group-hover:text-blaze">
                  {post.title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/50">
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700">
                    r/{post.subreddit}
                  </span>
                  <span>by u/{post.author}</span>
                  <span>·</span>
                  <span>{timeAgo(post.createdAt)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-black/60">
                <span className="flex items-center gap-1 font-medium">
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
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                  {formatNumber(post.score)}
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
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  {formatNumber(post.comments)}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      <a
        href={`https://www.reddit.com/search/?q=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blaze hover:underline"
      >
        View more discussions on Reddit
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
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  );
}
