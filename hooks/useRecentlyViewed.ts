"use client";

import { useCallback, useEffect, useState } from "react";
import type { AudioTrendRow } from "@/lib/types";
import { logger } from "@/lib/logger";

const STORAGE_KEY = "gramdominator_recently_viewed";
const MAX_ITEMS = 5;

interface RecentlyViewedItem {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  viewedAt: number;
}

type StorageType = "localStorage" | "sessionStorage" | "memory";

/**
 * Storage abstraction layer with fallback support
 */
class StorageManager {
  private storageType: StorageType = "memory";
  private memoryCache: Map<string, string> = new Map();

  constructor() {
    this.storageType = this.detectAvailableStorage();
  }

  /**
   * Detect which storage mechanism is available
   */
  private detectAvailableStorage(): StorageType {
    if (typeof window === "undefined") {
      return "memory";
    }

    // Test localStorage
    try {
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return "localStorage";
    } catch {
      logger.warn("localStorage unavailable, trying sessionStorage");
    }

    // Fallback to sessionStorage
    try {
      const testKey = "__storage_test__";
      sessionStorage.setItem(testKey, "test");
      sessionStorage.removeItem(testKey);
      return "sessionStorage";
    } catch {
      logger.warn("sessionStorage unavailable, using in-memory storage");
    }

    return "memory";
  }

  /**
   * Get the storage type being used
   */
  getStorageType(): StorageType {
    return this.storageType;
  }

  /**
   * Check if storage is persistent
   */
  isPersistent(): boolean {
    return (
      this.storageType === "localStorage" ||
      this.storageType === "sessionStorage"
    );
  }

  /**
   * Get an item from storage
   */
  getItem(key: string): string | null {
    try {
      switch (this.storageType) {
        case "localStorage":
          return localStorage.getItem(key);
        case "sessionStorage":
          return sessionStorage.getItem(key);
        case "memory":
          return this.memoryCache.get(key) ?? null;
      }
    } catch (error) {
      logger.warn("Storage getItem failed:", error);
    }
    return null;
  }

  /**
   * Set an item in storage
   */
  setItem(key: string, value: string): boolean {
    try {
      switch (this.storageType) {
        case "localStorage":
          localStorage.setItem(key, value);
          return true;
        case "sessionStorage":
          sessionStorage.setItem(key, value);
          return true;
        case "memory":
          this.memoryCache.set(key, value);
          // Limit memory cache size
          if (this.memoryCache.size > 100) {
            const firstKey = this.memoryCache.keys().next().value;
            if (firstKey) this.memoryCache.delete(firstKey);
          }
          return true;
      }
    } catch (error) {
      logger.warn("Storage setItem failed:", error);
      return false;
    }
    return false;
  }

  /**
   * Remove an item from storage
   */
  removeItem(key: string): boolean {
    try {
      switch (this.storageType) {
        case "localStorage":
          localStorage.removeItem(key);
          return true;
        case "sessionStorage":
          sessionStorage.removeItem(key);
          return true;
        case "memory":
          return this.memoryCache.delete(key);
      }
    } catch (error) {
      logger.warn("Storage removeItem failed:", error);
    }
    return false;
  }

  /**
   * Clear all items from storage
   */
  clear(): boolean {
    try {
      switch (this.storageType) {
        case "localStorage":
          localStorage.clear();
          return true;
        case "sessionStorage":
          sessionStorage.clear();
          return true;
        case "memory":
          this.memoryCache.clear();
          return true;
      }
    } catch (error) {
      logger.warn("Storage clear failed:", error);
    }
    return false;
  }
}

// Singleton instance
const storageManager = new StorageManager();

export function useRecentlyViewed() {
  const [recentItems, setRecentItems] = useState<RecentlyViewedItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [storageType, setStorageType] = useState<StorageType>("memory");

  useEffect(() => {
    // Detect storage type on mount
    setStorageType(storageManager.getStorageType());

    const stored = storageManager.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentItems(parsed);
        }
      } catch (error) {
        logger.warn("Failed to parse recently viewed items:", error);
      }
    }
    setIsInitialized(true);
  }, []);

  const saveRecentItems = useCallback((items: RecentlyViewedItem[]) => {
    const success = storageManager.setItem(STORAGE_KEY, JSON.stringify(items));
    if (!success) {
      logger.warn("Failed to save recently viewed items");
    }
  }, []);

  const addRecentlyViewed = useCallback(
    (audio: AudioTrendRow) => {
      setRecentItems((prev) => {
        const newItem: RecentlyViewedItem = {
          id: audio.id,
          title: audio.title,
          author: audio.author,
          cover_url: audio.cover_url,
          viewedAt: Date.now(),
        };

        // Remove existing item with same id if present
        const filtered = prev.filter((item) => item.id !== audio.id);

        // Add new item at the beginning
        const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
        saveRecentItems(updated);
        return updated;
      });
    },
    [saveRecentItems],
  );

  const clearRecentlyViewed = useCallback(() => {
    setRecentItems([]);
    saveRecentItems([]);
  }, [saveRecentItems]);

  return {
    recentItems,
    addRecentlyViewed,
    clearRecentlyViewed,
    isInitialized,
    storageType,
    isPersistent: storageManager.isPersistent(),
  };
}
