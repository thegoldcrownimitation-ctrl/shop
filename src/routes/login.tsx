import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Crown, Lock, Mail, AlertCircle, ShieldCheck, CheckCircle, ArrowLeft } from "lucide-react";
import { useCustomer } from "@/components/storefront/customer-context";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/utils/page-head";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () =>
    pageHead(
      "Sign In | The Gold Crown",
      "Sign in to your customer account at The Gold Crown to access your orders and saved addresses.",
      "/login",
    ),
});

export function LoginPage() {
  const { customer, loginWithShopify, login, recoverPassword, isCustomerAccountApiConfigured, loading } = useCustomer();
  const navigate = useNavigate();

  // If already authenticated, redirect to /account
  if (!loading && customer) {
    navigate({ to: "/account" });
  }

  // Read params if returned by OAuth or if navigated with ?mode=recover
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const oauthError = searchParams.get("error");
  const initialMode = searchParams.get("mode") === "recover" ? "recover" : "login";

  const [mode, setMode] = useState<"login" | "recover">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverSent, setRecoverSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleLegacyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate({ to: "/account" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid credentials.");
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

  return (
    <div className="account-container page-width">
      <div className="auth-card" style={{ maxWidth: 460, margin: "2rem auto" }}>
        {/* Header */}
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
            {mode === "login" ? "Welcome Back" : "Reset Your Password"}
          </h1>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.95rem", margin: 0 }}>
            {mode === "login"
              ? "Sign in to access your orders, track deliveries, and manage saved addresses."
              : "Enter your registered email address and Shopify will send you a password recovery link."}
          </p>
        </div>

        {oauthError && (
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: 8,
              background: "hsl(var(--destructive) / 0.1)",
              border: "1px solid hsl(var(--destructive) / 0.3)",
              color: "hsl(var(--destructive))",
              fontSize: "0.9rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <AlertCircle size={18} />
            <span>Authentication error: {oauthError}</span>
          </div>
        )}

        {/* ── MODE: FORGOT PASSWORD ── */}
        {mode === "recover" ? (
          <div>
            {recoverSent ? (
              <div
                style={{
                  padding: "1.25rem",
                  borderRadius: 8,
                  background: "hsl(var(--primary) / 0.1)",
                  border: "1px solid hsl(var(--primary) / 0.3)",
                  color: "hsl(var(--foreground))",
                  fontSize: "0.95rem",
                  marginBottom: "1.5rem",
                  textAlign: "center",
                }}
              >
                <CheckCircle size={32} className="text-primary mx-auto mb-2" />
                <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Password Reset Email Sent</div>
                <p style={{ fontSize: "0.85rem", color: "hsl(var(--muted-foreground))", margin: 0 }}>
                  If an account exists for <strong>{recoverEmail}</strong>, you will receive an official Shopify password reset link in your inbox shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleRecover} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="field"
                    style={{ width: "100%" }}
                  />
                </div>

                <Button type="submit" disabled={submitting} className="w-full" size="lg">
                  {submitting ? "Sending Reset Link..." : "Send Reset Link"}
                </Button>
              </form>
            )}

            <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setRecoverSent(false);
                  setFormError(null);
                }}
                className="text-link text-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          /* ── MODE: LOGIN ── */
          <div>
            {/* Primary: Modern Shopify Customer Account API OAuth */}
            <div style={{ marginBottom: "1.5rem" }}>
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={() => loginWithShopify("/account")}
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
                <Lock size={18} /> Continue with Shopify Account
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
                <span>Password-free one-time verification verified by Shopify</span>
              </div>
            </div>

            {/* Password Login Form */}
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
              <span>Or sign in with email</span>
              <div style={{ flex: 1, height: 1, background: "hsl(var(--border))" }} />
            </div>

            <form onSubmit={handleLegacyLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("recover");
                      setRecoverEmail(email);
                      setRecoverSent(false);
                      setFormError(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "hsl(var(--primary))",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field"
                  style={{ width: "100%" }}
                />
              </div>

              <Button type="submit" disabled={submitting} variant="outline" className="w-full">
                {submitting ? "Signing in..." : "Sign In with Password"}
              </Button>

              <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMode("recover");
                    setRecoverEmail(email);
                    setRecoverSent(false);
                    setFormError(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "hsl(var(--primary))",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: "4px",
                  }}
                >
                  Forgot your password? Click here to reset
                </button>
              </div>
            </form>

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
              New to The Gold Crown?{" "}
              <Link
                to="/register"
                style={{ color: "hsl(var(--primary))", fontWeight: 600, textDecoration: "underline" }}
              >
                Create an Account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
