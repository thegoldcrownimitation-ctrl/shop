/**
 * Shopify Storefront Cart API
 *
 * Manages a real Shopify cart via the Storefront API.
 * The cart ID is persisted in localStorage for cross-session continuity.
 */

import { shopifyFetch, ShopifyApiError, STORE_DOMAIN_EXPORT } from "@/lib/shopify";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ShopifyCartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    price: { amount: string; currencyCode: string };
    compareAtPrice: { amount: string; currencyCode: string } | null;
    image: { url: string; altText: string | null } | null;
    product: {
      id: string;
      title: string;
      handle: string;
    };
    selectedOptions: { name: string; value: string }[];
  };
  cost: {
    totalAmount: { amount: string; currencyCode: string };
    subtotalAmount: { amount: string; currencyCode: string };
  };
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: { nodes: ShopifyCartLine[] };
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
    totalTaxAmount: { amount: string; currencyCode: string } | null;
  };
  discountCodes: { code: string; applicable: boolean }[];
}

export interface CartUserError {
  code?: string | null;
  field?: string[] | null;
  message: string;
}

// ─── GraphQL Fragments ─────────────────────────────────────────────────────────

const CART_FIELDS = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    lines(first: 100) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              amount
              currencyCode
            }
            compareAtPrice {
              amount
              currencyCode
            }
            image {
              url
              altText
            }
            product {
              id
              title
              handle
            }
            selectedOptions {
              name
              value
            }
          }
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
        }
      }
    }
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
      totalAmount {
        amount
        currencyCode
      }
      totalTaxAmount {
        amount
        currencyCode
      }
    }
    discountCodes {
      code
      applicable
    }
  }
