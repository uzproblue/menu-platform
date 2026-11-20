import { getCloudflareContext } from "@opennextjs/cloudflare";

const SERVICE_BINDING_ORIGIN = "http://menu-2gis-worker.internal";

export const TWO_GIS_WORKER_UNAVAILABLE_MESSAGE =
  "menu-2gis-worker is not configured (Cloudflare MENU_2GIS binding or TWO_GIS_WORKER_URL for local HTTP)";

type TwoGisTransport =
  | { mode: "service"; fetcher: Fetcher }
  | { mode: "http"; baseUrl: string };

function getTwoGisTransport(): TwoGisTransport | null {
  const base = process.env.TWO_GIS_WORKER_URL?.trim();
  if (base?.length) {
    return { mode: "http", baseUrl: base.replace(/\/$/, "") };
  }
  try {
    const { env } = getCloudflareContext();
    const fetcher = (env as { MENU_2GIS?: Fetcher }).MENU_2GIS;
    if (fetcher) return { mode: "service", fetcher };
  } catch {
    /* not in Workers request context */
  }
  return null;
}

export type TwoGisExportWorkerResult =
  | {
      ok: true;
      locationId: string;
      publicUrl: string;
      objectKey: string;
      offerCount: number;
      categoryCount: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
      message?: string;
      reason?: string;
      publicUrl?: string;
    };

export async function requestTwoGisLocationExport(
  locationId: string,
): Promise<TwoGisExportWorkerResult> {
  const transport = getTwoGisTransport();
  if (!transport) {
    return {
      ok: false,
      status: 503,
      error: "service_unavailable",
      message: TWO_GIS_WORKER_UNAVAILABLE_MESSAGE,
    };
  }

  const path = `/export/${encodeURIComponent(locationId.trim())}`;
  const url =
    transport.mode === "http"
      ? new URL(path, `${transport.baseUrl}/`).toString()
      : `${SERVICE_BINDING_ORIGIN}${path}`;
  const request = new Request(url, { method: "POST" });
  const res =
    transport.mode === "service"
      ? await transport.fetcher.fetch(request)
      : await fetch(request);

  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }

  if (!res.ok) {
    const error =
      typeof body.error === "string" ? body.error : "export_failed";
    const reason =
      typeof body.reason === "string" ? body.reason : undefined;
    // Prefer structured fields; avoid stuffing the raw JSON body into message
    // when the worker already returned error/reason (prevents nested JSON).
    let message: string | undefined;
    if (typeof body.message === "string" && body.message.trim()) {
      const trimmed = body.message.trim();
      // Worker sometimes returns the whole JSON as message — unwrap once.
      if (trimmed.startsWith("{")) {
        try {
          const nested = JSON.parse(trimmed) as Record<string, unknown>;
          if (typeof nested.message === "string") {
            message = nested.message;
          } else if (typeof nested.reason === "string") {
            message = nested.reason;
          }
        } catch {
          message = trimmed;
        }
      } else {
        message = trimmed;
      }
    } else if (reason) {
      message = reason;
    } else if (error !== "export_failed") {
      message = error;
    } else if (text && !text.startsWith("{")) {
      message = text;
    }

    return {
      ok: false,
      status: res.status,
      error,
      message,
      reason,
      publicUrl:
        typeof body.publicUrl === "string" ? body.publicUrl : undefined,
    };
  }

  return {
    ok: true,
    locationId: String(body.locationId ?? locationId),
    publicUrl: String(body.publicUrl ?? ""),
    objectKey: String(body.objectKey ?? ""),
    offerCount: Number(body.offerCount ?? 0),
    categoryCount: Number(body.categoryCount ?? 0),
  };
}
