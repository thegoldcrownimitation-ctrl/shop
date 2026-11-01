import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, Minus, Plus, Trash2, Tag, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useCart } from "./cart-context";
import { products as demoProducts, money } from "@/data/store";
import { Button } from "@/components/ui/button";
import { isShopifyConfigured } from "@/lib/shopify";

export function CartPage() {
  if (isShopifyConfigured) {
    return <ShopifyCartPage />;
  }
  return <DemoCartPage />;
}

// ─── Shopify Cart Page ────────────────────────────────────────────────────────

function ShopifyCartPage() {
  const { lines, count, subtotal, total, checkoutUrl, discountCodes, loading, error,
    updateItem, removeItem, applyDiscount, removeDiscount, openCheckout } = useCart();
  const [discountInput, setDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  const currencyCode = lines[0]?.currencyCode ?? "INR";
  const appliedCodes = discountCodes.filter((d) => d.applicable);
  const invalidCodes = discountCodes.filter((d) => !d.applicable);

  const handleApplyDiscount = async () => {
    if (!discountInput.trim()) return;
    setApplyingDiscount(true);
    setDiscountError(null);
    try {
      await applyDiscount(discountInput.trim().toUpperCase());
      // Check if code was actually applied
      const code = discountInput.trim().toUpperCase();
      setDiscountInput("");
      // The cart will update — if code is invalid, it shows in discountCodes
      if (invalidCodes.some((c) => c.code === code)) {
        setDiscountError("Discount code is not valid or does not apply to your cart.");
      }
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : "Could not apply discount.");
    } finally {
      setApplyingDiscount(false);
    }
  };

  if (!count && !loading) {
    return (
      <div className="page-width">
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>Your Bag</span>
        </div>
        <div className="empty-state">
          <ShoppingBag size={42} />
          <h1>A little sparkle is missing</h1>
          <p>Your bag is empty. Discover something that feels like you.</p>
          <Button asChild>
            <Link to="/shop">Explore the Collection</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-width">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Your Bag</span>
      </div>
      <div className="page-title">
        <p className="eyebrow text-primary">YOUR LITTLE COLLECTION</p>
        <h1>Your Shopping Bag</h1>
      </div>

      {error && (
        <div className="cart-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading && !lines.length ? (
        <div className="empty-state">
          <Loader2 size={36} className="animate-spin" />
          <p>Loading your bag…</p>
        </div>
      ) : (
        <div className="cart-layout">
          {/* Line items */}
          <div>
            {lines.map((line) => (
              <article className="cart-item" key={line.lineId}>
                <Link to="/products/$slug" params={{ slug: line.handle }}>
                  {line.image ? (
                    <img src={line.image} alt={line.productTitle} width={100} height={125} />
                  ) : (
                    <div className="cart-item-placeholder" />
                  )}
                </Link>
                <div>
                  <Link to="/products/$slug" params={{ slug: line.handle }}>
                    <h2>{line.productTitle}</h2>
                  </Link>
                  <p>
                    {line.variantTitle !== "Default Title" ? line.variantTitle : ""}
                  </p>
                  <div className="quantity-control">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Decrease ${line.productTitle} quantity`}
                      disabled={loading || line.quantity <= 1}
                      onClick={() => line.lineId && updateItem(line.lineId, line.quantity - 1)}
                    >
                      <Minus size={14} />
                    </Button>
                    <span>{line.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Increase ${line.productTitle} quantity`}
                      disabled={loading || line.quantity >= 99}
                      onClick={() => line.lineId && updateItem(line.lineId, line.quantity + 1)}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
                <div className="cart-line-end">
                  <div className="cart-line-price">
                    <span>{money(line.price * line.quantity, line.currencyCode)}</span>
                    {line.compareAtPrice && line.compareAtPrice > line.price && (
                      <span className="cart-line-compare">{money(line.compareAtPrice * line.quantity, line.currencyCode)}</span>
                    )}
                  </div>
                  <div className="mt-5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${line.productTitle}`}
                      disabled={loading}
                      onClick={() => line.lineId && removeItem(line.lineId)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Summary */}
          <aside className="cart-total">
            <h2>Bag Summary</h2>
            <div className="total-row">
              <span>Subtotal</span>
              <span>{money(subtotal, currencyCode)}</span>
            </div>
            {total !== subtotal && (
              <div className="total-row total-row--main">
                <span>Total</span>
                <span>{money(total, currencyCode)}</span>
              </div>
            )}

            {/* Discount */}
            <div className="discount-block">
              {appliedCodes.map((code) => (
                <div key={code.code} className="discount-applied">
                  <Tag size={14} />
                  <span>{code.code}</span>
                  <button
                    aria-label={`Remove discount ${code.code}`}
                    onClick={removeDiscount}
                    className="discount-remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              {invalidCodes.map((code) => (
                <div key={code.code} className="discount-invalid">
                  <span>{code.code} — not applicable</span>
                </div>
              ))}
              <div className="discount-form">
                <input
                  className="field"
                  placeholder="Discount code"
                  value={discountInput}
                  onChange={(e) => {
                    setDiscountInput(e.target.value);
                    setDiscountError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyDiscount()}
                />
                <Button
                  variant="outline"
                  onClick={handleApplyDiscount}
                  disabled={applyingDiscount || !discountInput.trim()}
                >
                  {applyingDiscount ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                </Button>
              </div>
              {discountError && <p className="discount-error">{discountError}</p>}
            </div>

            <p className="cart-tax-note">
              Taxes and shipping are calculated at checkout.
            </p>

            <Button
              onClick={openCheckout}
              disabled={loading || !count}
              className="checkout-btn"
            >
              <ExternalLink size={16} />
              Proceed to Shopify Checkout
            </Button>

            <p className="cart-secure-note">
              Secure checkout powered by Shopify. No payment information is stored on this site.
            </p>

            <Link className="text-link mt-4" to="/shop">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}

// ─── Demo Cart Page ───────────────────────────────────────────────────────────

function DemoCartPage() {
  const { items, update, remove } = useCart();
  const total = items.reduce(
    (n, item) => n + (demoProducts.find((p) => p.id === item.productId)?.price ?? 0) * item.quantity,
    0,
  );

  if (!items.length) {
    return (
      <div className="page-width">
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>Your Bag</span>
        </div>
        <div className="empty-state">
          <ShoppingBag size={42} />
          <h2>A little sparkle is missing</h2>
          <p>Your bag is empty. Discover something that feels like you.</p>
          <Button asChild>
            <Link to="/shop">Explore the Collection</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-width">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Your Bag</span>
      </div>
      <div className="page-title">
        <p className="eyebrow text-primary">YOUR LITTLE COLLECTION</p>
        <h1>Your Shopping Bag</h1>
      </div>
      <div className="cart-layout">
        <div>
          {items.map((item) => {
            const p = demoProducts.find((p) => p.id === item.productId);
            if (!p) return null;
            return (
              <article className="cart-item" key={`${p.id}-${item.variant}`}>
                <Link to="/products/$slug" params={{ slug: p.slug }}>
                  <img src={p.image} alt={p.name} width={100} height={125} />
                </Link>
                <div>
                  <Link to="/products/$slug" params={{ slug: p.slug }}>
                    <h2>{p.name}</h2>
                  </Link>
                  <p>{item.variant}</p>
                  <div className="quantity-control">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Decrease ${p.name} quantity`}
                      disabled={item.quantity === 1}
                      onClick={() => update(p.id, item.variant, item.quantity - 1)}
                    >
                      <Minus />
                    </Button>
                    <span>{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Increase ${p.name} quantity`}
                      disabled={item.quantity === 99}
                      onClick={() => update(p.id, item.variant, item.quantity + 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
                <div className="cart-line-end">
                  <span>{money(p.price * item.quantity)}</span>
                  <div className="mt-5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => remove(p.id, item.variant)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
          <p className="gallery-note">Demo bag — no stock is reserved.</p>
        </div>
        <aside className="cart-total">
          <h2>Bag Summary</h2>
          <div className="total-row">
            <span>Subtotal</span>
            <span>{money(total)}</span>
          </div>
          <p>Connect Shopify to enable real checkout and payment.</p>
          <Button disabled>Checkout unavailable</Button>
          <Link className="text-link mt-4" to="/shop">
            Continue exploring
          </Link>
        </aside>
      </div>
    </div>
  );
}
