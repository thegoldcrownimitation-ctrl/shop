/**
 * Shopify Customer Account API Client Service
 *
 * Communicates with the secure Backend-For-Frontend (/api/auth/*) endpoints
 * using HttpOnly session cookies. No customer tokens or client secrets are
 * exposed to frontend JavaScript.
 */

import type { CustomerProfile, CustomerAddress, CustomerOrder } from "./shopify-customer";

export interface AuthSessionResponse {
  authenticated: boolean;
  customer: CustomerProfile | null;
  configured: boolean;
  storeDomain?: string;
}

export interface AuthStatusResponse {
  configured: boolean;
  storeDomain: string;
  clientId: string | null;
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  try {
    const res = await fetch("/api/auth/status", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { configured: false, storeDomain: "", clientId: null };
    return (await res.json()) as AuthStatusResponse;
  } catch {
    return { configured: false, storeDomain: "", clientId: null };
  }
}

export async function fetchCurrentSession(): Promise<AuthSessionResponse> {
  try {
    const res = await fetch("/api/auth/session", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return { authenticated: false, customer: null, configured: false };
    }
    return (await res.json()) as AuthSessionResponse;
  } catch (err) {
    console.warn("[shopify-customer-account] Failed to fetch session:", err);
    return { authenticated: false, customer: null, configured: false };
  }
}

export function startShopifyLogin(returnTo = "/account"): void {
  window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function startShopifyRegister(returnTo = "/account"): void {
  window.location.href = `/api/auth/register?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function performShopifyLogout(): Promise<void> {
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as { logoutUrl?: string };
      if (data.logoutUrl) {
        window.location.href = data.logoutUrl;
        return;
      }
    }
  } catch (err) {
    console.warn("[shopify-customer-account] Error during logout API call:", err);
  }
  // Fallback redirect home
  window.location.href = "/";
}

/** Proxy GraphQL mutation or query to Customer Account API via BFF */
export async function customerAccountGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch("/api/auth/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Customer Account API error (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  return json.data as T;
}

// ─── Customer Account API Mutations ───────────────────────────────────────────

export async function updateCustomerProfileInfo(params: {
  firstName?: string;
  lastName?: string;
}): Promise<void> {
  const query = /* GraphQL */ `
    mutation CustomerProfileUpdate($customer: CustomerUpdateInput!) {
      customerUpdate(input: $customer) {
        customer {
          id
          firstName
          lastName
        }
        userErrors {
          code
          field
          message
        }
      }
    }
  `;

  const data = await customerAccountGraphQL<{
    customerUpdate: {
      customer: { id: string };
      userErrors: { field: string[]; message: string }[];
    };
  }>(query, {
    customer: {
      firstName: params.firstName,
      lastName: params.lastName,
    },
  });

  if (data.customerUpdate.userErrors.length > 0) {
    throw new Error(data.customerUpdate.userErrors.map((e) => e.message).join("; "));
  }
}

export async function createAccountAddress(
  address: Omit<CustomerAddress, "id" | "isDefault">,
  isDefault = false,
): Promise<void> {
  const query = /* GraphQL */ `
    mutation CustomerAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) {
      customerAddressCreate(address: $address, defaultAddress: $defaultAddress) {
        customerAddress {
          id
        }
        userErrors {
          code
          field
          message
        }
      }
    }
  `;

  const data = await customerAccountGraphQL<{
    customerAddressCreate: {
      customerAddress: { id: string };
      userErrors: { field: string[]; message: string }[];
    };
  }>(query, {
    address: {
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      zoneCode: address.province,
      territoryCode: address.country || "IN",
      zip: address.zip,
      phoneNumber: address.phone,
    },
    defaultAddress: isDefault,
  });

  if (data.customerAddressCreate.userErrors.length > 0) {
    throw new Error(data.customerAddressCreate.userErrors.map((e) => e.message).join("; "));
  }
}

export async function updateAccountAddress(
  addressId: string,
  address: Omit<CustomerAddress, "id" | "isDefault">,
  isDefault?: boolean,
): Promise<void> {
  const query = /* GraphQL */ `
    mutation CustomerAddressUpdate(
      $addressId: ID!
      $address: CustomerAddressInput!
      $defaultAddress: Boolean
    ) {
      customerAddressUpdate(
        addressId: $addressId
        address: $address
        defaultAddress: $defaultAddress
      ) {
        customerAddress {
          id
        }
        userErrors {
          code
          field
          message
        }
      }
    }
  `;

  const data = await customerAccountGraphQL<{
    customerAddressUpdate: {
      customerAddress: { id: string };
      userErrors: { field: string[]; message: string }[];
    };
  }>(query, {
    addressId,
    address: {
      firstName: address.firstName,
      lastName: address.lastName,
      company: address.company,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      zoneCode: address.province,
      territoryCode: address.country || "IN",
      zip: address.zip,
      phoneNumber: address.phone,
    },
    defaultAddress: isDefault,
  });

  if (data.customerAddressUpdate.userErrors.length > 0) {
    throw new Error(data.customerAddressUpdate.userErrors.map((e) => e.message).join("; "));
  }
}

export async function deleteAccountAddress(addressId: string): Promise<void> {
  const query = /* GraphQL */ `
    mutation CustomerAddressDelete($addressId: ID!) {
      customerAddressDelete(addressId: $addressId) {
        deletedAddressId
        userErrors {
          code
          field
          message
        }
      }
    }
  `;

  const data = await customerAccountGraphQL<{
    customerAddressDelete: {
      deletedAddressId: string;
      userErrors: { field: string[]; message: string }[];
    };
  }>(query, { addressId });

  if (data.customerAddressDelete.userErrors.length > 0) {
    throw new Error(data.customerAddressDelete.userErrors.map((e) => e.message).join("; "));
  }
}
