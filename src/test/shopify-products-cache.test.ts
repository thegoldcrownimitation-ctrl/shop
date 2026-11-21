import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchAllShopifyProducts,
  fetchProductByHandle,
  clearProductCache,
} from "@/services/shopify-products";

const productNode = (handle: string) => ({
  id: `gid://shopify/Product/${handle}`,
  title: handle,
  handle,
  productType: "Necklace",
  tags: [],
  createdAt: "2026-01-01T00:00:00Z",
  description: "",
  descriptionHtml: "",
  availableForSale: true,
  priceRange: {
    minVariantPrice: { amount: "100.0", currencyCode: "INR" },
    maxVariantPrice: { amount: "100.0", currencyCode: "INR" },
  },
  compareAtPriceRange: { minVariantPrice: { amount: "0.0", currencyCode: "INR" } },
  images: { nodes: [] },
  collections: { nodes: [{ id: "c1", handle: "necklaces", title: "Necklaces" }] },
  variants: { nodes: [] },
  options: [],
  seo: { title: null, description: null },
});

const page = (nodes: unknown[], hasNextPage = false, endCursor: string | null = null) =>
  new Response(
    JSON.stringify({ data: { products: { pageInfo: { hasNextPage, endCursor }, nodes } } }),
  );

describe("product data layer", () => {
  beforeEach(() => clearProductCache());
  afterEach(() => vi.restoreAllMocks());

  it("shares one in-flight request between simultaneous callers and reuses the result", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => page([productNode("a")]));
    const [a, b, c] = await Promise.all([
      fetchAllShopifyProducts(),
      fetchAllShopifyProducts(),
      fetchAllShopifyProducts(),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    await fetchAllShopifyProducts();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("follows pagination cursors until hasNextPage is false", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(page([productNode("a")], true, "cur1"))
      .mockResolvedValueOnce(page([productNode("b")], false, null));
    const products = await fetchAllShopifyProducts();
    expect(products.map((p) => p.slug)).toEqual(["a", "b"]);
    const second = JSON.parse(spy.mock.calls[1]?.[1]?.body as string);
    expect(second.variables.cursor).toBe("cur1");
  });

  it("does not cache failures — the next call retries", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(page([productNode("a")]));
    await expect(fetchAllShopifyProducts()).rejects.toThrow();
    await expect(fetchAllShopifyProducts()).resolves.toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("returns null (not an error) for an unknown product handle", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { productByHandle: null } })),
    );
    await expect(fetchProductByHandle("nope")).resolves.toBeNull();
  });
});
