/**
 * Cart Context
 *
 * Shopify mode (credentials configured): every cart operation goes to the Storefront Cart API;
 * the cart id is persisted in localStorage. Failures are surfaced to the customer — the cart never
 * substitutes demo products for a failed request. Checkout hands off to the Shopify-hosted
 * `checkoutUrl`, where Shopify handles payment (whichever gateways are enabled in Shopify Admin)
 * and creates the order.
 *
 * Demo mode (no credentials): an in-memory sample cart with no stock, payment or order semantics.
 */

import type React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { isShopifyConfigured } from "@/lib/shopify";
import { validateCartItem, type CartItem } from "@/services/commerce";
import { products as demoProducts } from "@/data/store";
import {
  ensureCart,
  createCart,
  clearPersistedCartId,
  isCartGoneError,
  resolveCheckoutUrl,
  getCart,
  getPersistedCartId,
  addCartLines,
  updateCartLines,
  removeCartLines,
  applyDiscountCode as applyDiscountCodeAPI,
  updateCartBuyerIdentity,
  getFreshCheckoutUrl,
  type ShopifyCart,
  type ShopifyCartLine,
} from "@/services/shopify-cart";
import { useCustomer } from "./customer-context";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CartLineItem {
  /** Shopify line item ID (gid://shopify/CartLine/...) */
  lineId?: string;
  /** Shopify variant GID */
  merchandiseId: string;
  /** Shopify product GID */
  productId: string;
  /** Human-readable product title */
  productTitle: string;
  /** Human-readable variant label */
  variantTitle: string;
  quantity: number;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  handle: string;
  selectedOptions: { name: string; value: string }[];
  currencyCode: string;
}

export interface CartState {
  lines: CartLineItem[];
  count: number;
  subtotal: number;
  total: number;
  checkoutUrl: string | null;
  discountCodes: { code: string; applicable: boolean }[];
  loading: boolean;
  error: string | null;
  isCheckingOut: boolean;
  checkoutError: string | null;

  // Drawer control
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  // Actions
  addItem: (merchandiseId: string, quantity?: number) => Promise<void>;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  applyDiscount: (code: string) => Promise<void>;
  removeDiscount: () => Promise<void>;
  openCheckout: () => Promise<void>;

  // Legacy demo-mode helpers
  add: (item: CartItem) => void;
  update: (id: string, variant: string, quantity: number) => void;
  remove: (id: string, variant: string) => void;
  items: CartItem[];
}

// ─── Context ───────────────────────────────────────────────────────────────────

const globalKey = "__goldCrownCartContext";
const g = globalThis as unknown as Record<string, React.Context<CartState | null> | undefined>;
const CartContext = (g[globalKey] ??= createContext<CartState | null>(null));

