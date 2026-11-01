import { useState, useEffect, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Check, Gem, Heart, Loader2, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/data/store";
import { commerce } from "@/services/commerce";
import { isShopifyConfigured } from "@/lib/shopify";
import { useCart } from "./cart-context";
import { ProductCard } from "./product-card";
import { useWishlist } from "@/hooks/use-wishlist";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import type { Product } from "@/data/store";

export function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null | undefined>(undefined); // undefined = loading
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [imageIdx, setImageIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const { addItem, add, loading: cartLoading } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const { recentIds, track } = useRecentlyViewed();
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);

  // Load product
  useEffect(() => {
    setProduct(undefined);
    setAdded(false);
    setSelectedVariantIdx(0);
    setImageIdx(0);

    commerce
      .getProduct(slug)
      .then((p) => {
        setProduct(p);
        if (p) {
          // Track recently viewed
          track(p);
          // Load recommendations
          if (p.shopifyId) {
            commerce.getProductRecommendations(p.shopifyId).then(setRecommendations).catch(() => {});
          }
        }
      })
      .catch(() => setProduct(null));
  }, [slug, track]);

  // Load recently viewed products (excluding the current one)
  useEffect(() => {
    if (recentIds.length === 0) return;
    commerce.listProducts().then((all) => {
      const viewed = recentIds
        .filter((id) => product?.id !== id)
        .map((id) => all.find((p) => p.id === id))
        .filter((p): p is Product => !!p)
        .slice(0, 4);
      setRecentProducts(viewed);
    }).catch(() => {});
  }, [recentIds, product]);

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    setAdding(true);
    setAddError(null);

    if (isShopifyConfigured && product.detail) {
      const variants = product.detail.variants;
      const selectedVariant = variants[selectedVariantIdx];
      if (!selectedVariant) {
        setAddError("Please select a variant.");
        setAdding(false);
        return;
      }
      try {
        await addItem(selectedVariant.id, quantity);
        setAdded(true);
        setTimeout(() => setAdded(false), 4000);
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Could not add to bag. Please try again.");
      }
    } else {
      // Demo mode
      const variant = product.variants[selectedVariantIdx] ?? product.variants[0] ?? "Default";
      add({ productId: product.id, variant, quantity });
      setAdded(true);
      setTimeout(() => setAdded(false), 4000);
    }
    setAdding(false);
  }, [product, selectedVariantIdx, quantity, addItem, add]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (product === undefined) {
    return (
      <div className="empty-state">
        <Loader2 size={36} className="animate-spin" />
        <p>Loading product…</p>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!product) {
    return (
      <div className="empty-state">
        <Gem size={40} />
        <h1 className="font-display text-4xl">Piece not found</h1>
        <p>This product is not in our current collection.</p>
        <Button asChild>
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    );
  }

  const detail = product.detail;
  const images = detail?.images ?? [product.image];
  const currentImage = images[imageIdx] ?? product.image;
  const variants = detail?.variants ?? [];
  const selectedVariant = variants[selectedVariantIdx];
  const currencyCode = detail?.currencyCode ?? "INR";

  const price = selectedVariant?.price ?? product.price;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? detail?.compareAtPrice;
  const isOnSale = compareAtPrice && compareAtPrice > price;
  const isAvailable = selectedVariant
    ? selectedVariant.availableForSale
    : (product.availableForSale !== false);

  const options = detail?.options ?? [];
  const wished = isWishlisted(product.id);

  return (
    <div className="page-width">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/shop">Shop</Link>
        <span>/</span>
        <span>{product.name}</span>
      </div>
      <div className="product-detail">
        {/* ── Gallery ──────────────────────────────────────────────────── */}
        <div>
          <div className="detail-image" onClick={() => setZoomed(true)} style={{ cursor: "zoom-in" }}>
            <img
              src={currentImage}
              alt={product.name}
              width={1024}
              height={1280}
              key={currentImage}
            />
            <button className="zoom-hint" aria-label="Zoom image">
              <ZoomIn size={18} />
            </button>
            {images.length > 1 && (
              <>
                <button
                  className="gallery-prev"
                  aria-label="Previous image"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageIdx((i) => (i === 0 ? images.length - 1 : i - 1));
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="gallery-next"
                  aria-label="Next image"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageIdx((i) => (i === images.length - 1 ? 0 : i + 1));
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="thumbnail-row">
              {images.map((img, i) => (
                <button
                  key={img}
                  aria-label={`View image ${i + 1}`}
                  className={i === imageIdx ? "thumb-active" : ""}
                  onClick={() => setImageIdx(i)}
                >
                  <img src={img} alt={`${product.name} view ${i + 1}`} width={65} height={80} />
                </button>
              ))}
            </div>
          )}
          {!isShopifyConfigured && (
            <p className="gallery-note">
              Illustrative image. Approved product photographs are required before launch.
            </p>
          )}
        </div>

        {/* ── Product copy ────────────────────────────────────────────── */}
        <div className="detail-copy">
          <p className="eyebrow text-primary">
            THE GOLD CROWN · {product.category.replaceAll("-", " ").toUpperCase()}
          </p>
          <h1>{product.name}</h1>

          {/* Price */}
          <div className="detail-price-block">
            <span className="detail-price">{money(price, currencyCode)}</span>
            {isOnSale && compareAtPrice && (
              <span className="detail-compare-price">{money(compareAtPrice, currencyCode)}</span>
            )}
            {isOnSale && <span className="sale-badge">SALE</span>}
          </div>

          {!isShopifyConfigured && (
            <p className="demo-note">
              Sample price — not a live offer. Connect Shopify to display real pricing.
            </p>
          )}

          {/* Availability */}
          {isShopifyConfigured && !isAvailable && (
            <p className="sold-out-note">Currently out of stock</p>
          )}

          {/* Options / Variants */}
          {isShopifyConfigured && options.length > 0 ? (
            <div className="options-block">
              {options.map((opt, optIdx) => {
                // Get values that exist for this option across all variants
                const values = [...new Set(variants.map((v) => {
                  const so = v.selectedOptions.find((o) => o.name === opt.name);
                  return so?.value ?? "";
                }).filter(Boolean))];

                const currentVal = selectedVariant?.selectedOptions.find((o) => o.name === opt.name)?.value;

                return (
                  <div key={optIdx} className="option-group">
                    <label className="option-label">
                      {opt.name}: <strong>{currentVal}</strong>
                    </label>
                    <div className="option-pills">
                      {values.map((val) => {
                        // Find variant that matches all current selections but with this value
                        const matchingVariant = variants.find((v) => {
                          const thisOptMatch = v.selectedOptions.some((o) => o.name === opt.name && o.value === val);
                          if (!thisOptMatch) return false;
                          // All other options must match current selections
                          return v.selectedOptions.every((o) => {
                            if (o.name === opt.name) return true;
                            const curr = selectedVariant?.selectedOptions.find((s) => s.name === o.name);
                            return !curr || curr.value === o.value;
                          });
                        });

                        const variantIdx = matchingVariant ? variants.indexOf(matchingVariant) : -1;
                        const available = matchingVariant?.availableForSale ?? false;
                        const isSelected = currentVal === val;

                        return (
                          <button
                            key={val}
                            className={`option-pill ${isSelected ? "selected" : ""} ${!available ? "unavailable" : ""}`}
                            onClick={() => variantIdx >= 0 && setSelectedVariantIdx(variantIdx)}
                            aria-label={`${opt.name}: ${val}${!available ? " (unavailable)" : ""}`}
                            aria-pressed={isSelected}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : !isShopifyConfigured && product.variants.length > 0 ? (
            <label className="variant-field">
              {product.variants.length > 1 ? "Options" : "Variant"}
              <select
                className="field"
                value={selectedVariantIdx}
                onChange={(e) => {
                  setSelectedVariantIdx(Number(e.target.value));
                  setAdded(false);
                }}
              >
                {product.variants.map((v, i) => (
                  <option key={v} value={i}>{v}</option>
                ))}
              </select>
            </label>
          ) : null}

          {/* Quantity + Add to bag */}
          <div className="add-row">
            <div className="quantity-control">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Decrease quantity"
                disabled={quantity <= 1 || adding || cartLoading}
                onClick={() => setQuantity((n) => n - 1)}
              >
                <Minus size={14} />
              </Button>
              <span aria-live="polite">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Increase quantity"
                disabled={quantity >= 99 || adding || cartLoading}
                onClick={() => setQuantity((n) => n + 1)}
              >
                <Plus size={14} />
              </Button>
            </div>
            <Button
              onClick={handleAddToCart}
              disabled={adding || cartLoading || (isShopifyConfigured && !isAvailable)}
            >
              {adding || cartLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShoppingBag size={16} />
              )}
              {!isAvailable && isShopifyConfigured ? "Out of Stock" : "Add to Bag"}
            </Button>
            <button
              className={`detail-wishlist-btn ${wished ? "wished" : ""}`}
              aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
              onClick={() => toggle(product)}
            >
              <Heart size={20} fill={wished ? "currentColor" : "none"} />
            </button>
          </div>

          {added && (
            <p className="added-message" role="status">
              <Check size={16} />
              Added to your bag.{" "}
              <Link className="underline" to="/cart">
                View bag
              </Link>
            </p>
          )}

          {addError && (
            <p className="error-message" role="alert">
              {addError}
            </p>
          )}

          {/* Description */}
          {detail?.description && isShopifyConfigured && (
            <div className="product-description">
              <p>{detail.description}</p>
            </div>
          )}

          <details>
            <summary>Jewellery care</summary>
            <p>
              Store jewellery separately in a dry place, handle gently, and avoid direct contact
              with perfume, moisture and cleaning chemicals.
            </p>
          </details>
          <details>
            <summary>Shipping &amp; returns</summary>
            <p>
              {isShopifyConfigured
                ? "Shipping rates and estimated delivery times are shown at checkout. Please review our "
                : "Shipping details are awaiting configuration. Visit our "}
              <Link className="underline" to="/policies/shipping">
                shipping policy
              </Link>
              {" and "}
              <Link className="underline" to="/policies/returns">
                returns policy
              </Link>
              .
            </p>
          </details>
        </div>
      </div>

      {/* ── Recommendations ──────────────────────────────────────────────── */}
      {(recommendations.length > 0 || !isShopifyConfigured) && (
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ANOTHER LITTLE SPARKLE</p>
              <h2>You May Also Love</h2>
            </div>
          </div>
          <div className="product-grid">
            {(recommendations.length > 0 ? recommendations : []).slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── Recently Viewed ──────────────────────────────────────────────── */}
      {recentProducts.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR LITTLE HISTORY</p>
              <h2>Recently Viewed</h2>
            </div>
          </div>
          <div className="product-grid">
            {recentProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── Zoom overlay ─────────────────────────────────────────────────── */}
      {zoomed && (
        <div
          className="zoom-overlay"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-label="Zoomed product image"
        >
          <img src={currentImage} alt={product.name} />
          <button className="zoom-close" aria-label="Close zoom" onClick={() => setZoomed(false)}>×</button>
        </div>
      )}
    </div>
  );
}
