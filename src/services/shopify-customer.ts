/**
 * Shopify Customer Account & Authentication API
 *
 * Provides customer registration, login, session tokens, order history,
 * address management, password recovery, and cart buyer identity association
 * using the Shopify Storefront API.
 */

import { shopifyFetch, isShopifyConfigured, STORE_DOMAIN_EXPORT } from "@/lib/shopify";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CustomerAddress {
  id: string;
  address1: string;
  address2?: string | null;
  city: string;
  province?: string | null;
  country: string;
  zip: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isDefault?: boolean;
}

export interface CustomerOrderLineItem {
  title: string;
  quantity: number;
  variant?: {
    title: string;
    price: { amount: string; currencyCode: string };
    image?: { url: string; altText: string | null } | null;
    product?: { handle: string } | null;
  } | null;
  originalTotalPrice: { amount: string; currencyCode: string };
}

export interface CustomerOrder {
  id: string;
  name: string;
  orderNumber: number;
  processedAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  statusUrl?: string | null;
  totalPrice: { amount: string; currencyCode: string };
  subtotalPrice?: { amount: string; currencyCode: string } | null;
  totalShippingPrice?: { amount: string; currencyCode: string } | null;
  lineItems: CustomerOrderLineItem[];
  successfulFulfillments?: {
    trackingCompany?: string | null;
    trackingInfo: { number: string; url: string }[];
  }[];
}

export interface CustomerProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  email: string;
  phone: string | null;
  acceptsMarketing: boolean;
  defaultAddress: CustomerAddress | null;
  addresses: CustomerAddress[];
  orders: CustomerOrder[];
}

export interface CustomerAccessToken {
  accessToken: string;
  expiresAt: string;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const TOKEN_KEY = "gc_customer_access_token";
const EXPIRES_KEY = "gc_customer_token_expires";

export function getPersistedCustomerToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expires = localStorage.getItem(EXPIRES_KEY);
    if (!token) return null;
    if (expires && new Date(expires).getTime() <= Date.now()) {
      clearPersistedCustomerToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function persistCustomerToken(token: string, expiresAt: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRES_KEY, expiresAt);
  } catch {
    // ignore
  }
}

export function clearPersistedCustomerToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  } catch {
    // ignore
  }
}

// ─── GraphQL Queries & Mutations ──────────────────────────────────────────────

