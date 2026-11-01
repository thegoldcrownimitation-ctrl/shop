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

  if (!isDrawerOpen) return null;

  const currencyCode = lines[0]?.currencyCode ?? "INR";
  const progressPercent = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  const diffToFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <div className="cart-drawer-overlay" onClick={closeDrawer} role="dialog" aria-modal="true">
      <aside
        className="cart-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Shopping bag drawer"
      >
        {/* Drawer Header */}
        <div className="cart-drawer-header">
          <div className="cart-drawer-title">
            <ShoppingBag size={20} className="text-primary" />
            <h2>Your Shopping Bag</h2>
            <span className="cart-count-badge">({count})</span>
          </div>
          <button
            className="cart-drawer-close"
            onClick={closeDrawer}
            aria-label="Close bag drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Free Shipping Motivator */}
        <div className="shipping-progress-banner">
          <div className="shipping-banner-text">
            <Truck size={15} />
            {diffToFree === 0 ? (
              <span>
                <strong>Complimentary shipping unlocked!</strong> Delivery is on us.
              </span>
            ) : (
              <span>
                Add <strong>{money(diffToFree, currencyCode)}</strong> more to get{" "}
                <strong>Free Delivery</strong>
              </span>
            )}
          </div>
          <div className="shipping-progress-track">
            <div
              className="shipping-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Drawer Items List */}
        {count === 0 ? (
          <div className="cart-drawer-empty">
            <div className="empty-icon-wrap">
              <ShoppingBag size={44} strokeWidth={1.5} />
            </div>
            <h3>Your bag is waiting</h3>
            <p>Explore our handcrafted imitation jewellery collections and discover something magical.</p>
            <Button
              className="mt-4"
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
                        disabled={loading || line.quantity <= 1}
                        onClick={() => line.lineId && updateItem(line.lineId, line.quantity - 1)}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="qty-value">{line.quantity}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label="Increase quantity"
                        disabled={loading || line.quantity >= 99}
                        onClick={() => line.lineId && updateItem(line.lineId, line.quantity + 1)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="drawer-item-remove"
                      aria-label="Remove item"
                      disabled={loading}
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

            <div className="drawer-action-buttons">
              <Button
                className="drawer-checkout-btn w-full"
                onClick={() => {
                  closeDrawer();
                  openCheckout();
                }}
                disabled={loading}
              >
                Proceed to Checkout <ArrowRight size={16} />
              </Button>

              <Button
                variant="outline"
                className="w-full mt-2"
                asChild
                onClick={closeDrawer}
              >
                <Link to="/cart">View Full Bag</Link>
              </Button>
            </div>

            <div className="drawer-security-note">
              <ShieldCheck size={14} />
              <span>Secure checkout powered by Shopify</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
