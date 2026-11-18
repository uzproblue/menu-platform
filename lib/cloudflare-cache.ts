import { getCloudflareContext } from "@opennextjs/cloudflare";

export type CloudflarePurgeResult =
  | { ok: true }
  | { ok: false; skipped?: boolean; message: string };

type CloudflareZone = { id?: string; name?: string };

type CloudflareApiResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: CloudflareZone[];
  result_info?: { total_pages?: number };
};

const PURGE_TOKEN_AUTH_HINT =
  "CF_ANALYTICS_API_TOKEN needs Zone Read and Cache Purge, or set CLOUDFLARE_ZONE_ID plus a purge-capable token";

/**
 * Zone names are apex domains (`loyaltering.online`), while purge URLs use a
 * hostname such as `cdn.loyaltering.online`. Pick the longest zone that owns it.
 */
export function zoneIdOwningHostname(
  hostname: string,
  zones: Array<{ id: string; name: string }>,
): string | undefined {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return undefined;
  let best: { id: string; name: string } | undefined;
  for (const zone of zones) {
    const name = zone.name.trim().toLowerCase().replace(/\.$/, "");
    const id = zone.id.trim();
    if (!name || !id) continue;
    if (host === name || host.endsWith(`.${name}`)) {
      if (!best || name.length > best.name.length) best = { id, name };
    }
  }
  return best?.id;
}

export function isCloudflareAuthFailure(
  status: number,
  message: string | null | undefined,
): boolean {
  if (status === 401 || status === 403) return true;
  const text = (message ?? "").toLowerCase();
  if (!text) return false;
  return (
    text.includes("authentication error") ||
    text.includes("authentication failed") ||
    text.includes("unauthorized") ||
    text.includes("permission denied") ||
    text.includes("not allowed") ||
    text.includes("invalid token") ||
    text.includes("invalid access token") ||
    (text.includes("api token") && text.includes("invalid"))
  );
}

const PURGE_FILES_BATCH = 25;