const emptyCart: CartState = {
  lines: [],
  count: 0,
  subtotal: 0,
  total: 0,
  checkoutUrl: null,
  discountCodes: [],
  loading: false,
  error: null,
  isCheckingOut: false,
  checkoutError: null,
  isDrawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  applyDiscount: async () => {},
  removeDiscount: async () => {},
  openCheckout: async () => {},
  add: () => {},
  update: () => {},
  remove: () => {},
  items: [],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function shopifyLineToCartLine(line: ShopifyCartLine): CartLineItem {
  return {
    lineId: line.id,
    merchandiseId: line.merchandise.id,
    productId: line.merchandise.product.id,
    productTitle: line.merchandise.product.title,
    variantTitle: line.merchandise.title,
    quantity: line.quantity,
    price: parseFloat(line.merchandise.price.amount) || 0,
    compareAtPrice: line.merchandise.compareAtPrice
      ? parseFloat(line.merchandise.compareAtPrice.amount) || 0
      : null,
    image: line.merchandise.image?.url ?? null,
    handle: line.merchandise.product.handle,
    selectedOptions: line.merchandise.selectedOptions,
    currencyCode: line.merchandise.price.currencyCode,
  };
}

function shopifyCartToState(cart: ShopifyCart) {
  return {
    lines: cart.lines.nodes.map(shopifyLineToCartLine),
    count: cart.totalQuantity,
    subtotal: parseFloat(cart.cost.subtotalAmount.amount) || 0,
    total: parseFloat(cart.cost.totalAmount.amount) || 0,
    checkoutUrl: cart.checkoutUrl,
    discountCodes: cart.discountCodes,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  if (isShopifyConfigured) {
    return <ShopifyCartProvider>{children}</ShopifyCartProvider>;
  }
  return <DemoCartProvider>{children}</DemoCartProvider>;
}

// ─── Shopify Cart Provider ─────────────────────────────────────────────────────

const DISCOUNT_REJECTED_MESSAGE = "Discount code is not valid or does not apply to your cart.";

function ShopifyCartProvider({ children }: { children: ReactNode }) {
  const customerContext = useCustomer();
  const customer = customerContext?.customer ?? null;
  const token = customerContext?.token ?? null;

  const [lines, setLines] = useState<CartLineItem[]>([]);
  const [count, setCount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [discountCodes, setDiscountCodes] = useState<{ code: string; applicable: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Refs keep the latest cart id / lock state available to async code without stale closures.
  const cartIdRef = useRef<string | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const checkingOutRef = useRef(false);
  const discountCodesRef = useRef<{ code: string; applicable: boolean }[]>([]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const applyCart = useCallback((cart: ShopifyCart) => {
    const state = shopifyCartToState(cart);
    setLines(state.lines);
    setCount(state.count);
    setSubtotal(state.subtotal);
    setTotal(state.total);
    setCheckoutUrl(state.checkoutUrl);
    setDiscountCodes(state.discountCodes);
    discountCodesRef.current = state.discountCodes;
    cartIdRef.current = cart.id;
  }, []);

  const resetCart = useCallback(() => {
    clearPersistedCartId();
    cartIdRef.current = null;
    discountCodesRef.current = [];
    setLines([]);
    setCount(0);
    setSubtotal(0);
    setTotal(0);
    setCheckoutUrl(null);
    setDiscountCodes([]);
  }, []);

  // Restore the saved cart on mount. Only an explicit "cart does not exist" answer discards it;
  // a transient network error keeps the saved id so the bag is restored on the next attempt.
  useEffect(() => {
    const existingId = getPersistedCartId();
    if (!existingId) return;
    let cancelled = false;
    setLoading(true);
    getCart(existingId)
      .then((cart) => {
        if (cancelled) return;
        if (cart) applyCart(cart);
        else resetCart();
      })
      .catch((err) => {
        console.warn("[cart] Could not restore saved cart:", err);
        if (!cancelled) cartIdRef.current = existingId;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyCart, resetCart]);

  /**
   * Runs a cart mutation exclusively (one at a time, in call order) so rapid clicks can't create
   * duplicate carts or interleave stale responses. Recovers from an expired cart by starting a
   * new one when `recreateIfGone` is set (safe for add-to-bag, where the intent is still valid).
   */
  const withCart = useCallback(
    (
      fn: (cartId: string) => Promise<ShopifyCart>,
      options: {
        recreateIfGone?: boolean;
        reportError?: boolean;
        openDrawerOnSuccess?: boolean;
      } = {},
    ): Promise<void> => {
      const { recreateIfGone = false, reportError = true, openDrawerOnSuccess = true } = options;
      const task = async () => {
        setLoading(true);
        setError(null);
        try {
          let id = cartIdRef.current;
          if (!id) {
            const cart = await ensureCart();
            applyCart(cart);
            id = cart.id;
          }
          let updated: ShopifyCart;
          try {
            updated = await fn(id);
          } catch (err) {
            if (!isCartGoneError(err)) throw err;
            resetCart();
            if (!recreateIfGone) throw err;
            const fresh = await createCart();
            cartIdRef.current = fresh.id;
            updated = await fn(fresh.id);
          }
          applyCart(updated);
          if (openDrawerOnSuccess) setIsDrawerOpen(true);
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "Cart operation failed. Please try again.";
          if (reportError) setError(msg);
          throw err instanceof Error ? err : new Error(msg);
        } finally {
          setLoading(false);
        }
      };
      const next = queueRef.current.then(task, task);
      queueRef.current = next.catch(() => {});
      return next;
    },
    [applyCart, resetCart],
  );

  const addItem = useCallback(
    async (merchandiseId: string, quantity = 1) => {
      const qty = Math.max(1, Math.min(99, Math.floor(quantity)));
      await withCart((id) => addCartLines(id, [{ merchandiseId, quantity: qty }]), {
        recreateIfGone: true,
      });
    },
    [withCart],
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (quantity <= 0) {
        await withCart((id) => removeCartLines(id, [lineId]), { openDrawerOnSuccess: false });
      } else {
        const qty = Math.min(99, Math.floor(quantity));
        await withCart((id) => updateCartLines(id, [{ id: lineId, quantity: qty }]), {
          openDrawerOnSuccess: false,
        });
      }
    },
    [withCart],
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      await withCart((id) => removeCartLines(id, [lineId]), { openDrawerOnSuccess: false });
    },
    [withCart],
  );

  const applyDiscount = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      await withCart(
        async (id) => {
          const previous = discountCodesRef.current.map((d) => d.code);
          const next = previous.some((c) => c.toLowerCase() === trimmed.toLowerCase())
            ? previous
            : [...previous, trimmed];
          const updated = await applyDiscountCodeAPI(id, next);
          const entry = updated.discountCodes.find(
            (d) => d.code.toLowerCase() === trimmed.toLowerCase(),
          );
          if (!entry?.applicable) {
            // Don't leave a rejected code on the cart — restore the previous list, then report it.
            const reverted = await applyDiscountCodeAPI(id, previous);
            applyCart(reverted);
            throw new Error(DISCOUNT_REJECTED_MESSAGE);
          }
          return updated;
        },
        { reportError: false, openDrawerOnSuccess: false },
      );
    },
    [withCart, applyCart],
  );

  const removeDiscount = useCallback(async () => {
    await withCart((id) => applyDiscountCodeAPI(id, []), {
      reportError: false,
      openDrawerOnSuccess: false,
    });
  }, [withCart]);

  // Re-arm the checkout button if the buyer returns via the browser back button (bfcache).
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkingOutRef.current = false;
        setIsCheckingOut(false);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Hand off to Shopify-hosted checkout. Shopify owns payment, order creation and the
  // gateways configured under Settings → Payments; this app never touches payment data.
  const openCheckout = useCallback(async () => {
    if (checkingOutRef.current) return;
    if (!count && !lines.length) return;

    checkingOutRef.current = true;
    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      // Wait for any in-flight cart mutation so checkout reflects the latest bag.
      await queueRef.current;

      let targetCartId = cartIdRef.current;
      if (!targetCartId) {
        const fresh = await ensureCart();
        applyCart(fresh);
        targetCartId = fresh.id;
      }

      // Pre-fill checkout for signed-in customers. Failure here must never block checkout.
      if (customer?.email) {
        try {
          const legacyToken = token && token !== "oauth_session_active" ? token : undefined;
          const updated = await updateCartBuyerIdentity(targetCartId, {
            email: customer.email,
            ...(legacyToken ? { customerAccessToken: legacyToken } : {}),
          });
          applyCart(updated);
        } catch (buyerErr) {
          console.warn("[cart] Could not attach buyer identity before checkout:", buyerErr);
        }
      }

      // Always use a fresh, authoritative checkout URL from Shopify.
      const freshUrl = await getFreshCheckoutUrl(targetCartId);
      const targetUrl = resolveCheckoutUrl(freshUrl, window.location.hostname);
      window.location.assign(targetUrl);
    } catch (err) {
      if (isCartGoneError(err)) resetCart();
      const msg =
        err instanceof Error ? err.message : "Unable to redirect to checkout. Please try again.";
      setCheckoutError(msg);
      checkingOutRef.current = false;
      setIsCheckingOut(false);
    }
  }, [count, lines.length, customer, token, applyCart, resetCart]);

  // Demo-cart helpers exist only so the context shape is identical in both modes.
  // Live Shopify mode never fabricates cart lines.
  const noop = useCallback(() => {}, []);

  const value: CartState = {
    lines,
    count,
    subtotal,
    total,
    checkoutUrl,
    discountCodes,
    loading,
    error,
    isCheckingOut,
    checkoutError,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    addItem,
    updateItem,
    removeItem,
    applyDiscount,
    removeDiscount,
    openCheckout,
    add: noop,
    update: noop,
    remove: noop,
    items: [],
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ─── Demo Cart Provider ────────────────────────────────────────────────────────

function DemoCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const add = (item: CartItem) => {
    if (!validateCartItem(item)) return;
    setItems((prev) => {
      const found = prev.find((p) => p.productId === item.productId && p.variant === item.variant);
      return found
        ? prev.map((p) =>
            p === found ? { ...p, quantity: Math.min(99, p.quantity + item.quantity) } : p,
          )
        : [...prev, item];
    });
    setIsDrawerOpen(true);
  };

  const remove = (id: string, variant: string) =>
    setItems((prev) => prev.filter((p) => p.productId !== id || p.variant !== variant));

  const update = (id: string, variant: string, quantity: number) => {
    if (!validateCartItem({ productId: id, variant, quantity })) return;
    setItems((prev) =>
      prev.map((p) => (p.productId === id && p.variant === variant ? { ...p, quantity } : p)),
    );
  };

  const demoLines: CartLineItem[] = items.map((item) => {
    const p = demoProducts.find((prod) => prod.id === item.productId);
    return {
      lineId: `demo-${item.productId}-${item.variant}`,
      merchandiseId: item.productId,
      productId: item.productId,
      productTitle: p?.name ?? "Jewellery Piece",
      variantTitle: item.variant,
      quantity: item.quantity,
      price: p?.price ?? 0,
      compareAtPrice: null,
      image: p?.image ?? null,
      handle: p?.slug ?? "",
      selectedOptions: [{ name: "Option", value: item.variant }],
      currencyCode: "INR",
    };
  });

  const subtotal = demoLines.reduce((acc, line) => acc + line.price * line.quantity, 0);

  const value: CartState = {
    lines: demoLines,
    count: items.reduce((n, p) => n + p.quantity, 0),
    subtotal,
    total: subtotal,
    checkoutUrl: null,
    discountCodes: [],
    loading: false,
    error: null,
    isCheckingOut: false,
    checkoutError: null,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    addItem: async () => {},
    updateItem: async () => {},
    removeItem: async () => {},
    applyDiscount: async () => {},
    removeDiscount: async () => {},
    openCheckout: async () => {},
    add,
    update,
    remove,
    items,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    if (import.meta.env.DEV) console.warn("useCart used outside CartProvider; using empty bag.");
    return emptyCart;
  }
  return context;
}
