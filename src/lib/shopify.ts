/**
 * Shopify Storefront API client
 *
 * Credentials come from VITE_SHOPIFY_STORE_DOMAIN and VITE_SHOPIFY_STOREFRONT_TOKEN.
 * The token MUST be the *public* Storefront access token (header
 * `X-Shopify-Storefront-Access-Token`) — it is designed to be visible to buyers.
 * Never put a private (`shpat_` / delegate) token in a VITE_ variable: VITE_ values
 * are bundled into browser JavaScript.
 *
 * Docs: https://shopify.dev/docs/api/storefront#authentication
 *       https://shopify.dev/docs/api/usage/versioning
 */

const STORE_DOMAIN = ((import.meta.env["VITE_SHOPIFY_STORE_DOMAIN"] as string | undefined) ?? "")
  .replace(/^['"]|['"]$/g, "")
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "")
  .trim();
const STOREFRONT_TOKEN = (
  (import.meta.env["VITE_SHOPIFY_STOREFRONT_TOKEN"] as string | undefined) ?? ""
)
  .replace(/^['"]|['"]$/g, "")
  .trim();

/**
 * Pinned stable Storefront API version. Shopify keeps each stable version for
 * 12 months; requests to an expired version silently "fall forward" to the
 * oldest supported one, so bump this at least once a year.
 * 2026-10 is the latest stable release at the time of writing.
 */
export const API_VERSION = "2026-10";

export const SHOPIFY_ENDPOINT = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;
export const STORE_DOMAIN_EXPORT = STORE_DOMAIN;

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

/** Typed error so callers can distinguish throttling / auth / user-facing problems. */
export class ShopifyApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { status?: number; code?: string; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ShopifyApiError";
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

interface GraphQLErrorItem {
  message: string;
  extensions?: { code?: string };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 4000);
  return Math.min(250 * 2 ** attempt, 2000) + Math.floor(Math.random() * 150);
}

function httpErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return "Shopify rejected the Storefront access token (401). Check VITE_SHOPIFY_STOREFRONT_TOKEN.";
    case 402:
      return "The Shopify store is unavailable (402 — plan frozen or payment pending).";
    case 403:
      return "The Storefront access token lacks a required permission (403). Check the Headless channel scopes.";
    case 404:
      return "Shopify store not found (404). Check VITE_SHOPIFY_STORE_DOMAIN.";
    case 423:
      return "The Shopify store is locked (423).";
    case 429:
      return "Shopify is rate limiting requests (429). Please retry in a moment.";
    case 430:
      return "Shopify security rejected the request (430).";
    default:
      return status >= 500
        ? `Shopify is temporarily unavailable (${status}).`
        : `Shopify API error ${status}.`;
  }
}

/**
 * Raw GraphQL fetch.
 * - Retries (with backoff) on network errors, HTTP 429/5xx and `THROTTLED` GraphQL errors.
 * - Throws `ShopifyApiError` on HTTP errors and top-level GraphQL `errors`.
 * - Mutation `userErrors` are returned in `data` and must be handled by callers
 *   (see `throwOnUserErrors`).
 */
export async function shopifyFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!STORE_DOMAIN || STORE_DOMAIN === "your-store.myshopify.com") {
    throw new ShopifyApiError(
      "Shopify store domain is not configured. Set VITE_SHOPIFY_STORE_DOMAIN to your store's .myshopify.com domain.",
    );
  }
  if (!STOREFRONT_TOKEN || STOREFRONT_TOKEN === "your-public-storefront-access-token") {
    throw new ShopifyApiError(
      "Shopify Storefront token is not configured. Set VITE_SHOPIFY_STOREFRONT_TOKEN to the public " +
        "access token from Sales channels → Headless → your storefront → Storefront API.",
    );
  }

  let lastError: ShopifyApiError | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(SHOPIFY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = new ShopifyApiError(
        err instanceof Error && err.name === "TimeoutError"
          ? "Shopify request timed out."
          : "Could not reach Shopify. Check your connection.",
        { retryable: true },
      );
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
      throw lastError;
    }

    if (import.meta.env.DEV) {
      const served = res.headers?.get?.("x-shopify-api-version");
      if (served && served !== API_VERSION) {
        console.warn(
          `[shopify] Requested API ${API_VERSION} but Shopify served ${served} — the pinned version is outdated.`,
        );
      }
    }

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new ShopifyApiError(httpErrorMessage(res.status), {
        status: res.status,
        retryable,
      });
      if (retryable && attempt < MAX_ATTEMPTS - 1) {
        await sleep(backoffMs(attempt, res.headers?.get?.("retry-after") ?? null));
        continue;
      }
      throw lastError;
    }

    let json: { data?: T; errors?: GraphQLErrorItem[] };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      throw new ShopifyApiError("Shopify returned an unreadable response.", { status: res.status });
    }

    if (json.errors?.length) {
      const throttled = json.errors.some((e) => e.extensions?.code === "THROTTLED");
      const code = json.errors[0]?.extensions?.code;
      lastError = new ShopifyApiError(json.errors.map((e) => e.message).join("; "), {
        status: res.status,
        ...(code ? { code } : {}),
        retryable: throttled,
      });
      if (throttled && attempt < MAX_ATTEMPTS - 1) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
      throw lastError;
    }

    if (json.data === undefined || json.data === null) {
      throw new ShopifyApiError("Shopify returned no data.", { status: res.status });
    }
    return json.data;
  }

  throw lastError ?? new ShopifyApiError("Shopify request failed.");
}

/** Throws a ShopifyApiError built from mutation `userErrors` / `customerUserErrors`. */
export function throwOnUserErrors(
  errors: { message: string; code?: string | null }[] | null | undefined,
): void {
  if (errors && errors.length > 0) {
    const code = errors[0]?.code;
    throw new ShopifyApiError(errors.map((e) => e.message).join("; "), code ? { code } : {});
  }
}

/** Check if Shopify is configured */
export const isShopifyConfigured =
  !!STORE_DOMAIN &&
  STORE_DOMAIN !== "your-store.myshopify.com" &&
  !!STOREFRONT_TOKEN &&
  STOREFRONT_TOKEN !== "your-public-storefront-access-token";
