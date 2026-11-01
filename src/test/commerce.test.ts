import { describe, expect, it } from "vitest";
import { validateCartItem } from "@/services/commerce";
import { products } from "@/data/store";

describe("Demo commerce safety", () => {
  it("accepts real demo variants and valid quantities", () => {
    const p = products[0];
    if (!p) throw new Error("Missing demo product");
    expect(validateCartItem({ productId: p.id, variant: p.variants[0] ?? "", quantity: 2 })).toBe(
      true,
    );
  });

  it("rejects invalid products, variants and quantities", () => {
    const p = products[0];
    if (!p) throw new Error("Missing demo product");
    for (const quantity of [0, -1, 1.5, 100])
      expect(validateCartItem({ productId: p.id, variant: p.variants[0] ?? "", quantity })).toBe(
        false,
      );
    expect(validateCartItem({ productId: "missing", variant: "Display sample", quantity: 1 })).toBe(
      false,
    );
    expect(validateCartItem({ productId: p.id, variant: "made up", quantity: 1 })).toBe(false);
  });

  it("lists demo products in demo mode", async () => {
    const items = await import("@/services/commerce").then((m) => m.commerce.listProducts());
    // In test/demo mode Shopify is not configured so demo products are returned
    expect(Array.isArray(items)).toBe(true);
  });
});
