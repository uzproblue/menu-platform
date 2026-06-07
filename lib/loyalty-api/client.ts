/**
 * Transport and shared request helpers for menu-loyalty-worker API calls.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { RESTAURANT_ID_HEADER } from "@/lib/auth-api/client";

export const LOYALTY_API_UNAVAILABLE_MESSAGE =
  "menu-loyalty-worker is not configured (Cloudflare MENU_LOYALTY binding or LOYALTY_API_BASE_URL for local HTTP)";

const SERVICE_BINDING_ORIGIN = "http://menu-loyalty-worker.internal";

type LoyaltyApiTransport =
  | { mode: "service"; fetcher: Fetcher }
  | { mode: "http"; baseUrl: string };

function getLoyaltyApiBaseUrl(): string | null {
  const base = process.env.LOYALTY_API_BASE_URL?.trim();
  return base?.length ? base.replace(/\/$/, "") : null;
}

export function getLoyaltyApiTransport(): LoyaltyApiTransport | null {
  const base = getLoyaltyApiBaseUrl();
  if (base) return { mode: "http", baseUrl: base };

  try {
    const { env } = getCloudflareContext();
    const fetcher = (env as { MENU_LOYALTY?: Fetcher }).MENU_LOYALTY;
    if (fetcher) {
      return { mode: "service", fetcher };
    }
  } catch {
    /* not in OpenNext / Workers request context */
  }
  return null;
}

export function loyaltyRequestHeaders(
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

export async function loyaltyApiFetch(
  transport: LoyaltyApiTransport,
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

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

export type LoyaltyApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; message?: string };

export type LoyaltyApiVoidResult =
  | { ok: true }
  | { ok: false; status: number; error: string; message?: string };

type LoyaltyApiRequestOpts = {
  path: string;
  method: string;
  accessToken?: string;
  restaurantId?: string;
  body?: unknown;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
};

function buildHeaders(opts: LoyaltyApiRequestOpts): HeadersInit {
  const h: Record<string, string> = { ...opts.extraHeaders };
  if (opts.body !== undefined) {
    h["Content-Type"] = "application/json";
  }
  if (opts.accessToken) {
    return loyaltyRequestHeaders(opts.accessToken, opts.restaurantId, h);
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

function unavailableResult(): LoyaltyApiResult<never> {
  return {
    ok: false,
    status: 503,
    error: "loyalty_api_unavailable",
    message: LOYALTY_API_UNAVAILABLE_MESSAGE,
  };
}

export async function loyaltyApiJson<T>(
  opts: LoyaltyApiRequestOpts,
): Promise<LoyaltyApiResult<T>> {
  const transport = getLoyaltyApiTransport();
  if (!transport) return unavailableResult();

  try {
    const res = await loyaltyApiFetch(transport, opts.path, {
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
    if (res.status === 204) {
      return { ok: true, data: undefined as T };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "upstream_unreachable",
      message: "Could not reach loyalty API server",
    };
  }
}

export async function loyaltyApiVoid(
  opts: LoyaltyApiRequestOpts,
): Promise<LoyaltyApiVoidResult> {
  const result = await loyaltyApiJson<unknown>(opts);
  if (!result.ok) return result;
  return { ok: true };
}
