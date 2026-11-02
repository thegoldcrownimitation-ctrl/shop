import { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  SlidersHorizontal,
  Search,
  X,
  Gem,
  Loader2,
  Sparkles,
  Check,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { categories, type Product } from "@/data/store";
import { commerce } from "@/services/commerce";
import { ProductCard } from "./product-card";

interface CatalogueProps {
  collection?: string;
  searchPage?: boolean;
}

// Category tabs available for smooth filtering
const CATEGORY_TABS = [
  { id: "all", name: "All Pieces", slug: "all" },
  { id: "necklaces", name: "Necklaces", slug: "necklaces" },
  { id: "earrings", name: "Earrings", slug: "earrings" },
  { id: "bracelets", name: "Bracelets", slug: "bracelets" },
  { id: "bangles", name: "Bangles", slug: "bangles" },
  { id: "ring", name: "Rings", slug: "ring" },
  { id: "bridal-festive", name: "Bridal & Festive", slug: "bridal-festive" },
];

export function Catalogue({ collection, searchPage = false }: CatalogueProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(collection || "all");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("newest");
  const [limit, setLimit] = useState(12);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);

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

  // Load all products once so category switches are instant and smooth
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
          if (activeCategory === "bridal-festive") {
            if (!p.festive) return false;
          } else {
            const colls = p.collections ?? [];
            const matchesColl = colls.includes(activeCategory);
            const matchesCat = p.category === activeCategory;
            const matchesTitle = p.name.toLowerCase().includes(activeCategory === "ring" ? "ring" : activeCategory);
            if (!matchesColl && !matchesCat && !matchesTitle) return false;
          }
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

  const currentTab = CATEGORY_TABS.find((t) => t.slug === activeCategory);
  const displayTitle = searchPage
    ? "Search Jewellery"
    : currentTab?.name ?? "All Jewellery";

  const hasActiveFilters =
    activeCategory !== "all" || !!maxPrice || inStockOnly || !!query.trim();

  const handleResetFilters = () => {
    setActiveCategory("all");
    setMaxPrice("");
    setInStockOnly(false);
    setQuery("");
    setSort("newest");
  };

  return (
    <div className="page-width catalogue">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/shop">Shop</Link>
        {activeCategory !== "all" && (
          <>
            <span>/</span>
            <span>{displayTitle}</span>
          </>
        )}
      </div>

      {/* Header */}
      <div className="page-title text-center max-w-2xl mx-auto mb-8">
        <p className="eyebrow text-primary tracking-widest uppercase font-semibold text-xs mb-2">
          THE GOLD CROWN COLLECTION
        </p>
        <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight text-foreground mb-3">
          {displayTitle}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-light">
          Imitation jewellery crafted with timeless devotion. Perfect for weddings, festivities, and everyday royal elegance.
        </p>
      </div>

      {/* Category Pills Bar */}
      {!searchPage && (
        <div className="category-pills-container mb-8 overflow-x-auto pb-2 scrollbar-none">
          <div className="flex items-center gap-2 justify-start sm:justify-center min-w-max px-2">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.slug;
              return (
                <button
                  key={tab.slug}
                  onClick={() => {
                    setActiveCategory(tab.slug);
                    setLimit(12);
                  }}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm scale-105"
                      : "bg-secondary/70 hover:bg-secondary text-foreground hover:scale-102 border border-border/50"
                  }`}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Input on Search Page */}
      {searchPage && (
        <div className="search-form max-w-md mx-auto mb-8 flex gap-2">
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

      {/* Toolbar: Filter & Sorting */}
      <div className="catalogue-toolbar flex flex-wrap items-center justify-between gap-4 py-4 border-y border-border mb-8">
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm text-muted-foreground font-medium">
            Showing <strong className="text-foreground">{filtered.length}</strong> {filtered.length === 1 ? "piece" : "pieces"}
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-primary h-7 px-2 hover:bg-primary/10"
            >
              Reset filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Price Filter */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Max:</span>
            <input
              type="number"
              placeholder="₹ Any"
              className="w-24 px-2 py-1 text-xs border rounded bg-background"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

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
          <Button onClick={handleResetFilters} className="px-6">
            Explore All Pieces
          </Button>
        </div>
      )}
    </div>
  );
}
