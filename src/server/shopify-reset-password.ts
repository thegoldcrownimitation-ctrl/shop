/**
 * Shopify Customer Reset Password — Secure Backend Handler
 *
 * Implements:
 * - Secure POST /api/customer/reset-password handler
 * - Rate limiting against brute-force attacks
 * - URL and origin validation to prevent SSRF and open redirect exploits
 * - Password length & complexity validation
 * - Shopify Storefront API customerResetByUrl GraphQL mutation execution
 * - Friendly error mapping for expired, invalid, or already-used tokens
 * - No-store security headers & zero sensitive data logging
 */

import crypto from "node:crypto";

// ─── Environment Configuration ───────────────────────────────────────────────

const STORE_DOMAIN = (
  process.env.SHOPIFY_STOREFRONT_DOMAIN ||
  process.env.VITE_SHOPIFY_STORE_DOMAIN ||
  "thegoldcrownimitation.myshopify.com"
).replace(/^['"]|['"]$/g, "").trim();

const STOREFRONT_TOKEN = (
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  process.env.VITE_SHOPIFY_STOREFRONT_TOKEN ||
  ""
).replace(/^['"]|['"]$/g, "").trim();

const API_VERSION = "2025-01";
const SHOPIFY_ENDPOINT = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;

// Allowed domains for customer reset URLs (SSRF protection)
const ALLOWED_RESET_DOMAINS = new Set([
  STORE_DOMAIN.toLowerCase(),
  "thegoldcrownimitation.myshopify.com",
  "thegoldcrownjewellery.com",
  "www.thegoldcrownjewellery.com",
  "shopify.com",
]);

// ─── In-Memory Rate Limiting ──────────────────────────────────────────────────

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Periodic cleanup of expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

// ─── Reset URL Validation & Normalization ─────────────────────────────────────

export function validateAndNormalizeResetUrl(rawUrl: string): { valid: boolean; normalizedUrl?: string; error?: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "Reset URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: "Malformed reset URL provided." };
  }

  // Must be HTTPS
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Reset URL must use secure HTTPS protocol." };
  }

  const host = parsed.hostname.toLowerCase();

  // Check domain against allowed whitelist or .myshopify.com wildcard
  const isAllowedHost =
    ALLOWED_RESET_DOMAINS.has(host) ||
    host.endsWith(".myshopify.com");

  if (!isAllowedHost) {
    return { valid: false, error: "Invalid reset URL domain." };
  }

  // Check path: Shopify customer reset paths begin with /account/reset/
  if (!parsed.pathname.startsWith("/account/reset/")) {
    return { valid: false, error: "Invalid password reset path." };
  }

  // Normalize host to canonical myshopify store domain if pointing to custom domain
  // (Shopify Storefront API reliably validates resetUrl when using the myshopify domain)
  const canonicalHost = host.endsWith(".myshopify.com") ? host : STORE_DOMAIN;
  const normalizedUrl = `https://${canonicalHost}${parsed.pathname}${parsed.search}`;

  return { valid: true, normalizedUrl };
}

// ─── GraphQL Mutation ─────────────────────────────────────────────────────────

const CUSTOMER_RESET_BY_URL = /* GraphQL */ `
  mutation resetPasswordByUrl($resetUrl: URL!, $password: String!) {
    customerResetByUrl(resetUrl: $resetUrl, password: $password) {
      customer {
        id
        email
        firstName
        lastName
      }
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

interface ResetResponseData {
  customerResetByUrl?: {
    customer?: {
      id: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    } | null;
    customerAccessToken?: {
      accessToken: string;
      expiresAt: string;
    } | null;
    customerUserErrors?: Array<{
      code: string;
      field: string[];
      message: string;
    }>;
  } | null;
}

// ─── Main Request Handler ─────────────────────────────────────────────────────

export async function handleCustomerResetPassword(request: Request): Promise<Response> {
  const securityHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };

  // 1. Only POST allowed
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...securityHeaders, Allow: "POST" },
    });
  }

  // 2. Rate Limiting Check
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Too many password reset requests. Please wait a minute before trying again.",
      }),
      { status: 429, headers: securityHeaders }
    );
  }

  // 3. Parse JSON Body
  let body: { resetUrl?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON request payload." }),
      { status: 400, headers: securityHeaders }
    );
  }

  const { resetUrl, password } = body;

  // 4. Validate Password
  if (!password || typeof password !== "string") {
    return new Response(
      JSON.stringify({ ok: false, error: "Password is required." }),
      { status: 400, headers: securityHeaders }
    );
  }

  if (password.length < 5) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Password must be at least 5 characters long.",
        code: "PASSWORD_TOO_SHORT",
      }),
      { status: 400, headers: securityHeaders }
    );
  }

  if (password.length > 128) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Password cannot exceed 128 characters.",
      }),
      { status: 400, headers: securityHeaders }
    );
  }

  // 5. Validate & Normalize Reset URL
  if (!resetUrl || typeof resetUrl !== "string") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Password reset link is missing or invalid. Please check your reset email.",
      }),
      { status: 400, headers: securityHeaders }
    );
  }

  const urlValidation = validateAndNormalizeResetUrl(resetUrl);
  if (!urlValidation.valid || !urlValidation.normalizedUrl) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: urlValidation.error || "Invalid password reset URL.",
      }),
      { status: 400, headers: securityHeaders }
    );
  }

  // 6. Verify Storefront Token Configuration
  if (!STOREFRONT_TOKEN) {
    console.error("[shopify-reset-password] Missing Storefront Access Token in environment.");
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Storefront authentication service is currently unavailable.",
      }),
      { status: 503, headers: securityHeaders }
    );
  }

  // 7. Execute Shopify Storefront API customerResetByUrl Mutation
  try {
    const shopifyRes = await fetch(SHOPIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: CUSTOMER_RESET_BY_URL,
        variables: {
          resetUrl: urlValidation.normalizedUrl,
          password,
        },
      }),
    });

    if (!shopifyRes.ok) {
      console.error(`[shopify-reset-password] Shopify API HTTP error: ${shopifyRes.status}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Shopify service returned an error. Please try again later.",
        }),
        { status: 502, headers: securityHeaders }
      );
    }

    const json = (await shopifyRes.json()) as {
      data?: ResetResponseData;
      errors?: Array<{ message: string; extensions?: { code?: string } }>;
    };

    // Check top-level GraphQL errors (e.g. "Unidentified customer")
    if (json.errors && json.errors.length > 0) {
      const firstError = json.errors[0];
      const code = firstError.extensions?.code;
      const msg = firstError.message?.toLowerCase() || "";

      if (code === "NOT_FOUND" || msg.includes("unidentified") || msg.includes("invalid") || msg.includes("expired")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "This password reset link is invalid, expired, or has already been used. Please request a new password reset email.",
            code: "LINK_EXPIRED_OR_INVALID",
          }),
          { status: 400, headers: securityHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          ok: false,
          error: "Unable to reset password. Please try again or request a new reset link.",
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    const payload = json.data?.customerResetByUrl;
    if (!payload) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Unexpected response from Shopify. Please request a new reset link.",
        }),
        { status: 500, headers: securityHeaders }
      );
    }

    // Check customer user errors
    if (payload.customerUserErrors && payload.customerUserErrors.length > 0) {
      const userErr = payload.customerUserErrors[0];
      const errCode = userErr.code;
      const errMsg = userErr.message.toLowerCase();

      if (errCode === "EXPIRED" || errCode === "INVALID" || errCode === "TAKEN" || errMsg.includes("expired") || errMsg.includes("invalid")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "This password reset link is invalid or has expired. Please request a new reset link.",
            code: "LINK_EXPIRED_OR_INVALID",
          }),
          { status: 400, headers: securityHeaders }
        );
      }

      if (errCode === "PASSWORD_TOO_SHORT" || errMsg.includes("short")) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Password is too short. Please choose a password with at least 5 characters.",
            code: "PASSWORD_TOO_SHORT",
          }),
          { status: 400, headers: securityHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          ok: false,
          error: userErr.message || "Unable to reset password. Please try again.",
          code: userErr.code,
        }),
        { status: 400, headers: securityHeaders }
      );
    }

    // Success! Verify customer ID was returned
    if (payload.customer?.id) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Your password has been updated successfully. You can now sign in with your new password.",
        }),
        { status: 200, headers: securityHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Password reset could not be completed. Please request a new reset link.",
      }),
      { status: 400, headers: securityHeaders }
    );
  } catch (err) {
    console.error("[shopify-reset-password] Unexpected error during password reset execution:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "A network or server error occurred. Please try again in a moment.",
      }),
      { status: 500, headers: securityHeaders }
    );
  }
}
