import { describe, expect, it } from "vitest";
import { validateCartItem } from "@/services/commerce";

describe("Commerce validation and cart safety", () => {
  it("accepts valid cart items and positive quantities", () => {
    expect(validateCartItem({ productId: "prod-1", variant: "Default", quantity: 2 })).toBe(true);
    expect(validateCartItem({ productId: "gid://shopify/ProductVariant/123", variant: "Default", quantity: 1 })).toBe(true);
  });

  it("rejects invalid products, variants and quantities", () => {
    for (const quantity of [0, -1, 1.5, 100]) {
      expect(validateCartItem({ productId: "prod-1", variant: "Default", quantity })).toBe(false);
    }
    expect(validateCartItem({ productId: "", variant: "Default", quantity: 1 })).toBe(false);
    expect(validateCartItem({ productId: "prod-1", variant: "", quantity: 1 })).toBe(false);
  });

  it("lists products via commerce service", async () => {
    const items = await import("@/services/commerce").then((m) => m.commerce.listProducts());
    expect(Array.isArray(items)).toBe(true);
  });
});
