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
    return {
      ok: false,
      status: res.status,
      error: typeof body.error === "string" ? body.error : "export_failed",
      message: typeof body.message === "string" ? body.message : text || undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
      publicUrl: typeof body.publicUrl === "string" ? body.publicUrl : undefined,
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
