import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Crown,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/utils/page-head";
import { resetCustomerPasswordByUrl } from "@/services/shopify-customer";

interface ResetPasswordSearchParams {
  reset_url?: string;
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearchParams => ({
    reset_url: typeof search.reset_url === "string" ? search.reset_url : undefined,
  }),
  component: ResetPasswordPage,
  head: () =>
    pageHead(
      "Reset Your Password | The Gold Crown",
      "Enter your new password below to secure your account at The Gold Crown.",
      "/reset-password",
    ),
});

export function ResetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  // Safely capture original reset URL in application memory
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [urlEvaluated, setUrlEvaluated] = useState(false);

  // Form states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // On mount, extract the reset_url from search or window.location, then sanitize visible browser URL
  useEffect(() => {
    let captured = search.reset_url;

    if (!captured && typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        captured = params.get("reset_url") || undefined;
      } catch {
        // ignore
      }
    }

    if (captured && captured.trim().startsWith("http")) {
      setResetUrl(captured.trim());

      // Sanitize URL from browser address bar and history to protect the sensitive token
      if (typeof window !== "undefined" && window.history?.replaceState) {
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch {
          // ignore
        }
      }
    }

    setUrlEvaluated(true);
  }, [search.reset_url]);

  // Password strength calculations
  const passwordChecks = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      hasNumberOrSpecial: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
      matches: newPassword.length > 0 && newPassword === confirmPassword,
    };
  }, [newPassword, confirmPassword]);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (newPassword.length >= 5) score += 1;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;
    return score;
  }, [newPassword]);

  const strengthLabel = useMemo(() => {
    if (!newPassword) return null;
    if (passwordScore <= 2) return { text: "Weak", color: "hsl(var(--destructive))", percent: 33 };
    if (passwordScore <= 4) return { text: "Good", color: "hsl(38 92% 50%)", percent: 66 };
    return { text: "Strong", color: "hsl(142 71% 45%)", percent: 100 };
  }, [newPassword, passwordScore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!resetUrl) {
      setErrorMessage("The password reset link is missing or has expired. Please request a new link.");
      return;
    }

    if (newPassword.length < 5) {
      setErrorMessage("Password must be at least 5 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The passwords do not match. Please ensure both fields are identical.");
      return;
    }

    setSubmitting(true);

    try {
      await resetCustomerPasswordByUrl(resetUrl, newPassword);
      setIsSuccess(true);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to reset password. The link may have expired or already been used.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── 1. SUCCESS SCREEN ──
  if (isSuccess) {
    return (
      <div className="account-container page-width">
        <div className="auth-card" style={{ maxWidth: 460, margin: "3rem auto", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "hsl(142 71% 45% / 0.12)",
              color: "hsl(142 71% 45%)",
              marginBottom: "1.25rem",
            }}
          >
            <CheckCircle size={36} />
          </div>

          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Password Updated
          </h1>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.95rem", lineHeight: 1.5, margin: "0 0 1.75rem" }}>
            Your Shopify customer password has been successfully updated. You can now sign in with your new credentials.
          </p>

          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate({ to: "/login" })}
            style={{ fontWeight: 600 }}
          >
            Sign In with New Password
          </Button>

          <div style={{ marginTop: "1.25rem" }}>
            <Link to="/" className="text-link text-sm" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <ArrowLeft size={14} /> Back to Store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. INVALID / MISSING RESET LINK SCREEN ──
  if (urlEvaluated && !resetUrl) {
    return (
      <div className="account-container page-width">
        <div className="auth-card" style={{ maxWidth: 460, margin: "3rem auto", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "hsl(var(--destructive) / 0.12)",
              color: "hsl(var(--destructive))",
              marginBottom: "1.25rem",
            }}
          >
            <AlertCircle size={36} />
          </div>

          <h1 style={{ fontSize: "1.65rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Invalid or Expired Link
          </h1>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.95rem", lineHeight: 1.5, margin: "0 0 1.75rem" }}>
            This password reset link is invalid, expired, or has already been used. For your security, password reset links are one-time use only.
          </p>

          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate({ to: "/login" })}
            style={{ fontWeight: 600 }}
          >
            Request New Reset Link
          </Button>

          <div style={{ marginTop: "1.25rem" }}>
            <Link to="/login" className="text-link text-sm" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <ArrowLeft size={14} /> Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. RESET PASSWORD FORM ──
  return (
    <div className="account-container page-width">
      <div className="auth-card" style={{ maxWidth: 460, margin: "2.5rem auto" }}>
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
              marginBottom: "0.75rem",
            }}
          >
            <Crown size={28} />
          </div>
          <div style={{ fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(var(--primary))", marginBottom: "0.25rem" }}>
            The Gold Crown
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.4rem" }}>
            Reset Your Password
          </h1>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.95rem", margin: 0 }}>
            Enter your new password below to secure your account.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: 8,
              background: "hsl(var(--destructive) / 0.1)",
              border: "1px solid hsl(var(--destructive) / 0.3)",
              color: "hsl(var(--destructive))",
              fontSize: "0.88rem",
              marginBottom: "1.25rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.6rem",
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {/* New Password */}
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              New Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={5}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 8 characters"
                className="field"
                style={{ width: "100%", paddingRight: "2.75rem" }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "hsl(var(--muted-foreground))",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Strength Bar */}
            {strengthLabel && (
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>Password Strength</span>
                  <span style={{ color: strengthLabel.color, fontWeight: 600 }}>{strengthLabel.text}</span>
                </div>
                <div style={{ height: 4, width: "100%", background: "hsl(var(--border))", borderRadius: 2, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${strengthLabel.percent}%`,
                      background: strengthLabel.color,
                      transition: "width 0.3s ease, background-color 0.3s ease",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}>
              Confirm New Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={5}
                maxLength={128}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="field"
                style={{ width: "100%", paddingRight: "2.75rem" }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "hsl(var(--muted-foreground))",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px",
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Match Indicator */}
            {confirmPassword.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  marginTop: "0.4rem",
                  fontSize: "0.78rem",
                  color: passwordChecks.matches ? "hsl(142 71% 45%)" : "hsl(var(--destructive))",
                }}
              >
                {passwordChecks.matches ? (
                  <>
                    <Check size={14} /> <span>Passwords match</span>
                  </>
                ) : (
                  <>
                    <X size={14} /> <span>Passwords do not match</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Guidelines */}
          <div
            style={{
              padding: "0.75rem 0.85rem",
              borderRadius: 6,
              background: "hsl(var(--muted) / 0.4)",
              fontSize: "0.78rem",
              color: "hsl(var(--muted-foreground))",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <ShieldCheck size={14} className="text-primary" />
              <span>Password requirements:</span>
            </div>
            <div style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <span style={{ color: passwordChecks.length ? "hsl(142 71% 45%)" : undefined }}>
                • Minimum 8 characters recommended (Shopify requires at least 5)
              </span>
              <span style={{ color: passwordChecks.hasNumberOrSpecial ? "hsl(142 71% 45%)" : undefined }}>
                • Include numbers or special characters for stronger security
              </span>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting || (confirmPassword.length > 0 && !passwordChecks.matches)}
            className="w-full"
            size="lg"
            style={{ fontWeight: 600, marginTop: "0.5rem" }}
          >
            {submitting ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <KeyRound size={18} className="animate-spin" /> Updating Password...
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                <KeyRound size={18} /> Reset Password
              </span>
            )}
          </Button>
        </form>

        <div
          style={{
            marginTop: "1.75rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid hsl(var(--border))",
            textAlign: "center",
          }}
        >
          <Link
            to="/login"
            className="text-link text-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
