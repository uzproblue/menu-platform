import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getLocationMenuWithAuthServer,
  getLocationsWithAuthServer,
  getLocationWithAuthServer,
} from "@/lib/auth-api";
import { purgeCloudflareUrls } from "@/lib/cloudflare-cache";
import { buildLocationPublicExport } from "@/lib/data/location-public-export";
import {
  makeLocationPublicExportObjectKey,
  putLocationPublicExportToR2,
} from "@/lib/r2-location-export";
import { getR2UploadConfig } from "@/lib/r2-upload";

/** Result of Cloudflare CDN purge for the public snapshot URL(s). */
export type LocationSnapshotPurgeDetail = {
  /** URLs sent to Cloudflare `purge_cache` (canonical + any `LOCATION_EXPORT_PURGE_EXTRA_BASES`). */
  urls: string[];
  /** True when purge API succeeded for all URLs. */
  purgeOk: boolean;
  /** True when credentials were missing and purge was not attempted. */
  skipped: boolean;
  message?: string;
};

export type LocationExportResult =
  | { ok: true; publicUrl: string; objectKey: string; purge: LocationSnapshotPurgeDetail }
  | { ok: false; message: string };

/** Comma-separated origins (no path), same object key appended — e.g. guest `MENU_PUBLIC_BASE_URL` if it differs from `R2_PUBLIC_BASE_URL`. */
function parseLocationExportPurgeExtraBases(): string[] {
  const raw = process.env.LOCATION_EXPORT_PURGE_EXTRA_BASES?.trim() ?? "";
  if (!raw.length) return [];
  return raw
    .split(/[,]+/)
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function buildLocationSnapshotPurgeUrls(
  publicUrl: string,
  objectKey: string,
): string[] {
  const urls = new Set<string>();
  urls.add(publicUrl.trim());
  for (const base of parseLocationExportPurgeExtraBases()) {
    urls.add(`${base}/${objectKey}`);
  }
  return [...urls];
}

function logPurgeOutcome(
  context: string,
  detail: LocationSnapshotPurgeDetail,
): void {
  if (detail.skipped) {
    console.warn(
      `[${context}] Cloudflare CDN purge skipped — guest menus may stay stale up to Cache-Control max-age/s-maxage. Set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN on menu-platform; align MENU_PUBLIC_BASE_URL with R2_PUBLIC_BASE_URL or set LOCATION_EXPORT_PURGE_EXTRA_BASES.`,
      { urls: detail.urls },
    );
    return;
  }
  if (!detail.purgeOk) {
    console.warn(`[${context}] Cloudflare CDN purge failed`, {
      urls: detail.urls,
      message: detail.message,
    });
    return;
  }
  console.info(`[${context}] Cloudflare CDN purge ok`, { urls: detail.urls });
}

export type SyncAndPurgeAllLocationExportsResult = {
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  failures: Array<{ locationId: string; message: string }>;
  /** Set when the batch was scheduled on `ctx.waitUntil` (non-strict Workers); counts are placeholders. */
  deferred?: boolean;
};

/**
 * Refreshes every location's public R2 export after a catalog change.
 * On Cloudflare with `LOCATION_EXPORT_STRICT` off (default), runs in the background so the
 * HTTP handler can return before the batch finishes — avoids Worker wall-clock timeouts that
 * surface in the browser as "Failed to fetch" / generic network errors.
 */
export async function scheduleOrAwaitAllRestaurantLocationExports(
  accessToken: string,
): Promise<SyncAndPurgeAllLocationExportsResult> {
  if (isLocationExportStrict()) {
    return syncAndPurgeAllRestaurantLocationExports(accessToken);
  }

  try {
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(
      syncAndPurgeAllRestaurantLocationExports(accessToken).catch((err) => {
        console.error(
          "[scheduleOrAwaitAllRestaurantLocationExports] background sync failed",
          err,
        );
      }),
    );
    return {
      ok: true,
      total: 0,
      succeeded: 0,
      failed: 0,
      failures: [],
      deferred: true,
    };
  } catch {
    /* `next dev` or non-Workers: no execution context */
  }

  return syncAndPurgeAllRestaurantLocationExports(accessToken);
}

/**
 * Fetches latest location + published menu from the auth API and uploads the public menu snapshot
 * to R2 as Brotli-compressed JSON (`Content-Encoding: br`).
 */
export async function syncLocationPublicExportToR2(
  accessToken: string,
  locationId: string,
): Promise<
  | { ok: true; publicUrl: string; objectKey: string }
  | { ok: false; message: string }
> {
  const [locRes, menuRes] = await Promise.all([
    getLocationWithAuthServer(accessToken, locationId),
    getLocationMenuWithAuthServer(accessToken, locationId),
  ]);

  if (!locRes.ok) {
    return {
      ok: false,
      message: locRes.message ?? locRes.error ?? "location_fetch_failed",
    };
  }
  if (!menuRes.ok) {
    return {
      ok: false,
      message: menuRes.message ?? menuRes.error ?? "menu_fetch_failed",
    };
  }

  const payload = buildLocationPublicExport(
    locRes.data.location,
    menuRes.data,
  );

  try {
    const { publicUrl, objectKey } = await putLocationPublicExportToR2(
      locationId,
      payload,
    );
    return { ok: true, publicUrl, objectKey };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "location_export_upload_failed";
    return { ok: false, message };
  }
}

export async function syncAndPurgeLocationPublicExport(
  accessToken: string,
  locationId: string,
): Promise<LocationExportResult> {
  const syncRes = await syncLocationPublicExportToR2(accessToken, locationId);
  if (!syncRes.ok) {
    return syncRes;
  }

  const urls = buildLocationSnapshotPurgeUrls(syncRes.publicUrl, syncRes.objectKey);
  const purgeRes = await purgeCloudflareUrls(urls);

  const purge: LocationSnapshotPurgeDetail = {
    urls,
    purgeOk: purgeRes.ok,
    skipped: !purgeRes.ok ? Boolean(purgeRes.skipped) : false,
    message: !purgeRes.ok ? purgeRes.message : undefined,
  };

  if (!purgeRes.ok && !purge.skipped) {
    logPurgeOutcome("syncAndPurgeLocationPublicExport", purge);
    return { ok: false, message: purge.message ?? "purge_failed" };
  }

  logPurgeOutcome("syncAndPurgeLocationPublicExport", purge);

  return { ok: true, publicUrl: syncRes.publicUrl, objectKey: syncRes.objectKey, purge };
}

export async function purgeLocationPublicExportUrl(
  locationId: string,
): Promise<
  | { ok: true; purge: LocationSnapshotPurgeDetail }
  | { ok: false; message: string; skipped?: boolean; purge?: LocationSnapshotPurgeDetail }
> {
  try {
    const config = getR2UploadConfig();
    const objectKey = makeLocationPublicExportObjectKey(locationId);
    const publicUrl = `${config.publicBaseUrl}/${objectKey}`;
    const urls = buildLocationSnapshotPurgeUrls(publicUrl, objectKey);
    const purgeRes = await purgeCloudflareUrls(urls);
    const purge: LocationSnapshotPurgeDetail = {
      urls,
      purgeOk: purgeRes.ok,
      skipped: !purgeRes.ok ? Boolean(purgeRes.skipped) : false,
      message: !purgeRes.ok ? purgeRes.message : undefined,
    };

    if (!purgeRes.ok && !purge.skipped) {
      logPurgeOutcome("purgeLocationPublicExportUrl", purge);
      return { ok: false, message: purge.message ?? "purge_failed", purge };
    }

    logPurgeOutcome("purgeLocationPublicExportUrl", purge);
    return { ok: true, purge };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "location_export_purge_build_failed",
    };
  }
}

