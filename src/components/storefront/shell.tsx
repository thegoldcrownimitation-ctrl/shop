import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Crown,
  Search,
  ShoppingBag,
  Menu,
  X,
  Instagram,
  ArrowUpRight,
  Heart,
  User,
  Package,
  MapPin,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-context";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCustomer } from "./customer-context";
import { PredictiveSearchModal } from "./predictive-search";
import { brand, categories } from "@/data/store";
import { isShopifyConfigured } from "@/lib/shopify";
import logo from "@/assets/logo.png.asset.json";

const Nav = () => (
  <>
    <Link to="/">Home</Link>
    <Link to="/collections/$slug" params={{ slug: "new-arrivals" }}>
      New Arrivals
    </Link>
    <Link to="/shop">Shop All</Link>
    {categories.map((c) => (
      <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }}>
        {c.name}
        {c.slug === "bridal-festive" ? " Jewellery" : ""}
      </Link>
    ))}
    <Link to="/about">About Us</Link>
  </>
);

export function Header() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { count, openDrawer } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { customer, logout } = useCustomer();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="announcement">{brand.announcement}</div>
      <header className="site-header">
        <div className="header-main page-width">
          <div className="header-note">
            <Crown size={15} />
            <span>Curated imitation jewellery</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          <Link to="/" className="brand-logo">
            <img src={logo.url} alt="The Gold Crown logo" width={54} height={54} />
            <span>
              THE GOLD CROWN<small>IMITATION JEWELLERY</small>
            </span>
          </Link>
          <div className="header-actions">
            {/* Predictive live search trigger */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search jewellery"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={20} />
            </Button>

            {/* Wishlist */}
            <Button variant="ghost" size="icon" asChild style={{ position: "relative" }}>
              <Link to="/wishlist" aria-label={`Wishlist, ${wishlistCount} items`}>
                <Heart size={20} />
                {wishlistCount > 0 && <span className="bag-count">{wishlistCount}</span>}
              </Link>
            </Button>

            {/* Customer Account / Dropdown */}
            {customer ? (
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    fontWeight: 500,
                  }}
                  aria-label={`Customer account: ${customer.firstName || customer.displayName}`}
                >
                  <User size={18} />
                  <span className="hidden md:inline text-xs">
                    {customer.firstName || customer.displayName || "Account"}
                  </span>
                  <ChevronDown size={14} />
                </Button>

                {dropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: "6px",
                      width: "220px",
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                      zIndex: 50,
                      padding: "6px 0",
                    }}
                  >
                    <div style={{ padding: "8px 16px", borderBottom: "1px solid hsl(var(--border))" }}>
                      <div style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
                        Signed in as
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {customer.email || customer.displayName}
                      </div>
                    </div>

                    <Link
                      to="/account"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 16px",
                        fontSize: "13px",
                        color: "hsl(var(--foreground))",
                        textDecoration: "none",
                      }}
                    >
                      <User size={15} /> My Account
                    </Link>

                    <Link
                      to="/account"
                      onClick={() => {
                        setDropdownOpen(false);
                        if (typeof window !== "undefined") {
                          window.location.href = "/account?tab=orders";
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 16px",
                        fontSize: "13px",
                        color: "hsl(var(--foreground))",
                        textDecoration: "none",
                      }}
                    >
                      <Package size={15} /> My Orders
                    </Link>

                    <Link
                      to="/account"
                      onClick={() => {
                        setDropdownOpen(false);
                        if (typeof window !== "undefined") {
                          window.location.href = "/account?tab=addresses";
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 16px",
                        fontSize: "13px",
                        color: "hsl(var(--foreground))",
                        textDecoration: "none",
                      }}
                    >
                      <MapPin size={15} /> My Addresses
                    </Link>

                    <div style={{ borderTop: "1px solid hsl(var(--border))", marginTop: "4px", paddingTop: "4px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          width: "100%",
                          padding: "10px 16px",
                          fontSize: "13px",
                          color: "hsl(var(--destructive))",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <LogOut size={15} /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button variant="ghost" size="icon" asChild style={{ position: "relative" }}>
                <Link to="/login" aria-label="Customer Account, Sign in">
                  <User size={20} />
                </Link>
              </Button>
            )}

            {/* Shopping Bag / Cart Drawer */}
            <Button
              variant="ghost"
              size="icon"
              style={{ position: "relative" }}
              aria-label={`Shopping bag, ${count} items`}
              onClick={openDrawer}
            >
              <ShoppingBag size={20} />
              {count > 0 && <span className="bag-count">{count}</span>}
            </Button>
          </div>
        </div>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Nav />
        </nav>
      </header>

      {/* Predictive Search Modal */}
      <PredictiveSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile Drawer */}
      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <aside
            className="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
          >
            <div className="drawer-heading">
              <span className="font-display text-2xl">The Gold Crown</span>
              <Button
                autoFocus
                variant="ghost"
                size="icon"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <nav onClick={() => setOpen(false)}>
              <Nav />
              <div className="mobile-drawer-account-section">
                {customer ? (
                  <>
                    <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>Signed in as:</span>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>
                        {customer.firstName || customer.displayName || customer.email}
                      </div>
                    </div>
                    <Link to="/account">
                      <User size={16} />
                      <span>My Account Overview</span>
                    </Link>
                    <a href="/account?tab=orders" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Package size={16} />
                      <span>My Orders ({customer.orders?.length || 0})</span>
                    </a>
                    <a href="/account?tab=addresses" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <MapPin size={16} />
                      <span>My Addresses ({customer.addresses?.length || 0})</span>
                    </a>
                    <button
                      type="button"
                      onClick={logout}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: "none",
                        border: "none",
                        color: "var(--destructive)",
                        padding: "8px 0",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login">
                      <User size={16} />
                      <span>Sign In</span>
                    </Link>
                    <Link to="/register">
                      <Crown size={16} />
                      <span>Create Account</span>
                    </Link>
                  </>
                )}
                <Link to="/wishlist" style={{ marginTop: "8px" }}>
                  <Heart size={16} />
                  <span>My Wishlist ({wishlistCount})</span>
                </Link>
              </div>
            </nav>
            <p className="eyebrow mt-8">Where every look deserves a crown.</p>
          </aside>
        </div>
      )}
    </>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-width footer-grid">
        <div>
          <Crown className="text-gold mb-4" size={30} />
          <h2>THE GOLD CROWN</h2>
          <p>Where Every Look Deserves a Crown.</p>
          <a href={brand.instagram} target="_blank" rel="noreferrer" className="social-link">
            <Instagram size={18} /> Follow our story <ArrowUpRight size={16} />
          </a>
        </div>
        <div>
          <h3>Explore</h3>
          <Link to="/shop">Shop All Jewellery</Link>
          {categories.map((c) => (
            <Link key={c.slug} to="/collections/$slug" params={{ slug: c.slug }}>
              {c.name}
            </Link>
          ))}
          <Link to="/wishlist">My Wishlist</Link>
        </div>
        <div>
          <h3>Customer Care</h3>
          <Link to="/account">My Account &amp; Orders</Link>
          <Link to="/contact">Contact Us</Link>
          <Link to="/faq">Frequently Asked Questions</Link>
          <Link to="/policies/shipping">Shipping Policy</Link>
          <Link to="/policies/returns">Returns &amp; Exchanges</Link>
          <Link to="/policies/privacy">Privacy Policy</Link>
          <Link to="/policies/terms">Terms of Service</Link>
        </div>
        <div>
          <h3>Visit The Gold Crown</h3>
          <p>{brand.address}</p>
          <Link to="/about">
            Our Story <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="footer-bottom page-width">
        <span>© {new Date().getFullYear()} The Gold Crown. All rights reserved.</span>
        <span>
          {isShopifyConfigured
            ? "Secure checkout powered by Shopify"
            : "Demo storefront — Shopify integration pending"}
        </span>
      </div>
    </footer>
  );
}
