import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sanitizeReturnTo,
  validateIdToken,
  normalizeCustomer,
  handleAuthLogin,
  handleAuthCallback,
  handleAuthLogout,
  handleCustomerGraphQLProxy,
  handleAuthStatus,
} from "../server/shopify-auth";

const ISSUER = "https://shopify.com/authentication/1";
const jwt = (claims: Record<string, unknown>) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

describe("sanitizeReturnTo (open-redirect protection)", () => {
  it("allows same-site paths", () => {
    expect(sanitizeReturnTo("/account?tab=orders")).toBe("/account?tab=orders");
    expect(sanitizeReturnTo("/cart")).toBe("/cart");
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/ok\nSet-Cookie: x=1",
    "",
    null,
    undefined,
  ])("rejects %j", (value) => {
    expect(sanitizeReturnTo(value as string | null | undefined)).toBe("/account");
  });
});

describe("validateIdToken", () => {
  const now = 1_700_000_000_000;
  const good = { iss: ISSUER, aud: "client-1", exp: now / 1000 + 600, nonce: "n1" };
  const expected = { issuer: ISSUER, audience: "client-1", nonce: "n1" };

  it("accepts a token with matching iss/aud/nonce that has not expired", () => {
    expect(validateIdToken(jwt(good), expected, now)).toBe(true);
    expect(validateIdToken(jwt({ ...good, aud: ["x", "client-1"] }), expected, now)).toBe(true);
  });
  it("rejects wrong issuer, audience, nonce, expired or malformed tokens", () => {
    expect(validateIdToken(jwt({ ...good, iss: "https://evil" }), expected, now)).toBe(false);
    expect(validateIdToken(jwt({ ...good, aud: "other" }), expected, now)).toBe(false);
    expect(validateIdToken(jwt({ ...good, nonce: "replayed" }), expected, now)).toBe(false);
    expect(validateIdToken(jwt({ ...good, exp: now / 1000 - 1 }), expected, now)).toBe(false);
    expect(validateIdToken("garbage", expected, now)).toBe(false);
    expect(validateIdToken(jwt({ ...good, nonce: undefined }), expected, now)).toBe(false);
  });
});

describe("normalizeCustomer", () => {
  it("maps Customer Account API order connections (fulfillments.nodes, statusPageUrl)", () => {
    const customer = normalizeCustomer({
      id: "gid://shopify/Customer/1",
      firstName: "A",
      lastName: "B",
      emailAddress: { emailAddress: "a@b.co" },
      defaultAddress: { id: "addr1", address1: "1 Road", territoryCode: "IN", zoneCode: "GJ" },
      addresses: {
        nodes: [
          { id: "addr1", address1: "1 Road" },
          { id: "addr2", address1: "2 Road" },
        ],
      },
      orders: {
        nodes: [
          {
            id: "o1",
            name: "#1001",
            number: 1001,
            processedAt: "2026-11-01T00:00:00Z",
            cancelledAt: null,
            financialStatus: "PAID",
            statusPageUrl: "https://shop.example/status/1",
            totalPrice: { amount: "2500.0", currencyCode: "INR" },
            lineItems: {
              nodes: [
                {
                  title: "Ring",
                  quantity: 1,
                  totalPrice: { amount: "2500.0", currencyCode: "INR" },
                  image: null,
                },
              ],
            },
            fulfillments: {
              nodes: [
                {
                  status: "SUCCESS",
                  trackingInformation: [{ number: "T1", url: "https://t/1", company: "BlueDart" }],
                },
              ],
            },
          },
          {
            id: "o2",
            name: "#1002",
            number: 1002,
            cancelledAt: "2026-11-02",
            financialStatus: "PENDING",
            totalPrice: { amount: "1", currencyCode: "INR" },
            lineItems: { nodes: [] },
            fulfillments: { nodes: [] },
          },
        ],
      },
    });
    expect(customer.email).toBe("a@b.co");
    expect(customer.addresses.map((a: { isDefault: boolean }) => a.isDefault)).toEqual([
      true,
      false,
    ]);
    const [o1, o2] = customer.orders;
    expect(o1.statusUrl).toBe("https://shop.example/status/1");
    expect(o1.fulfillmentStatus).toBe("SUCCESS");
    expect(o1.successfulFulfillments[0].trackingInfo[0]).toEqual({
      number: "T1",
      url: "https://t/1",
    });
    expect(o2.financialStatus).toBe("CANCELLED");
    expect(o2.fulfillmentStatus).toBe("UNFULFILLED");
  });
});

