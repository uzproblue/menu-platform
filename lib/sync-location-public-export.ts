import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  getLocationMenuWithAuthServer,
  getLocationsWithAuthServer,
  getLocationWithAuthServer,
  syncCategoryTranslationsWithAuthServer,
  syncMenuItemTranslationsWithAuthServer,
} from "@/lib/auth-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
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
  | {
      ok: true;
      publicUrl: string;
      objectKey: string;
      purge: LocationSnapshotPurgeDetail;
      /** Set when export runs on `ctx.waitUntil` and outcome is not yet known. */
      deferred?: boolean;
    }
  | { ok: false; message: string };

/** Single-flight export per location within a Worker isolate. */
const locationExportInFlight = new Map<string, Promise<LocationExportResult>>();

const RESTAURANT_EXPORT_DEBOUNCE_MS = 3_000;

type PendingCatalogPipeline = {
  options: PostCatalogChangeOptions;
  /** Bumped on each schedule; runner sleeps until generation is stable. */
  generation: number;
};

/** Debounced translation + export per access token (absorbs rapid saves/retries). */
const pendingCatalogPipelines = new Map<string, PendingCatalogPipeline>();

/** One debounce+pipeline runner per token; kept alive via ctx.waitUntil on Workers. */
const catalogPipelineRunners = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type PostCatalogChangeOptions = {
  textFieldsChanged: boolean;
  /** When set, runs POST sync-translations (Gemini). Merged with OR across debounced saves. */
  syncTranslations?: boolean;
  itemId?: string;
  categoryId?: string;
};

function shouldSyncItemTranslations(options: PostCatalogChangeOptions): boolean {
  if (!options.itemId) return false;
  return options.syncTranslations === true || options.textFieldsChanged === true;
}

function shouldSyncCategoryTranslations(options: PostCatalogChangeOptions): boolean {
  if (!options.categoryId) return false;
  return options.syncTranslations === true || options.textFieldsChanged === true;
}

/** When name/description changed or the item still has no guest translation rows. */
export function postCatalogOptionsForMenuItem(
  itemId: string,
  item: { translations?: unknown[] },
  meta?: { textFieldsChanged?: boolean },
): PostCatalogChangeOptions {
  const textFieldsChanged = meta?.textFieldsChanged === true;
  const translationsMissing = (item.translations?.length ?? 0) === 0;
  return {
    textFieldsChanged,
    syncTranslations: textFieldsChanged || translationsMissing,
    itemId,
  };
}

/** When name/description changed or the category still has no guest translation rows. */
export function postCatalogOptionsForCategory(
  categoryId: string,
  category: { translations?: unknown[] },
  meta?: { textFieldsChanged?: boolean },
): PostCatalogChangeOptions {
  const textFieldsChanged = meta?.textFieldsChanged === true;
  const translationsMissing = (category.translations?.length ?? 0) === 0;
  return {
    textFieldsChanged,
    syncTranslations: textFieldsChanged || translationsMissing,
    categoryId,
  };
}

function makeDeferredBatchExportResult(): SyncAndPurgeAllLocationExportsResult {
  return {
    ok: true,
    total: 0,
    succeeded: 0,
    failed: 0,
    failures: [],
    deferred: true,
  };
}

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
function makeDeferredLocationExportResult(
  locationId: string,
): Extract<LocationExportResult, { ok: true }> {
  const config = getR2UploadConfig();
  const objectKey = makeLocationPublicExportObjectKey(locationId);
  const publicUrl = `${config.publicBaseUrl}/${objectKey}`;
  return {
    ok: true,
    publicUrl,
    objectKey,
    deferred: true,
    purge: {
      urls: buildLocationSnapshotPurgeUrls(publicUrl, objectKey),
      purgeOk: false,
      skipped: true,
    },
  };
}

/**
 * One export+purge per `locationId` at a time; concurrent callers share the same promise.
 */
function coalescedSyncAndPurgeLocationPublicExport(
  accessToken: string,
  locationId: string,
): Promise<LocationExportResult> {
  const key = locationId.trim();
  const existing = locationExportInFlight.get(key);
  if (existing) return existing;

  const work = syncAndPurgeLocationPublicExport(accessToken, key).finally(() => {
    locationExportInFlight.delete(key);
  });
  locationExportInFlight.set(key, work);
  return work;
}

/**
 * Refreshes one location's public R2 export after a menu change.
 * Default: `ctx.waitUntil` + single-flight coalescing so rapid toggles do not run N parallel exports.
 */
export async function scheduleOrAwaitLocationPublicExport(
  accessToken: string,
  locationId: string,
): Promise<LocationExportResult> {
  if (isLocationExportStrict()) {
    return coalescedSyncAndPurgeLocationPublicExport(accessToken, locationId);
  }

  const exportWork = coalescedSyncAndPurgeLocationPublicExport(
    accessToken,
    locationId,
  ).catch((err) => {
    console.error(
      "[scheduleOrAwaitLocationPublicExport] background sync failed",
      locationId,
      err,
    );
    return {
      ok: false,
      message: err instanceof Error ? err.message : "location_export_failed",
    } satisfies LocationExportResult;
  });

  try {
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(exportWork);
    return makeDeferredLocationExportResult(locationId);
  } catch {
    /* `next dev` or non-Workers: no execution context */
  }

  return exportWork;
}

