/**
 * Recently viewed products hook
 * Persists the last N product IDs viewed in this session in localStorage.
 */

import { useState, useEffect, useCallback } from "react";
import type { Product } from "@/data/store";

const RECENT_KEY = "gc_recently_viewed";
const MAX_RECENT = 8;

function readRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeRecentIds(ids: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function useRecentlyViewed() {
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentIds());

  useEffect(() => {
    writeRecentIds(recentIds);
  }, [recentIds]);

  const track = useCallback((product: Product) => {
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== product.id);
      return [product.id, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  return { recentIds, track };
}
