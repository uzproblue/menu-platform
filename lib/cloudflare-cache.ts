export type CloudflarePurgeResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; message: string };

type CloudflareApiResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
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

/** Purge one or more exact URLs from the zone CDN cache (see Cloudflare purge by single-file). */
export async function purgeCloudflareUrls(
  urls: string[],
): Promise<CloudflarePurgeResult> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!zoneId || !apiToken) {
    return {
      ok: false,
      skipped: true,
      message:
        "Cloudflare purge skipped: CLOUDFLARE_ZONE_ID/CLOUDFLARE_API_TOKEN not configured",
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
