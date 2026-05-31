/**
 * Transport and shared request helpers for menu-server API calls.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

export const AUTH_API_UNAVAILABLE_MESSAGE =
  "menu-server is not configured (Cloudflare MENU_SERVER binding or AUTH_API_BASE_URL for local HTTP)";

/** Origin is ignored for service-binding `fetch`; only path matters. */
const SERVICE_BINDING_ORIGIN = "http://menu-server.internal";

type AuthApiTransport =
  | { mode: "service"; fetcher: Fetcher }
  | { mode: "http"; baseUrl: string };

function getAuthApiBaseUrl(): string | null {
  const base = process.env.AUTH_API_BASE_URL?.trim();
  return base?.length ? base.replace(/\/$/, "") : null;
}

export function getAuthApiTransport(): AuthApiTransport | null {
  // Prefer explicit local HTTP first. `AUTH_API_BASE_URL` is opt-in (only set
  // for local dev) and never present in production, so this preserves the
  // service-binding path in deployed Workers.
  //
  // Why this order matters: plain `next dev` invokes
  // `initOpenNextCloudflareForDev()` which exposes `env.MENU_SERVER` as a
  // miniflare stub even when no real menu-server worker is running. Letting
  // that stub win silently swallows every login as a 401 because the stub
  // fetch always fails.
  const base = getAuthApiBaseUrl();
  if (base) return { mode: "http", baseUrl: base };

  try {
    const { env } = getCloudflareContext();
    const fetcher = env.MENU_SERVER;
    if (fetcher) {
      return { mode: "service", fetcher };
    }
  } catch {
    /* not in OpenNext / Workers request context */
  }
  return null;
}

export const RESTAURANT_ID_HEADER = "x-restaurant-id";

export function authRequestHeaders(
  accessToken: string,
  restaurantId?: string,
  extra?: Record<string, string>,
): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
  if (restaurantId) h[RESTAURANT_ID_HEADER] = restaurantId;
  return h;
}

export async function authApiFetch(
  transport: AuthApiTransport,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const url =
    transport.mode === "http"
      ? new URL(path, `${transport.baseUrl}/`).toString()
      : `${SERVICE_BINDING_ORIGIN}${path}`;
  const request = new Request(url, init);
  if (transport.mode === "service") {
    return transport.fetcher.fetch(request);
  }
  return fetch(request);
}

export type AuthApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; message?: string };

export type AuthApiVoidResult =
  | { ok: true }
  | { ok: false; status: number; error: string; message?: string };

const DEFAULT_NETWORK_ERROR = {
  status: 502,
  error: "upstream_unreachable",
  message: "Could not reach auth API server",
} as const;

type AuthApiRequestOpts = {
  path: string;
  method: string;
  accessToken?: string;
  restaurantId?: string;
  body?: unknown;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
  networkError?: {
    status: number;
    error: string;
    message: string;
  };
};

function buildHeaders(opts: AuthApiRequestOpts): HeadersInit {
  const h: Record<string, string> = { ...opts.extraHeaders };
  if (opts.body !== undefined) {
    h["Content-Type"] = "application/json";
  }
  if (opts.accessToken) {
    return authRequestHeaders(opts.accessToken, opts.restaurantId, h);
  }
  return h;
}

async function parseErrorFromResponse(
  res: Response,
): Promise<{ error: string; message?: string }> {
  let payload: ApiErrorResponse | null = null;
  try {
    payload = (await res.json()) as ApiErrorResponse;
  } catch {
    payload = null;
  }
  return {
    error: payload?.error ?? "request_failed",
    message: payload?.message,
  };
}

function unavailableResult(): AuthApiResult<never> {
  return {
    ok: false,
    status: 503,
    error: "auth_api_unavailable",
    message: AUTH_API_UNAVAILABLE_MESSAGE,
  };
}

function networkFailure(opts: AuthApiRequestOpts): AuthApiResult<never> {
  const err = opts.networkError ?? DEFAULT_NETWORK_ERROR;
  return {
    ok: false,
    status: err.status,
    error: err.error,
    message: err.message,
  };
}

export async function authApiJson<T>(opts: AuthApiRequestOpts): Promise<AuthApiResult<T>> {
  const transport = getAuthApiTransport();
  if (!transport) return unavailableResult();

  try {
    const res = await authApiFetch(transport, opts.path, {
      method: opts.method,
      headers: buildHeaders(opts),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    if (!res.ok) {
      const { error, message } = await parseErrorFromResponse(res);
      return { ok: false, status: res.status, error, message };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return networkFailure(opts);
  }
}

export async function authApiVoid(opts: AuthApiRequestOpts): Promise<AuthApiVoidResult> {
  const transport = getAuthApiTransport();
  if (!transport) return unavailableResult();

  try {
    const res = await authApiFetch(transport, opts.path, {
      method: opts.method,
      headers: buildHeaders(opts),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    if (!res.ok) {
      const { error, message } = await parseErrorFromResponse(res);
      return { ok: false, status: res.status, error, message };
    }
    return { ok: true };
  } catch {
    return networkFailure(opts);
  }
}

export { type ApiErrorResponse, parseErrorFromResponse };
