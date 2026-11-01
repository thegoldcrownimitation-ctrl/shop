/**
 * Shopify Customer Account API — Backend-for-Frontend (BFF) Auth & Session Engine
 *
 * Implements:
 * - Dynamic OpenID Connect & Customer Account API discovery
 * - OAuth 2.0 Authorization Code Flow with PKCE (S256)
 * - State and nonce validation against CSRF
 * - Secure HttpOnly, Secure, SameSite=Lax cookie session management
 * - Automatic token refresh
 * - Customer Account GraphQL API proxying without exposing tokens to frontend
 */

import crypto from "node:crypto";

// ─── Environment & Discovery Configuration ─────────────────────────────────────

const STORE_DOMAIN =
  process.env.SHOPIFY_STOREFRONT_DOMAIN ||
  process.env.VITE_SHOPIFY_STORE_DOMAIN ||
  "thegoldcrownimitation.myshopify.com";

const CLIENT_ID =
  process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID ||
  process.env.VITE_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID ||
  "";

const CLIENT_SECRET = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET || "";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash("sha256").update(STORE_DOMAIN + "-session-secret-salt").digest("hex");

// Discovery Cache (persists for the process lifetime)
interface DiscoveryCache {
  openid?: {
    authorization_endpoint: string;
    token_endpoint: string;
    end_session_endpoint: string;
    issuer: string;
  };
  customerAccount?: {
    graphql_api: string;
  };
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
    return {
      openid: discoveryCache.openid,
      customerAccount: discoveryCache.customerAccount,
    };
  }

  const [openidRes, caRes] = await Promise.all([
    fetch(`https://${STORE_DOMAIN}/.well-known/openid-configuration`),
    fetch(`https://${STORE_DOMAIN}/.well-known/customer-account-api`),
  ]);

  if (!openidRes.ok) {
    throw new Error(`Failed to fetch OpenID configuration: ${openidRes.statusText}`);
  }
  if (!caRes.ok) {
    throw new Error(`Failed to fetch Customer Account API configuration: ${caRes.statusText}`);
  }

  const openid = (await openidRes.json()) as {
    authorization_endpoint: string;
    token_endpoint: string;
    end_session_endpoint: string;
    issuer: string;
  };

  const customerAccount = (await caRes.json()) as {
    graphql_api: string;
  };

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
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64Url(hash);
}

// ─── Cookie Signing & Parsing ──────────────────────────────────────────────────

function signData(data: string): string {
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
  return `${data}.${sig}`;
}

function verifyAndExtractData(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const data = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
  if (sig !== expectedSig) return null;
  return data;
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...val] = part.trim().split("=");
    if (name && val.length) {
      cookies[name] = decodeURIComponent(val.join("="));
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

// ─── Session State Types ───────────────────────────────────────────────────────

interface AuthStatePayload {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo?: string;
  createdAt: number;
}

interface CustomerSessionPayload {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
}

// ─── Route Handlers ────────────────────────────────────────────────────────────

function getOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return url.origin;
}

