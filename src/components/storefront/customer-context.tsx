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
  logoutCustomer,
  fetchCustomerProfile,
  addCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  associateCustomerWithCart,
} from "@/services/shopify-customer";
import { getPersistedCartId } from "@/services/shopify-cart";
import { isShopifyConfigured } from "@/lib/shopify";

interface CustomerContextType {
  customer: CustomerProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
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
  refreshProfile: () => Promise<void>;
  addAddress: (address: Omit<CustomerAddress, "id" | "isDefault">) => Promise<void>;
  updateAddress: (id: string, address: Omit<CustomerAddress, "id" | "isDefault">) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (authToken: string) => {
    try {
      const profile = await fetchCustomerProfile(authToken);
      if (profile) {
        setCustomer(profile);
        // Link customer to the active cart if one exists
        const cartId = getPersistedCartId();
        if (cartId) {
          associateCustomerWithCart(cartId, authToken).catch(() => {});
        }
      } else {
        // Token might have expired or been revoked
        setToken(null);
        setCustomer(null);
      }
    } catch (err) {
      console.warn("[customer-context] Failed to load profile:", err);
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    const savedToken = getPersistedCustomerToken();
    if (savedToken && isShopifyConfigured) {
      setToken(savedToken);
      loadProfile(savedToken).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const { accessToken } = await loginCustomer(email, password);
        setToken(accessToken);
        await loadProfile(accessToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to sign in.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadProfile],
  );

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
        // Automatically attempt login right after registration
        const { accessToken } = await loginCustomer(params.email, params.password);
        setToken(accessToken);
        await loadProfile(accessToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Registration failed.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (token) {
        await logoutCustomer(token);
      }
    } finally {
      setToken(null);
      setCustomer(null);
      setLoading(false);
    }
  }, [token]);

  const recoverPassword = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await recoverCustomerPassword(email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send password reset email.";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (token) {
      setLoading(true);
      await loadProfile(token);
      setLoading(false);
    }
  }, [token, loadProfile]);

  const addAddress = useCallback(
    async (address: Omit<CustomerAddress, "id" | "isDefault">) => {
      if (!token) throw new Error("Not logged in");
      setLoading(true);
      setError(null);
      try {
        await addCustomerAddress(token, address);
        await loadProfile(token);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add address.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, loadProfile],
  );

  const updateAddress = useCallback(
    async (id: string, address: Omit<CustomerAddress, "id" | "isDefault">) => {
      if (!token) throw new Error("Not logged in");
      setLoading(true);
      setError(null);
      try {
        await updateCustomerAddress(token, id, address);
        await loadProfile(token);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update address.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, loadProfile],
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      if (!token) throw new Error("Not logged in");
      setLoading(true);
      setError(null);
      try {
        await deleteCustomerAddress(token, id);
        await loadProfile(token);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete address.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, loadProfile],
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      if (!token) throw new Error("Not logged in");
      setLoading(true);
      setError(null);
      try {
        await setDefaultCustomerAddress(token, id);
        await loadProfile(token);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to set default address.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, loadProfile],
  );

  return (
    <CustomerContext.Provider
      value={{
        customer,
        token,
        loading,
        error,
        login,
        register,
        logout,
        recoverPassword,
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
