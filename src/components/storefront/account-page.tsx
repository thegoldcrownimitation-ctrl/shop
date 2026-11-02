import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  User,
  Package,
  MapPin,
  LogOut,
  Mail,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Lock,
  ArrowRight,
  Truck,
  Sparkles,
  ShieldCheck,
  Check,
  Phone,
  Building,
} from "lucide-react";
import { useCustomer } from "./customer-context";
import { Button } from "@/components/ui/button";
import { money } from "@/data/store";
import { getShopifyNativeAccountUrl, type CustomerAddress } from "@/services/shopify-customer";

export function AccountPage() {
  const {
    customer,
    loading,
    error,
    isCustomerAccountApiConfigured,
    loginWithShopify,
    registerWithShopify,
    updateProfile,
    login,
    register,
    logout,
    recoverPassword,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useCustomer();

  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "addresses" | "profile">("overview");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "orders" || tabParam === "addresses" || tabParam === "profile") {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const [authMode, setAuthMode] = useState<"login" | "register" | "recover">("login");

  // Form states for fallback
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regMarketing, setRegMarketing] = useState(true);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverSent, setRecoverSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Address modal states
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrFirst, setAddrFirst] = useState("");
  const [addrLast, setAddrLast] = useState("");
  const [addrCompany, setAddrCompany] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrProvince, setAddrProvince] = useState("");
  const [addrCountry, setAddrCountry] = useState("India");
  const [addrZip, setAddrZip] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);

  // Profile edit modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Demo preview toggle for demonstration/testing
  const [demoPreview, setDemoPreview] = useState(false);

  const nativeAccountUrl = getShopifyNativeAccountUrl();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await register({
        email: regEmail,
        password: regPassword,
        firstName: regFirstName,
        lastName: regLastName,
        acceptsMarketing: regMarketing,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await recoverPassword(recoverEmail);
      setRecoverSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Password recovery request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAddAddressModal = () => {
    setEditingAddressId(null);
    setAddrFirst(customer?.firstName || "");
    setAddrLast(customer?.lastName || "");
    setAddrCompany("");
    setAddr1("");
    setAddr2("");
    setAddrCity("");
    setAddrProvince("");
    setAddrCountry("India");
    setAddrZip("");
    setAddrPhone(customer?.phone || "");
    setAddrIsDefault(false);
    setShowAddressModal(true);
  };

  const openEditAddressModal = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setAddrFirst(addr.firstName || "");
    setAddrLast(addr.lastName || "");
    setAddrCompany(addr.company || "");
    setAddr1(addr.address1 || "");
    setAddr2(addr.address2 || "");
    setAddrCity(addr.city || "");
    setAddrProvince(addr.province || "");
    setAddrCountry(addr.country || "India");
    setAddrZip(addr.zip || "");
    setAddrPhone(addr.phone || "");
    setAddrIsDefault(!!addr.isDefault);
    setShowAddressModal(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrSaving(true);
    try {
      const addressData = {
        firstName: addrFirst,
        lastName: addrLast,
        company: addrCompany,
        address1: addr1,
        address2: addr2,
        city: addrCity,
        province: addrProvince,
        country: addrCountry,
        zip: addrZip,
        phone: addrPhone,
      };

      if (editingAddressId) {
        await updateAddress(editingAddressId, addressData, addrIsDefault);
      } else {
        await addAddress(addressData, addrIsDefault);
      }
      setShowAddressModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save address.");
    } finally {
      setAddrSaving(false);
    }
  };

  const openEditProfileModal = () => {
    setEditFirstName(customer?.firstName || "");
    setEditLastName(customer?.lastName || "");
    setProfileSuccess(false);
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await updateProfile({
        firstName: editFirstName,
        lastName: editLastName,
      });
      setProfileSuccess(true);
      setTimeout(() => setShowProfileModal(false), 800);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const displayCustomer =
    customer ||
    (demoPreview
      ? {
          id: "demo-cust-1",
          firstName: "Priya",
          lastName: "Shah",
          displayName: "Priya Shah",
          email: "priya.shah@example.com",
          phone: "+91 98765 43210",
          acceptsMarketing: true,
          defaultAddress: {
            id: "addr-1",
            address1: "402, Shivalik High Street",
            address2: "Bhavsar Hostel Cross Road",
            city: "Ahmedabad",
            province: "Gujarat",
            country: "India",
            zip: "380013",
            phone: "+91 98765 43210",
            firstName: "Priya",
            lastName: "Shah",
            isDefault: true,
          },
          addresses: [
            {
              id: "addr-1",
              address1: "402, Shivalik High Street",
              address2: "Bhavsar Hostel Cross Road",
              city: "Ahmedabad",
              province: "Gujarat",
              country: "India",
              zip: "380013",
              phone: "+91 98765 43210",
              firstName: "Priya",
              lastName: "Shah",
              isDefault: true,
            },
          ],
          orders: [
            {
              id: "gid://shopify/Order/1001",
              name: "#GC-1048",
              orderNumber: 1048,
              processedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
              financialStatus: "PAID",
              fulfillmentStatus: "FULFILLED",
              statusUrl: "https://thegoldcrownimitation.myshopify.com",
              totalPrice: { amount: "4200.00", currencyCode: "INR" },
              subtotalPrice: { amount: "4200.00", currencyCode: "INR" },
              totalShippingPrice: { amount: "0.00", currencyCode: "INR" },
              successfulFulfillments: [
                {
                  trackingCompany: "BlueDart Express",
                  trackingInfo: [{ number: "BD847392019IN", url: "https://www.bluedart.com" }],
                },
              ],
              lineItems: [
                {
                  title: "Sterling Silver Gold Vermeil Freshwater Pearl Necklace",
                  quantity: 1,
                  originalTotalPrice: { amount: "2800.00", currencyCode: "INR" },
                  variant: {
                    title: "Gold Plated / Ruby Pink",
                    price: { amount: "2800.00", currencyCode: "INR" },
                    image: {
                      url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
                      altText: "Sterling Silver Gold Vermeil Freshwater Pearl Necklace",
                    },
                    product: { handle: "sterling-silver-gold-vermeil-freshwater-pearl-necklace-n-1642-g" },
                  },
                },
              ],
            },
          ],
        }
      : null);

  // ─── Unauthenticated View ──────────────────────────────────────────────────
  if (!displayCustomer) {
    return (
      <div className="page-width account-page">
        <div className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>Customer Account</span>
        </div>

        <div className="account-auth-container">
          <div className="account-auth-card">
            <div className="auth-header">
              <p className="eyebrow text-primary">THE GOLD CROWN</p>
              <h1>
                {authMode === "login" && "Welcome Back"}
                {authMode === "register" && "Create an Account"}
                {authMode === "recover" && "Reset Password"}
              </h1>
              <p className="auth-sub">
                {authMode === "login" && "Access your orders, saved addresses, and jewellery wishlist."}
                {authMode === "register" &&
                  "Join our circle to enjoy seamless checkout and exclusive festive previews."}
                {authMode === "recover" &&
                  "Enter your email address and we will send you a password recovery link."}
              </p>
            </div>

            {/* Primary Modern Shopify Customer Account OAuth Button */}
            <div style={{ marginBottom: "1.75rem" }}>
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={() =>
                  authMode === "register"
                    ? registerWithShopify("/account")
                    : loginWithShopify("/account")
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.6rem",
                  fontWeight: 600,
                  fontSize: "1rem",
                  padding: "0.85rem 1.5rem",
                }}
              >
                <Lock size={18} />
                {authMode === "register"
                  ? "Continue with Shopify Account"
                  : "Sign In with Shopify Account"}
              </Button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                  marginTop: "0.6rem",
                  fontSize: "0.78rem",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                <ShieldCheck size={14} className="text-primary" />
                <span>Modern password-free authentication verified by Shopify</span>
              </div>
            </div>

            {/* Tabs for secondary fallback options */}
            <div className="auth-tabs">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => {
                  setAuthMode("login");
                  setFormError(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => {
                  setAuthMode("register");
                  setFormError(null);
                }}
              >
                Create Account
              </button>
            </div>

            {(formError || error) && (
              <div className="auth-alert error">
                <AlertCircle size={18} />
                <span>{formError || error}</span>
              </div>
            )}

            {/* Email/Password fallback login form */}
            {authMode === "login" && (
              <form onSubmit={handleLogin} className="auth-form">
                <label className="field-group">
                  <span>Email address</span>
                  <input
                    type="email"
                    required
                    className="field"
                    placeholder="name@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <div className="field-header">
                    <span>Password</span>
                    <button
                      type="button"
                      className="text-link text-xs"
                      onClick={() => {
                        setAuthMode("recover");
                        setRecoverSent(false);
                        setFormError(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    className="field"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </label>
                <Button type="submit" disabled={submitting || loading} className="w-full">
                  {submitting ? "Signing in..." : "Sign In with Password"}
                </Button>
              </form>
            )}

            {/* Email/Password fallback register form */}
            {authMode === "register" && (
              <form onSubmit={handleRegister} className="auth-form">
                <div className="field-row">
                  <label className="field-group">
                    <span>First name</span>
                    <input
                      type="text"
                      required
                      className="field"
                      placeholder="Priya"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                    />
                  </label>
                  <label className="field-group">
                    <span>Last name</span>
                    <input
                      type="text"
                      required
                      className="field"
                      placeholder="Shah"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                    />
                  </label>
                </div>
                <label className="field-group">
                  <span>Email address</span>
                  <input
                    type="email"
                    required
                    className="field"
                    placeholder="name@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span>Password</span>
                  <input
                    type="password"
                    required
                    className="field"
                    placeholder="At least 6 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={regMarketing}
                    onChange={(e) => setRegMarketing(e.target.checked)}
                  />
                  <span>Email me about new festive arrivals and member exclusives</span>
                </label>
                <Button type="submit" disabled={submitting || loading} className="w-full">
                  {submitting ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            )}

            {/* Password recover form */}
            {authMode === "recover" && (
              <div className="auth-form">
                {recoverSent ? (
                  <div className="auth-alert success">
                    <CheckCircle size={18} />
                    <span>Recovery email sent! Please check your inbox for instructions.</span>
                  </div>
                ) : (
                  <form onSubmit={handleRecover}>
                    <label className="field-group">
                      <span>Email address</span>
                      <input
                        type="email"
                        required
                        className="field"
                        placeholder="name@example.com"
                        value={recoverEmail}
                        onChange={(e) => setRecoverEmail(e.target.value)}
                      />
                    </label>
                    <Button type="submit" disabled={submitting || loading} className="w-full mt-4">
                      {submitting ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </form>
                )}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    className="text-link text-sm"
                    onClick={() => {
                      setAuthMode("login");
                      setRecoverSent(false);
                    }}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </div>
            )}

            <div className="auth-footer-options">
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDemoPreview(true)}
                  className="preview-dashboard-btn"
                >
                  <Sparkles size={14} /> Preview Account Dashboard Demo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Authenticated Customer Dashboard ──────────────────────────────────────
  return (
    <div className="page-width account-page">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>My Account</span>
      </div>

      <div className="account-header">
        <div>
          <p className="eyebrow text-primary">CUSTOMER PORTAL</p>
          <h1>Welcome, {displayCustomer.firstName || displayCustomer.displayName || "Valued Customer"}</h1>
          <p className="account-email">{displayCustomer.email}</p>
        </div>
        <div className="account-header-actions">
          {demoPreview && <span className="demo-badge">Preview Mode</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (demoPreview) setDemoPreview(false);
              else logout();
            }}
          >
            <LogOut size={14} /> Sign Out
          </Button>
        </div>
      </div>

      <div className="account-layout">
        {/* Navigation sidebar */}
        <nav className="account-nav" aria-label="Account navigation">
          <button
            className={`account-nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <User size={18} />
            <span>Overview</span>
          </button>
          <button
            className={`account-nav-item ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            <Package size={18} />
            <span>Orders ({displayCustomer.orders.length})</span>
          </button>
          <button
            className={`account-nav-item ${activeTab === "addresses" ? "active" : ""}`}
            onClick={() => setActiveTab("addresses")}
          >
            <MapPin size={18} />
            <span>Addresses ({displayCustomer.addresses.length})</span>
          </button>
          <button
            className={`account-nav-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <Mail size={18} />
            <span>Profile &amp; Settings</span>
          </button>
        </nav>

        {/* Content area */}
        <main className="account-content">
          {/* ── TAB: OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="tab-pane">
              <div className="dashboard-metrics">
                <div className="metric-card">
                  <Package className="metric-icon" size={24} />
                  <div>
                    <span className="metric-val">{displayCustomer.orders.length}</span>
                    <span className="metric-lbl">Total Orders</span>
                  </div>
                </div>
                <div className="metric-card">
                  <MapPin className="metric-icon" size={24} />
                  <div>
                    <span className="metric-val">{displayCustomer.addresses.length}</span>
                    <span className="metric-lbl">Saved Addresses</span>
                  </div>
                </div>
                <div className="metric-card">
                  <Lock className="metric-icon" size={24} />
                  <div>
                    <span className="metric-val">Authenticated</span>
                    <span className="metric-lbl">Shopify Verified</span>
                  </div>
                </div>
              </div>

              {/* Recent Order Card */}
              <div className="dashboard-section mt-6">
                <div className="section-title-row">
                  <h2>Recent Order</h2>
                  {displayCustomer.orders.length > 0 && (
                    <button className="text-link text-sm" onClick={() => setActiveTab("orders")}>
                      View all orders →
                    </button>
                  )}
                </div>

                {displayCustomer.orders.length > 0 ? (
                  <div className="order-card p-4 border border-border rounded-lg bg-card mt-3">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="font-bold text-base">{displayCustomer.orders[0].name}</span>
                        <span className="text-xs text-muted-foreground ml-3">
                          {new Date(displayCustomer.orders[0].processedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <span className="badge-status">{displayCustomer.orders[0].fulfillmentStatus}</span>
                    </div>
                    <div className="text-sm font-semibold text-primary">
                      Total: {money(parseFloat(displayCustomer.orders[0].totalPrice.amount))}
                    </div>
                    <div className="mt-3 flex gap-3 overflow-x-auto">
                      {displayCustomer.orders[0].lineItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs border rounded p-1.5">
                          {item.variant?.image?.url && (
                            <img
                              src={item.variant.image.url}
                              alt={item.title}
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <span>{item.title} (x{item.quantity})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-account-state p-8 text-center border rounded">
                    <Package size={32} className="mx-auto text-muted-foreground mb-2" />
                    <p>No orders placed yet.</p>
                    <Link to="/shop" className="text-link text-sm mt-2 inline-block">
                      Start browsing our jewellery catalogue →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: ORDERS ── */}
          {activeTab === "orders" && (
            <div className="tab-pane">
              <div className="section-title-row mb-4">
                <h2>Order History ({displayCustomer.orders.length})</h2>
              </div>

              {displayCustomer.orders.length === 0 ? (
                <div className="empty-account-state p-8 text-center border rounded">
                  <Package size={36} className="mx-auto text-muted-foreground mb-3" />
                  <p>You haven't placed any orders yet.</p>
                  <Link to="/shop" className="text-link text-sm mt-2 inline-block">
                    Explore New Arrivals →
                  </Link>
                </div>
              ) : (
                <div className="orders-list flex flex-col gap-4">
                  {displayCustomer.orders.map((order: any) => (
                    <div key={order.id} className="order-card p-5 border border-border rounded-lg bg-card">
                      <div className="flex justify-between items-start flex-wrap gap-2 pb-3 border-b border-border">
                        <div>
                          <div className="font-bold text-lg">{order.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Placed on{" "}
                            {new Date(order.processedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-1 bg-secondary rounded">
                            {order.financialStatus}
                          </span>
                          <span className="text-xs font-semibold px-2 py-1 bg-primary text-primary-foreground rounded">
                            {order.fulfillmentStatus}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="py-4 flex flex-col gap-3">
                        {order.lineItems.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-3">
                              {item.variant?.image?.url ? (
                                <img
                                  src={item.variant.image.url}
                                  alt={item.title}
                                  className="w-12 h-12 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center">
                                  <Package size={18} />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{item.title}</div>
                                <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                              </div>
                            </div>
                            <div className="font-semibold">
                              {money(parseFloat(item.originalTotalPrice?.amount || "0"))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-border flex justify-between items-center flex-wrap gap-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-bold text-base">
                            {money(parseFloat(order.totalPrice.amount))}
                          </span>
                        </div>
                        {order.successfulFulfillments?.[0]?.trackingInfo?.[0]?.url && (
                          <a
                            href={order.successfulFulfillments[0].trackingInfo[0].url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold border border-primary px-3 py-1.5 rounded hover:bg-primary hover:text-primary-foreground transition"
                          >
                            <Truck size={14} /> Track Delivery
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: ADDRESSES ── */}
          {activeTab === "addresses" && (
            <div className="tab-pane">
              <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
                <h2>Saved Addresses ({displayCustomer.addresses.length})</h2>
                <Button size="sm" onClick={openAddAddressModal}>
                  <Plus size={16} /> Add New Address
                </Button>
              </div>

              {displayCustomer.addresses.length === 0 ? (
                <div className="empty-account-state p-8 text-center border rounded">
                  <MapPin size={36} className="mx-auto text-muted-foreground mb-3" />
                  <p>You have no saved addresses yet.</p>
                  <Button size="sm" className="mt-3" onClick={openAddAddressModal}>
                    <Plus size={16} /> Add Shipping Address
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayCustomer.addresses.map((addr: CustomerAddress) => (
                    <div
                      key={addr.id}
                      className="address-card p-5 border rounded-lg bg-card relative flex flex-col justify-between"
                      style={{ borderLeft: addr.isDefault ? "4px solid hsl(var(--primary))" : undefined }}
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-base">
                            {[addr.firstName, addr.lastName].filter(Boolean).join(" ") || "Recipient"}
                          </span>
                          {addr.isDefault && (
                            <span className="text-xs bg-primary text-primary-foreground font-semibold px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        {addr.company && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                            <Building size={12} /> {addr.company}
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {addr.address1}
                          {addr.address2 && <><br />{addr.address2}</>}
                          <br />
                          {addr.city}, {addr.province} {addr.zip}
                          <br />
                          {addr.country}
                        </p>
                        {addr.phone && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Phone size={12} /> {addr.phone}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                        <button
                          type="button"
                          className="text-link text-xs flex items-center gap-1 font-semibold"
                          onClick={() => openEditAddressModal(addr)}
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        {!addr.isDefault && (
                          <button
                            type="button"
                            className="text-link text-xs font-semibold"
                            onClick={() => setDefaultAddress(addr.id)}
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          className="text-destructive text-xs flex items-center gap-1 ml-auto font-semibold"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this address?")) {
                              deleteAddress(addr.id);
                            }
                          }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: PROFILE & SECURITY ── */}
          {activeTab === "profile" && (
            <div className="tab-pane">
              <div className="section-title-row mb-4">
                <h2>Profile Information</h2>
              </div>

              <div className="p-6 border rounded-lg bg-card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                      Full Name
                    </label>
                    <div className="text-base font-medium">
                      {[displayCustomer.firstName, displayCustomer.lastName].filter(Boolean).join(" ") || "Not set"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                      Email Address
                    </label>
                    <div className="text-base font-medium">{displayCustomer.email}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                      Phone Number
                    </label>
                    <div className="text-base font-medium">{displayCustomer.phone || "Not provided"}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                      Authentication Method
                    </label>
                    <div className="text-sm font-medium flex items-center gap-1.5 text-primary">
                      <ShieldCheck size={16} /> Shopify Customer Account OAuth (PKCE)
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-border flex items-center gap-4 flex-wrap">
                  <Button size="sm" onClick={openEditProfileModal}>
                    <Edit2 size={14} /> Edit Profile Details
                  </Button>
                  <Button variant="outline" size="sm" onClick={logout}>
                    <LogOut size={14} /> Sign Out of Account
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── ADDRESS MODAL ── */}
      {showAddressModal && (
        <div className="drawer-backdrop" onClick={() => setShowAddressModal(false)}>
          <div
            className="auth-card"
            style={{ maxWidth: 540, margin: "auto", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl mb-4">
              {editingAddressId ? "Edit Address" : "Add New Shipping Address"}
            </h3>
            <form onSubmit={handleSaveAddress} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="field-group">
                  <span>First Name</span>
                  <input
                    type="text"
                    required
                    className="field"
                    value={addrFirst}
                    onChange={(e) => setAddrFirst(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span>Last Name</span>
                  <input
                    type="text"
                    required
                    className="field"
                    value={addrLast}
                    onChange={(e) => setAddrLast(e.target.value)}
                  />
                </label>
              </div>

              <label className="field-group">
                <span>Company (Optional)</span>
                <input
                  type="text"
                  className="field"
                  value={addrCompany}
                  onChange={(e) => setAddrCompany(e.target.value)}
                />
              </label>

              <label className="field-group">
                <span>Address Line 1</span>
                <input
                  type="text"
                  required
                  className="field"
                  placeholder="Street address or P.O. Box"
                  value={addr1}
                  onChange={(e) => setAddr1(e.target.value)}
                />
              </label>

              <label className="field-group">
                <span>Address Line 2 (Optional)</span>
                <input
                  type="text"
                  className="field"
                  placeholder="Apartment, suite, unit, etc."
                  value={addr2}
                  onChange={(e) => setAddr2(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="field-group">
                  <span>City</span>
                  <input
                    type="text"
                    required
                    className="field"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span>State / Province</span>
                  <input
                    type="text"
                    required
                    className="field"
                    placeholder="Gujarat"
                    value={addrProvince}
                    onChange={(e) => setAddrProvince(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="field-group">
                  <span>Postal / ZIP Code</span>
                  <input
                    type="text"
                    required
                    className="field"
                    value={addrZip}
                    onChange={(e) => setAddrZip(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span>Phone Number</span>
                  <input
                    type="tel"
                    className="field"
                    placeholder="+91..."
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value)}
                  />
                </label>
              </div>

              <label className="checkbox-label mt-2">
                <input
                  type="checkbox"
                  checked={addrIsDefault}
                  onChange={(e) => setAddrIsDefault(e.target.checked)}
                />
                <span>Set as default shipping address</span>
              </label>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowAddressModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addrSaving}>
                  {addrSaving ? "Saving..." : "Save Address"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PROFILE EDIT MODAL ── */}
      {showProfileModal && (
        <div className="drawer-backdrop" onClick={() => setShowProfileModal(false)}>
          <div
            className="auth-card"
            style={{ maxWidth: 440, margin: "auto", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl mb-4">Edit Profile</h3>
            {profileSuccess ? (
              <div className="p-4 bg-primary/10 text-primary rounded flex items-center gap-2 mb-4">
                <Check size={18} /> Profile updated successfully!
              </div>
            ) : null}
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
              <label className="field-group">
                <span>First Name</span>
                <input
                  type="text"
                  required
                  className="field"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Last Name</span>
                <input
                  type="text"
                  required
                  className="field"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t">
                <Button type="button" variant="outline" onClick={() => setShowProfileModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={profileSaving}>
                  {profileSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
