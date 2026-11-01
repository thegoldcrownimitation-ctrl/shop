import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFreshCheckoutUrl, updateCartBuyerIdentity } from "@/services/shopify-cart";

describe("Shopify Cart & Headless Checkout Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("queries fresh checkoutUrl for a given cartId", async () => {
    const mockCheckoutUrl = "https://thegoldcrownimitation.myshopify.com/cart/c/c1-fresh-checkout-123";
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
      "Your cart has expired or was not found"
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
    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
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

    const requestBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(requestBody.variables.buyerIdentity.customerAccessToken).toBe("customer-access-token-abc");
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
      updateCartBuyerIdentity("gid://shopify/Cart/123456", { email: "invalid-email" })
    ).rejects.toThrow("Invalid email");
  });
});
