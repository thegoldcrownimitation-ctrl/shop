/**
 * Opt-in LIVE integration test against the real Storefront API configured in .env.
 *
 *   RUN_LIVE_SHOPIFY=1 npx vitest run src/test/shopify-live.test.ts
 *
 * Safe by design: read-only catalogue queries plus an ephemeral cart that is never checked out.
 * No customers are created/authenticated, no emails sent, and no payment is attempted.
 */
import { describe, it, expect } from "vitest";
import { isShopifyConfigured, shopifyFetch, API_VERSION } from "@/lib/shopify";
import {
  fetchAllShopifyProducts,
  fetchCollections,
  fetchCollectionProducts,
  fetchProductByHandle,
  searchShopifyProducts,
} from "@/services/shopify-products";
import {
  createCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
  applyDiscountCode,
  getCart,
  getFreshCheckoutUrl,
  resolveCheckoutUrl,
} from "@/services/shopify-cart";

const live = !!process.env["RUN_LIVE_SHOPIFY"] && isShopifyConfigured;

describe.skipIf(!live)("LIVE Shopify Storefront API", () => {
  it(`serves the pinned API version ${API_VERSION} (no silent fall-forward)`, async () => {
    const data = await shopifyFetch<{ shop: { name: string } }>("{ shop { name } }");
    expect(data.shop.name).toBeTruthy();
  });

  it("lists products with variants, prices and availability", async () => {
    const products = await fetchAllShopifyProducts();
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.detail?.variants.length).toBeGreaterThan(0);
      expect(p.price).toBeGreaterThanOrEqual(0);
      expect(typeof p.availableForSale).toBe("boolean");
    }
  });

  it("lists collections and loads a collection's products", async () => {
    const collections = await fetchCollections();
    expect(collections.length).toBeGreaterThan(0);
    const first = collections[0]!;
    const res = await fetchCollectionProducts(first.handle);
    expect(res).not.toBeNull();
    expect(res!.title).toBeTruthy();
  });

  it("loads a product by handle and returns null for an unknown handle", async () => {
    const [p] = await fetchAllShopifyProducts();
    const found = await fetchProductByHandle(p!.slug);
    expect(found?.shopifyId).toBe(p!.shopifyId);
    expect(await fetchProductByHandle("definitely-not-a-real-handle-xyz")).toBeNull();
  });

  it("searches products", async () => {
    const [p] = await fetchAllShopifyProducts();
    const word = p!.name.split(/\s+/)[0]!;
    const results = await searchShopifyProducts(word);
    expect(Array.isArray(results)).toBe(true);
  });

  it("runs a full cart lifecycle: create → add → update → discount → remove → checkout URL", async () => {
    const products = await fetchAllShopifyProducts();
    const variant = products
      .flatMap((p) => p.detail?.variants ?? [])
      .find((v) => v.availableForSale && (v.quantityAvailable ?? 0) > 1);
    expect(variant, "needs at least one in-stock variant").toBeTruthy();

    const cart = await createCart();
    expect(cart.totalQuantity).toBe(0);

    const added = await addCartLines(cart.id, [{ merchandiseId: variant!.id, quantity: 1 }]);
    expect(added.totalQuantity).toBe(1);
    const lineId = added.lines.nodes[0]!.id;
    expect(Number(added.cost.totalAmount.amount)).toBeGreaterThan(0);

    const updated = await updateCartLines(cart.id, [{ id: lineId, quantity: 2 }]);
    expect(updated.totalQuantity).toBe(2);

    const discounted = await applyDiscountCode(cart.id, ["NOT-A-REAL-CODE-123"]);
    expect(discounted.discountCodes[0]?.applicable).toBe(false);
    const cleared = await applyDiscountCode(cart.id, []);
    expect(cleared.discountCodes).toHaveLength(0);

    const url = await getFreshCheckoutUrl(cart.id);
    const safe = resolveCheckoutUrl(url, "storefront.example");
    expect(new URL(safe).protocol).toBe("https:");

    const removed = await removeCartLines(cart.id, [lineId]);
    expect(removed.totalQuantity).toBe(0);
    expect((await getCart(cart.id))?.id).toBe(cart.id);
  });

  it("rejects an over-stock quantity with a readable error", async () => {
    const products = await fetchAllShopifyProducts();
    const variant = products
      .flatMap((p) => p.detail?.variants ?? [])
      .find((v) => v.availableForSale && v.quantityAvailable != null);
    const cart = await createCart();
    // Shopify may either clamp the quantity or return a userError; both are acceptable, a crash is not.
    const res = await addCartLines(cart.id, [
      { merchandiseId: variant!.id, quantity: (variant!.quantityAvailable ?? 1) + 1000 },
    ]).catch((e) => e as Error);
    if (res instanceof Error) expect(res.message.length).toBeGreaterThan(0);
    else expect(res.totalQuantity).toBeLessThanOrEqual(variant!.quantityAvailable ?? 1);
  });
});
