/**
 * Wishlist hook — persists favourite product IDs in localStorage.
 */

import { useState, useEffect, useCallback } from "react";
import type { Product } from "@/data/store";

const WISHLIST_KEY = "gc_wishlist";

function readWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeWishlist(ids: string[]): void {
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function useWishlist() {
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => readWishlist());

  // Sync changes to localStorage
  useEffect(() => {
    writeWishlist(wishlistIds);
  }, [wishlistIds]);

  const toggle = useCallback((product: Product) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(product.id);
      return exists ? prev.filter((id) => id !== product.id) : [...prev, product.id];
    });
  }, []);

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds],
  );

  const clearWishlist = useCallback(() => {
    setWishlistIds([]);
  }, []);

  return { wishlistIds, toggle, isWishlisted, clearWishlist, count: wishlistIds.length };
}