`;

// ─── Mutations ────────────────────────────────────────────────────────────────

const CART_CREATE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartCreate($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        ...CartFields
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const CART_LINES_ADD = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const CART_LINES_UPDATE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const CART_LINES_REMOVE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFields
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const CART_DISCOUNT_CODES_UPDATE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) {
    cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
      cart {
        ...CartFields
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const CART_BUYER_IDENTITY_UPDATE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart {
        ...CartFields
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const GET_CART = /* GraphQL */ `
  ${CART_FIELDS}
  query GetCart($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
`;

// ─── Response types ───────────────────────────────────────────────────────────

interface CartMutationPayload {
  cart: ShopifyCart | null;
  userErrors: CartUserError[];
}

interface GetCartResponse {
  cart: ShopifyCart | null;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const CART_ID_KEY = "gc_shopify_cart_id";

export function getPersistedCartId(): string | null {
  try {
    return localStorage.getItem(CART_ID_KEY);
  } catch {
    return null;
  }
}

export function persistCartId(id: string): void {
  try {
    localStorage.setItem(CART_ID_KEY, id);
  } catch {
    // ignore storage errors
  }
}

export function clearPersistedCartId(): void {
  try {
    localStorage.removeItem(CART_ID_KEY);
  } catch {
    // ignore
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Shopify reports a missing / expired cart as a userError on `cartId`
 * ("The specified cart does not exist.") — callers use this to recreate the cart.
 */
export function isCartGoneError(err: unknown): boolean {
  return err instanceof CartGoneError;
}

export class CartGoneError extends ShopifyApiError {
  constructor() {
    super("Your cart has expired or was not found. Please add your items again.", {
      code: "CART_GONE",
    });
    this.name = "CartGoneError";
  }
}

/** Unwraps a cart mutation payload, throwing a readable error on userErrors. */
function unwrapCartPayload(payload: CartMutationPayload | null | undefined): ShopifyCart {
  if (!payload) throw new ShopifyApiError("Shopify returned an empty cart response.");
  const errors = payload.userErrors ?? [];
  if (
    errors.some((e) => e.field?.includes("cartId") && /does not exist|not found/i.test(e.message))
  ) {
    throw new CartGoneError();
  }
  // Variant-level problems (sold out, not found, quantity limits) are reported with a message
  // Shopify already words for customers; surface it verbatim.
  if (errors.length > 0) {
    const first = errors[0];
    throw new ShopifyApiError(errors.map((e) => e.message).join("; "), {
      ...(first?.code ? { code: first.code } : {}),
    });
  }
  if (!payload.cart) throw new ShopifyApiError("Shopify did not return a cart.");
  return payload.cart;
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Fetches an existing cart by ID. Returns null only when Shopify confirms the cart
 * no longer exists. Network / API failures are thrown so callers don't mistake a
 * transient outage for an expired cart (and wipe the customer's saved bag).
 */
export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const res = await shopifyFetch<GetCartResponse>(GET_CART, { cartId });
  return res.cart;
}

/**
 * Creates a new Shopify cart, optionally with initial line items.
 */
export async function createCart(
  lines?: { merchandiseId: string; quantity: number }[],
): Promise<ShopifyCart> {
  const res = await shopifyFetch<{ cartCreate: CartMutationPayload }>(CART_CREATE, {
    lines: lines ?? [],
  });
  const cart = unwrapCartPayload(res.cartCreate);
  persistCartId(cart.id);
  return cart;
}

/**
 * Ensures a valid cart exists — fetches existing or creates a new one.
 * Only an explicit "cart does not exist" answer clears the saved id.
 */
export async function ensureCart(): Promise<ShopifyCart> {
  const existingId = getPersistedCartId();
  if (existingId) {
    const cart = await getCart(existingId);
    if (cart) return cart;
    clearPersistedCartId();
  }
  return createCart();
}

/**
 * Adds line items to a cart.
 */
export async function addCartLines(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[],
): Promise<ShopifyCart> {
  const res = await shopifyFetch<{ cartLinesAdd: CartMutationPayload }>(CART_LINES_ADD, {
    cartId,
    lines,
  });
  return unwrapCartPayload(res.cartLinesAdd);
}

/**
 * Updates existing line item quantities.
 */
export async function updateCartLines(
  cartId: string,
  lines: { id: string; quantity: number }[],
): Promise<ShopifyCart> {
  const res = await shopifyFetch<{ cartLinesUpdate: CartMutationPayload }>(CART_LINES_UPDATE, {
    cartId,
    lines,
  });
  return unwrapCartPayload(res.cartLinesUpdate);
}

/**
 * Removes line items from a cart.
 */
export async function removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const res = await shopifyFetch<{ cartLinesRemove: CartMutationPayload }>(CART_LINES_REMOVE, {
    cartId,
    lineIds,
  });
  return unwrapCartPayload(res.cartLinesRemove);
}

/**
 * Replaces the discount codes on a cart. Pass the complete desired list
 * (an empty array clears all codes). Codes Shopify can't apply come back
 * with `applicable: false` — callers should surface that to the customer.
 */
export async function applyDiscountCode(cartId: string, codes: string[]): Promise<ShopifyCart> {
  const res = await shopifyFetch<{ cartDiscountCodesUpdate: CartMutationPayload }>(
    CART_DISCOUNT_CODES_UPDATE,
    { cartId, discountCodes: codes },
  );
  return unwrapCartPayload(res.cartDiscountCodesUpdate);
}

/**
 * Updates the buyer identity on the cart so checkout is pre-filled.
 * `customerAccessToken` is only valid for legacy-account tokens issued by the Storefront API.
 */
export async function updateCartBuyerIdentity(
  cartId: string,
  buyerIdentity: { email?: string; phone?: string; customerAccessToken?: string },
): Promise<ShopifyCart> {
  const res = await shopifyFetch<{ cartBuyerIdentityUpdate: CartMutationPayload }>(
    CART_BUYER_IDENTITY_UPDATE,
    { cartId, buyerIdentity },
  );
  return unwrapCartPayload(res.cartBuyerIdentityUpdate);
}

/**
 * Retrieves the fresh, authoritative checkout URL directly from Shopify.
 */
export async function getFreshCheckoutUrl(cartId: string): Promise<string> {
  const cart = await getCart(cartId);
  if (!cart) throw new CartGoneError();
  if (!cart.checkoutUrl) {
    throw new ShopifyApiError("Unable to retrieve checkout URL from Shopify.");
  }
  return cart.checkoutUrl;
}

/** Returns a checkout URL that is safe to navigate to (https only, never our own storefront host). */
export function resolveCheckoutUrl(rawUrl: string, currentHostname?: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid checkout URL returned by Shopify.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Invalid checkout URL returned by Shopify.");
  }
  // If Shopify's primary domain is this storefront (whose DNS serves the headless site, not
  // Shopify checkout), send the buyer to the store's myshopify.com domain, which always serves checkout.
  if (
    currentHostname &&
    STORE_DOMAIN_EXPORT &&
    parsed.hostname === currentHostname &&
    !currentHostname.endsWith(".myshopify.com") &&
    !currentHostname.startsWith("checkout.")
  ) {
    parsed.hostname = STORE_DOMAIN_EXPORT;
  }
  return parsed.toString();
}