describe("OAuth + session endpoints", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    vi.stubEnv("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID", "client-1");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/.well-known/openid-configuration")) {
        return new Response(
          JSON.stringify({
            issuer: ISSUER,
            authorization_endpoint: "https://shopify.com/authentication/1/oauth/authorize",
            token_endpoint: "https://shopify.com/authentication/1/oauth/token",
            end_session_endpoint: "https://shopify.com/authentication/1/logout",
          }),
        );
      }
      if (url.endsWith("/.well-known/customer-account-api")) {
        return new Response(
          JSON.stringify({
            graphql_api: "https://shopify.com/1/account/customer/api/2026-10/graphql",
          }),
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("login redirects to Shopify with PKCE S256, state, nonce and sets an encrypted state cookie", async () => {
    const res = await handleAuthLogin(
      new Request("https://shop.test/api/auth/login?returnTo=https://evil.example"),
    );
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("Location")!);
    expect(loc.origin + loc.pathname).toBe("https://shopify.com/authentication/1/oauth/authorize");
    expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
    expect(loc.searchParams.get("code_challenge")).toBeTruthy();
    expect(loc.searchParams.get("state")).toBeTruthy();
    expect(loc.searchParams.get("nonce")).toBeTruthy();
    expect(loc.searchParams.get("scope")).toContain("customer-account-api:full");
    expect(loc.searchParams.get("redirect_uri")).toBe("https://shop.test/api/auth/callback");
    const cookie = res.headers.get("Set-Cookie")!;
    expect(cookie).toMatch(/^gc_auth_state=/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    // payload is encrypted, so the verifier / state must not appear in plain text
    expect(decodeURIComponent(cookie)).not.toContain(loc.searchParams.get("state")!);
  });

  it("login redirects to /login with an error code (no raw JSON) when the client id is missing", async () => {
    vi.stubEnv("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID", "");
    vi.stubEnv("VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID", "");
    const res = await handleAuthLogin(new Request("https://shop.test/api/auth/login"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/login?error=customer_accounts_not_configured");
  });

  it("callback rejects a missing, forged or mismatched state cookie", async () => {
    const noCookie = await handleAuthCallback(
      new Request("https://shop.test/api/auth/callback?code=c&state=s"),
    );
    expect(noCookie.headers.get("Location")).toContain("error=state_expired");

    const forged = await handleAuthCallback(
      new Request("https://shop.test/api/auth/callback?code=c&state=s", {
        headers: { cookie: "gc_auth_state=forged-value" },
      }),
    );
    expect(forged.headers.get("Location")).toContain("error=invalid_state_signature");

    // real state cookie from /login, but a different `state` in the callback URL
    const login = await handleAuthLogin(new Request("https://shop.test/api/auth/login"));
    const cookie = login.headers.get("Set-Cookie")!.split(";")[0]!;
    const mismatch = await handleAuthCallback(
      new Request("https://shop.test/api/auth/callback?code=c&state=attacker", {
        headers: { cookie },
      }),
    );
    expect(mismatch.headers.get("Location")).toContain("error=state_mismatch");
  });

  it("callback does not echo provider-supplied error text into the redirect", async () => {
    const res = await handleAuthCallback(
      new Request(
        "https://shop.test/api/auth/callback?error=server_error&error_description=%3Cscript%3E",
      ),
    );
    expect(res.headers.get("Location")).toBe("/login?error=login_failed");
  });

  it("logout requires POST from the same origin", async () => {
    const get = await handleAuthLogout(new Request("https://shop.test/api/auth/logout"));
    expect(get.status).toBe(405);
    const cross = await handleAuthLogout(
      new Request("https://shop.test/api/auth/logout", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      }),
    );
    expect(cross.status).toBe(403);
  });

  it("customer GraphQL proxy rejects cross-origin, GET and unauthenticated calls", async () => {
    expect(
      (await handleCustomerGraphQLProxy(new Request("https://shop.test/api/auth/graphql"))).status,
    ).toBe(405);
    const cross = await handleCustomerGraphQLProxy(
      new Request("https://shop.test/api/auth/graphql", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
        body: "{}",
      }),
    );
    expect(cross.status).toBe(403);
    const anon = await handleCustomerGraphQLProxy(
      new Request("https://shop.test/api/auth/graphql", {
        method: "POST",
        headers: { Origin: "https://shop.test" },
        body: "{}",
      }),
    );
    expect(anon.status).toBe(401);
  });

  it("status endpoint does not leak any part of the client id", async () => {
    const body = await handleAuthStatus().text();
    expect(body).not.toContain("client-1");
    expect(body).not.toContain("clien");
  });

  it("production refuses to run without a strong SESSION_SECRET", async () => {
    vi.stubEnv("SESSION_SECRET", "short");
    vi.stubEnv("NODE_ENV", "production");
    await expect(handleAuthLogin(new Request("https://shop.test/api/auth/login"))).rejects.toThrow(
      /SESSION_SECRET/,
    );
  });
});
