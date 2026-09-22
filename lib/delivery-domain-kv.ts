import { getCloudflareContext } from "@opennextjs/cloudflare";

interface KvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface PlatformCloudflareEnv {
  DELIVERY_DOMAINS?: KvNamespace;
}

export function sanitizeDeliveryDomain(domain?: string | null): string | null {
  if (!domain || typeof domain !== "string") return null;
  let clean = domain.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//, "");
  clean = clean.split("/")[0].split(":")[0];
  clean = clean.replace(/[^a-z0-9.-]/g, "");
  return clean.length > 0 ? clean : null;
}

export interface SyncDeliveryDomainParams {
  oldDomain?: string | null;
  newDomain?: string | null;
  locationId: string;
}

export interface SyncDeliveryDomainResult {
  ok: boolean;
  syncedVia: "kv_binding" | "cloudflare_api" | "dev_simulated";
  message?: string;
}

/**
 * Synchronizes custom domain mappings in the Cloudflare KV DELIVERY_DOMAINS namespace.
 * - Removes oldDomain if changed/removed
 * - Inserts newDomain -> locationId (and www. counterpart if root apex)
 */
export async function syncDeliveryDomainKV({
  oldDomain,
  newDomain,
  locationId,
}: SyncDeliveryDomainParams): Promise<SyncDeliveryDomainResult> {
  const oldClean = sanitizeDeliveryDomain(oldDomain);
  const newClean = sanitizeDeliveryDomain(newDomain);
  const safeLocationId = locationId.trim();

  if (oldClean === newClean && !newClean) {
    return { ok: true, syncedVia: "dev_simulated" };
  }

  // 1. Try native Cloudflare Worker KV binding
  try {
    const { env } = getCloudflareContext();
    const cfEnv = env as PlatformCloudflareEnv;
    if (cfEnv?.DELIVERY_DOMAINS) {
      if (oldClean && oldClean !== newClean) {
        await cfEnv.DELIVERY_DOMAINS.delete(oldClean);
        if (!oldClean.startsWith("www.")) {
          await cfEnv.DELIVERY_DOMAINS.delete(`www.${oldClean}`).catch(() => {});
        }
      }

      if (newClean) {
        await cfEnv.DELIVERY_DOMAINS.put(newClean, safeLocationId);
        if (!newClean.startsWith("www.")) {
          await cfEnv.DELIVERY_DOMAINS.put(`www.${newClean}`, safeLocationId).catch(() => {});
        }
      }

      return { ok: true, syncedVia: "kv_binding" };
    }
  } catch {
    /* Not in Worker runtime context (e.g. running in Node next dev) */
  }

  // 2. Try Cloudflare REST API fallback
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    process.env.CF_API_TOKEN?.trim();
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
    process.env.CF_ACCOUNT_ID?.trim();
  const kvNamespaceId =
    process.env.DELIVERY_DOMAINS_KV_ID?.trim() ||
    "085be29251ec493881cd12f6c0b699ba";

  if (apiToken && accountId && kvNamespaceId) {
    try {
      const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/values`;

      if (oldClean && oldClean !== newClean) {
        await fetch(`${baseUrl}/${encodeURIComponent(oldClean)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        if (!oldClean.startsWith("www.")) {
          await fetch(`${baseUrl}/${encodeURIComponent(`www.${oldClean}`)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${apiToken}` },
          }).catch(() => {});
        }
      }

      if (newClean) {
        await fetch(`${baseUrl}/${encodeURIComponent(newClean)}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "text/plain",
          },
          body: safeLocationId,
        });
        if (!newClean.startsWith("www.")) {
          await fetch(`${baseUrl}/${encodeURIComponent(`www.${newClean}`)}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "text/plain",
            },
            body: safeLocationId,
          }).catch(() => {});
        }
      }

      return { ok: true, syncedVia: "cloudflare_api" };
    } catch (err) {
      console.error("[syncDeliveryDomainKV] Cloudflare API error:", err);
      return {
        ok: false,
        syncedVia: "cloudflare_api",
        message: err instanceof Error ? err.message : "Cloudflare API request failed",
      };
    }
  }

  // 3. Fallback for local development
  console.info(
    `[syncDeliveryDomainKV dev] KV simulated mapping: "${newClean || "(none)"}" -> "${safeLocationId}"`,
  );
  return { ok: true, syncedVia: "dev_simulated" };
}
