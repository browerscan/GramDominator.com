"use client";

import Link from "next/link";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { buildAudioSlug } from "@/lib/slug";

export function RecentlyViewed() {
  const {
    recentItems,
    isInitialized,
    clearRecentlyViewed,
    storageType,
    isPersistent,
  } = useRecentlyViewed();

  if (!isInitialized || recentItems.length === 0) {
    return null;
  }

  const handleClear = () => {
    clearRecentlyViewed();
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-glow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-black/70">
            Recently viewed
          </h3>
          {!isPersistent && (
            <span
              className="text-xs text-black/40"
              title="Storage not available - using memory"
            >
              (session only)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-black/40 hover:text-black/60"
        >
          Clear
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {recentItems.map((item) => {
          const slug = buildAudioSlug(item.title, item.id);
          return (
            <li key={item.id}>
              <Link
                href={`/audio/${slug}`}
                className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-black/[0.02]"
              >
                {item.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.cover_url}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-black/5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5 text-black/40"
                    >
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-black">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-black/50">
                    {item.author ?? "Unknown artist"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
