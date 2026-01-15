"use client";

import { useState } from "react";

interface CopyTikTokButtonProps {
  audioId: string;
  className?: string;
}

export function CopyTikTokButton({
  audioId,
  className = "",
}: CopyTikTokButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const url = `https://www.tiktok.com/music/${audioId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-black/70 transition hover:border-black/20 hover:bg-black/5 ${className}`}
      aria-label={copied ? "Copied to clipboard" : "Copy TikTok sound link"}
    >
      {copied ? (
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy link
        </span>
      )}
    </button>
  );
}
