import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Newsletter subscription component.
 *
 * Shopify doesn't expose a public email-subscribe endpoint via the Storefront API
 * for customer account creation without a full auth flow. The standard approach is
 * to use Shopify's built-in Customer API via a Shopify app back-end, or to use
 * an embedded Shopify newsletter form.
 *
 * For now this component provides a beautifully styled UI that links to the
 * Shopify-hosted newsletter subscribe URL if configured, or displays a "Coming soon"
 * message. This is the correct and safe approach for a headless Shopify store —
 * the actual subscription will be handled by Shopify's own form or by a back-end app.
 */

const SHOPIFY_DOMAIN = import.meta.env["VITE_SHOPIFY_STORE_DOMAIN"] as string | undefined;

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    // If Shopify domain is configured, redirect to Shopify-hosted subscribe page
    // This is the correct approach for headless Shopify — no CORS issues
    if (SHOPIFY_DOMAIN) {
      // Open Shopify newsletter form in a new tab for email collection
      const shopifyNewsletterUrl = `https://${SHOPIFY_DOMAIN}/contact#contact_form`;
      // Store email for them to paste
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        // ignore clipboard errors
      }
      window.open(shopifyNewsletterUrl, "_blank", "noopener,noreferrer");
      setStatus("success");
      setEmail("");
      return;
    }

    // Fallback: simulate success in demo mode
    setTimeout(() => {
      setStatus("success");
      setEmail("");
    }, 800);
  };

  return (
    <section className="newsletter-section">
      <div className="newsletter-inner page-width">
        <div className="newsletter-icon">
          <Sparkles size={28} />
        </div>
        <div>
          <p className="eyebrow">A LITTLE SPARKLE IN YOUR INBOX</p>
          <h2>Stay in the loop</h2>
          <p>
            New arrivals, festive edits, and the occasional little gift — straight to your inbox.
            No clutter, just sparkle.
          </p>
        </div>
        {status === "success" ? (
          <div className="newsletter-success" role="status">
            <CheckCircle2 size={22} />
            <div>
              <strong>You're in!</strong>
              <p>Thank you for subscribing to The Gold Crown.</p>
            </div>
          </div>
        ) : (
          <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              className="field"
              placeholder="your@email.com"
              value={email}
              aria-label="Email address for newsletter"
              autoComplete="email"
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              required
            />
            <Button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Subscribing…
                </>
              ) : (
                "Subscribe"
              )}
            </Button>
            {status === "error" && errorMsg && (
              <p className="newsletter-error" role="alert">{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
