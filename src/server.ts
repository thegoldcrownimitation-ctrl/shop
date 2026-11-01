import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  handleAuthLogin,
  handleAuthCallback,
  handleAuthSession,
  handleAuthLogout,
  handleCustomerGraphQLProxy,
  handleAuthStatus,
} from "./server/shopify-auth";
import { handleCustomerResetPassword } from "./server/shopify-reset-password";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // 1. Customer Reset Password Backend Endpoint
    if (url.pathname === "/api/customer/reset-password") {
      return await handleCustomerResetPassword(request);
    }

    // 2. Shopify Email Click-Tracking Links: /_t/*
    // Shopify Email wraps all outgoing email links in /_t/c/v3/...
    // We resolve it against the Shopify store domain and redirect to the un-tracked target path.
    if (url.pathname.startsWith("/_t/")) {
      const storeDomain = (
        process.env.SHOPIFY_STOREFRONT_DOMAIN ||
        process.env.VITE_SHOPIFY_STORE_DOMAIN ||
        "thegoldcrownimitation.myshopify.com"
      ).replace(/^['"]|['"]$/g, "").trim();

      try {
        const shopifyTarget = `https://${storeDomain}${url.pathname}${url.search}`;
        const shopifyRes = await fetch(shopifyTarget, {
          method: "GET",
          headers: {
            "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0",
            "Accept": request.headers.get("accept") || "*/*",
          },
          redirect: "manual",
        });

        const location = shopifyRes.headers.get("location");
        if (location) {
          const locUrl = new URL(location, url.origin);
          // If the tracking link resolves to account reset
          if (locUrl.pathname.startsWith("/account/reset/")) {
            const canonicalResetUrl = `https://${storeDomain}${locUrl.pathname}${locUrl.search}`;
            const destination = new URL(`/reset-password?reset_url=${encodeURIComponent(canonicalResetUrl)}`, url.origin);
            return Response.redirect(destination.toString(), 302);
          }
          // If tracking link resolves to storefront internal path or homepage
          if (locUrl.origin === url.origin || locUrl.hostname.includes("thegoldcrownjewellery.com")) {
            const destination = new URL(`${locUrl.pathname}${locUrl.search}`, url.origin);
            return Response.redirect(destination.toString(), 302);
          }
          // Otherwise redirect to the destination Shopify returned
          return Response.redirect(location, 302);
        }
      } catch (err) {
        console.error("[server] Failed to proxy Shopify email tracking URL:", err);
      }
      return Response.redirect(new URL("/", url.origin).toString(), 302);
    }

    // 3. Direct Fallback: If customer clicks an email linking directly to /account/reset/:id/:token
    if (url.pathname.startsWith("/account/reset/")) {
      const storeDomain = (
        process.env.SHOPIFY_STOREFRONT_DOMAIN ||
        process.env.VITE_SHOPIFY_STORE_DOMAIN ||
        "thegoldcrownimitation.myshopify.com"
      ).replace(/^['"]|['"]$/g, "").trim();
      const shopifyResetUrl = `https://${storeDomain}${url.pathname}${url.search}`;
      const destination = new URL(`/reset-password?reset_url=${encodeURIComponent(shopifyResetUrl)}`, url.origin);
      return Response.redirect(destination.toString(), 302);
    }

    // 4. Shopify Hosted Checkout Handoff:
    // If a request arrives directly at /cart/c/* or /checkouts/* on the custom domain,
    // redirect to Shopify's secure checkout domain so it never renders a 404.
    if (url.pathname.startsWith("/cart/c/") || url.pathname.startsWith("/checkouts/") || url.pathname.includes("/checkouts/")) {
      const storeDomain = (
        process.env.SHOPIFY_STOREFRONT_DOMAIN ||
        process.env.VITE_SHOPIFY_STORE_DOMAIN ||
        "thegoldcrownimitation.myshopify.com"
      ).replace(/^['"]|['"]$/g, "").trim();
      const shopifyCheckoutUrl = `https://${storeDomain}${url.pathname}${url.search}`;
      return Response.redirect(shopifyCheckoutUrl, 302);
    }

    // 5. Route Shopify Customer Account API Auth Endpoints (BFF)
    if (url.pathname.startsWith("/api/auth/")) {
      try {
        switch (url.pathname) {
          case "/api/auth/login":
            return await handleAuthLogin(request, false);
          case "/api/auth/register":
            return await handleAuthLogin(request, true);
          case "/api/auth/callback":
            return await handleAuthCallback(request);
          case "/api/auth/session":
            return await handleAuthSession(request);
          case "/api/auth/logout":
            return await handleAuthLogout(request);
          case "/api/auth/graphql":
            return await handleCustomerGraphQLProxy(request);
          case "/api/auth/status":
            return handleAuthStatus();
        }
      } catch (authError) {
        console.error("[server] Auth route handler exception:", authError);
        return new Response(
          JSON.stringify({ error: authError instanceof Error ? authError.message : "Internal auth error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
