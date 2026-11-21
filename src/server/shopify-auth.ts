/**
 * Shopify Customer Account API — Backend-for-Frontend (BFF) Auth & Session Engine
 *
 * Implements (https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api):
 * - Dynamic OpenID Connect & Customer Account API discovery (/.well-known/*)
 * - OAuth 2.0 Authorization Code Flow with PKCE (S256), state + nonce
 * - id_token claim validation (issuer, audience, expiry, nonce)
 * - Encrypted (AES-256-GCM), HttpOnly, Secure, SameSite=Lax session cookies
 * - Automatic refresh-token rotation (serialised so concurrent requests can't race)
 * - Customer Account GraphQL proxying without exposing tokens to browser JavaScript
 *
 * Required env: SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID, SESSION_SECRET (32+ chars).
 * Optional env: SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET (confidential client only),
 *   SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI, SHOPIFY_CUSTOMER_ACCOUNT_LOGOUT_REDIRECT_URI.
 */

import crypto from "node:crypto";

// ─── Environment ───────────────────────────────────────────────────────────────

function env(name: string): string {
  return (process.env[name] ?? "").replace(/^['"]|['"]$/g, "").trim();
}

const storeDomain = () =>
  env("SHOPIFY_STOREFRONT_DOMAIN") ||
  env("VITE_SHOPIFY_STORE_DOMAIN") ||
  "thegoldcrownimitation.myshopify.com";

const clientId = () =>
  env("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID") || env("VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID");

const clientSecret = () => env("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET");

const UPSTREAM_TIMEOUT_MS = 10_000;
const SESSION_COOKIE = "gc_customer_session";
const STATE_COOKIE = "gc_auth_state";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const MAX_GRAPHQL_BODY_BYTES = 64 * 1024;

// Dev-only ephemeral secret so local development works without configuration.
let ephemeralDevSecret: string | undefined;

/**
 * The session secret must be a private, high-entropy value. Deriving it from the public
 * store domain (as an earlier version did) would let anyone forge cookies, so production
 * fails closed when it is missing or weak.
 */
function sessionSecret(): string {
  const configured = env("SESSION_SECRET");
  const looksLikePlaceholder = /change|replace|your[_-]|example|placeholder|secret[_-]?here/i.test(
    configured,
  );
  if (
    configured.length >= 32 &&
    !(looksLikePlaceholder && process.env["NODE_ENV"] === "production")
  ) {
    return configured;
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[shopify-auth] SESSION_SECRET is not set (or shorter than 32 chars); using a temporary dev secret. Sessions reset on restart.",
    );
  }
  return ephemeralDevSecret;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function redirect(location: string, extraHeaders?: Headers): Response {
  const headers = extraHeaders ?? new Headers();
  headers.set("Location", location);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 302, headers });
}

// ─── Discovery ─────────────────────────────────────────────────────────────────

interface OpenIdConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
  issuer: string;
}

interface DiscoveryCache {
  openid?: OpenIdConfig;
  customerAccount?: { graphql_api: string };
  timestamp?: number;
}

const discoveryCache: DiscoveryCache = {};
const DISCOVERY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getDiscoveryConfig() {
  const now = Date.now();
  if (
    discoveryCache.openid &&
    discoveryCache.customerAccount &&
    discoveryCache.timestamp &&
    now - discoveryCache.timestamp < DISCOVERY_CACHE_TTL_MS
  ) {
    return { openid: discoveryCache.openid, customerAccount: discoveryCache.customerAccount };
  }

  const domain = storeDomain();
  const opts = { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) };
  const [openidRes, caRes] = await Promise.all([
    fetch(`https://${domain}/.well-known/openid-configuration`, opts),
    fetch(`https://${domain}/.well-known/customer-account-api`, opts),
  ]);

  if (!openidRes.ok) {
    throw new Error(`Failed to fetch OpenID configuration: ${openidRes.status}`);
  }
  if (!caRes.ok) {
    throw new Error(`Failed to fetch Customer Account API configuration: ${caRes.status}`);
  }

  const openid = (await openidRes.json()) as OpenIdConfig;
  const customerAccount = (await caRes.json()) as { graphql_api: string };

  discoveryCache.openid = openid;
  discoveryCache.customerAccount = customerAccount;
  discoveryCache.timestamp = now;

  return { openid, customerAccount };
}

