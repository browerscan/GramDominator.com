"use client";

import { useEffect } from "react";
import type { AudioTrendRow } from "@/lib/types";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";

interface AudioViewTrackerProps {
  audio: AudioTrendRow;
}

export function AudioViewTracker({ audio }: AudioViewTrackerProps) {
  const { addRecentlyViewed } = useRecentlyViewed();

  useEffect(() => {
    addRecentlyViewed(audio);
  }, [audio, addRecentlyViewed]);

  return null;
}
