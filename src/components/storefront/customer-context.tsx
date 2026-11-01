import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type CustomerProfile,
  type CustomerAddress,
  getPersistedCustomerToken,
  loginCustomer,
  registerCustomer,
  recoverCustomerPassword,
  resetCustomerPasswordByUrl,
  logoutCustomer,
  fetchCustomerProfile,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  associateCustomerWithCart,
} from "@/services/shopify-customer";
import {
  fetchCurrentSession,
  fetchAuthStatus,
  startShopifyLogin,
  startShopifyRegister,
  performShopifyLogout,
  updateCustomerProfileInfo,
  createAccountAddress,
  updateAccountAddress,
  deleteAccountAddress,
} from "@/services/shopify-customer-account";
import { getPersistedCartId } from "@/services/shopify-cart";
import { isShopifyConfigured } from "@/lib/shopify";

interface CustomerContextType {
  customer: CustomerProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isCustomerAccountApiConfigured: boolean;
  // Modern Shopify Customer Account API OAuth flows
  loginWithShopify: (returnTo?: string) => void;
  registerWithShopify: (returnTo?: string) => void;
  updateProfile: (params: { firstName?: string; lastName?: string }) => Promise<void>;
  // Legacy Storefront API direct mutations
  login: (email: string, password: string) => Promise<void>;
  register: (params: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    acceptsMarketing?: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  recoverPassword: (email: string) => Promise<void>;
  resetPassword: (resetUrl: string, password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Address management
  addAddress: (address: Omit<CustomerAddress, "id" | "isDefault">, isDefault?: boolean) => Promise<void>;
  updateAddress: (id: string, address: Omit<CustomerAddress, "id" | "isDefault">, isDefault?: boolean) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCustomerAccountApiConfigured, setIsCustomerAccountApiConfigured] = useState(false);

  // Initialize session: First check modern Customer Account API session, fallback to legacy token
  const refreshProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Check server-side HttpOnly Customer Account API session
      const session = await fetchCurrentSession();
      setIsCustomerAccountApiConfigured(session.configured);

      if (session.authenticated && session.customer) {
        setCustomer(session.customer);
        setToken("oauth_session_active");
        setLoading(false);
        return;
      }

      // 2. Fallback: check legacy Storefront token
      const legacyToken = getPersistedCustomerToken();
      if (legacyToken && isShopifyConfigured) {
        setToken(legacyToken);
        const legacyProfile = await fetchCustomerProfile(legacyToken);
        if (legacyProfile) {
          setCustomer(legacyProfile);
          const cartId = getPersistedCartId();
          if (cartId) {
            associateCustomerWithCart(cartId, legacyToken).catch(() => {});
          }
        } else {
          setToken(null);
          setCustomer(null);
        }
      } else {
        setCustomer(null);
        setToken(null);
      }
    } catch (err) {
      console.warn("[customer-context] Failed to refresh profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus().then((status) => {
      setIsCustomerAccountApiConfigured(status.configured);
    }).catch(() => {});
    refreshProfile();
  }, [refreshProfile]);

  // Modern Shopify OAuth redirects
  const loginWithShopify = useCallback((returnTo?: string) => {
    startShopifyLogin(returnTo);
  }, []);

  const registerWithShopify = useCallback((returnTo?: string) => {
    startShopifyRegister(returnTo);
  }, []);

  // Profile update
  const updateProfile = useCallback(
    async (params: { firstName?: string; lastName?: string }) => {
      setError(null);
      try {
        if (isCustomerAccountApiConfigured && token === "oauth_session_active") {
          await updateCustomerProfileInfo(params);
        }
        await refreshProfile();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update profile";
        setError(msg);
        throw err;
      }
    },
    [isCustomerAccountApiConfigured, token, refreshProfile],
  );

  // Legacy fallback login
  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const { accessToken } = await loginCustomer(email, password);
        setToken(accessToken);
        const profile = await fetchCustomerProfile(accessToken);
        setCustomer(profile);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to sign in.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Legacy fallback register
  const register = useCallback(
    async (params: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
      acceptsMarketing?: boolean;
    }) => {
      setLoading(true);
      setError(null);
      try {
        await registerCustomer(params);
        // Automatically sign in after registration
        const { accessToken } = await loginCustomer(params.email, params.password);
        setToken(accessToken);
        const profile = await fetchCustomerProfile(accessToken);
        setCustomer(profile);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Registration failed.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (token === "oauth_session_active") {
        await performShopifyLogout();
      } else if (token) {
        await logoutCustomer(token);
      }
    } finally {
      setCustomer(null);
      setToken(null);
      setLoading(false);
    }
  }, [token]);

  const recoverPassword = useCallback(async (email: string) => {
    await recoverCustomerPassword(email);
  }, []);

  const resetPassword = useCallback(async (resetUrl: string, password: string) => {
    await resetCustomerPasswordByUrl(resetUrl, password);
  }, []);

  const addAddress = useCallback(
    async (address: Omit<CustomerAddress, "id" | "isDefault">, isDefault = false) => {
      setError(null);
      if (token === "oauth_session_active") {
        await createAccountAddress(address, isDefault);
        await refreshProfile();
      } else if (token) {
        await addCustomerAddress(token, address);
        await refreshProfile();
      } else {
        throw new Error("You must be logged in to add an address.");
      }
    },
    [token, refreshProfile],
  );

  const updateAddress = useCallback(
    async (id: string, address: Omit<CustomerAddress, "id" | "isDefault">, isDefault?: boolean) => {
      setError(null);
      if (token === "oauth_session_active") {
        await updateAccountAddress(id, address, isDefault);
        await refreshProfile();
      } else if (token) {
        await updateCustomerAddress(token, id, address);
        await refreshProfile();
      } else {
        throw new Error("You must be logged in to update an address.");
      }
    },
    [token, refreshProfile],
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      setError(null);
      if (token === "oauth_session_active") {
        await deleteAccountAddress(id);
        await refreshProfile();
      } else if (token) {
        await deleteCustomerAddress(token, id);
        await refreshProfile();
      } else {
        throw new Error("You must be logged in to delete an address.");
      }
    },
    [token, refreshProfile],
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      setError(null);
      if (token === "oauth_session_active") {
        const target = customer?.addresses.find((a) => a.id === id);
        if (target) {
          await updateAccountAddress(id, target, true);
          await refreshProfile();
        }
      } else if (token) {
        await setDefaultCustomerAddress(token, id);
        await refreshProfile();
      }
    },
    [token, customer, refreshProfile],
  );

  return (
    <CustomerContext.Provider
      value={{
        customer,
        token,
        loading,
        error,
        isCustomerAccountApiConfigured,
        loginWithShopify,
        registerWithShopify,
        updateProfile,
        login,
        register,
        logout,
        recoverPassword,
    resetPassword,
        refreshProfile,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) {
    throw new Error("useCustomer must be used within a CustomerProvider");
  }
  return ctx;
}
