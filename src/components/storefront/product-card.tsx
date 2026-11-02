import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Heart, Sparkles } from "lucide-react";
import { type Product, money } from "@/data/store";
import { useWishlist } from "@/hooks/use-wishlist";
import { isShopifyConfigured } from "@/lib/shopify";

export function ProductCard({ product }: { product: Product }) {
  const { toggle, isWishlisted } = useWishlist();
  const wished = isWishlisted(product.id);
  const currencyCode = product.detail?.currencyCode ?? "INR";
  const compareAtPrice = product.detail?.compareAtPrice;
  const isOnSale = compareAtPrice && compareAtPrice > product.price;
  const isAvailable = product.availableForSale !== false;

  const displayCategory =
    product.category && product.category !== "uncategorised"
      ? product.category.replaceAll("-", " ")
      : "Jewellery";

  return (
    <article className="product-card group relative flex flex-col justify-between">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="product-photo block relative overflow-hidden rounded-md bg-secondary/30">
        <img
          src={product.image}
          alt={product.name}
          width={1024}
          height={1280}
          loading="lazy"
          className="w-full aspect-[4/5] object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {isOnSale && (
          <span className="product-tag sale-tag">SALE</span>
        )}
        {!isAvailable && (
          <span className="product-tag sold-tag">OUT OF STOCK</span>
        )}
        <span className="product-arrow">
          <ArrowUpRight size={18} />
        </span>
      </Link>

      <div className="product-info pt-3">
        <p className="product-category uppercase text-[10px] tracking-wider text-muted-foreground font-semibold">
          {displayCategory}
        </p>
        <Link to="/products/$slug" params={{ slug: product.slug }}>
          <h3 className="font-serif text-base sm:text-lg font-medium text-foreground line-clamp-1 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <div className="product-price-row mt-1 flex items-baseline gap-2">
          <span className="product-price text-sm sm:text-base font-semibold text-primary">
            {money(product.price, currencyCode)}
          </span>
          {isOnSale && compareAtPrice && (
            <span className="product-compare-price text-xs line-through text-muted-foreground">
              {money(compareAtPrice, currencyCode)}
            </span>
          )}
        </div>
      </div>

      <button
        className={`wishlist-btn ${wished ? "wished" : ""}`}
        aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(product);
        }}
      >
        <Heart size={16} fill={wished ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
