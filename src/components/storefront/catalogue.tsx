import { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  X,
  Gem,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Product } from "@/data/store";
import { commerce } from "@/services/commerce";
import { ProductCard } from "./product-card";

interface CatalogueProps {
  collection?: string;
  searchPage?: boolean;
}

const TITLE_MAP: Record<string, string> = {
  all: "Shop All Jewellery",
  necklaces: "Necklaces",
  earrings: "Earrings",
  bracelets: "Bracelets",
  bangles: "Bangles",
  ring: "Rings",
};

export function Catalogue({ collection, searchPage = false }: CatalogueProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(collection || "all");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("newest");
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize category state when prop changes
  useEffect(() => {
    if (collection) {
      const aliasMap: Record<string, string> = {
        "necklace-sets": "necklaces",
        "bangles-bracelets": "bracelets",
        "rings": "ring",
      };
      setActiveCategory(aliasMap[collection] ?? collection);
    } else {
      setActiveCategory("all");
    }
  }, [collection]);

  // Load all products once so category filtering is instant
  useEffect(() => {
    setLoading(true);
    setError(null);
    commerce
      .listProducts()
      .then((data) => {
        setAllProducts(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load products."))
      .finally(() => setLoading(false));
  }, []);

  // Filter and sort products
  const filtered = useMemo(() => {
    return allProducts
      .filter((p) => {
        // Category filtering
        if (activeCategory !== "all") {
          const colls = p.collections ?? [];
          const matchesColl = colls.includes(activeCategory);
          const matchesCat = p.category === activeCategory;
          const matchesTitle = p.name.toLowerCase().includes(activeCategory === "ring" ? "ring" : activeCategory);
          if (!matchesColl && !matchesCat && !matchesTitle) return false;
        }

        // In-stock filter
        if (inStockOnly && p.availableForSale === false) {
          return false;
        }

        // Price filter
        if (maxPrice && p.price > Number(maxPrice)) {
          return false;
        }

        // Search filter
        if (query.trim()) {
          const q = query.toLowerCase();
          const matches =
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            (p.collections && p.collections.some((c) => c.includes(q)));
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sort === "price-low") return a.price - b.price;
        if (sort === "price-high") return b.price - a.price;
        if (sort === "in-stock") {
          return (b.availableForSale ? 1 : 0) - (a.availableForSale ? 1 : 0);
        }
        return b.date.localeCompare(a.date);
      });
  }, [allProducts, activeCategory, maxPrice, inStockOnly, query, sort]);

  const displayTitle = searchPage
    ? "Search Jewellery"
    : TITLE_MAP[activeCategory] ?? activeCategory.replaceAll("-", " ").replace(/\\b\\w/g, (c) => c.toUpperCase());

  const hasActiveFilters =
    (activeCategory !== "all" && !collection) || !!maxPrice || inStockOnly || !!query.trim();

  const handleResetFilters = () => {
    if (!collection) {
      setActiveCategory("all");
    }
    setMaxPrice("");
    setInStockOnly(false);
    setQuery("");
    setSort("newest");
  };

  return (
    <div className="page-width catalogue pt-4 pb-16">
      {/* Search Input on Search Page */}
      {searchPage && (
        <div className="search-form max-w-md mx-auto my-6 flex gap-2">
          <input
            className="field flex-1 px-4 py-2 border rounded-md text-sm"
            aria-label="Search jewellery"
            placeholder="Search necklaces, earrings, bangles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <Button variant="ghost" size="icon" onClick={() => setQuery("")}>
              <X size={16} />
            </Button>
          )}
        </div>
      )}

      {/* Clean Toolbar: Title on left, Filters on right */}
      <div className="catalogue-toolbar flex flex-wrap items-center justify-between gap-4 py-4 border-b border-border mb-8">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
            {displayTitle}
          </h1>
          <span className="text-xs sm:text-sm text-muted-foreground font-medium">
            ({filtered.length} {filtered.length === 1 ? "piece" : "pieces"})
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-primary h-7 px-2 hover:bg-primary/10 ml-2"
            >
              Reset filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">


          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <ArrowUpDown size={14} className="text-muted-foreground" />
            <select
              className="field text-xs sm:text-sm py-1.5 px-3 border rounded bg-background"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort products"
            >
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="in-stock">Available Pieces First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Shimmer */}
      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 py-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse flex flex-col gap-3">
              <div className="w-full aspect-[4/5] bg-secondary/60 rounded-md" />
              <div className="w-3/4 h-4 bg-secondary/60 rounded" />
              <div className="w-1/2 h-3 bg-secondary/60 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="empty-state text-center py-16">
          <Gem size={42} className="mx-auto text-primary mb-3" />
          <h2 className="text-2xl font-serif mb-2">Could not load catalogue</h2>
          <p className="text-sm text-destructive max-w-md mx-auto mb-4">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      )}

      {/* Products Grid */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="product-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filtered.slice(0, limit).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {filtered.length > limit && (
            <div className="text-center mt-12">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setLimit((prev) => prev + 12)}
                className="px-8"
              >
                Load More Pieces
              </Button>
            </div>
          )}
        </>
      )}

      {/* Empty Category State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state text-center py-16 max-w-md mx-auto border border-dashed rounded-lg p-8 my-8">
          <Sparkles size={40} className="mx-auto text-primary mb-3" />
          <h2 className="font-serif text-2xl font-normal mb-2">Curating This Collection</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            New handcrafted pieces for <strong>{displayTitle}</strong> are currently arriving. In the meantime, discover our other exquisite pieces.
          </p>
          <Button asChild className="px-6">
            <Link to="/shop">Explore All Pieces</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
