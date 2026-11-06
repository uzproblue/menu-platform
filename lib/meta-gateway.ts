/**
 * Server-side transport to meta-gateway for WhatsApp pairing.
 * Production uses the META_GATEWAY service binding.
 * Local next dev uses META_GATEWAY_BASE_URL so the OpenNext stub is not used.
 * The gateway JWT is minted per request and never returned to the browser.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { authApiFetch, getAuthApiTransport } from "@/lib/auth-api/client";

const SERVICE_BINDING_ORIGIN = "http://meta-gateway.internal";

type WorkerFetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type Transport =
  | { mode: "service"; fetcher: WorkerFetcher }
  | { mode: "http"; baseUrl: string };

function configuredBaseUrl(): string | null {
  const base = process.env.META_GATEWAY_BASE_URL?.trim();
  return base?.length ? base.replace(/\/$/, "") : null;
}

function serviceFetcher(): WorkerFetcher | null {
  try {
    const { env } = getCloudflareContext();
    return env.META_GATEWAY ?? null;
  } catch {
    return null;
  }
}

function transport(): Transport | null {
  // Prefer explicit local HTTP first (same rationale as auth-api client).
  const base = configuredBaseUrl();
  if (base) return { mode: "http", baseUrl: base };

  const fetcher = serviceFetcher();
  if (fetcher) return { mode: "service", fetcher };
  return null;
}

export async function metaGatewayFetch(path: string, init?: RequestInit): Promise<Response> {
  const selected = transport();
  if (!selected) {
    throw new Error("meta-gateway is not configured (META_GATEWAY binding or META_GATEWAY_BASE_URL)");
  }
  const url =
    selected.mode === "http"
      ? new URL(path, `${selected.baseUrl}/`).toString()
      : `${SERVICE_BINDING_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
  const request = new Request(url, init);
  if (selected.mode === "service") return selected.fetcher.fetch(request);
  return fetch(request);
}

async function mintGatewayToken(
  accessToken: string,
  locationId: string,
): Promise<{ token: string } | { response: Response }> {
  const authTransport = getAuthApiTransport();
  if (!authTransport) {
    return {
      response: NextResponse.json(
        { error: "auth_unavailable", message: "menu-server is not configured" },
        { status: 502 },
      ),
    };
  }
  const tokenRes = await authApiFetch(authTransport, "/api/auth/meta-gateway-token", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ locationId }),
  });
  if (!tokenRes.ok) {
    const payload = (await tokenRes.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    return {
      response: NextResponse.json(
        {
          error: payload?.error ?? "gateway_token_denied",
          message:
            payload?.message ??
            "Could not mint a meta-gateway token for this location. Owner or admin access is required.",
        },
        { status: tokenRes.status },
      ),
    };
  }
  const payload = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
  if (!payload?.access_token) {
    return {
      response: NextResponse.json({ error: "token_missing" }, { status: 502 }),
    };
  }
  return { token: payload.access_token };
}

export async function gatewayFetch(
  accessToken: string,
  locationId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const minted = await mintGatewayToken(accessToken, locationId);
  if ("response" in minted) return minted.response;
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${minted.token}`);
  return metaGatewayFetch(path, { ...init, headers });
}

export function gatewayResponse(
  upstream: Response,
  body: BodyInit | null,
  extra?: HeadersInit,
): NextResponse {
  const headers = new Headers(extra);
  const contentType = upstream.headers.get("content-type");
  if (contentType && !headers.has("content-type")) headers.set("content-type", contentType);
  return new NextResponse(body, { status: upstream.status, headers });
}

export async function proxyGateway(
  accessToken: string,
  locationId: string,
  path: string,
  init?: RequestInit,
): Promise<NextResponse> {
  try {
    const upstream = await gatewayFetch(accessToken, locationId, path, init);
    // Mint failures already return NextResponse JSON from gatewayFetch's early path,
    // but gatewayFetch returns a plain Response — detect non-gateway error bodies via status.
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.startsWith("application/json") || contentType.startsWith("text/") || !upstream.body) {
      return gatewayResponse(upstream, await upstream.text());
    }
    return gatewayResponse(upstream, upstream.body, {
      "cache-control": upstream.headers.get("cache-control") ?? "private, max-age=60",
      "x-content-type-options": "nosniff",
    });
  } catch {
    return NextResponse.json({ error: "gateway_unavailable" }, { status: 502 });
  }
}

export function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(id);
}
