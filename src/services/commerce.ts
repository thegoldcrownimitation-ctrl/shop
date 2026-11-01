/**
 * Commerce adapter
 *
 * When VITE_SHOPIFY_STORE_DOMAIN and VITE_SHOPIFY_STOREFRONT_TOKEN are
 * configured in .env this module fetches real products from the Shopify
 * Storefront API.  Until the credentials are filled in it falls back to
 * the local demo catalogue so the site always renders.
 */

import { products as demoProducts, type Product } from "@/data/store";
import {
  fetchAllShopifyProducts,
  fetchProductByHandle,
  fetchCollectionProducts,
  searchShopifyProducts,
  fetchProductRecommendations,
} from "@/services/shopify-products";
import { isShopifyConfigured } from "@/lib/shopify";

// ─── Status ───────────────────────────────────────────────────────────────────

export const commerceStatus = {
  mode: isShopifyConfigured ? ("shopify" as const) : ("demo" as const),
  checkoutEnabled: isShopifyConfigured,
} as const;

// ─── Cart ─────────────────────────────────────────────────────────────────────

/** Legacy in-memory cart item used by cart-context for demo mode */
export interface CartItem {
  productId: string;
  variant: string;
  quantity: number;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export interface CommerceAdapter {
  listProducts(): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  getCollectionProducts(handle: string): Promise<{ products: Product[]; title: string; description: string } | null>;
  searchProducts(query: string): Promise<Product[]>;
  getProductRecommendations(shopifyId: string): Promise<Product[]>;
}

export const commerce: CommerceAdapter = {
  async listProducts(): Promise<Product[]> {
    if (!isShopifyConfigured) {
      console.info(
        "[commerce] Running in demo mode. " +
          "Set VITE_SHOPIFY_STORE_DOMAIN and VITE_SHOPIFY_STOREFRONT_TOKEN in .env to load live products.",
      );
      return demoProducts;
    }

    try {
      const shopifyProducts = await fetchAllShopifyProducts();
      console.info(`[commerce] Loaded ${shopifyProducts.length} products from Shopify.`);
      return shopifyProducts;
    } catch (err) {
      console.error("[commerce] Failed to fetch from Shopify, falling back to demo products:", err);
      return demoProducts;
    }
  },

  async getProduct(slug: string): Promise<Product | null> {
    if (!isShopifyConfigured) {
      return demoProducts.find((p) => p.slug === slug) ?? null;
    }
    try {
      return await fetchProductByHandle(slug);
    } catch (err) {
      console.error(`[commerce] Failed to fetch product '${slug}':`, err);
      return demoProducts.find((p) => p.slug === slug) ?? null;
    }
  },

  async getCollectionProducts(handle: string): Promise<{ products: Product[]; title: string; description: string } | null> {
    if (isShopifyConfigured) {
      try {
        const col = await fetchCollectionProducts(handle);
        if (col && col.products.length > 0) return col;
      } catch (err) {
        console.warn(`[commerce] Falling back to demo products for collection '${handle}':`, err);
      }
    }

    // Filter demo products by category/festive
    const filtered = demoProducts.filter(
      (p) =>
        p.category === handle ||
        (handle === "bridal-festive" && p.festive) ||
        handle === "new-arrivals",
    );
    return {
      products: filtered,
      title: handle,
      description: "",
    };
  },

  async searchProducts(query: string): Promise<Product[]> {
    if (isShopifyConfigured) {
      try {
        const results = await searchShopifyProducts(query);
        if (results.length > 0) return results;
      } catch (err) {
        console.warn("[commerce] Live Shopify search fallback:", err);
      }
    }

    const q = query.toLowerCase();
    return demoProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  },

  async getProductRecommendations(shopifyId: string): Promise<Product[]> {
    if (isShopifyConfigured) {
      try {
        const recs = await fetchProductRecommendations(shopifyId);
        if (recs.length > 0) return recs;
      } catch (err) {
        console.warn("[commerce] Recommendations fallback to demo catalogue:", err);
      }
    }

    return demoProducts.slice(0, 4);
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

  // If it's a Shopify GID
  if (item.productId.startsWith("gid://shopify/")) {
    return true;
  }

  // Otherwise validate against demo catalogue
  const product = demoProducts.find((p) => p.id === item.productId);
  if (!product) return false;
  return product.variants.includes(item.variant);
}
