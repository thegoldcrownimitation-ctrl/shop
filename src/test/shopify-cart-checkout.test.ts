import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getFreshCheckoutUrl,
  updateCartBuyerIdentity,
  getCart,
  ensureCart,
  addCartLines,
  applyDiscountCode,
  isCartGoneError,
  getPersistedCartId,
  persistCartId,
  resolveCheckoutUrl,
} from "@/services/shopify-cart";

describe("Shopify Cart & Headless Checkout Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("queries fresh checkoutUrl for a given cartId", async () => {
    const mockCheckoutUrl =
      "https://thegoldcrownimitation.myshopify.com/cart/c/c1-fresh-checkout-123";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cart: {
            checkoutUrl: mockCheckoutUrl,
          },
        },
      }),
    } as Response);

    const result = await getFreshCheckoutUrl("gid://shopify/Cart/123456");
    expect(result).toBe(mockCheckoutUrl);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("throws clear error if cart is not found or expired when querying fresh checkoutUrl", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cart: null,
        },
      }),
    } as Response);

    await expect(getFreshCheckoutUrl("gid://shopify/Cart/expired-cart")).rejects.toThrow(
      "Your cart has expired or was not found",
    );
  });

  it("attaches buyer identity (email) to Shopify cart via cartBuyerIdentityUpdate", async () => {
    const mockCart = {
      id: "gid://shopify/Cart/123456",
      checkoutUrl: "https://thegoldcrownimitation.myshopify.com/cart/c/xyz",
      cost: {
        subtotalAmount: { amount: "2500.00", currencyCode: "INR" },
        totalAmount: { amount: "2500.00", currencyCode: "INR" },
      },
      lines: { edges: [] },
      discountCodes: [],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cartBuyerIdentityUpdate: {
            cart: mockCart,
            userErrors: [],
          },
        },
      }),
    } as Response);

    const result = await updateCartBuyerIdentity("gid://shopify/Cart/123456", {
      email: "test@thegoldcrownjewellery.com",
    });

    expect(result).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalled();
    const requestBody = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.query).toContain("cartBuyerIdentityUpdate");
    expect(requestBody.variables.buyerIdentity.email).toBe("test@thegoldcrownjewellery.com");
  });

  it("attaches customerAccessToken to buyer identity when provided for logged-in user", async () => {
    const mockCart = {
      id: "gid://shopify/Cart/123456",
      checkoutUrl: "https://thegoldcrownimitation.myshopify.com/cart/c/xyz",
      cost: {
        subtotalAmount: { amount: "2500.00", currencyCode: "INR" },
        totalAmount: { amount: "2500.00", currencyCode: "INR" },
      },
      lines: { edges: [] },
      discountCodes: [],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cartBuyerIdentityUpdate: {
            cart: mockCart,
            userErrors: [],
          },
        },
      }),
    } as Response);

    await updateCartBuyerIdentity("gid://shopify/Cart/123456", {
      email: "test@thegoldcrownjewellery.com",
      customerAccessToken: "customer-access-token-abc",
    });

    const requestBody = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.variables.buyerIdentity.customerAccessToken).toBe(
      "customer-access-token-abc",
    );
    expect(requestBody.variables.buyerIdentity.email).toBe("test@thegoldcrownjewellery.com");
  });

  it("handles user errors gracefully from cartBuyerIdentityUpdate", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cartBuyerIdentityUpdate: {
            cart: null,
            userErrors: [{ field: ["email"], message: "Invalid email" }],
          },
        },
      }),
    } as Response);

    await expect(
      updateCartBuyerIdentity("gid://shopify/Cart/123456", { email: "invalid-email" }),
    ).rejects.toThrow("Invalid email");
  });

  describe("cart resilience", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("recognises Shopify's 'cart does not exist' userError as an expired cart", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            cartLinesAdd: {
              cart: null,
              userErrors: [
                {
                  code: "INVALID",
                  field: ["cartId"],
                  message: "The specified cart does not exist.",
                },
              ],
            },
          },
        }),
      } as Response);
      const err = await addCartLines("gid://shopify/Cart/gone", [
        { merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 },
      ]).catch((e) => e);
      expect(isCartGoneError(err)).toBe(true);
    });

    it("surfaces variant userErrors (e.g. sold out) without treating them as an expired cart", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            cartLinesAdd: {
              cart: null,
              userErrors: [
                { code: "INVALID", field: ["lines", "0", "merchandiseId"], message: "Sold out" },
              ],
            },
          },
        }),
      } as Response);
      const err = await addCartLines("gid://shopify/Cart/1", [
        { merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 },
      ]).catch((e) => e);
      expect(isCartGoneError(err)).toBe(false);
      expect((err as Error).message).toBe("Sold out");
    });

    it("getCart returns null only when Shopify says the cart is gone, and throws on API failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { cart: null } }),
      } as Response);
      await expect(getCart("gid://shopify/Cart/gone")).resolves.toBeNull();

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);
      await expect(getCart("gid://shopify/Cart/1")).rejects.toThrow(/token/i);
    });

    it("ensureCart keeps the saved cart id when Shopify is temporarily unreachable", async () => {
      persistCartId("gid://shopify/Cart/keep-me");
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);
      await expect(ensureCart()).rejects.toThrow();
      expect(getPersistedCartId()).toBe("gid://shopify/Cart/keep-me");
    });

    it("ensureCart replaces the saved id only after Shopify confirms the cart is gone", async () => {
      persistCartId("gid://shopify/Cart/old");
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { cart: null } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              cartCreate: {
                cart: {
                  id: "gid://shopify/Cart/new",
                  checkoutUrl: "https://x.myshopify.com/cart/c/new",
                },
                userErrors: [],
              },
            },
          }),
        } as Response);
      const cart = await ensureCart();
      expect(cart.id).toBe("gid://shopify/Cart/new");
      expect(getPersistedCartId()).toBe("gid://shopify/Cart/new");
    });

    it("applyDiscountCode sends the full desired code list and returns applicability", async () => {
      const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            cartDiscountCodesUpdate: {
              cart: {
                id: "gid://shopify/Cart/1",
                discountCodes: [{ code: "BOGUS", applicable: false }],
              },
              userErrors: [],
            },
          },
        }),
      } as Response);
      const cart = await applyDiscountCode("gid://shopify/Cart/1", ["BOGUS"]);
      expect(cart.discountCodes[0]?.applicable).toBe(false);
      const body = JSON.parse(spy.mock.calls[0]?.[1]?.body as string);
      expect(body.variables.discountCodes).toEqual(["BOGUS"]);
    });
  });

  describe("checkout redirect safety", () => {
    it("rejects non-https and malformed checkout URLs", () => {
      expect(() => resolveCheckoutUrl("http://shop.example/cart/c/1")).toThrow();
      expect(() => resolveCheckoutUrl("javascript:alert(1)")).toThrow();
      expect(() => resolveCheckoutUrl("not a url")).toThrow();
    });

    it("keeps Shopify's own checkout host untouched", () => {
      const url = "https://thegoldcrownimitation.myshopify.com/cart/c/abc?key=1";
      expect(resolveCheckoutUrl(url, "www.thegoldcrownjewellery.com")).toBe(url);
    });

    it("never sends the buyer to the headless site's own host (which doesn't serve checkout)", () => {
      const out = resolveCheckoutUrl(
        "https://www.thegoldcrownjewellery.com/cart/c/abc?key=1",
        "www.thegoldcrownjewellery.com",
      );
      expect(new URL(out).hostname).not.toBe("www.thegoldcrownjewellery.com");
      expect(new URL(out).pathname).toBe("/cart/c/abc");
      expect(new URL(out).search).toBe("?key=1");
    });
  });
});
