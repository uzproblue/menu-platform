/**
 * Helpers for surfacing background JSON-export / CDN-purge issues that the platform
 * settings APIs include in their 200 responses (`locationExportBatch` and `locationExport`).
 *
 * The settings routes intentionally return 200 even when the post-write export/purge
 * stage failed (unless `LOCATION_EXPORT_STRICT` is on), because the database write
 * itself succeeded. Without this helper the staleness is only visible in server logs.
 */

import type { useI18n } from "@/app/components/i18n-provider";

type Translator = ReturnType<typeof useI18n>["t"];

type LocationExportBatchShape = {
  ok?: unknown;
  total?: unknown;
  succeeded?: unknown;
  failed?: unknown;
  failures?: unknown;
  deferred?: unknown;
};

type LocationExportShape = {
  ok?: unknown;
  message?: unknown;
  purge?: unknown;
  deferred?: unknown;
};

type LocationExportPurgeShape = {
  purgeOk?: unknown;
  skipped?: unknown;
  message?: unknown;
  urls?: unknown;
};

function asPlainObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

/**
 * Inspect a successful settings-route response body and return a localized
 * non-blocking warning when the background JSON export / CDN purge degraded.
 * Returns null when there is nothing to surface (e.g. deferred to ctx.waitUntil
 * in production, where we don't yet know the outcome at response time).
 */
export function readLocationExportWarning(
  body: unknown,
  t: Translator,
): string | null {
  const root = asPlainObject(body);
  if (!root) return null;

  const batch = asPlainObject(root.locationExportBatch) as
    | LocationExportBatchShape
    | null;
  const single = asPlainObject(root.locationExport) as LocationExportShape | null;

  // Multi-location batch (item create/edit/delete/activation, category create/edit/delete).
  if (batch) {
    if (batch.deferred === true) return null;
    const failed = typeof batch.failed === "number" ? batch.failed : 0;
    const total = typeof batch.total === "number" ? batch.total : 0;
    if (failed > 0) {
      return t("locationExport.batchFailed", {
        count: String(failed),
        total: String(total),
      });
    }
    // Even when failed === 0 the per-location purge can still have been skipped,
    // but the batch shape doesn't carry that detail today; skip the warning.
    return null;
  }

  // Single-location result (location publish, location category PATCH).
  if (single) {
    if (single.deferred === true) return null;
    if (single.ok === false) {
      const msg =
        typeof single.message === "string" && single.message.trim().length > 0
          ? single.message
          : t("locationExport.singleFailedFallback");
      return t("locationExport.singleFailed", { detail: msg });
    }
    const purge = asPlainObject(single.purge) as LocationExportPurgeShape | null;
    if (purge) {
      if (purge.skipped === true) {
        return t("locationExport.purgeSkipped");
      }
      if (purge.purgeOk === false) {
        return t("locationExport.purgeFailed");
      }
    }
  }

  return null;
}

/**
 * Try to read JSON from a fetch Response without throwing.
 * Returns the parsed JSON or null when the body is empty / not JSON.
 */
export async function tryReadJson(res: Response): Promise<unknown | null> {
  try {
    const text = await res.clone().text();
    if (!text.trim().length) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * sessionStorage handoff so create flows (which navigate away on success) can
 * still surface a non-blocking JSON-export / CDN-purge warning on the destination
 * page that lists the affected resources.
 */
const PENDING_WARNING_STORAGE_KEY = "menu-platform:pending-location-export-warning";

export function persistPendingLocationExportWarning(message: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (message && message.trim().length > 0) {
      window.sessionStorage.setItem(PENDING_WARNING_STORAGE_KEY, message);
    }
  } catch {
    /* private mode / quota */
  }
}

export function consumePendingLocationExportWarning(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(PENDING_WARNING_STORAGE_KEY);
    if (!value) return null;
    window.sessionStorage.removeItem(PENDING_WARNING_STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}