async function purgeCloudflareFilesBatch(
  zoneId: string,
  apiToken: string,
  files: string[],
): Promise<CloudflarePurgeResult & { status?: number }> {
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
    status: res.status,
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

/** Prefer analytics token (production), then dedicated purge tokens. */
function purgeApiTokens(): string[] {
  const names = [
    "CF_ANALYTICS_API_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "CF_API_TOKEN",
  ] as const;
  const out: string[] = [];
  for (const name of names) {
    const value = readCloudflareSetting(name);
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

type ZoneListResult =
  | { ok: true; zones: Array<{ id: string; name: string }> }
  | { ok: false; authFailure: boolean; message: string };

async function listAccountZones(
  apiToken: string,
  accountId: string,
): Promise<ZoneListResult> {
  const zones: Array<{ id: string; name: string }> = [];
  for (let page = 1; page <= 10; page++) {
    const endpoint = new URL("https://api.cloudflare.com/client/v4/zones");
    endpoint.searchParams.set("account.id", accountId);
    endpoint.searchParams.set("per_page", "50");
    endpoint.searchParams.set("page", String(page));
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
    if (!res.ok || !payload?.success) {
      const apiMessage =
        payload?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
        null;
      const message =
        apiMessage ||
        `Could not list Cloudflare zones for CF_ACCOUNT_ID (HTTP ${res.status}). ${PURGE_TOKEN_AUTH_HINT}.`;
      return {
        ok: false,
        authFailure: isCloudflareAuthFailure(res.status, apiMessage ?? message),
        message,
      };
    }
    for (const zone of payload.result ?? []) {
      const id = zone.id?.trim();
      const name = zone.name?.trim();
      if (id && name) zones.push({ id, name });
    }
    const totalPages = payload.result_info?.total_pages ?? 1;
    if (page >= totalPages) break;
  }
  return { ok: true, zones };
}

let resolvedZoneId: string | null = null;

type ResolveZoneResult =
  | { ok: true; zoneId: string }
  | { ok: false; skipped?: boolean; authFailure?: boolean; message: string };

/** Zone id from env, or the zone that owns `hostname` in CF_ACCOUNT_ID. */
async function resolvePurgeZoneId(
  apiToken: string,
  hostname: string | undefined,
): Promise<ResolveZoneResult> {
  const configured = readCloudflareSetting("CLOUDFLARE_ZONE_ID");
  if (configured) return { ok: true, zoneId: configured };
  if (resolvedZoneId) return { ok: true, zoneId: resolvedZoneId };

  const accountId = readCloudflareSetting("CF_ACCOUNT_ID");
  const name = hostname?.trim();
  if (!accountId || !name) {
    return {
      ok: false,
      skipped: true,
      message:
        "Cloudflare purge skipped: set CF_ACCOUNT_ID on menu-platform",
    };
  }

  const listed = await listAccountZones(apiToken, accountId);
  if (!listed.ok) {
    return {
      ok: false,
      authFailure: listed.authFailure,
      skipped: listed.authFailure,
      message: listed.authFailure
        ? `Cloudflare purge skipped: ${listed.message}`
        : listed.message,
    };
  }
  const zoneId = zoneIdOwningHostname(name, listed.zones);
  if (zoneId) {
    resolvedZoneId = zoneId;
    return { ok: true, zoneId };
  }
  return {
    ok: false,
    message: `Could not resolve Cloudflare zone for ${name} in CF_ACCOUNT_ID. ${PURGE_TOKEN_AUTH_HINT}.`,
  };
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

async function purgeWithToken(
  apiToken: string,
  urls: string[],
  hostname: string | undefined,
): Promise<CloudflarePurgeResult & { authFailure?: boolean }> {
  const zoneRes = await resolvePurgeZoneId(apiToken, hostname);
  if (!zoneRes.ok) {
    return {
      ok: false,
      skipped: zoneRes.skipped,
      authFailure: zoneRes.authFailure,
      message: zoneRes.message,
    };
  }

  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!unique.length) {
    return { ok: true };
  }

  try {
    for (let i = 0; i < unique.length; i += PURGE_FILES_BATCH) {
      const chunk = unique.slice(i, i + PURGE_FILES_BATCH);
      const batch = await purgeCloudflareFilesBatch(
        zoneRes.zoneId,
        apiToken,
        chunk,
      );
      if (!batch.ok) {
        const authFailure = isCloudflareAuthFailure(
          batch.status ?? 0,
          batch.message,
        );
        return {
          ok: false,
          skipped: authFailure,
          authFailure,
          message: authFailure
            ? `Cloudflare purge skipped: ${batch.message}. ${PURGE_TOKEN_AUTH_HINT}.`
            : batch.message,
        };
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

/** Purge one or more exact URLs from the zone CDN cache (see Cloudflare purge by single-file). */
export async function purgeCloudflareUrls(
  urls: string[],
): Promise<CloudflarePurgeResult> {
  const tokens = purgeApiTokens();
  if (!tokens.length) {
    return {
      ok: false,
      skipped: true,
      message:
        "Cloudflare purge skipped: set CF_ANALYTICS_API_TOKEN on menu-platform",
    };
  }

  const hostname = hostnameFromUrls(urls);
  let lastFailure: CloudflarePurgeResult = {
    ok: false,
    message: "Cloudflare purge failed",
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const result = await purgeWithToken(token, urls, hostname);
    if (result.ok) return { ok: true };

    lastFailure = {
      ok: false,
      skipped: result.skipped,
      message: result.message,
    };

    // Auth/permission failure: try the next dedicated purge token if present.
    if (result.authFailure && i < tokens.length - 1) {
      resolvedZoneId = null;
      continue;
    }
    return lastFailure;
  }

  return lastFailure;
}

export async function purgeCloudflareUrl(url: string): Promise<CloudflarePurgeResult> {
  return purgeCloudflareUrls([url]);
}