async function runCatalogChangePipeline(
  accessToken: string,
  options: PostCatalogChangeOptions,
): Promise<SyncAndPurgeAllLocationExportsResult> {
  const restaurantId = await getSelectedRestaurantIdFromCookies();

  if (shouldSyncItemTranslations(options)) {
    const syncRes = await syncMenuItemTranslationsWithAuthServer(
      accessToken,
      options.itemId!,
      restaurantId,
    );
    if (!syncRes.ok) {
      console.error(
        "[runCatalogChangePipeline] menu item translation sync failed",
        options.itemId,
        syncRes.error,
        syncRes.message,
      );
    } else if (syncRes.data.meta?.skippedReason === "unconfigured") {
      console.error(
        "[runCatalogChangePipeline] menu item translation sync skipped — set CF_AI_GATEWAY_* on menu-server (dynamic route: BASE_URL, DYNAMIC_ROUTE, TOKEN)",
        options.itemId,
      );
    } else if ((syncRes.data.meta?.written ?? syncRes.data.translations.length) === 0) {
      console.warn(
        "[runCatalogChangePipeline] menu item translation sync returned no rows",
        options.itemId,
        syncRes.data.meta?.skippedReason,
      );
    }
  }
  if (shouldSyncCategoryTranslations(options)) {
    const syncRes = await syncCategoryTranslationsWithAuthServer(
      accessToken,
      options.categoryId!,
      restaurantId,
    );
    if (!syncRes.ok) {
      console.error(
        "[runCatalogChangePipeline] category translation sync failed",
        options.categoryId,
        syncRes.error,
        syncRes.message,
      );
    } else if (syncRes.data.meta?.skippedReason === "unconfigured") {
      console.error(
        "[runCatalogChangePipeline] category translation sync skipped — set CF_AI_GATEWAY_* on menu-server (dynamic route: BASE_URL, DYNAMIC_ROUTE, TOKEN)",
        options.categoryId,
      );
    }
  }

  const exportResult = await syncAndPurgeAllRestaurantLocationExports(accessToken);
  if (!exportResult.ok) {
    console.error(
      "[runCatalogChangePipeline] restaurant location export batch failed",
      exportResult.failures,
    );
  }
  return exportResult;
}

function mergeCatalogPipelineOptions(
  current: PostCatalogChangeOptions,
  next: PostCatalogChangeOptions,
): PostCatalogChangeOptions {
  return {
    textFieldsChanged: current.textFieldsChanged || next.textFieldsChanged,
    syncTranslations:
      (current.syncTranslations ?? current.textFieldsChanged) ||
      (next.syncTranslations ?? next.textFieldsChanged),
    itemId: next.itemId ?? current.itemId,
    categoryId: next.categoryId ?? current.categoryId,
  };
}

/**
 * Trailing-edge debounce, then translation sync + location export. Loops while saves
 * arrive during an in-flight pipeline (merged via pendingCatalogPipelines).
 */
async function catalogPipelineRunner(accessToken: string): Promise<void> {
  try {
    for (;;) {
      let options: PostCatalogChangeOptions | null = null;

      while (pendingCatalogPipelines.has(accessToken)) {
        const generation = pendingCatalogPipelines.get(accessToken)!.generation;
        await sleep(RESTAURANT_EXPORT_DEBOUNCE_MS);

        const state = pendingCatalogPipelines.get(accessToken);
        if (!state || state.generation !== generation) {
          continue;
        }

        options = state.options;
        pendingCatalogPipelines.delete(accessToken);
        break;
      }

      if (!options) return;

      await runCatalogChangePipeline(accessToken, options);

      if (!pendingCatalogPipelines.has(accessToken)) return;
    }
  } catch (err) {
    console.error("[catalogPipelineRunner] pipeline failed", err);
  } finally {
    catalogPipelineRunners.delete(accessToken);
    if (pendingCatalogPipelines.has(accessToken)) {
      armCatalogPipelineRunner(accessToken);
    }
  }
}

/** Registers the runner under ctx.waitUntil so the debounce delay survives the HTTP response on Workers. */
function armCatalogPipelineRunner(accessToken: string): void {
  if (catalogPipelineRunners.has(accessToken)) return;
  catalogPipelineRunners.add(accessToken);

  const work = catalogPipelineRunner(accessToken);

  try {
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(work);
  } catch {
    void work;
  }
}

/**
 * After a global catalog write: optionally retranslate (Gemini), then refresh all location R2 snapshots.
 * Default: debounced + `ctx.waitUntil` so HTTP handlers return quickly.
 */
export async function schedulePostCatalogChangePipeline(
  accessToken: string,
  options: PostCatalogChangeOptions,
): Promise<SyncAndPurgeAllLocationExportsResult> {
  if (isLocationExportStrict()) {
    return runCatalogChangePipeline(accessToken, options);
  }

  const existing = pendingCatalogPipelines.get(accessToken);
  const merged = existing
    ? mergeCatalogPipelineOptions(existing.options, options)
    : options;

  pendingCatalogPipelines.set(accessToken, {
    options: merged,
    generation: (existing?.generation ?? 0) + 1,
  });

  armCatalogPipelineRunner(accessToken);
  return makeDeferredBatchExportResult();
}

export async function scheduleOrAwaitAllRestaurantLocationExports(
  accessToken: string,
): Promise<SyncAndPurgeAllLocationExportsResult> {
  return schedulePostCatalogChangePipeline(accessToken, {
    textFieldsChanged: false,
  });
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
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const [locRes, menuRes] = await Promise.all([
    getLocationWithAuthServer(accessToken, locationId, restaurantId),
    getLocationMenuWithAuthServer(accessToken, locationId, restaurantId),
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

  const r2Config = getR2UploadConfig();
  const payload = buildLocationPublicExport(
    locRes.data.location,
    menuRes.data,
    r2Config.publicBaseUrl,
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
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const locationsRes = await getLocationsWithAuthServer(accessToken, restaurantId);
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
      const result = await coalescedSyncAndPurgeLocationPublicExport(
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
