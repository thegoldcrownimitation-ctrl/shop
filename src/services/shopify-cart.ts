/**
 * Shopify Storefront Cart API
 *
 * Manages a real Shopify cart via the Storefront API.
 * The cart ID is persisted in localStorage for cross-session continuity.
 */

import { shopifyFetch } from "@/lib/shopify";

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

interface CartCreateResponse {
  cartCreate: {
    cart: ShopifyCart;
    userErrors: { field: string; message: string }[];
  };
}

interface CartLinesAddResponse {
  cartLinesAdd: {
    cart: ShopifyCart;
    userErrors: { field: string; message: string }[];
  };
}

interface CartLinesUpdateResponse {
  cartLinesUpdate: {
    cart: ShopifyCart;
    userErrors: { field: string; message: string }[];
  };
}

interface CartLinesRemoveResponse {
  cartLinesRemove: {
    cart: ShopifyCart;
    userErrors: { field: string; message: string }[];
  };
}

interface CartDiscountResponse {
  cartDiscountCodesUpdate: {
    cart: ShopifyCart;
    userErrors: { field: string; message: string }[];
  };
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

function persistCartId(id: string): void {
  try {
    localStorage.setItem(CART_ID_KEY, id);
  } catch {
    // ignore storage errors
  }
}

function clearPersistedCartId(): void {
  try {
    localStorage.removeItem(CART_ID_KEY);
  } catch {
    // ignore
  }
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Fetches an existing cart by ID. Returns null if cart is expired/not found.
 */
export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  try {
    const res = await shopifyFetch<GetCartResponse>(GET_CART, { cartId });
    return res.cart;
  } catch {
    return null;
  }
}

/**
 * Creates a new Shopify cart, optionally with initial line items.
 */
export async function createCart(
  lines?: { merchandiseId: string; quantity: number }[],
): Promise<ShopifyCart> {
  const res = await shopifyFetch<CartCreateResponse>(CART_CREATE, { lines: lines ?? [] });
  if (res.cartCreate.userErrors.length > 0) {
    throw new Error(res.cartCreate.userErrors.map((e) => e.message).join("; "));
  }
  const cart = res.cartCreate.cart;
  persistCartId(cart.id);
  return cart;
}

/**
 * Ensures a valid cart exists — fetches existing or creates a new one.
 */
export async function ensureCart(): Promise<ShopifyCart> {
  const existingId = getPersistedCartId();
  if (existingId) {
    const cart = await getCart(existingId);
    if (cart) return cart;
    // Cart expired or not found — clear it
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
  const res = await shopifyFetch<CartLinesAddResponse>(CART_LINES_ADD, { cartId, lines });
  if (res.cartLinesAdd.userErrors.length > 0) {
    throw new Error(res.cartLinesAdd.userErrors.map((e) => e.message).join("; "));
  }
  return res.cartLinesAdd.cart;
}

/**
 * Updates existing line item quantities.
 */
export async function updateCartLines(
  cartId: string,
  lines: { id: string; quantity: number }[],
): Promise<ShopifyCart> {
  const res = await shopifyFetch<CartLinesUpdateResponse>(CART_LINES_UPDATE, { cartId, lines });
  if (res.cartLinesUpdate.userErrors.length > 0) {
    throw new Error(res.cartLinesUpdate.userErrors.map((e) => e.message).join("; "));
  }
  return res.cartLinesUpdate.cart;
}

/**
 * Removes line items from a cart.
 */
export async function removeCartLines(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const res = await shopifyFetch<CartLinesRemoveResponse>(CART_LINES_REMOVE, { cartId, lineIds });
  if (res.cartLinesRemove.userErrors.length > 0) {
    throw new Error(res.cartLinesRemove.userErrors.map((e) => e.message).join("; "));
  }
  return res.cartLinesRemove.cart;
}

/**
 * Applies or removes discount codes from a cart.
 */
export async function applyDiscountCode(cartId: string, codes: string[]): Promise<ShopifyCart> {
  const res = await shopifyFetch<CartDiscountResponse>(CART_DISCOUNT_CODES_UPDATE, {
    cartId,
    discountCodes: codes,
  });
  if (res.cartDiscountCodesUpdate.userErrors.length > 0) {
    throw new Error(res.cartDiscountCodesUpdate.userErrors.map((e) => e.message).join("; "));
  }
  return res.cartDiscountCodesUpdate.cart;
}