// ─── PKCE & Crypto Helpers ─────────────────────────────────────────────────────

function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateRandomString(bytes = 32): string {
  return base64Url(crypto.randomBytes(bytes));
}

function generateCodeChallenge(verifier: string): string {
  return base64Url(crypto.createHash("sha256").update(verifier).digest());
}

// ─── Cookie sealing (AES-256-GCM) & parsing ────────────────────────────────────

function sealingKey(): Buffer {
  return crypto.createHash("sha256").update(`gc-session-v2:${sessionSecret()}`).digest();
}

/** Encrypts + authenticates `data`; `purpose` is bound as AAD so cookies can't be swapped. */
function seal(data: string, purpose: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sealingKey(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  return base64Url(Buffer.concat([iv, cipher.getAuthTag(), encrypted]));
}

function unseal(sealed: string, purpose: string): string | null {
  try {
    const raw = Buffer.from(sealed.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", sealingKey(), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [name, ...val] = part.trim().split("=");
    if (name && val.length) {
      try {
        cookies[name] = decodeURIComponent(val.join("="));
      } catch {
        // ignore malformed cookie values
      }
    }
  }
  return cookies;
}

export function createSetCookieHeader(
  name: string,
  value: string,
  options: { maxAge?: number; httpOnly?: boolean; sameSite?: "Lax" | "Strict" | "None" } = {},
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push("Path=/");
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push("Secure");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  return parts.join("; ");
}

const clearCookie = (name: string) => createSetCookieHeader(name, "", { maxAge: 0 });

// ─── Session State Types ───────────────────────────────────────────────────────

interface AuthStatePayload {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  createdAt: number;
}

interface CustomerSessionPayload {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

// ─── Request helpers ───────────────────────────────────────────────────────────

function getOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

/**
 * Only same-site relative paths are allowed as post-login destinations; anything else
 * (absolute URLs, protocol-relative `//host`, backslash tricks) falls back to /account.
 */
export function sanitizeReturnTo(value: string | null | undefined, fallback = "/account"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if ([...value].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f))
    return fallback;
  return value;
}

/** Browsers always send Origin on cross-origin POSTs; reject when it doesn't match our origin. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    const site = request.headers.get("sec-fetch-site");
    return !site || site === "same-origin" || site === "none";
  }
  try {
    return new URL(origin).host === new URL(getOrigin(request)).host;
  } catch {
    return false;
  }
}

function redirectUriFor(request: Request): string {
  return env("SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI") || `${getOrigin(request)}/api/auth/callback`;
}

async function postToken(params: URLSearchParams): Promise<Response> {
  const { openid } = await getDiscoveryConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  const secret = clientSecret();
  if (secret) {
    // Confidential clients authenticate with client_id/client_secret in the Authorization header.
    headers["Authorization"] = `Basic ${Buffer.from(`${clientId()}:${secret}`).toString("base64")}`;
  }
  return fetch(openid.token_endpoint, {
    method: "POST",
    headers,
    body: params.toString(),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
}

/**
 * Validates the id_token claims we rely on (OIDC Core §3.1.3.7). The token is received directly
 * from the token endpoint over TLS, so signature verification is not required by the spec.
 */
export function validateIdToken(
  idToken: string,
  expected: { issuer: string; audience: string; nonce: string },
  nowMs = Date.now(),
): boolean {
  try {
    const payloadPart = idToken.split(".")[1];
    if (!payloadPart) return false;
    const claims = JSON.parse(
      Buffer.from(payloadPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { iss?: string; aud?: string | string[]; exp?: number; nonce?: string };
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    return (
      claims.iss === expected.issuer &&
      audiences.includes(expected.audience) &&
      typeof claims.exp === "number" &&
      claims.exp * 1000 > nowMs &&
      claims.nonce === expected.nonce
    );
  } catch {
    return false;
  }
}

// ─── Route Handlers ────────────────────────────────────────────────────────────

export async function handleAuthLogin(request: Request, _isRegister = false): Promise<Response> {
  const returnTo = sanitizeReturnTo(new URL(request.url).searchParams.get("returnTo"));

  if (!clientId()) {
    console.error("[shopify-auth] SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID is not configured.");
    return redirect(`/login?error=${encodeURIComponent("customer_accounts_not_configured")}`);
  }

  let openid: OpenIdConfig;
  try {
    ({ openid } = await getDiscoveryConfig());
  } catch (err) {
    console.error("[shopify-auth] Discovery failed:", err);
    return redirect(`/login?error=${encodeURIComponent("shopify_unreachable")}`);
  }

  const state = generateRandomString(24);
  const nonce = generateRandomString(24);
  const codeVerifier = generateRandomString(32);

  const authState: AuthStatePayload = {
    state,
    nonce,
    codeVerifier,
    returnTo,
    createdAt: Date.now(),
  };

  const authUrl = new URL(openid.authorization_endpoint);
  authUrl.searchParams.set("client_id", clientId());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUriFor(request));
  authUrl.searchParams.set("scope", "openid email customer-account-api:full");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", generateCodeChallenge(codeVerifier));
  authUrl.searchParams.set("code_challenge_method", "S256");

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    createSetCookieHeader(STATE_COOKIE, seal(JSON.stringify(authState), "state"), {
      maxAge: 600, // 10 minutes
      httpOnly: true,
      sameSite: "Lax",
    }),
  );
  return redirect(authUrl.toString(), headers);
}

function loginError(code: string): Response {
  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE));
  return redirect(`/login?error=${encodeURIComponent(code)}`, headers);
}

