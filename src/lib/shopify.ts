/**
 * Shopify Storefront API client
 * Credentials are loaded from VITE_SHOPIFY_STORE_DOMAIN and
 * VITE_SHOPIFY_STOREFRONT_TOKEN in your .env file.
 */

const STORE_DOMAIN = import.meta.env["VITE_SHOPIFY_STORE_DOMAIN"] as string;
const STOREFRONT_TOKEN = import.meta.env["VITE_SHOPIFY_STOREFRONT_TOKEN"] as string;
export const API_VERSION = "2025-01"; // Update if Shopify releases a newer stable version

export const SHOPIFY_ENDPOINT = `https://${STORE_DOMAIN}/api/${API_VERSION}/graphql.json`;
export const STORE_DOMAIN_EXPORT = STORE_DOMAIN;

/** Raw GraphQL fetch — throws on network / HTTP errors */
export async function shopifyFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!STORE_DOMAIN || STORE_DOMAIN === "your-store.myshopify.com") {
    throw new Error(
      "Shopify store domain is not configured. " +
        "Open .env and set VITE_SHOPIFY_STORE_DOMAIN to your store's .myshopify.com domain.",
    );
  }
  if (!STOREFRONT_TOKEN || STOREFRONT_TOKEN === "your-public-storefront-access-token") {
    throw new Error(
      "Shopify Storefront token is not configured. " +
        "Open .env and set VITE_SHOPIFY_STOREFRONT_TOKEN to the Public Access Token " +
        "from Sales channels → Headless → your storefront → API permissions.",
    );
  }

  const res = await fetch(SHOPIFY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  return json.data as T;
}

/** Check if Shopify is configured */
export const isShopifyConfigured =
  !!STORE_DOMAIN &&
  STORE_DOMAIN !== "your-store.myshopify.com" &&
  !!STOREFRONT_TOKEN &&
  STOREFRONT_TOKEN !== "your-public-storefront-access-token";
