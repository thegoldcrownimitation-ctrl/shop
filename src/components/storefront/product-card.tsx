import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Heart } from "lucide-react";
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

  return (
    <article className="product-card">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="product-photo">
        <img
          src={product.image}
          alt={product.name}
          width={1024}
          height={1280}
          loading="lazy"
        />
        {!isShopifyConfigured && (
          <span className="product-tag">DEMO</span>
        )}
        {isShopifyConfigured && isOnSale && (
          <span className="product-tag sale-tag">SALE</span>
        )}
        {isShopifyConfigured && !isAvailable && (
          <span className="product-tag sold-tag">SOLD OUT</span>
        )}
        <span className="product-arrow">
          <ArrowUpRight size={19} />
        </span>
      </Link>
      <div className="product-info">
        <p className="product-category">{product.category.replaceAll("-", " ")}</p>
        <Link to="/products/$slug" params={{ slug: product.slug }}>
          <h3>{product.name}</h3>
        </Link>
        <div className="product-price-row">
          <span className="product-price">{money(product.price, currencyCode)}</span>
          {isOnSale && compareAtPrice && (
            <span className="product-compare-price">{money(compareAtPrice, currencyCode)}</span>
          )}
          {!isShopifyConfigured && (
            <span className="sample-price">sample price</span>
          )}
        </div>
      </div>
      <button
        className={`wishlist-btn ${wished ? "wished" : ""}`}
        aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        onClick={(e) => {
          e.preventDefault();
          toggle(product);
        }}
      >
        <Heart size={16} fill={wished ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