export async function handleAuthCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error(
      "[shopify-auth] Auth callback error from Shopify:",
      error,
      url.searchParams.get("error_description"),
    );
    // Show a stable code, not provider-controlled free text.
    return loginError(error === "access_denied" ? "access_denied" : "login_failed");
  }
  if (!code || !state) return loginError("missing_code_or_state");

  const cookies = parseCookies(request.headers.get("cookie"));
  const rawAuthState = cookies[STATE_COOKIE];
  if (!rawAuthState) return loginError("state_expired");

  const stateJson = unseal(rawAuthState, "state");
  if (!stateJson) return loginError("invalid_state_signature");

  let authState: AuthStatePayload;
  try {
    authState = JSON.parse(stateJson) as AuthStatePayload;
  } catch {
    return loginError("invalid_state_signature");
  }
  if (Date.now() - authState.createdAt > 10 * 60 * 1000) return loginError("state_expired");

  const a = Buffer.from(authState.state);
  const b = Buffer.from(state);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return loginError("state_mismatch");

  let tokenData: TokenResponse;
  let issuer: string;
  try {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId(),
      redirect_uri: redirectUriFor(request),
      code,
      code_verifier: authState.codeVerifier,
    });
    const tokenRes = await postToken(params);
    if (!tokenRes.ok) {
      console.error("[shopify-auth] Token exchange failed:", tokenRes.status);
      return loginError("token_exchange_failed");
    }
    tokenData = (await tokenRes.json()) as TokenResponse;
    ({
      openid: { issuer },
    } = await getDiscoveryConfig());
  } catch (err) {
    console.error("[shopify-auth] Token exchange error:", err);
    return loginError("token_exchange_failed");
  }

  if (!tokenData.access_token) return loginError("token_exchange_failed");

  if (
    !tokenData.id_token ||
    !validateIdToken(tokenData.id_token, {
      issuer,
      audience: clientId(),
      nonce: authState.nonce,
    })
  ) {
    console.error("[shopify-auth] id_token validation failed (issuer/audience/expiry/nonce).");
    return loginError("invalid_id_token");
  }

  const sessionPayload: CustomerSessionPayload = {
    accessToken: tokenData.access_token,
    ...(tokenData.refresh_token ? { refreshToken: tokenData.refresh_token } : {}),
    idToken: tokenData.id_token,
    expiresAt: Date.now() + (tokenData.expires_in || 7200) * 1000,
  };

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    createSetCookieHeader(SESSION_COOKIE, seal(JSON.stringify(sessionPayload), "session"), {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      sameSite: "Lax",
    }),
  );
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE));
  return redirect(sanitizeReturnTo(authState.returnTo), headers);
}

