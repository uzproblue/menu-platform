import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const POS_SYNC_API_UNAVAILABLE_MESSAGE =
  "menu-pos-sync-worker is not configured (MENU_POS_SYNC binding, or POS_SYNC_API_BASE_URL for local dev)";

const SERVICE_BINDING_ORIGIN = "http://menu-pos-sync-worker.internal";

type PosSyncTransport =
  | { mode: "service"; fetcher: Fetcher }
  | { mode: "http"; baseUrl: string };

function getPosSyncApiBaseUrl(): string | null {
  const base = process.env.POS_SYNC_API_BASE_URL?.trim();
  return base?.length ? base.replace(/\/$/, "") : null;
}

async function getMenuPosSyncFetcher(): Promise<Fetcher | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).MENU_POS_SYNC;
  } catch {
    return undefined;
  }
}

export async function getSyncServiceSecret(): Promise<string | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const fromBinding = (env as CloudflareEnv).SYNC_SERVICE_SECRET?.trim();
    if (fromBinding) return fromBinding;
  } catch {
    /* not in Workers context */
  }
  const fromProcess = process.env.SYNC_SERVICE_SECRET?.trim();
  return fromProcess || null;
}

export async function getPosSyncTransport(): Promise<PosSyncTransport | null> {
  const base = getPosSyncApiBaseUrl();

  if (base && process.env.NODE_ENV === "development") {
    return { mode: "http", baseUrl: base };
  }

  const fetcher = await getMenuPosSyncFetcher();
  if (fetcher) {
    return { mode: "service", fetcher };
  }

  if (base) return { mode: "http", baseUrl: base };
  return null;
}

export async function posSyncWorkerFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const transport = await getPosSyncTransport();
  if (!transport) {
    return Response.json(
      {
        error: "pos_sync_api_unavailable",
        message: POS_SYNC_API_UNAVAILABLE_MESSAGE,
      },
      { status: 503 },
    );
  }

  const secret = await getSyncServiceSecret();
  const headers = new Headers(init.headers);
  if (secret) {
    headers.set("X-Sync-Service-Secret", secret);
  }

  const url =
    transport.mode === "http"
      ? new URL(path, `${transport.baseUrl}/`).toString()
      : `${SERVICE_BINDING_ORIGIN}${path}`;

  try {
    const request = new Request(url, { ...init, headers });
    if (transport.mode === "service") {
      return await transport.fetcher.fetch(request);
    }
    return await fetch(request);
  } catch {
    return Response.json(
      {
        error: "upstream_unreachable",
        message:
          transport.mode === "http"
            ? `Could not reach menu-pos-sync-worker at ${transport.baseUrl}. Is it running?`
            : "Could not reach menu-pos-sync-worker via MENU_POS_SYNC binding.",
      },
      { status: 502 },
    );
  }
}
