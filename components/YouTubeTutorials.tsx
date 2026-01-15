"use client";

import { useState } from "react";
import Image from "next/image";
import type { YouTubeVideo } from "@/lib/proxy-grid";

interface YouTubeTutorialsProps {
  audioTitle: string;
  videos: YouTubeVideo[];
  error?: string;
}

export function YouTubeTutorials({
  audioTitle,
  videos,
  error,
}: YouTubeTutorialsProps) {
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(
    videos.length > 0 ? videos[0] : null,
  );

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">
          How to use this sound
        </h2>
        <p className="mt-3 text-sm text-black/60">
          Tutorial videos will be available soon.
        </p>
      </div>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="font-display text-lg font-semibold">
        How to use this sound
      </h2>
      <p className="mt-1 text-sm text-black/60">
        Learn from creators who have mastered this audio.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          {selectedVideo && (
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black/5">
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.videoId}`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          )}
          {selectedVideo && (
            <div className="flex items-center gap-2 text-xs text-black/60">
              <span className="font-semibold">{selectedVideo.channel}</span>
              <span>·</span>
              <a
                href={`https://www.youtube.com/watch?v=${selectedVideo.videoId}`}
                target="_blank"
                rel="noreferrer"
                className="text-blaze hover:underline"
              >
                Watch on YouTube
              </a>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-black/40">
            More tutorials
          </p>
          <div className="space-y-2">
            {videos.map((video) => (
              <button
                key={video.videoId}
                onClick={() => setSelectedVideo(video)}
                className={`flex w-full items-start gap-3 rounded-lg p-2 text-left transition ${
                  selectedVideo?.videoId === video.videoId
                    ? "bg-black/5"
                    : "hover:bg-black/[0.02]"
                }`}
              >
                <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-md bg-black/5">
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold text-black">
                    {video.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-black/50">
                    {video.channel}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
