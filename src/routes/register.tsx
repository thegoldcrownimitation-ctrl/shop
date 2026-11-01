import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Crown, Sparkles, ArrowRight, ShieldCheck, Check, Lock } from "lucide-react";
import { useCustomer } from "@/components/storefront/customer-context";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/utils/page-head";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  head: () =>
    pageHead(
      "Create Account | The Gold Crown",
      "Join The Gold Crown to save your favourite jewellery pieces, track orders, and receive festive offers.",
      "/register",
    ),
});

export function RegisterPage() {
  const { customer, registerWithShopify, register, isCustomerAccountApiConfigured, loading } = useCustomer();
  const navigate = useNavigate();

  if (!loading && customer) {
    navigate({ to: "/account" });
  }

  // Fallback registration form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleLegacyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        acceptsMarketing,
      });
      navigate({ to: "/account" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="account-container page-width">
      <div className="auth-card" style={{ maxWidth: 500, margin: "2rem auto" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "hsl(var(--primary) / 0.1)",
              color: "hsl(var(--primary))",
              marginBottom: "1rem",
            }}
          >
            <Crown size={28} />
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Create an Account
          </h1>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.95rem", margin: 0 }}>
            Join The Gold Crown community for early access to festive collections and seamless checkout.
          </p>
        </div>

        {/* Benefits list */}
        <div
          style={{
            background: "hsl(var(--surface-sunken))",
            borderRadius: 8,
            padding: "1rem 1.25rem",
            marginBottom: "1.75rem",
            fontSize: "0.85rem",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "hsl(var(--foreground))" }}>
            Member Benefits:
          </div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <li style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Check size={14} className="text-primary" /> Live order status & delivery tracking
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Check size={14} className="text-primary" /> Saved shipping addresses for instant checkout
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Check size={14} className="text-primary" /> Sync wishlist across all your devices
            </li>
          </ul>
        </div>

        {/* Primary: Modern Shopify Customer Account API Registration */}
        <div style={{ marginBottom: "1.5rem" }}>
          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={() => registerWithShopify("/account")}
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
            <Lock size={18} /> Register with Shopify Account
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
            <span>Secure account verification powered directly by Shopify</span>
          </div>
        </div>

        {/* Fallback form if Customer Account API is not configured yet */}
        {!isCustomerAccountApiConfigured && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                margin: "1.5rem 0",
                color: "hsl(var(--muted-foreground))",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "hsl(var(--border))" }} />
              <span>Or sign up with email</span>
              <div style={{ flex: 1, height: 1, background: "hsl(var(--border))" }} />
            </div>

            <form onSubmit={handleLegacyRegister} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {formError && (
                <div
                  style={{
                    padding: "0.75rem",
                    borderRadius: 6,
                    background: "hsl(var(--destructive) / 0.1)",
                    color: "hsl(var(--destructive))",
                    fontSize: "0.85rem",
                  }}
                >
                  {formError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Priya"
                    className="field"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Shah"
                    className="field"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="field"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="field"
                  style={{ width: "100%" }}
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={acceptsMarketing}
                  onChange={(e) => setAcceptsMarketing(e.target.checked)}
                />
                Keep me updated on festive promotions and new arrivals
              </label>

              <Button type="submit" disabled={submitting} variant="outline" className="w-full">
                {submitting ? "Creating account..." : "Sign Up with Email"}
              </Button>
            </form>
          </>
        )}

        <div
          style={{
            marginTop: "1.75rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid hsl(var(--border))",
            textAlign: "center",
            fontSize: "0.9rem",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            style={{ color: "hsl(var(--primary))", fontWeight: 600, textDecoration: "underline" }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
