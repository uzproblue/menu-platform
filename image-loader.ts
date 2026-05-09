import type { ImageLoaderProps } from "next/image";

/**
 * Cloudflare zone Image Resizing (URL interface).
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url/
 *
 * Transforms are requested on the **app’s** zone as a relative URL:
 *   `/cdn-cgi/image/<OPTIONS>/<SOURCE>`
 * where SOURCE may be a path on this zone or an **absolute** `https://...` URL
 * (e.g. public R2 object URL). Do not prefix with `R2_PUBLIC_BASE_URL` — that host
 * is not where `/cdn-cgi/image/` lives.
 *
 * Behaviour:
 *   - Public R2 URLs (`*.r2.dev`, `*.r2.cloudflarestorage.com`) and URLs under
 *     `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` / `R2_PUBLIC_BASE_URL` (when inlined at build):
 *     in production, same-origin `/cdn-cgi/image/.../<full-src>`.
 *     No build-time env is required for default R2 hostnames.
 *   - Custom R2 domains: set `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` or `R2_PUBLIC_BASE_URL`
 *     for the **build** (Worker runtime vars alone are not visible to the client bundle).
 *   - Other absolute URLs: unchanged (avoid proxying arbitrary third-party URLs).
 *   - Relative `src`: `/cdn-cgi/image/.../<path>` in production; as-is in `next dev`.
 */

const CDN_BASE_URL: string = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
  process.env.R2_PUBLIC_BASE_URL ||
  ""
)
  .trim()
  .replace(/\/+$/, "");

function buildTransformOptions(width: number, quality?: number): string {
  const q = quality != null && quality > 0 ? quality : 80;
  return `width=${350},quality=${q},format=auto,metadata=none`;
}

function isTransformableRemoteImage(src: string): boolean {
  if (!/^https?:\/\//i.test(src)) return false;
  if (/cdn-cgi\/image\//i.test(src)) return false;

  if (CDN_BASE_URL && src.startsWith(`${CDN_BASE_URL}/`)) {
    return true;
  }

  try {
    const host = new URL(src).hostname.toLowerCase();
    return host.endsWith(".r2.dev") || host.endsWith(".r2.cloudflarestorage.com");
  } catch {
    return false;
  }
}

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  const options = buildTransformOptions(width, quality);
  const isDev = process.env.NODE_ENV === "development";

  if (/^https?:\/\//i.test(src)) {
    if (isDev || !isTransformableRemoteImage(src)) {
      return src;
    }
    return `/cdn-cgi/image/${options}/${src}`;
  }

  if (isDev) {
    return src;
  }

  const pathPart = src.startsWith("/") ? src.slice(1) : src;
  return `/cdn-cgi/image/${options}/${pathPart}`;
}
