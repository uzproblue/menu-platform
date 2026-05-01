export type CloudflarePurgeResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; message: string };

type CloudflareApiResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
};

export async function purgeCloudflareUrl(
  url: string,
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

  const endpoint = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ files: [url] }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
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
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Cloudflare purge request failed",
    };
  }
}
