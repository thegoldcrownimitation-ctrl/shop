import { describe, expect, it } from "vitest";
import {
  validateAndNormalizeResetUrl,
  handleCustomerResetPassword,
} from "@/server/shopify-reset-password";

describe("Shopify Reset Password Backend Security", () => {
  describe("validateAndNormalizeResetUrl", () => {
    it("accepts valid Shopify reset URLs on myshopify domain", () => {
      const url = "https://thegoldcrownimitation.myshopify.com/account/reset/102462390644/abcdef123456";
      const result = validateAndNormalizeResetUrl(url);
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toBe(url);
    });

    it("accepts valid Shopify reset URLs on custom domain and normalizes to canonical store", () => {
      const url = "https://thegoldcrownjewellery.com/account/reset/102462390644/abcdef123456?key=val";
      const result = validateAndNormalizeResetUrl(url);
      expect(result.valid).toBe(true);
      expect(result.normalizedUrl).toContain("/account/reset/102462390644/abcdef123456?key=val");
      expect(result.normalizedUrl).toMatch(/^https:\/\//);
    });

    it("rejects non-HTTPS URLs", () => {
      const url = "http://thegoldcrownimitation.myshopify.com/account/reset/123/abc";
      const result = validateAndNormalizeResetUrl(url);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTPS");
    });

    it("rejects untrusted domains (SSRF protection)", () => {
      const url = "https://malicious-site.com/account/reset/123/abc";
      const result = validateAndNormalizeResetUrl(url);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid reset URL domain");
    });

    it("rejects invalid pathnames", () => {
      const url = "https://thegoldcrownimitation.myshopify.com/admin/auth/login";
      const result = validateAndNormalizeResetUrl(url);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid password reset path");
    });

    it("rejects empty or malformed strings", () => {
      expect(validateAndNormalizeResetUrl("").valid).toBe(false);
      expect(validateAndNormalizeResetUrl("not-a-url").valid).toBe(false);
    });
  });

  describe("handleCustomerResetPassword request validation", () => {
    it("rejects non-POST HTTP methods", async () => {
      const req = new Request("https://thegoldcrownjewellery.com/api/customer/reset-password", {
        method: "GET",
      });
      const res = await handleCustomerResetPassword(req);
      expect(res.status).toBe(405);
    });

    it("rejects empty password", async () => {
      const req = new Request("https://thegoldcrownjewellery.com/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetUrl: "https://thegoldcrownimitation.myshopify.com/account/reset/123/abc",
          password: "",
        }),
      });
      const res = await handleCustomerResetPassword(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Password is required");
    });

    it("rejects password shorter than 5 characters", async () => {
      const req = new Request("https://thegoldcrownjewellery.com/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetUrl: "https://thegoldcrownimitation.myshopify.com/account/reset/123/abc",
          password: "1234",
        }),
      });
      const res = await handleCustomerResetPassword(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("at least 5 characters");
    });

    it("rejects missing resetUrl", async () => {
      const req = new Request("https://thegoldcrownjewellery.com/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: "ValidPassword123!",
        }),
      });
      const res = await handleCustomerResetPassword(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("missing or invalid");
    });
  });
});
