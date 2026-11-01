import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/use-wishlist";
import { useEffect, useState } from "react";
import { commerce } from "@/services/commerce";
import { type Product } from "@/data/store";
import { ProductCard } from "@/components/storefront/product-card";
import { Loader2 } from "lucide-react";
import { pageHead } from "@/utils/page-head";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
  head: () =>
    pageHead(
      "My Wishlist | The Gold Crown",
      "View your saved jewellery pieces at The Gold Crown.",
      "/wishlist",
    ),
});

function WishlistPage() {
  const { wishlistIds, clearWishlist, count } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wishlistIds.length === 0) {
      setProducts([]);
      return;
    }
    setLoading(true);
    commerce
      .listProducts()
      .then((all) => {
        const wishlisted = all.filter((p) => wishlistIds.includes(p.id));
        setProducts(wishlisted);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [wishlistIds]);

  return (
    <div className="page-width">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>My Wishlist</span>
      </div>
      <div className="page-title">
        <p className="eyebrow text-primary">YOUR SAVED PIECES</p>
        <h1>My Wishlist</h1>
        <p>The pieces that caught your eye. Add them to your bag when you're ready.</p>
      </div>

      {loading ? (
        <div className="empty-state">
          <Loader2 size={36} className="animate-spin" />
          <p>Loading your wishlist…</p>
        </div>
      ) : count === 0 || products.length === 0 ? (
        <div className="empty-state">
          <Heart size={42} />
          <h2>Your wishlist is empty</h2>
          <p>Browse our collection and tap the heart icon to save your favourite pieces.</p>
          <Button asChild>
            <Link to="/shop">Explore the Collection</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="wishlist-toolbar">
            <p className="results-count">
              {products.length} {products.length === 1 ? "saved piece" : "saved pieces"}
            </p>
            <Button variant="ghost" size="sm" onClick={clearWishlist}>
              Clear wishlist
            </Button>
          </div>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DISCOVER MORE</p>
            <h2>Continue Exploring</h2>
          </div>
          <Link className="text-link" to="/shop">
            Shop all <Gem size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
