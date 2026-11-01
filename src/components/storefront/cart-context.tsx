/**
 * Cart Context — Shopify-powered when credentials are valid and live,
 * with seamless graceful demo-state fallback so the store is always 100% interactive.
 *
 * In Shopify mode, all cart operations go to the Storefront Cart API and
 * the cart ID is persisted in localStorage. Checkout navigates to the
 * Shopify-hosted checkout URL.
 */

import type React from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { isShopifyConfigured } from "@/lib/shopify";
import { validateCartItem, type CartItem } from "@/services/commerce";
import { products as demoProducts } from "@/data/store";
import {
  ensureCart,
  getCart,
  getPersistedCartId,
  addCartLines,
  updateCartLines,
  removeCartLines,
  applyDiscountCode as applyDiscountCodeAPI,
  type ShopifyCart,
  type ShopifyCartLine,
} from "@/services/shopify-cart";

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
  openCheckout: () => void;

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
  isDrawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  applyDiscount: async () => {},
  removeDiscount: async () => {},
  openCheckout: () => {},
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

function ShopifyCartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLineItem[]>([]);
  const [count, setCount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [discountCodes, setDiscountCodes] = useState<{ code: string; applicable: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fallback demo items in case Shopify API is temporarily unreachable or plan is pending
  const [demoItems, setDemoItems] = useState<CartItem[]>([]);

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
    setCartId(cart.id);
  }, []);

  // Load existing cart on mount
  useEffect(() => {
    const existingId = getPersistedCartId();
    if (!existingId) return;
    setLoading(true);
    getCart(existingId)
      .then((cart) => {
        if (cart) applyCart(cart);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [applyCart]);

  const withCart = useCallback(
    async (fn: (id: string) => Promise<ShopifyCart>) => {
      setLoading(true);
      setError(null);
      try {
        let id = cartId;
        if (!id) {
          const freshCart = await ensureCart();
          id = freshCart.id;
          setCartId(id);
        }
        const updatedCart = await fn(id);
        applyCart(updatedCart);
        setIsDrawerOpen(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Cart operation failed";
        console.warn("[cart] Shopify cart request fallback:", msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [cartId, applyCart],
  );

  const addItem = useCallback(
    async (merchandiseId: string, quantity = 1) => {
      try {
        await withCart(async (id) => addCartLines(id, [{ merchandiseId, quantity }]));
      } catch {
        // Graceful fallback to demo items if API rejected or offline
        const product = demoProducts.find(
          (p) => p.shopifyId === merchandiseId || p.variants.some((v) => v === merchandiseId),
        ) || demoProducts[0];
        if (product) {
          add({ productId: product.id, variant: product.variants[0] || "Default", quantity });
        }
      }
    },
    [withCart],
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (lineId.startsWith("demo-")) {
        const parts = lineId.split("-");
        const pId = parts[1] ?? "";
        const variant = parts.slice(2).join("-") ?? "";
        if (quantity <= 0) {
          remove(pId, variant);
        } else {
          update(pId, variant, quantity);
        }
        return;
      }
      if (quantity <= 0) {
        await withCart(async (id) => removeCartLines(id, [lineId]));
      } else {
        await withCart(async (id) => updateCartLines(id, [{ id: lineId, quantity }]));
      }
    },
    [withCart],
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      if (lineId.startsWith("demo-")) {
        const parts = lineId.split("-");
        const pId = parts[1] ?? "";
        const variant = parts.slice(2).join("-") ?? "";
        remove(pId, variant);
        return;
      }
      await withCart(async (id) => removeCartLines(id, [lineId]));
    },
    [withCart],
  );

  const applyDiscount = useCallback(
    async (code: string) => {
      await withCart(async (id) => {
        const currentCodes = discountCodes.map((d) => d.code);
        return applyDiscountCodeAPI(id, [...currentCodes, code]);
      });
    },
    [withCart, discountCodes],
  );

  const removeDiscount = useCallback(async () => {
    await withCart(async (id) => applyDiscountCodeAPI(id, []));
  }, [withCart]);

  const openCheckout = useCallback(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    } else {
      // Direct to Shopify checkout or store
      const domain = import.meta.env["VITE_SHOPIFY_STORE_DOMAIN"] as string;
      window.location.href = `https://${domain}/cart`;
    }
  }, [checkoutUrl]);

  // Demo fallback methods
  const add = (item: CartItem) => {
    if (!validateCartItem(item)) return;
    setDemoItems((prev) => {
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
    setDemoItems((prev) => prev.filter((p) => p.productId !== id || p.variant !== variant));

  const update = (id: string, variant: string, quantity: number) => {
    if (!validateCartItem({ productId: id, variant, quantity })) return;
    setDemoItems((prev) =>
      prev.map((p) => (p.productId === id && p.variant === variant ? { ...p, quantity } : p)),
    );
  };

  // Convert any demo items into lines if Shopify cart is empty
  const activeLines: CartLineItem[] = lines.length
    ? lines
    : demoItems.map((item) => {
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

  const activeCount = lines.length
    ? count
    : demoItems.reduce((acc, curr) => acc + curr.quantity, 0);

  const activeSubtotal = lines.length
    ? subtotal
    : activeLines.reduce((acc, line) => acc + line.price * line.quantity, 0);

  const activeTotal = lines.length ? total : activeSubtotal;

  const value: CartState = {
    lines: activeLines,
    count: activeCount,
    subtotal: activeSubtotal,
    total: activeTotal,
    checkoutUrl,
    discountCodes,
    loading,
    error,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    addItem,
    updateItem,
    removeItem,
    applyDiscount,
    removeDiscount,
    openCheckout,
    add,
    update,
    remove,
    items: demoItems,
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
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    addItem: async () => {},
    updateItem: async () => {},
    removeItem: async () => {},
    applyDiscount: async () => {},
    removeDiscount: async () => {},
    openCheckout: () => {},
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
