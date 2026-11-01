import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { SlidersHorizontal, Search, X, Gem, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categories, type Product } from "@/data/store";
import { commerce } from "@/services/commerce";
import { ProductCard } from "./product-card";

interface CatalogueProps {
  collection?: string;
  searchPage?: boolean;
}

export function Catalogue({ collection, searchPage = false }: CatalogueProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [limit, setLimit] = useState(12);
  const [filters, setFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);

  // Fetch products (from collection if specified, otherwise all)
  useEffect(() => {
    setLoading(true);
    setError(null);
    setLimit(12);

    if (collection && collection !== "new-arrivals" && collection !== "bridal-festive") {
      // Try to load a Shopify collection by handle first
      commerce
        .getCollectionProducts(collection)
        .then((result): Promise<void> | void => {
          if (result) {
            setProducts(result.products);
            if (result.title && result.title !== collection) {
              setCollectionTitle(result.title);
            }
          } else {
            // Fall back to filtering all products by category
            return commerce.listProducts().then((all) => {
              setProducts(all.filter((p) => p.category === collection));
            });
          }
        })
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false));
    } else {
      commerce
        .listProducts()
        .then((data) => setProducts(data))
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false));
    }
  }, [collection]);

  // Handle search with debounce
  useEffect(() => {
    if (!searchPage || !query.trim()) return;
    const timer = setTimeout(() => {
      setLoading(true);
      commerce
        .searchProducts(query)
        .then((results) => {
          setProducts(results);
          setLimit(12);
        })
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query, searchPage]);

  const current = categories.find((c) => c.slug === collection);
  const title = searchPage
    ? "Find Your Sparkle"
    : collection === "new-arrivals"
      ? "New Arrivals"
      : collectionTitle ??
        (collection === "bridal-festive" ? "Bridal & Festive" : (current?.name ?? "All Jewellery"));

  const filtered = products
    .filter((p) => {
      if (collection === "bridal-festive" && !p.festive) return false;
      if (category !== "all" && p.category !== category) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      if (searchPage && query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) =>
      sort === "price-low"
        ? a.price - b.price
        : sort === "price-high"
          ? b.price - a.price
          : b.date.localeCompare(a.date),
    );

  return (
    <div className="page-width catalogue">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>{title}</span>
      </div>
      <div className="page-title">
        <p className="eyebrow text-primary">THE GOLD CROWN COLLECTIONS</p>
        <h1>{title}</h1>
        <p>A little tradition, a little expression. Find the piece that feels like you.</p>
      </div>
      {searchPage && (
        <form className="search-form" onSubmit={(e) => e.preventDefault()}>
          <input
            className="field"
            aria-label="Search products"
            placeholder="Search necklace sets, earrings, bangles…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(12);
            }}
          />
          <Button type="submit" size="icon" aria-label="Submit search">
            <Search />
          </Button>
        </form>
      )}
      {loading && (
        <div className="empty-state">
          <Loader2 size={36} className="animate-spin" />
          <p>Loading products…</p>
        </div>
      )}
      {error && (
        <div className="empty-state">
          <Gem size={36} />
          <h2>Could not load products</h2>
          <p style={{ color: "var(--destructive)", fontSize: "0.85rem", maxWidth: "40ch" }}>{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      )}
      {!loading && !error && (
        <div className="catalogue-toolbar">
          <Button className="mobile-filter-button" variant="ghost" onClick={() => setFilters(true)}>
            <SlidersHorizontal />
            Filters
          </Button>
          <div className={`filter-controls ${filters ? "filter-open" : ""}`}>
            <Button
              className="mobile-filter-button"
              variant="ghost"
              aria-label="Close filters"
              onClick={() => setFilters(false)}
            >
              <X />
              Close
            </Button>
            {!searchPage && (
              <select
                className="field"
                aria-label="Filter by category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setLimit(12);
                }}
              >
                <option value="all">All categories</option>
                {categories
                  .filter((c) => c.slug !== "bridal-festive")
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
              </select>
            )}
            <input
              className="field"
              type="number"
              min="0"
              placeholder="Max price (₹)"
              aria-label="Maximum price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
            <Button
              variant="link"
              onClick={() => {
                setCategory("all");
                setMaxPrice("");
                setQuery("");
                setSort("newest");
              }}
            >
              Reset
            </Button>
          </div>
          <select
            className="field sort-field"
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </div>
      )}
      {!loading && !error && (
        <>
          <p className="results-count">
            {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
          </p>
          {filtered.length ? (
            <>
              <div className="product-grid">
                {filtered.slice(0, limit).map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {filtered.length > limit && (
                <div className="load-more">
                  <Button variant="outline" onClick={() => setLimit((n) => n + 12)}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Gem size={36} />
              <h2>
                {collection === "rings"
                  ? "The next chapter is coming"
                  : searchPage && query
                    ? "No results found"
                    : "No pieces found"}
              </h2>
              <p>
                {collection === "rings"
                  ? "Our rings collection is being curated."
                  : searchPage && query
                    ? `We couldn't find anything for "${query}". Try a different search.`
                    : "Try adjusting your filters."}
              </p>
              <Button asChild variant="outline">
                <Link to="/shop">Explore all jewellery</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
