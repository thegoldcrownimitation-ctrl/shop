import { useState } from "react";
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
  Lock,
  ArrowRight,
  Truck,
  Sparkles,
} from "lucide-react";
import { useCustomer } from "./customer-context";
import { Button } from "@/components/ui/button";
import { money } from "@/data/store";
import { getShopifyNativeAccountUrl } from "@/services/shopify-customer";

export function AccountPage() {
  const {
    customer,
    loading,
    error,
    login,
    register,
    logout,
    recoverPassword,
    addAddress,
    deleteAddress,
    setDefaultAddress,
  } = useCustomer();

  const [authMode, setAuthMode] = useState<"login" | "register" | "recover">("login");
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "addresses" | "profile">("overview");

  // Form states
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

  // Address form modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addrFirst, setAddrFirst] = useState("");
  const [addrLast, setAddrLast] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrProvince, setAddrProvince] = useState("");
  const [addrCountry, setAddrCountry] = useState("India");
  const [addrZip, setAddrZip] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrSaving, setAddrSaving] = useState(false);

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

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrSaving(true);
    try {
      await addAddress({
        firstName: addrFirst,
        lastName: addrLast,
        address1: addr1,
        address2: addr2,
        city: addrCity,
        province: addrProvince,
        country: addrCountry,
        zip: addrZip,
        phone: addrPhone,
      });
      setShowAddressModal(false);
      // Reset form
      setAddrFirst("");
      setAddrLast("");
      setAddr1("");
      setAddr2("");
      setAddrCity("");
      setAddrProvince("");
      setAddrZip("");
      setAddrPhone("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save address.");
    } finally {
      setAddrSaving(false);
    }
  };

  // Mock demo customer for previewing when Shopify store status is pending
  const displayCustomer = customer || (demoPreview ? {
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
      {
        id: "addr-2",
        address1: "B-12, Royal Palms Residency",
        address2: "Chandkheda",
        city: "Ahmedabad",
        province: "Gujarat",
        country: "India",
        zip: "382424",
        phone: "+91 98765 43210",
        firstName: "Priya",
        lastName: "Shah",
        isDefault: false,
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
            title: "Gulabi Choker Necklace Set",
            quantity: 1,
            originalTotalPrice: { amount: "2800.00", currencyCode: "INR" },
            variant: {
              title: "Gold Plated / Ruby Pink",
              price: { amount: "2800.00", currencyCode: "INR" },
              image: {
                url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=600&q=80",
                altText: "Gulabi Choker Necklace Set",
              },
              product: { handle: "gulabi-necklace-set" },
            },
          },
          {
            title: "Mayur Meenakari Jhumkas",
            quantity: 1,
            originalTotalPrice: { amount: "1400.00", currencyCode: "INR" },
            variant: {
              title: "Peacock Green & Gold",
              price: { amount: "1400.00", currencyCode: "INR" },
              image: {
                url: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80",
                altText: "Mayur Meenakari Jhumkas",
              },
              product: { handle: "mayur-jhumkas" },
            },
          },
        ],
      },
    ],
  } : null);

  // ─── Unauthenticated View (Login / Register / Recover) ─────────────────────
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
                {authMode === "register" && "Join our circle to enjoy seamless checkout and exclusive festive previews."}
                {authMode === "recover" && "Enter your email address and we will send you a password recovery link."}
              </p>
            </div>

            {/* Segmented control */}
            {authMode !== "recover" && (
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
            )}

            {(formError || error) && (
              <div className="auth-alert error">
                <AlertCircle size={18} />
                <span>{formError || error}</span>
              </div>
            )}

            {/* Login Form */}
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
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : "Sign In to Your Account"}
                </Button>
              </form>
            )}

            {/* Registration Form */}
            {authMode === "register" && (
              <form onSubmit={handleRegister} className="auth-form">
                <div className="form-row-2">
                  <label className="field-group">
                    <span>First name</span>
                    <input
                      type="text"
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
                  <span>Create Password</span>
                  <input
                    type="password"
                    required
                    minLength={6}
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
                  <span>Receive festive updates and new jewellery launches via email</span>
                </label>
                <Button type="submit" disabled={submitting || loading} className="w-full">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : "Create Account"}
                </Button>
              </form>
            )}

            {/* Password Recovery Form */}
            {authMode === "recover" && (
              <div>
                {recoverSent ? (
                  <div className="auth-alert success">
                    <CheckCircle size={18} />
                    <span>
                      Password reset email sent. Please check your inbox for instructions to reset your password.
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleRecover} className="auth-form">
                    <label className="field-group">
                      <span>Account Email</span>
                      <input
                        type="email"
                        required
                        className="field"
                        placeholder="name@example.com"
                        value={recoverEmail}
                        onChange={(e) => setRecoverEmail(e.target.value)}
                      />
                    </label>
                    <Button type="submit" disabled={submitting || loading} className="w-full">
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : "Send Recovery Link"}
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

            {/* Shopify direct portal fallback button */}
            <div className="auth-footer-options">
              <div className="divider">
                <span>or</span>
              </div>
              <a
                href={nativeAccountUrl}
                target="_blank"
                rel="noreferrer"
                className="shopify-account-link"
              >
                Sign in with Shopify Hosted Portal <ExternalLink size={14} />
              </a>

              {/* Developer / Demo preview toggle button */}
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
          {demoPreview && (
            <span className="demo-badge">Preview Mode</span>
          )}
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
            <span>Profile &amp; Security</span>
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
                    <span className="metric-val">Active</span>
                    <span className="metric-lbl">Account Status</span>
                  </div>
                </div>
              </div>

              {/* Latest Order Card */}
              <div className="dashboard-section mt-6">
                <div className="section-title-row">
                  <h2>Recent Order</h2>
                  {displayCustomer.orders.length > 0 && (
                    <button
                      className="text-link text-sm"
                      onClick={() => setActiveTab("orders")}
                    >
                      View all orders →
                    </button>
                  )}
                </div>

                {displayCustomer.orders.length === 0 ? (
                  <div className="empty-account-state">
                    <Package size={36} />
                    <p>You haven't placed any orders yet.</p>
                    <Button asChild variant="outline">
                      <Link to="/shop">Explore Jewellery Collection</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="order-card-compact">
                    {displayCustomer.orders.slice(0, 1).map((order) => (
                      <div key={order.id} className="order-summary-box">
                        <div className="order-head">
                          <div>
                            <span className="order-name">{order.name}</span>
                            <span className="order-date">
                              {new Date(order.processedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="order-badges">
                            <span className={`status-badge ${order.fulfillmentStatus.toLowerCase()}`}>
                              {order.fulfillmentStatus}
                            </span>
                            <span className="status-badge paid">{order.financialStatus}</span>
                          </div>
                        </div>

                        <div className="order-items-preview">
                          {order.lineItems.map((item, idx) => (
                            <div key={idx} className="order-item-row">
                              {item.variant?.image?.url ? (
                                <img
                                  src={item.variant.image.url}
                                  alt={item.title}
                                  className="order-thumb"
                                  width={48}
                                  height={56}
                                />
                              ) : (
                                <div className="order-thumb-placeholder" />
                              )}
                              <div className="order-item-info">
                                <p className="item-title">{item.title}</p>
                                <p className="item-variant">{item.variant?.title} × {item.quantity}</p>
                              </div>
                              <span className="item-price">
                                {money(
                                  parseFloat(item.originalTotalPrice.amount),
                                  item.originalTotalPrice.currencyCode,
                                )}
                              </span>
                            </div>
                          ))}
                        </div>

                        {order.successfulFulfillments?.[0]?.trackingInfo?.[0] && (
                          <div className="order-tracking-banner">
                            <Truck size={16} />
                            <span>
                              Shipped via {order.successfulFulfillments[0].trackingCompany || "Carrier"}:{" "}
                              <strong>{order.successfulFulfillments[0].trackingInfo[0].number}</strong>
                            </span>
                            <a
                              href={order.successfulFulfillments[0].trackingInfo[0].url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-link text-xs ml-auto"
                            >
                              Track Package <ExternalLink size={12} />
                            </a>
                          </div>
                        )}

                        <div className="order-footer">
                          <span>Total Amount</span>
                          <span className="order-total">
                            {money(parseFloat(order.totalPrice.amount), order.totalPrice.currencyCode)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Default Address summary */}
              <div className="dashboard-section mt-6">
                <div className="section-title-row">
                  <h2>Default Delivery Address</h2>
                  <button
                    className="text-link text-sm"
                    onClick={() => setActiveTab("addresses")}
                  >
                    Manage addresses →
                  </button>
                </div>
                {displayCustomer.defaultAddress ? (
                  <div className="address-box-display">
                    <p className="addr-name">
                      {displayCustomer.defaultAddress.firstName} {displayCustomer.defaultAddress.lastName}
                    </p>
                    <p>{displayCustomer.defaultAddress.address1}</p>
                    {displayCustomer.defaultAddress.address2 && (
                      <p>{displayCustomer.defaultAddress.address2}</p>
                    )}
                    <p>
                      {displayCustomer.defaultAddress.city}, {displayCustomer.defaultAddress.province}{" "}
                      {displayCustomer.defaultAddress.zip}
                    </p>
                    <p>{displayCustomer.defaultAddress.country}</p>
                    {displayCustomer.defaultAddress.phone && (
                      <p className="addr-phone">Phone: {displayCustomer.defaultAddress.phone}</p>
                    )}
                  </div>
                ) : (
                  <div className="empty-account-state">
                    <MapPin size={32} />
                    <p>No default address saved yet.</p>
                    <Button variant="outline" size="sm" onClick={() => setShowAddressModal(true)}>
                      Add an Address
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: ORDERS ── */}
          {activeTab === "orders" && (
            <div className="tab-pane">
              <div className="section-title-row">
                <h2>Your Order History</h2>
                <span className="results-count">
                  {displayCustomer.orders.length} {displayCustomer.orders.length === 1 ? "order" : "orders"}
                </span>
              </div>

              {displayCustomer.orders.length === 0 ? (
                <div className="empty-account-state">
                  <Package size={40} />
                  <h3>No Orders Placed Yet</h3>
                  <p>When you complete a purchase, your order history and tracking updates will appear here.</p>
                  <Button asChild>
                    <Link to="/shop">Shop New Arrivals</Link>
                  </Button>
                </div>
              ) : (
                <div className="orders-stack">
                  {displayCustomer.orders.map((order) => (
                    <div key={order.id} className="order-full-card">
                      <div className="order-card-header">
                        <div>
                          <h3 className="order-number">{order.name}</h3>
                          <p className="order-timestamp">
                            Ordered on{" "}
                            {new Date(order.processedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="order-card-meta">
                          <span className={`status-badge ${order.fulfillmentStatus.toLowerCase()}`}>
                            {order.fulfillmentStatus}
                          </span>
                          <span className="status-badge paid">{order.financialStatus}</span>
                        </div>
                      </div>

                      <div className="order-card-lines">
                        {order.lineItems.map((item, idx) => (
                          <div key={idx} className="order-line-item">
                            {item.variant?.image?.url ? (
                              <img
                                src={item.variant.image.url}
                                alt={item.title}
                                className="order-card-img"
                                width={64}
                                height={80}
                              />
                            ) : (
                              <div className="order-card-placeholder" />
                            )}
                            <div className="order-line-details">
                              <h4>{item.title}</h4>
                              <p className="line-variant">{item.variant?.title}</p>
                              <p className="line-qty">Qty: {item.quantity}</p>
                            </div>
                            <span className="order-line-price">
                              {money(
                                parseFloat(item.originalTotalPrice.amount),
                                item.originalTotalPrice.currencyCode,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.successfulFulfillments?.[0]?.trackingInfo?.[0] && (
                        <div className="tracking-status-strip">
                          <Truck size={16} />
                          <span>
                            Tracking Number:{" "}
                            <strong>{order.successfulFulfillments[0].trackingInfo[0].number}</strong> (
                            {order.successfulFulfillments[0].trackingCompany || "Courier"})
                          </span>
                          <a
                            href={order.successfulFulfillments[0].trackingInfo[0].url}
                            target="_blank"
                            rel="noreferrer"
                            className="tracking-btn"
                          >
                            Live Tracking <ExternalLink size={12} />
                          </a>
                        </div>
                      )}

                      <div className="order-card-footer">
                        {order.statusUrl && (
                          <a
                            href={order.statusUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-link text-xs"
                          >
                            View Shopify Receipt / Order Status <ExternalLink size={12} />
                          </a>
                        )}
                        <div className="order-card-total-box">
                          <span>Total Paid:</span>
                          <span className="total-highlight">
                            {money(parseFloat(order.totalPrice.amount), order.totalPrice.currencyCode)}
                          </span>
                        </div>
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
              <div className="section-title-row">
                <h2>Saved Delivery Addresses</h2>
                <Button size="sm" onClick={() => setShowAddressModal(true)}>
                  <Plus size={16} /> Add Address
                </Button>
              </div>

              {displayCustomer.addresses.length === 0 ? (
                <div className="empty-account-state">
                  <MapPin size={40} />
                  <h3>No Addresses Saved</h3>
                  <p>Save your delivery address for faster checkout on future orders.</p>
                  <Button onClick={() => setShowAddressModal(true)}>Add Your First Address</Button>
                </div>
              ) : (
                <div className="addresses-grid">
                  {displayCustomer.addresses.map((addr) => (
                    <div key={addr.id} className={`address-card ${addr.isDefault ? "default" : ""}`}>
                      {addr.isDefault && (
                        <span className="default-pill">Default Address</span>
                      )}
                      <p className="addr-recipient">
                        {addr.firstName} {addr.lastName}
                      </p>
                      <p className="addr-line">{addr.address1}</p>
                      {addr.address2 && <p className="addr-line">{addr.address2}</p>}
                      <p className="addr-line">
                        {addr.city}, {addr.province} - {addr.zip}
                      </p>
                      <p className="addr-line">{addr.country}</p>
                      {addr.phone && <p className="addr-phone">Phone: {addr.phone}</p>}

                      <div className="address-actions">
                        {!addr.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultAddress(addr.id)}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete address"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this address?")) {
                              deleteAddress(addr.id);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
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
              <div className="section-title-row">
                <h2>Profile &amp; Account Settings</h2>
              </div>

              <div className="profile-details-card">
                <div className="profile-field">
                  <span className="profile-field-label">Full Name</span>
                  <span className="profile-field-value">
                    {displayCustomer.firstName || ""} {displayCustomer.lastName || ""}
                  </span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Email Address</span>
                  <span className="profile-field-value">{displayCustomer.email}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Phone Number</span>
                  <span className="profile-field-value">{displayCustomer.phone || "Not provided"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Marketing Preferences</span>
                  <span className="profile-field-value">
                    {displayCustomer.acceptsMarketing ? "Subscribed to festive emails" : "Not subscribed"}
                  </span>
                </div>
              </div>

              <div className="profile-actions-box mt-6">
                <h3>Shopify Customer Portal</h3>
                <p>
                  To change your password, update two-factor security, or manage payments, access your official Shopify
                  customer profile directly.
                </p>
                <Button asChild variant="outline" className="mt-3">
                  <a href={nativeAccountUrl} target="_blank" rel="noreferrer">
                    Manage Security in Shopify <ExternalLink size={14} />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Add Address Modal ── */}
      {showAddressModal && (
        <div className="drawer-backdrop" onClick={() => setShowAddressModal(false)}>
          <div
            className="address-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Add Address"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Add Delivery Address</h3>
              <button
                className="close-btn"
                aria-label="Close modal"
                onClick={() => setShowAddressModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveAddress} className="address-modal-form">
              <div className="form-row-2">
                <label className="field-group">
                  <span>First name</span>
                  <input
                    required
                    className="field"
                    value={addrFirst}
                    onChange={(e) => setAddrFirst(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span>Last name</span>
                  <input
                    required
                    className="field"
                    value={addrLast}
                    onChange={(e) => setAddrLast(e.target.value)}
                  />
                </label>
              </div>
              <label className="field-group">
                <span>Address line 1</span>
                <input
                  required
                  className="field"
                  placeholder="Apartment, building, street"
                  value={addr1}
                  onChange={(e) => setAddr1(e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Address line 2 (optional)</span>
                <input
                  className="field"
                  placeholder="Locality, landmark"
                  value={addr2}
                  onChange={(e) => setAddr2(e.target.value)}
                />
              </label>
              <div className="form-row-2">
                <label className="field-group">
                  <span>City</span>
                  <input
                    required
                    className="field"
                    placeholder="Ahmedabad"
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span>State / Province</span>
                  <input
                    required
                    className="field"
                    placeholder="Gujarat"
                    value={addrProvince}
                    onChange={(e) => setAddrProvince(e.target.value)}
                  />
                </label>
              </div>
              <div className="form-row-2">
                <label className="field-group">
                  <span>PIN / Postal code</span>
                  <input
                    required
                    className="field"
                    placeholder="380013"
                    value={addrZip}
                    onChange={(e) => setAddrZip(e.target.value)}
                  />
                </label>
                <label className="field-group">
                  <span>Country</span>
                  <input
                    required
                    className="field"
                    value={addrCountry}
                    onChange={(e) => setAddrCountry(e.target.value)}
                  />
                </label>
              </div>
              <label className="field-group">
                <span>Phone number (for delivery updates)</span>
                <input
                  type="tel"
                  className="field"
                  placeholder="+91 98765 43210"
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddressModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addrSaving}>
                  {addrSaving ? <Loader2 size={16} className="animate-spin" /> : "Save Address"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
