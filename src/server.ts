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

    // Route Shopify Customer Account API Auth Endpoints (BFF)
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