// ─── Token access / refresh ────────────────────────────────────────────────────

interface AccessTokenResult {
  accessToken: string | null;
  /** Set-Cookie value to send back (refreshed session, or a clearing cookie when the session is dead). */
  setCookie?: string;
}

// Refresh tokens rotate; serialise concurrent refreshes of the same session so a second
// in-flight request doesn't present an already-used token and log the customer out.
const inflightRefresh = new Map<string, Promise<AccessTokenResult>>();

async function refreshSession(session: CustomerSessionPayload): Promise<AccessTokenResult> {
  const refreshToken = session.refreshToken;
  if (!refreshToken) return { accessToken: null, setCookie: clearCookie(SESSION_COOKIE) };

  const existing = inflightRefresh.get(refreshToken);
  if (existing) return existing;

  const work = (async (): Promise<AccessTokenResult> => {
    try {
      const res = await postToken(
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId(),
          refresh_token: refreshToken,
        }),
      );
      if (!res.ok) {
        console.warn("[shopify-auth] Token refresh failed:", res.status);
        // 400/401 = refresh token revoked/expired → drop the session. 5xx = transient → keep it.
        return res.status >= 500
          ? { accessToken: null }
          : { accessToken: null, setCookie: clearCookie(SESSION_COOKIE) };
      }
      const data = (await res.json()) as TokenResponse;
      if (!data.access_token) return { accessToken: null, setCookie: clearCookie(SESSION_COOKIE) };

      const updated: CustomerSessionPayload = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? refreshToken,
        ...(data.id_token || session.idToken ? { idToken: data.id_token ?? session.idToken! } : {}),
        expiresAt: Date.now() + (data.expires_in || 7200) * 1000,
      };
      return {
        accessToken: updated.accessToken,
        setCookie: createSetCookieHeader(SESSION_COOKIE, seal(JSON.stringify(updated), "session"), {
          maxAge: SESSION_MAX_AGE,
          httpOnly: true,
          sameSite: "Lax",
        }),
      };
    } catch (err) {
      console.error("[shopify-auth] Error refreshing token:", err);
      return { accessToken: null };
    } finally {
      // Keep the result around briefly so near-simultaneous callers reuse it.
      setTimeout(() => inflightRefresh.delete(refreshToken), 5_000);
    }
  })();

  inflightRefresh.set(refreshToken, work);
  return work;
}

function readSession(request: Request): CustomerSessionPayload | null {
  const raw = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (!raw) return null;
  const jsonStr = unseal(raw, "session");
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as CustomerSessionPayload;
  } catch {
    return null;
  }
}

async function getOrRefreshAccessToken(request: Request): Promise<AccessTokenResult> {
  const session = readSession(request);
  if (!session) {
    return parseCookies(request.headers.get("cookie"))[SESSION_COOKIE]
      ? { accessToken: null, setCookie: clearCookie(SESSION_COOKIE) } // undecryptable/stale cookie
      : { accessToken: null };
  }
  if (session.expiresAt > Date.now() + 60 * 1000) return { accessToken: session.accessToken };
  return refreshSession(session);
}

// ─── Customer profile ──────────────────────────────────────────────────────────

const ADDRESS_FIELDS = `
  id
  formatted
  firstName
  lastName
  company
  address1
  address2
  city
  zoneCode
  territoryCode
  zip
  phoneNumber
`;