export async function syncAndPurgeAllRestaurantLocationExports(
  accessToken: string,
  concurrency = 4,
): Promise<SyncAndPurgeAllLocationExportsResult> {
  const locationsRes = await getLocationsWithAuthServer(accessToken);
  if (!locationsRes.ok) {
    return {
      ok: false,
      total: 0,
      succeeded: 0,
      failed: 1,
      failures: [
        {
          locationId: "*",
          message:
            locationsRes.message ??
            locationsRes.error ??
            "locations_fetch_failed",
        },
      ],
    };
  }

  const locationIds = locationsRes.data.locations.map((location) => location.id);
  const total = locationIds.length;
  const failures: Array<{ locationId: string; message: string }> = [];
  let succeeded = 0;

  const workerCount = Math.min(
    Math.max(1, Math.floor(concurrency) || 1),
    Math.max(1, total),
  );

  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= total) return;

      const locationId = locationIds[current];
      const result = await syncAndPurgeLocationPublicExport(
        accessToken,
        locationId,
      );

      if (result.ok) {
        succeeded += 1;
      } else {
        failures.push({ locationId, message: result.message });
      }
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      await worker();
    }),
  );

  const failed = failures.length;
  return {
    ok: failed === 0,
    total,
    succeeded,
    failed,
    failures,
  };
}

export function isLocationExportStrict(): boolean {
  const v = process.env.LOCATION_EXPORT_STRICT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Shape for `locationExport` on settings API JSON responses. */
export function toLocationExportApiField(result: LocationExportResult):
  | { ok: true; publicUrl: string; purge: LocationSnapshotPurgeDetail }
  | { ok: false; message: string } {
  if (result.ok) {
    return { ok: true, publicUrl: result.publicUrl, purge: result.purge };
  }
  return { ok: false, message: result.message };
}
