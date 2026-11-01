import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, X, Loader2, ArrowRight, Sparkles, Gem } from "lucide-react";
import { commerce } from "@/services/commerce";
import { type Product, money } from "@/data/store";

interface PredictiveSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const TRENDING_TAGS = [
  "Necklace Set",
  "Kundan",
  "Jhumkas",
  "Bridal",
  "Bangles",
  "Earrings",
  "Meenakari",
];

export function PredictiveSearchModal({ isOpen, onClose }: PredictiveSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setResults([]);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      commerce
        .searchProducts(trimmed)
        .then((items) => {
          setResults(items);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onClose();
    navigate({ to: "/search" });
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="search-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Search header / input */}
        <form onSubmit={handleSubmit} className="search-modal-header">
          <Search size={22} className="search-icon-decor" />
          <input
            ref={inputRef}
            type="search"
            className="search-modal-input"
            placeholder="Search jewellery, necklace sets, earrings, bangles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <Loader2 size={18} className="animate-spin text-muted" />}
          {query && !loading && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            className="search-close-btn"
            onClick={onClose}
            aria-label="Close search"
          >
            Esc
          </button>
        </form>

        {/* Modal body */}
        <div className="search-modal-body">
          {/* Trending suggestions when no query */}
          {!query.trim() && (
            <div className="search-suggestions-block">
              <div className="search-suggestions-title">
                <Sparkles size={15} />
                <span>Popular Searches</span>
              </div>
              <div className="search-tag-pills">
                {TRENDING_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="search-tag-pill"
                    onClick={() => setQuery(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live search results */}
          {query.trim().length > 0 && (
            <div className="search-results-block">
              {loading && results.length === 0 ? (
                <div className="search-loading-state">
                  <Loader2 size={28} className="animate-spin" />
                  <p>Searching collections…</p>
                </div>
              ) : results.length > 0 ? (
                <>
                  <div className="search-results-header">
                    <span>
                      {results.length} {results.length === 1 ? "result" : "results"} for "{query}"
                    </span>
                    <button
                      type="button"
                      className="view-all-results-link"
                      onClick={() => {
                        onClose();
                        navigate({ to: "/search" });
                      }}
                    >
                      View all in catalogue <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="search-results-grid">
                    {results.slice(0, 6).map((product) => {
                      const currencyCode = product.detail?.currencyCode ?? "INR";
                      return (
                        <Link
                          key={product.id}
                          to="/products/$slug"
                          params={{ slug: product.slug }}
                          onClick={onClose}
                          className="search-result-item"
                        >
                          <img
                            src={product.image}
                            alt={product.name}
                            width={70}
                            height={88}
                            className="search-result-thumb"
                          />
                          <div className="search-result-info">
                            <span className="search-result-cat">
                              {product.category.replaceAll("-", " ")}
                            </span>
                            <h4>{product.name}</h4>
                            <span className="search-result-price">
                              {money(product.price, currencyCode)}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="search-empty-state">
                  <Gem size={32} />
                  <h3>No matching pieces found</h3>
                  <p>We couldn't find anything matching "{query}". Try checking your spelling or search by category.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