const CUSTOMER_ACCESS_TOKEN_CREATE = /* GraphQL */ `
  mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
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

const CUSTOMER_CREATE = /* GraphQL */ `
  mutation customerCreate($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
        firstName
        lastName
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CUSTOMER_RECOVER = /* GraphQL */ `
  mutation customerRecover($email: String!) {
    customerRecover(email: $email) {
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CUSTOMER_ACCESS_TOKEN_DELETE = /* GraphQL */ `
  mutation customerAccessTokenDelete($customerAccessToken: String!) {
    customerAccessTokenDelete(customerAccessToken: $customerAccessToken) {
      deletedAccessToken
      deletedCustomerAccessTokenId
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_CUSTOMER_QUERY = /* GraphQL */ `
  query getCustomer($customerAccessToken: String!) {
    customer(customerAccessToken: $customerAccessToken) {
      id
      firstName
      lastName
      displayName
      email
      phone
      acceptsMarketing
      defaultAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        phone
        firstName
        lastName
      }
      addresses(first: 10) {
        nodes {
          id
          address1
          address2
          city
          province
          country
          zip
          phone
          firstName
          lastName
        }
      }
      orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          orderNumber
          processedAt
          financialStatus
          fulfillmentStatus
          statusUrl
          totalPrice {
            amount
            currencyCode
          }
          subtotalPrice {
            amount
            currencyCode
          }
          totalShippingPrice {
            amount
            currencyCode
          }
          lineItems(first: 20) {
            nodes {
              title
              quantity
              originalTotalPrice {
                amount
                currencyCode
              }
              variant {
                title
                price {
                  amount
                  currencyCode
                }
                image {
                  url
                  altText
                }
                product {
                  handle
                }
              }
            }
          }
          successfulFulfillments(first: 5) {
            trackingCompany
            trackingInfo {
              number
              url
            }
          }
        }
      }
    }
  }
`;

const CUSTOMER_ADDRESS_CREATE = /* GraphQL */ `
  mutation customerAddressCreate($customerAccessToken: String!, $address: MailingAddressInput!) {
    customerAddressCreate(customerAccessToken: $customerAccessToken, address: $address) {
      customerAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        phone
        firstName
        lastName
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CUSTOMER_ADDRESS_UPDATE = /* GraphQL */ `
  mutation customerAddressUpdate($customerAccessToken: String!, $id: ID!, $address: MailingAddressInput!) {
    customerAddressUpdate(customerAccessToken: $customerAccessToken, id: $id, address: $address) {
      customerAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        phone
        firstName
        lastName
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CUSTOMER_ADDRESS_DELETE = /* GraphQL */ `
  mutation customerAddressDelete($customerAccessToken: String!, $id: ID!) {
    customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
      deletedCustomerAddressId
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CUSTOMER_DEFAULT_ADDRESS_UPDATE = /* GraphQL */ `
  mutation customerDefaultAddressUpdate($customerAccessToken: String!, $addressId: ID!) {
    customerDefaultAddressUpdate(customerAccessToken: $customerAccessToken, addressId: $addressId) {
      customer {
        id
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CART_BUYER_IDENTITY_UPDATE = /* GraphQL */ `
  mutation cartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── API Functions ────────────────────────────────────────────────────────────

export async function loginCustomer(
  email: string,
  password: string,
): Promise<CustomerAccessToken> {
  if (!isShopifyConfigured) {
    throw new Error("Shopify integration is not configured in .env.");
  }

  const res = await shopifyFetch<{
    customerAccessTokenCreate: {
      customerAccessToken: CustomerAccessToken | null;
      customerUserErrors: { code: string; field: string[]; message: string }[];
    };
  }>(CUSTOMER_ACCESS_TOKEN_CREATE, {
    input: { email, password },
  });

  const payload = res.customerAccessTokenCreate;
  if (payload.customerUserErrors.length > 0) {
    throw new Error(payload.customerUserErrors.map((e) => e.message).join("; "));
  }

  if (!payload.customerAccessToken) {
    throw new Error("Invalid email or password. Please verify your credentials.");
  }

  persistCustomerToken(
    payload.customerAccessToken.accessToken,
    payload.customerAccessToken.expiresAt,
  );

  return payload.customerAccessToken;
}

export async function registerCustomer(params: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  acceptsMarketing?: boolean;
}): Promise<void> {
  if (!isShopifyConfigured) {
    throw new Error("Shopify integration is not configured in .env.");
  }

  const res = await shopifyFetch<{
    customerCreate: {
      customer: { id: string } | null;
      customerUserErrors: { code: string; field: string[]; message: string }[];
    };
  }>(CUSTOMER_CREATE, {
    input: params,
  });

  const payload = res.customerCreate;
  if (payload.customerUserErrors.length > 0) {
    throw new Error(payload.customerUserErrors.map((e) => e.message).join("; "));
  }
}

export async function recoverCustomerPassword(email: string): Promise<void> {
  if (!isShopifyConfigured) {
    throw new Error("Shopify integration is not configured in .env.");
  }

  const res = await shopifyFetch<{
    customerRecover: {
      customerUserErrors: { code: string; message: string }[];
    };
  }>(CUSTOMER_RECOVER, { email });

  const payload = res.customerRecover;
  if (payload.customerUserErrors.length > 0) {
    throw new Error(payload.customerUserErrors.map((e) => e.message).join("; "));
  }
}

export async function logoutCustomer(token: string): Promise<void> {
  clearPersistedCustomerToken();
  if (!isShopifyConfigured) return;
  try {
    await shopifyFetch(CUSTOMER_ACCESS_TOKEN_DELETE, {
      customerAccessToken: token,
    });
  } catch {
    // ignore network logout errors
  }
}

export async function fetchCustomerProfile(token: string): Promise<CustomerProfile | null> {
  if (!isShopifyConfigured) return null;

  interface RawCustomerResponse {
    customer: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      displayName: string;
      email: string;
      phone: string | null;
      acceptsMarketing: boolean;
      defaultAddress: CustomerAddress | null;
      addresses: { nodes: CustomerAddress[] };
      orders: {
        nodes: {
          id: string;
          name: string;
          orderNumber: number;
          processedAt: string;
          financialStatus: string;
          fulfillmentStatus: string;
          statusUrl?: string | null;
          totalPrice: { amount: string; currencyCode: string };
          subtotalPrice?: { amount: string; currencyCode: string } | null;
          totalShippingPrice?: { amount: string; currencyCode: string } | null;
          lineItems: { nodes: CustomerOrderLineItem[] };
          successfulFulfillments?: {
            trackingCompany?: string | null;
            trackingInfo: { number: string; url: string }[];
          }[];
        }[];
      };
    } | null;
  }

  try {
    const res = await shopifyFetch<RawCustomerResponse>(GET_CUSTOMER_QUERY, {
      customerAccessToken: token,
    });

    if (!res.customer) return null;

    const raw = res.customer;
    return {
      id: raw.id,
      firstName: raw.firstName,
      lastName: raw.lastName,
      displayName: raw.displayName || `${raw.firstName ?? ""} ${raw.lastName ?? ""}`.trim() || raw.email,
      email: raw.email,
      phone: raw.phone,
      acceptsMarketing: raw.acceptsMarketing,
      defaultAddress: raw.defaultAddress,
      addresses: raw.addresses.nodes.map((addr) => ({
        ...addr,
        isDefault: raw.defaultAddress?.id === addr.id,
      })),
      orders: raw.orders.nodes.map((order) => ({
        ...order,
        lineItems: order.lineItems.nodes,
      })),
    };
  } catch (err) {
    console.warn("[shopify-customer] Failed to fetch customer profile:", err);
    return null;
  }
}

export async function addCustomerAddress(
  token: string,
  address: Omit<CustomerAddress, "id" | "isDefault">,
): Promise<CustomerAddress> {
  const res = await shopifyFetch<{
    customerAddressCreate: {
      customerAddress: CustomerAddress | null;
      customerUserErrors: { message: string }[];
    };
  }>(CUSTOMER_ADDRESS_CREATE, {
    customerAccessToken: token,
    address,
  });

  const payload = res.customerAddressCreate;
  if (payload.customerUserErrors.length > 0) {
    throw new Error(payload.customerUserErrors.map((e) => e.message).join("; "));
  }

  if (!payload.customerAddress) {
    throw new Error("Failed to create address.");
  }

  return payload.customerAddress;
}

export async function updateCustomerAddress(
  token: string,
  id: string,
  address: Omit<CustomerAddress, "id" | "isDefault">,
): Promise<CustomerAddress> {
  const res = await shopifyFetch<{
    customerAddressUpdate: {
      customerAddress: CustomerAddress | null;
      customerUserErrors: { message: string }[];
    };
  }>(CUSTOMER_ADDRESS_UPDATE, {
    customerAccessToken: token,
    id,
    address,
  });

  const payload = res.customerAddressUpdate;
  if (payload.customerUserErrors.length > 0) {
    throw new Error(payload.customerUserErrors.map((e) => e.message).join("; "));
  }

  if (!payload.customerAddress) {
    throw new Error("Failed to update address.");
  }

  return payload.customerAddress;
}

export async function deleteCustomerAddress(token: string, id: string): Promise<void> {
  const res = await shopifyFetch<{
    customerAddressDelete: {
      deletedCustomerAddressId: string | null;
      customerUserErrors: { message: string }[];
    };
  }>(CUSTOMER_ADDRESS_DELETE, {
    customerAccessToken: token,
    id,
  });

  const payload = res.customerAddressDelete;
  if (payload.customerUserErrors.length > 0) {
    throw new Error(payload.customerUserErrors.map((e) => e.message).join("; "));
  }
}

export async function setDefaultCustomerAddress(token: string, addressId: string): Promise<void> {
  const res = await shopifyFetch<{
    customerDefaultAddressUpdate: {
      customerUserErrors: { message: string }[];
    };
  }>(CUSTOMER_DEFAULT_ADDRESS_UPDATE, {
    customerAccessToken: token,
    addressId,
  });

  const payload = res.customerDefaultAddressUpdate;
  if (payload.customerUserErrors.length > 0) {
    throw new Error(payload.customerUserErrors.map((e) => e.message).join("; "));
  }
}

/** Link authenticated customer to the active cart so their shipping/billing info pre-fills */
export async function associateCustomerWithCart(cartId: string, customerAccessToken: string): Promise<void> {
  try {
    await shopifyFetch(CART_BUYER_IDENTITY_UPDATE, {
      cartId,
      buyerIdentity: { customerAccessToken },
    });
  } catch (err) {
    console.warn("[shopify-customer] Could not link buyer identity to cart:", err);
  }
}

/** Get direct link to store's native Shopify customer account login */
export function getShopifyNativeAccountUrl(): string {
  const domain = STORE_DOMAIN_EXPORT || "thegoldcrownimitation.myshopify.com";
  return `https://${domain}/account`;
}

/**
 * Reset customer password using Shopify's official customerResetByUrl via secure backend API
 */
export async function resetCustomerPasswordByUrl(
  resetUrl: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch("/api/customer/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resetUrl, password }),
  });

  const data = (await res.json().catch(() => ({
    ok: false,
    error: "Network response error during password reset.",
  }))) as { ok?: boolean; message?: string; error?: string; code?: string };

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Password reset failed. Please request a new link.");
  }

  return { ok: true, message: data.message || "Password updated successfully." };
}