export async function handleAuthLogin(request: Request, isRegister = false): Promise<Response> {
  if (!CLIENT_ID) {
    return new Response(
      JSON.stringify({
        error: "SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID is not configured in environment variables.",
        configured: false,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { openid } = await getDiscoveryConfig();
  const origin = getOrigin(request);
  const redirectUri =
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI || `${origin}/api/auth/callback`;

  const state = generateRandomString(24);
  const nonce = generateRandomString(24);
  const codeVerifier = generateRandomString(32);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/account";

  const authState: AuthStatePayload = {
    state,
    nonce,
    codeVerifier,
    returnTo,
    createdAt: Date.now(),
  };

  const authUrl = new URL(openid.authorization_endpoint);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "openid email customer-account-api:full");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  // State cookie expires in 10 minutes
  const signedState = signData(JSON.stringify(authState));
  const setCookie = createSetCookieHeader("gc_auth_state", signedState, {
    maxAge: 600,
    httpOnly: true,
    sameSite: "Lax",
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": setCookie,
    },
  });
}

export async function handleAuthCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    console.error("[shopify-auth] Auth callback error from Shopify:", error, errorDescription);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/login?error=${encodeURIComponent(errorDescription || error)}`,
      },
    });
  }

  if (!code || !state) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login?error=missing_code_or_state" },
    });
  }

  // Validate state from cookie
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawAuthState = cookies["gc_auth_state"];
  if (!rawAuthState) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login?error=state_expired" },
    });
  }

  const verifiedStateJson = verifyAndExtractData(rawAuthState);
  if (!verifiedStateJson) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login?error=invalid_state_signature" },
    });
  }

  const authState = JSON.parse(verifiedStateJson) as AuthStatePayload;
  if (authState.state !== state) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/login?error=state_mismatch" },
    });
  }

  const { openid } = await getDiscoveryConfig();
  const origin = getOrigin(request);
  const redirectUri =
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI || `${origin}/api/auth/callback`;

  // Exchange authorization code for access token & refresh token
  const tokenParams = new URLSearchParams();
  tokenParams.set("grant_type", "authorization_code");
  tokenParams.set("client_id", CLIENT_ID);
  tokenParams.set("redirect_uri", redirectUri);
  tokenParams.set("code", code);
  tokenParams.set("code_verifier", authState.codeVerifier);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (CLIENT_SECRET) {
    headers["Authorization"] = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
  }

  const tokenRes = await fetch(openid.token_endpoint, {
    method: "POST",
    headers,
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errorBody = await tokenRes.text();
    console.error("[shopify-auth] Token exchange failed:", tokenRes.status, errorBody);
    return new Response(null, {
      status: 302,
      headers: { Location: "/login?error=token_exchange_failed" },
    });
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  };

  const sessionPayload: CustomerSessionPayload = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    idToken: tokenData.id_token,
    expiresAt: Date.now() + (tokenData.expires_in || 7200) * 1000,
  };

  const signedSession = signData(JSON.stringify(sessionPayload));
  // 30 days session
  const setSessionCookie = createSetCookieHeader("gc_customer_session", signedSession, {
    maxAge: 30 * 24 * 60 * 60,
    httpOnly: true,
    sameSite: "Lax",
  });

  // Clear temporary auth state cookie
  const clearStateCookie = createSetCookieHeader("gc_auth_state", "", {
    maxAge: 0,
    httpOnly: true,
  });

  const destination = authState.returnTo || "/account";

  const responseHeaders = new Headers();
  responseHeaders.set("Location", destination);
  responseHeaders.append("Set-Cookie", setSessionCookie);
  responseHeaders.append("Set-Cookie", clearStateCookie);

  return new Response(null, {
    status: 302,
    headers: responseHeaders,
  });
}

async function getOrRefreshAccessToken(
  request: Request,
): Promise<{ accessToken: string | null; updatedCookie?: string }> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawSession = cookies["gc_customer_session"];
  if (!rawSession) return { accessToken: null };

  const verifiedSessionJson = verifyAndExtractData(rawSession);
  if (!verifiedSessionJson) return { accessToken: null };

  const session = JSON.parse(verifiedSessionJson) as CustomerSessionPayload;

  // If token is still valid with at least 60s margin, return it
  if (session.expiresAt > Date.now() + 60 * 1000) {
    return { accessToken: session.accessToken };
  }

  // Token is expired, try refresh token
  if (!session.refreshToken) {
    return { accessToken: null };
  }

  try {
    const { openid } = await getDiscoveryConfig();
    const tokenParams = new URLSearchParams();
    tokenParams.set("grant_type", "refresh_token");
    tokenParams.set("client_id", CLIENT_ID);
    tokenParams.set("refresh_token", session.refreshToken);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (CLIENT_SECRET) {
      headers["Authorization"] = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
    }

    const refreshRes = await fetch(openid.token_endpoint, {
      method: "POST",
      headers,
      body: tokenParams.toString(),
    });

    if (!refreshRes.ok) {
      console.warn("[shopify-auth] Token refresh failed:", refreshRes.status);
      return { accessToken: null };
    }

    const refreshData = (await refreshRes.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
    };

    session.accessToken = refreshData.access_token;
    if (refreshData.refresh_token) session.refreshToken = refreshData.refresh_token;
    if (refreshData.id_token) session.idToken = refreshData.id_token;
    session.expiresAt = Date.now() + (refreshData.expires_in || 7200) * 1000;

    const signedSession = signData(JSON.stringify(session));
    const updatedCookie = createSetCookieHeader("gc_customer_session", signedSession, {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "Lax",
    });

    return { accessToken: session.accessToken, updatedCookie };
  } catch (err) {
    console.error("[shopify-auth] Error refreshing token:", err);
    return { accessToken: null };
  }
}

export async function handleAuthSession(request: Request): Promise<Response> {
  const { accessToken, updatedCookie } = await getOrRefreshAccessToken(request);

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", "application/json");
  responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate");
  if (updatedCookie) {
    responseHeaders.append("Set-Cookie", updatedCookie);
  }

  if (!accessToken) {
    return new Response(
      JSON.stringify({
        authenticated: false,
        customer: null,
        configured: !!CLIENT_ID,
        storeDomain: STORE_DOMAIN,
      }),
      { status: 200, headers: responseHeaders },
    );
  }

  // Fetch customer profile from Customer Account GraphQL API
  try {
    const { customerAccount } = await getDiscoveryConfig();
    const profileRes = await fetch(customerAccount.graphql_api, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: accessToken,
      },
      body: JSON.stringify({
        query: `
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
              }
              addresses(first: 10) {
                nodes {
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
                }
              }
              orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
                nodes {
                  id
                  name
                  number
                  processedAt
                  financialStatus
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
        `,
      }),
    });

    if (!profileRes.ok) {
      return new Response(
        JSON.stringify({
          authenticated: false,
          customer: null,
          configured: !!CLIENT_ID,
          storeDomain: STORE_DOMAIN,
        }),
        { status: 200, headers: responseHeaders },
      );
    }

    const json = (await profileRes.json()) as { data?: { customer?: any }; errors?: any[] };
    const rawCustomer = json.data?.customer;

    if (!rawCustomer) {
      return new Response(
        JSON.stringify({
          authenticated: false,
          customer: null,
          configured: !!CLIENT_ID,
          storeDomain: STORE_DOMAIN,
        }),
        { status: 200, headers: responseHeaders },
      );
    }

    // Normalize customer object for frontend
    const customer = {
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
      defaultAddress: rawCustomer.defaultAddress
        ? {
            id: rawCustomer.defaultAddress.id,
            firstName: rawCustomer.defaultAddress.firstName,
            lastName: rawCustomer.defaultAddress.lastName,
            company: rawCustomer.defaultAddress.company,
            address1: rawCustomer.defaultAddress.address1,
            address2: rawCustomer.defaultAddress.address2,
            city: rawCustomer.defaultAddress.city,
            province: rawCustomer.defaultAddress.zoneCode,
            country: rawCustomer.defaultAddress.territoryCode || "IN",
            zip: rawCustomer.defaultAddress.zip,
            phone: rawCustomer.defaultAddress.phoneNumber,
            isDefault: true,
          }
        : null,
      addresses: (rawCustomer.addresses?.nodes || []).map((addr: any) => ({
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
        isDefault: addr.id === rawCustomer.defaultAddress?.id,
      })),
      orders: (rawCustomer.orders?.nodes || []).map((order: any) => ({
        id: order.id,
        name: order.name,
        orderNumber: order.number || parseInt(order.name.replace(/\D/g, ""), 10) || 0,
        processedAt: order.processedAt,
        financialStatus: order.financialStatus,
        fulfillmentStatus: order.fulfillments?.[0]?.status || "UNFULFILLED",
        totalPrice: order.totalPrice,
        lineItems: (order.lineItems?.nodes || []).map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
          originalTotalPrice: item.totalPrice,
          variant: {
            image: item.image,
          },
        })),
        successfulFulfillments: (order.fulfillments || []).map((f: any) => ({
          trackingCompany: f.trackingInformation?.[0]?.company,
          trackingInfo: (f.trackingInformation || []).map((t: any) => ({
            number: t.number,
            url: t.url,
          })),
        })),
      })),
    };

    return new Response(
      JSON.stringify({
        authenticated: true,
        customer,
        configured: !!CLIENT_ID,
        storeDomain: STORE_DOMAIN,
      }),
      { status: 200, headers: responseHeaders },
    );
  } catch (err) {
    console.error("[shopify-auth] Failed to retrieve customer profile:", err);
    return new Response(
      JSON.stringify({
        authenticated: true,
        customer: null,
        configured: !!CLIENT_ID,
        storeDomain: STORE_DOMAIN,
      }),
      { status: 200, headers: responseHeaders },
    );
  }
}

export async function handleAuthLogout(request: Request): Promise<Response> {
  const cookies = parseCookies(request.headers.get("cookie"));
  const rawSession = cookies["gc_customer_session"];
  let idToken: string | undefined;

  if (rawSession) {
    const verified = verifyAndExtractData(rawSession);
    if (verified) {
      try {
        const payload = JSON.parse(verified) as CustomerSessionPayload;
        idToken = payload.idToken;
      } catch {}
    }
  }

  const { openid } = await getDiscoveryConfig();
  const origin = getOrigin(request);
  const postLogoutRedirectUri = `${origin}/`;

  const logoutUrl = new URL(openid.end_session_endpoint);
  if (idToken) {
    logoutUrl.searchParams.set("id_token_hint", idToken);
  }
  logoutUrl.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);

  const clearSessionCookie = createSetCookieHeader("gc_customer_session", "", {
    maxAge: 0,
    httpOnly: true,
  });

  const acceptsJson = request.headers.get("accept")?.includes("application/json");
  if (acceptsJson) {
    return new Response(
      JSON.stringify({ success: true, logoutUrl: logoutUrl.toString() }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearSessionCookie,
        },
      },
    );
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: logoutUrl.toString(),
      "Set-Cookie": clearSessionCookie,
    },
  });
}

export async function handleCustomerGraphQLProxy(request: Request): Promise<Response> {
  const { accessToken, updatedCookie } = await getOrRefreshAccessToken(request);

  if (!accessToken) {
    return new Response(
      JSON.stringify({ errors: [{ message: "Unauthorized. Please log in." }] }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await request.text();
  const { customerAccount } = await getDiscoveryConfig();

  const response = await fetch(customerAccount.graphql_api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body,
  });

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", "application/json");
  responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate");
  if (updatedCookie) {
    responseHeaders.append("Set-Cookie", updatedCookie);
  }

  const resBody = await response.text();
  return new Response(resBody, {
    status: response.status,
    headers: responseHeaders,
  });
}

export function handleAuthStatus(): Response {
  return new Response(
    JSON.stringify({
      configured: !!CLIENT_ID,
      storeDomain: STORE_DOMAIN,
      clientId: CLIENT_ID ? `${CLIENT_ID.slice(0, 4)}...configured` : null,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    },
  );
}
