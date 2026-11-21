import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shopifyFetch,
  throwOnUserErrors,
  ShopifyApiError,
  API_VERSION,
  SHOPIFY_ENDPOINT,
} from "@/lib/shopify";

const ok = (data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ data }), { status: 200, headers });

describe("Shopify Storefront client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("pins a currently supported stable API version (>= 2026-01)", () => {
    expect(API_VERSION >= "2026-01").toBe(true);
    expect(SHOPIFY_ENDPOINT).toContain(`/api/${API_VERSION}/graphql.json`);
  });

  it("sends the public Storefront token header and returns data", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(ok({ shop: { name: "x" } }));
    const data = await shopifyFetch<{ shop: { name: string } }>("{ shop { name } }");
    expect(data.shop.name).toBe("x");
    const init = spy.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers)).toContain("X-Shopify-Storefront-Access-Token");
    expect(Object.keys(headers)).not.toContain("Shopify-Storefront-Private-Token");
  });

  it("retries on HTTP 429 and succeeds", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(ok({ ok: true }));
    const promise = shopifyFetch<{ ok: boolean }>("{ x }");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("retries on THROTTLED GraphQL errors", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(ok({ ok: true }));
    const promise = shopifyFetch("{ x }");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 attempts on persistent 503 with a typed, retryable error", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("", { status: 503 }));
    const promise = shopifyFetch("{ x }");
    const assertion = expect(promise).rejects.toMatchObject({ status: 503, retryable: true });
    await vi.runAllTimersAsync();
    await assertion;
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("does not retry auth failures and explains them", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }));
    await expect(shopifyFetch("{ x }")).rejects.toThrow(/access token/i);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("reports 403 as a missing-permission problem", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 403 }));
    await expect(shopifyFetch("{ x }")).rejects.toThrow(/permission/i);
  });

  it("throws ShopifyApiError carrying the GraphQL error code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [
            { message: "Field 'nope' doesn't exist", extensions: { code: "undefinedField" } },
          ],
        }),
        { status: 200 },
      ),
    );
    await expect(shopifyFetch("{ nope }")).rejects.toMatchObject({
      name: "ShopifyApiError",
      code: "undefinedField",
      retryable: false,
    });
  });

  it("throwOnUserErrors joins messages and keeps the first code", () => {
    expect(() => throwOnUserErrors([])).not.toThrow();
    expect(() => throwOnUserErrors(null)).not.toThrow();
    try {
      throwOnUserErrors([
        { message: "a", code: "INVALID" },
        { message: "b", code: "OTHER" },
      ]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ShopifyApiError);
      expect((err as ShopifyApiError).message).toBe("a; b");
      expect((err as ShopifyApiError).code).toBe("INVALID");
    }
  });
});
