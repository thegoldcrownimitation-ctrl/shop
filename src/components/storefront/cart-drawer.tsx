import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  X,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Truck,
  Sparkles,
  Loader2,
  Lock,
} from "lucide-react";
import { useCart } from "./cart-context";
import { Button } from "@/components/ui/button";
import { money } from "@/data/store";

const FREE_SHIPPING_THRESHOLD = 1999;

export function CartDrawer() {
  const {
    lines,
    count,
    subtotal,
    isDrawerOpen,
    closeDrawer,
    updateItem,
    removeItem,
    openCheckout,
    loading,
    isCheckingOut,
    checkoutError,
  } = useCart();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerOpen) {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  const currencyCode = lines[0]?.currencyCode || "INR";
  const freeShippingProgress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  const amountNeeded = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  if (!isDrawerOpen) {
    return null;
  }

  return (
    <div
      className="cart-drawer-overlay open"
      onClick={closeDrawer}
      aria-hidden="false"
    >
      <aside
        className={`cart-drawer ${isDrawerOpen ? "open" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Bag"
      >
        {/* Drawer Header */}
        <div className="cart-drawer-header">
          <div className="cart-drawer-title">
            <ShoppingBag size={20} className="text-primary" />
            <h2>Shopping Bag</h2>
            {count > 0 && <span className="cart-drawer-count">({count})</span>}
          </div>
          <button
            type="button"
            className="cart-drawer-close"
            onClick={closeDrawer}
            aria-label="Close bag"
          >
            <X size={20} />
          </button>
        </div>

        {/* Free Shipping Meter */}
        <div className="cart-drawer-shipping-meter">
          <div className="shipping-meter-text">
            {amountNeeded > 0 ? (
              <>
                <Truck size={14} className="text-primary" />
                <span>
                  Add <strong>{money(amountNeeded, currencyCode)}</strong> more for{" "}
                  <span className="text-primary font-semibold">FREE Express Delivery</span>
                </span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-primary" />
                <span className="text-primary font-semibold">
                  You've unlocked FREE Express Delivery!
                </span>
              </>
            )}
          </div>
          <div className="shipping-meter-bar">
            <div
              className="shipping-meter-fill"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Drawer Items */}
        {lines.length === 0 ? (
          <div className="cart-drawer-empty">
            <div className="empty-icon-wrapper">
              <ShoppingBag size={48} className="text-muted-foreground" />
            </div>
            <h3>Your bag is currently empty</h3>
            <p>Explore our handcrafted imitation jewellery pieces designed to make you shine.</p>
            <Button
              className="w-full mt-4"
              onClick={() => {
                closeDrawer();
              }}
              asChild
            >
              <Link to="/shop">Explore Jewellery Collection</Link>
            </Button>
          </div>
        ) : (
          <div className="cart-drawer-items">
            {lines.map((line) => (
              <div key={line.lineId || line.merchandiseId} className="cart-drawer-item">
                <Link
                  to="/products/$slug"
                  params={{ slug: line.handle }}
                  onClick={closeDrawer}
                  className="drawer-item-img-link"
                >
                  {line.image ? (
                    <img
                      src={line.image}
                      alt={line.productTitle}
                      width={80}
                      height={100}
                      className="drawer-item-img"
                    />
                  ) : (
                    <div className="drawer-item-placeholder" />
                  )}
                </Link>

                <div className="drawer-item-info">
                  <Link
                    to="/products/$slug"
                    params={{ slug: line.handle }}
                    onClick={closeDrawer}
                    className="drawer-item-title"
                  >
                    <h3>{line.productTitle}</h3>
                  </Link>

                  {line.variantTitle && line.variantTitle !== "Default Title" && (
                    <p className="drawer-item-variant">{line.variantTitle}</p>
                  )}

                  <div className="drawer-item-price-row">
                    <span className="drawer-item-price">
                      {money(line.price * line.quantity, line.currencyCode)}
                    </span>
                    {line.compareAtPrice && line.compareAtPrice > line.price && (
                      <span className="drawer-item-compare">
                        {money(line.compareAtPrice * line.quantity, line.currencyCode)}
                      </span>
                    )}
                  </div>

                  <div className="drawer-item-controls">
                    <div className="quantity-control quantity-control--sm">
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label="Decrease quantity"
                        disabled={loading || isCheckingOut || line.quantity <= 1}
                        onClick={() => line.lineId && updateItem(line.lineId, line.quantity - 1)}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="qty-value">{line.quantity}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label="Increase quantity"
                        disabled={loading || isCheckingOut || line.quantity >= 99}
                        onClick={() => line.lineId && updateItem(line.lineId, line.quantity + 1)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="drawer-item-remove"
                      aria-label="Remove item"
                      disabled={loading || isCheckingOut}
                      onClick={() => line.lineId && removeItem(line.lineId)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drawer Footer */}
        {count > 0 && (
          <div className="cart-drawer-footer">
            <div className="drawer-subtotal-row">
              <span className="drawer-subtotal-label">Subtotal</span>
              <span className="drawer-subtotal-value">{money(subtotal, currencyCode)}</span>
            </div>
            <p className="drawer-tax-note">Taxes and delivery calculated at checkout.</p>

            {checkoutError && (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: 6,
                  background: "hsl(var(--destructive) / 0.1)",
                  border: "1px solid hsl(var(--destructive) / 0.3)",
                  color: "hsl(var(--destructive))",
                  fontSize: "0.8rem",
                  marginBottom: "0.75rem",
                }}
              >
                {checkoutError}
              </div>
            )}

            <div className="drawer-action-buttons">
              <Button
                className="drawer-checkout-btn w-full"
                onClick={openCheckout}
                disabled={loading || isCheckingOut || count === 0}
              >
                {isCheckingOut ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                    <Loader2 size={16} className="animate-spin" /> Connecting to Secure Checkout...
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                    <Lock size={15} /> Proceed to Checkout <ArrowRight size={16} />
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full mt-2"
                asChild
                onClick={closeDrawer}
                disabled={isCheckingOut}
              >
                <Link to="/cart">View Full Bag</Link>
              </Button>
            </div>

            <div className="drawer-security-note" style={{ textAlign: "center", marginTop: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontSize: "0.78rem", color: "hsl(var(--muted-foreground))" }}>
                <ShieldCheck size={14} className="text-primary" />
                <span>100% Secure Checkout powered by Shopify & Razorpay</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground) / 0.8)", marginTop: "0.25rem", letterSpacing: "0.02em" }}>
                UPI (GPay, PhonePe, Paytm) • Cards • NetBanking • Wallets
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
