import {
  getLocationMenuWithAuthServer,
  getLocationsWithAuthServer,
  getLocationWithAuthServer,
} from "@/lib/auth-api";
import { purgeCloudflareUrl } from "@/lib/cloudflare-cache";
import { buildLocationPublicExport } from "@/lib/data/location-public-export";
import {
  makeLocationPublicExportObjectKey,
  putLocationPublicExportToR2,
} from "@/lib/r2-location-export";
import { getR2UploadConfig } from "@/lib/r2-upload";

export type LocationExportResult =
  | { ok: true; publicUrl: string; objectKey: string }
  | { ok: false; message: string };

export type SyncAndPurgeAllLocationExportsResult = {
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  failures: Array<{ locationId: string; message: string }>;
};

/**
 * Fetches latest location + published menu from the auth API and uploads the public menu snapshot
 * to R2 as Brotli-compressed JSON (`Content-Encoding: br`).
 */
export async function syncLocationPublicExportToR2(
  accessToken: string,
  locationId: string,
): Promise<LocationExportResult> {
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

  const purgeRes = await purgeCloudflareUrl(syncRes.publicUrl);
  if (!purgeRes.ok && !purgeRes.skipped) {
    return { ok: false, message: purgeRes.message };
  }

  return syncRes;
}

export async function purgeLocationPublicExportUrl(
  locationId: string,
): Promise<{ ok: true } | { ok: false; message: string; skipped?: boolean }> {
  try {
    const config = getR2UploadConfig();
    const objectKey = makeLocationPublicExportObjectKey(locationId);
    const publicUrl = `${config.publicBaseUrl}/${objectKey}`;
    const purgeRes = await purgeCloudflareUrl(publicUrl);
    if (!purgeRes.ok) {
      return {
        ok: false,
        message: purgeRes.message,
        skipped: purgeRes.skipped,
      };
    }
    return { ok: true };
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
