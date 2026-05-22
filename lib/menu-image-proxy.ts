import { expandR2AssetToPublicUrl, looksLikeR2ObjectKey } from "@/lib/r2-object-key";

const MAX_PROXY_BYTES = 15 * 1024 * 1024;

export function readR2PublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");
}

/**
 * Resolves a stored menu image reference to an absolute HTTPS URL on the public CDN origin.
 */
export function resolveMenuAssetToAbsoluteUrl(value: string): string | null {
  const t = value.trim();
  if (!t.length) return null;
  if (t.startsWith("blob:") || t.startsWith("data:")) return t;

  const base = readR2PublicBaseUrl();
  if (!base) {
    return /^https?:\/\//i.test(t) ? t : null;
  }

  if (looksLikeR2ObjectKey(t) || (!t.includes("://") && !t.startsWith("/"))) {
    return expandR2AssetToPublicUrl(t, base) ?? null;
  }

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const b = new URL(base);
      if (u.origin === b.origin) return t;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Returns true if `url` is allowed to be fetched by the menu-image proxy (same CDN origin only).
 */
export function isAllowedMenuImageProxyUrl(url: string): boolean {
  const resolved = resolveMenuAssetToAbsoluteUrl(url);
  if (!resolved || resolved.startsWith("blob:") || resolved.startsWith("data:")) {
    return false;
  }

  const base = readR2PublicBaseUrl();
  if (!base) return false;

  try {
    return new URL(resolved).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

export async function fetchMenuImageForProxy(
  absoluteUrl: string,
): Promise<
  | { ok: true; body: Uint8Array; contentType: string }
  | { ok: false; status: number; error: string }
> {
  const res = await fetch(absoluteUrl, {
    method: "GET",
    cache: "force-cache",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    return { ok: false, status: res.status, error: "upstream_failed" };
  }

  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return { ok: false, status: 415, error: "not_an_image" };
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_PROXY_BYTES) {
    return { ok: false, status: 413, error: "too_large" };
  }

  return { ok: true, body: new Uint8Array(buf), contentType };
}

/**
 * Same-origin URL for Konva / canvas (avoids CDN CORS). Pass CDN URL or object key.
 */
export function toCanvasMenuImageProxyUrl(imageRef: string): string {
  const t = imageRef.trim();
  if (!t.length || t.startsWith("blob:") || t.startsWith("data:")) return t;
  return `/api/settings/menu-image-proxy?src=${encodeURIComponent(t)}`;
}
