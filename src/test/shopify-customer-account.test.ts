import { describe, it, expect, vi } from "vitest";
import {
  getDiscoveryConfig,
  createSetCookieHeader,
  handleAuthStatus,
  handleAuthLogin,
  handleAuthLogout,
} from "../server/shopify-auth";

describe("Shopify Customer Account API & Auth Tests", () => {
  it("resolves dynamic OpenID and Customer Account discovery endpoints", async () => {
    const config = await getDiscoveryConfig();
    expect(config.openid).toBeDefined();
    expect(config.openid.authorization_endpoint).toContain("oauth/authorize");
    expect(config.openid.token_endpoint).toContain("oauth/token");
    expect(config.openid.end_session_endpoint).toContain("logout");
    expect(config.customerAccount).toBeDefined();
    expect(config.customerAccount.graphql_api).toContain("graphql");
  });

  it("creates secure HttpOnly SameSite cookie headers", () => {
    const header = createSetCookieHeader("test_session", "secret_value", {
      maxAge: 3600,
      httpOnly: true,
      sameSite: "Lax",
    });
    expect(header).toContain("test_session=secret_value");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=3600");
  });

  it("returns auth status without throwing", () => {
    const res = handleAuthStatus();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("handles logout and clears session cookie", async () => {
    const req = new Request("https://thegoldcrownjewellery.com/api/auth/logout", {
      headers: { Accept: "application/json" },
    });
    const res = await handleAuthLogout(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("gc_customer_session=");
    expect(setCookie).toContain("Max-Age=0");
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.logoutUrl).toContain("logout");
  });
});