const CUSTOMER_PROFILE_QUERY = /* GraphQL */ `
  query CustomerSessionProfile {
    customer {
      id
      firstName
      lastName
      displayName
      emailAddress {
        emailAddress
      }
      phoneNumber {
        phoneNumber
      }
      defaultAddress {
        ${ADDRESS_FIELDS}
      }
      addresses(first: 10) {
        nodes {
          ${ADDRESS_FIELDS}
        }
      }
      orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          number
          processedAt
          cancelledAt
          financialStatus
          statusPageUrl
          totalPrice {
            amount
            currencyCode
          }
          lineItems(first: 20) {
            nodes {
              title
              quantity
              totalPrice {
                amount
                currencyCode
              }
              image {
                url
                altText
              }
            }
          }
          fulfillments(first: 5) {
            nodes {
              status
              trackingInformation {
                number
                url
                company
              }
            }
          }
        }
      }
    }
  }
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeCustomer(rawCustomer: any) {
  const toAddress = (addr: any, isDefault: boolean) => ({
    id: addr.id,
    firstName: addr.firstName,
    lastName: addr.lastName,
    company: addr.company,
    address1: addr.address1,
    address2: addr.address2,
    city: addr.city,
    province: addr.zoneCode,
    country: addr.territoryCode || "IN",
    zip: addr.zip,
    phone: addr.phoneNumber,
    isDefault,
  });

  return {
    id: rawCustomer.id,
    firstName: rawCustomer.firstName || null,
    lastName: rawCustomer.lastName || null,
    displayName:
      rawCustomer.displayName ||
      [rawCustomer.firstName, rawCustomer.lastName].filter(Boolean).join(" ") ||
      rawCustomer.emailAddress?.emailAddress ||
      "Customer",
    email: rawCustomer.emailAddress?.emailAddress || "",
    phone: rawCustomer.phoneNumber?.phoneNumber || null,
    acceptsMarketing: false,
    defaultAddress: rawCustomer.defaultAddress ? toAddress(rawCustomer.defaultAddress, true) : null,
    addresses: (rawCustomer.addresses?.nodes || []).map((addr: any) =>
      toAddress(addr, addr.id === rawCustomer.defaultAddress?.id),
    ),
    orders: (rawCustomer.orders?.nodes || []).map((order: any) => {
      const fulfillments: any[] = order.fulfillments?.nodes || [];
      return {
        id: order.id,
        name: order.name,
        orderNumber: order.number || parseInt(String(order.name).replace(/\D/g, ""), 10) || 0,
        processedAt: order.processedAt,
        financialStatus: order.cancelledAt ? "CANCELLED" : order.financialStatus,
        fulfillmentStatus: fulfillments[0]?.status || "UNFULFILLED",
        statusUrl: order.statusPageUrl ?? null,
        totalPrice: order.totalPrice,
        lineItems: (order.lineItems?.nodes || []).map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
          originalTotalPrice: item.totalPrice,
          variant: { image: item.image },
        })),
        successfulFulfillments: fulfillments.map((f) => ({
          trackingCompany: f.trackingInformation?.[0]?.company,
          trackingInfo: (f.trackingInformation || []).map((t: any) => ({
            number: t.number,
            url: t.url,
          })),
        })),
      };
    }),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function handleAuthSession(request: Request): Promise<Response> {
  const { accessToken, setCookie } = await getOrRefreshAccessToken(request);

  const headers = new Headers();
  if (setCookie) headers.append("Set-Cookie", setCookie);

  const base = { configured: !!clientId(), storeDomain: storeDomain() };
  const unauthenticated = () =>
    json({ authenticated: false, customer: null, ...base }, { status: 200, headers });

  if (!accessToken) return unauthenticated();

  try {
    const { customerAccount } = await getDiscoveryConfig();
    const profileRes = await fetch(customerAccount.graphql_api, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: accessToken },
      body: JSON.stringify({ query: CUSTOMER_PROFILE_QUERY }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (profileRes.status === 401 || profileRes.status === 403) {
      headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
      return unauthenticated();
    }
    if (!profileRes.ok) {
      // Transient upstream failure: report it instead of pretending the customer signed out.
      console.error("[shopify-auth] Customer profile request failed:", profileRes.status);
      return json(
        { authenticated: true, customer: null, error: "profile_unavailable", ...base },
        { status: 503, headers },
      );
    }

    const body = (await profileRes.json()) as {
      data?: { customer?: unknown };
      errors?: { message: string }[];
    };
    if (body.errors?.length) {
      console.error(
        "[shopify-auth] Customer Account API errors:",
        body.errors.map((e) => e.message).join("; "),
      );
    }
    if (!body.data?.customer) {
      return json(
        { authenticated: true, customer: null, error: "profile_unavailable", ...base },
        { status: 502, headers },
      );
    }

    return json(
      { authenticated: true, customer: normalizeCustomer(body.data.customer), ...base },
      { status: 200, headers },
    );
  } catch (err) {
    console.error("[shopify-auth] Failed to retrieve customer profile:", err);
    return json(
      { authenticated: true, customer: null, error: "profile_unavailable", ...base },
      { status: 503, headers },
    );
  }
}

export async function handleAuthLogout(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
  }
  if (!isSameOrigin(request)) {
    return json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  const idToken = readSession(request)?.idToken;
  const { openid } = await getDiscoveryConfig();

  const postLogoutRedirectUri =
    env("SHOPIFY_CUSTOMER_ACCOUNT_LOGOUT_REDIRECT_URI") || `${getOrigin(request)}/`;
  const logoutUrl = new URL(openid.end_session_endpoint);
  if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
  logoutUrl.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);

  const headers = new Headers();
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE));

  if (request.headers.get("accept")?.includes("application/json")) {
    return json({ success: true, logoutUrl: logoutUrl.toString() }, { status: 200, headers });
  }
  return redirect(logoutUrl.toString(), headers);
}

export async function handleCustomerGraphQLProxy(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json({ errors: [{ message: "Method not allowed" }] }, { status: 405 });
  }
  if (!isSameOrigin(request)) {
    return json({ errors: [{ message: "Cross-origin request rejected" }] }, { status: 403 });
  }

  const { accessToken, setCookie } = await getOrRefreshAccessToken(request);
  const headers = new Headers();
  if (setCookie) headers.append("Set-Cookie", setCookie);

  if (!accessToken) {
    return json(
      { errors: [{ message: "Unauthorized. Please log in." }] },
      { status: 401, headers },
    );
  }

  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_GRAPHQL_BODY_BYTES) {
    return json({ errors: [{ message: "Request too large" }] }, { status: 413, headers });
  }

  let payload: { query?: unknown; variables?: unknown; operationName?: unknown };
  try {
    payload = JSON.parse(text);
  } catch {
    return json({ errors: [{ message: "Invalid JSON body" }] }, { status: 400, headers });
  }
  if (typeof payload.query !== "string" || !payload.query.trim()) {
    return json({ errors: [{ message: "Missing GraphQL query" }] }, { status: 400, headers });
  }

  try {
    const { customerAccount } = await getDiscoveryConfig();
    const upstream = await fetch(customerAccount.graphql_api, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: accessToken },
      // Forward only the GraphQL fields, nothing else from the browser.
      body: JSON.stringify({
        query: payload.query,
        variables: payload.variables,
        operationName: payload.operationName,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store");
    return new Response(await upstream.text(), { status: upstream.status, headers });
  } catch (err) {
    console.error("[shopify-auth] Customer GraphQL proxy error:", err);
    return json({ errors: [{ message: "Shopify is unreachable" }] }, { status: 502, headers });
  }
}

export function handleAuthStatus(): Response {
  return json(
    { configured: !!clientId(), storeDomain: storeDomain() },
    { status: 200, headers: { "Cache-Control": "no-cache" } },
  );
}
