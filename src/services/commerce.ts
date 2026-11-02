/**
 * Commerce adapter
 *
 * Real Shopify Storefront API integration.
 * Fetches real products, live collections, predictive search and product details.
 * Zero static dummy products are returned to customers.
 */

import type { Product } from "@/data/store";
import {
  fetchAllShopifyProducts,
  fetchProductByHandle,
  fetchCollectionProducts,
  searchShopifyProducts,
  fetchProductRecommendations,
} from "@/services/shopify-products";
import { isShopifyConfigured } from "@/lib/shopify";

export const commerceStatus = {
  mode: isShopifyConfigured ? ("shopify" as const) : ("demo" as const),
  checkoutEnabled: isShopifyConfigured,
} as const;

export interface CartItem {
  productId: string;
  variant: string;
  quantity: number;
}

export interface CommerceAdapter {
  listProducts(): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  getCollectionProducts(handle: string): Promise<{ products: Product[]; title: string; description: string } | null>;
  searchProducts(query: string): Promise<Product[]>;
  getProductRecommendations(shopifyId: string): Promise<Product[]>;
}

// Aliases mapping old or plural handles to live Shopify collection handles
const ALIASES: Record<string, string> = {
  "necklace-sets": "necklaces",
  "bangles-bracelets": "bracelets",
  "rings": "ring",
};

export const commerce: CommerceAdapter = {
  async listProducts(): Promise<Product[]> {
    if (!isShopifyConfigured) {
      return [];
    }

    try {
      const shopifyProducts = await fetchAllShopifyProducts();
      return shopifyProducts;
    } catch (err) {
      console.error("[commerce] Failed to fetch products from Shopify:", err);
      return [];
    }
  },

  async getProduct(slug: string): Promise<Product | null> {
    if (!isShopifyConfigured) return null;
    try {
      return await fetchProductByHandle(slug);
    } catch (err) {
      console.error(`[commerce] Failed to fetch product '${slug}':`, err);
      return null;
    }
  },

  async getCollectionProducts(handle: string): Promise<{ products: Product[]; title: string; description: string } | null> {
    const realHandle = ALIASES[handle] ?? handle;

    if (isShopifyConfigured) {
      // 1. Try to fetch directly from Shopify collection
      try {
        const col = await fetchCollectionProducts(realHandle);
        if (col && col.products.length > 0) {
          return col;
        }
      } catch (err) {
        console.warn(`[commerce] Fetching collection '${realHandle}' failed:`, err);
      }

      // 2. Fetch all products and filter by collection membership, category, or title
      try {
        const all = await fetchAllShopifyProducts();
        const matched = all.filter((p) => {
          if (realHandle === "bridal-festive") return p.festive;
          if (realHandle === "new-arrivals") return true;

          const colls = p.collections ?? [];
          return (
            colls.includes(realHandle) ||
            colls.includes(handle) ||
            p.category === realHandle ||
            p.category === handle
          );
        });

        const titleMap: Record<string, string> = {
          necklaces: "Necklaces",
          earrings: "Earrings",
          bracelets: "Bracelets",
          bangles: "Bangles",
          ring: "Rings",
          "bridal-festive": "Bridal & Festive",
          "new-arrivals": "New Arrivals",
        };

        return {
          products: matched,
          title: titleMap[realHandle] ?? realHandle.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          description: "",
        };
      } catch (err) {
        console.warn(`[commerce] Collection fallback filtering failed:`, err);
      }
    }

    return {
      products: [],
      title: handle,
      description: "",
    };
  },

  async searchProducts(query: string): Promise<Product[]> {
    if (isShopifyConfigured) {
      try {
        const results = await searchShopifyProducts(query);
        return results;
      } catch (err) {
        console.warn("[commerce] Live Shopify search failed:", err);
      }
    }
    return [];
  },

  async getProductRecommendations(shopifyId: string): Promise<Product[]> {
    if (isShopifyConfigured) {
      try {
        const recs = await fetchProductRecommendations(shopifyId);
        if (recs.length > 0) return recs;
      } catch (err) {
        console.warn("[commerce] Recommendations failed:", err);
      }

      try {
        const all = await fetchAllShopifyProducts();
        return all.filter((p) => p.shopifyId !== shopifyId).slice(0, 4);
      } catch {}
    }

    return [];
  },
};

export function validateCartItem(item: CartItem): boolean {
  if (
    !item ||
    typeof item.productId !== "string" ||
    !item.productId ||
    typeof item.variant !== "string" ||
    !item.variant ||
    !Number.isInteger(item.quantity) ||
    item.quantity <= 0 ||
    item.quantity > 99
  ) {
    return false;
  }

  return true;
}
