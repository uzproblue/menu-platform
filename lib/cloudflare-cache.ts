import { getCloudflareContext } from "@opennextjs/cloudflare";

export type CloudflarePurgeResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; message: string };

type CloudflareApiResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{ id?: string }>;
};

const PURGE_FILES_BATCH = 25;

async function purgeCloudflareFilesBatch(
  zoneId: string,
  apiToken: string,
  files: string[],
): Promise<CloudflarePurgeResult> {
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ files }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  let payload: CloudflareApiResponse | null = null;
  try {
    payload = (await res.json()) as CloudflareApiResponse;
  } catch {
    payload = null;
  }

  if (res.ok && payload?.success) {
    return { ok: true };
  }

  const apiMessage =
    payload?.errors?.map((e) => e.message).filter(Boolean).join("; ") || null;

  return {
    ok: false,
    message:
      apiMessage ??
      `Cloudflare purge failed with status ${res.status}${
        res.statusText ? ` ${res.statusText}` : ""
      }`,
  };
}

function readCloudflareSetting(name: string): string | undefined {
  try {
    const { env } = getCloudflareContext();
    const value = (env as unknown as Record<string, unknown>)[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    /* next dev / non-Workers */
  }
  const fromProcess = process.env[name]?.trim();
  return fromProcess || undefined;
}

function purgeApiToken(): string | undefined {
  return (
    readCloudflareSetting("CLOUDFLARE_API_TOKEN") ||
    readCloudflareSetting("CF_API_TOKEN") ||
    readCloudflareSetting("CF_ANALYTICS_API_TOKEN")
  );
}

let resolvedZoneId: string | null = null;

/** Zone id from env, or the zone that owns `hostname` in CF_ACCOUNT_ID. */
async function resolvePurgeZoneId(
  apiToken: string,
  hostname: string | undefined,
): Promise<string | undefined> {
  const configured = readCloudflareSetting("CLOUDFLARE_ZONE_ID");
  if (configured) return configured;
  if (resolvedZoneId) return resolvedZoneId;

  const accountId = readCloudflareSetting("CF_ACCOUNT_ID");
  const name = hostname?.trim();
  if (!accountId || !name) return undefined;

  const endpoint = new URL("https://api.cloudflare.com/client/v4/zones");
  endpoint.searchParams.set("account.id", accountId);
  endpoint.searchParams.set("name", name);
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${apiToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  let payload: CloudflareApiResponse | null = null;
  try {
    payload = (await res.json()) as CloudflareApiResponse;
  } catch {
    payload = null;
  }
  const zoneId = payload?.result?.[0]?.id?.trim();
  if (res.ok && payload?.success && zoneId) {
    resolvedZoneId = zoneId;
    return zoneId;
  }
  const apiMessage = payload?.errors?.map((e) => e.message).filter(Boolean).join("; ");
  throw new Error(
    apiMessage ||
      `Could not resolve Cloudflare zone for ${name} (HTTP ${res.status}). CF_ANALYTICS_API_TOKEN needs Zone Read and Cache Purge, or set CLOUDFLARE_ZONE_ID.`,
  );
}

function hostnameFromUrls(urls: string[]): string | undefined {
  for (const raw of urls) {
    try {
      return new URL(raw).hostname;
    } catch {
      /* skip */
    }
  }
  return undefined;
}

/** Purge one or more exact URLs from the zone CDN cache (see Cloudflare purge by single-file). */
export async function purgeCloudflareUrls(
  urls: string[],
): Promise<CloudflarePurgeResult> {
  const apiToken = purgeApiToken();
  if (!apiToken) {
    return {
      ok: false,
      skipped: true,
      message:
        "Cloudflare purge skipped: set CLOUDFLARE_API_TOKEN or CF_ANALYTICS_API_TOKEN on menu-platform",
    };
  }

  let zoneId: string | undefined;
  try {
    zoneId = await resolvePurgeZoneId(apiToken, hostnameFromUrls(urls));
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Cloudflare zone lookup failed",
    };
  }

  if (!zoneId) {
    return {
      ok: false,
      skipped: true,
      message:
        "Cloudflare purge skipped: set CLOUDFLARE_ZONE_ID, or CF_ACCOUNT_ID plus a token that can list zones",
    };
  }

  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!unique.length) {
    return { ok: true };
  }

  try {
    for (let i = 0; i < unique.length; i += PURGE_FILES_BATCH) {
      const chunk = unique.slice(i, i + PURGE_FILES_BATCH);
      const batch = await purgeCloudflareFilesBatch(zoneId, apiToken, chunk);
      if (!batch.ok) {
        return batch;
      }
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Cloudflare purge request failed",
    };
  }
}

export async function purgeCloudflareUrl(url: string): Promise<CloudflarePurgeResult> {
  return purgeCloudflareUrls([url]);
}
