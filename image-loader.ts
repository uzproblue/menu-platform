import type { ImageLoaderProps } from "next/image";

/**
 * Cloudflare zone Image Resizing (URL interface).
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url/
 *
 * Behaviour by source kind:
 *
 *   - Absolute URL on the configured CDN host (`NEXT_PUBLIC_R2_PUBLIC_BASE_URL`):
 *       rewrite to `<cdn>/cdn-cgi/image/<options>/<path>` so it always hits the
 *       transformations endpoint that Cloudflare exposes on that zone.
 *
 *   - Other absolute URLs (any host where transformations may not be enabled):
 *       returned unchanged so we don't break third-party images.
 *
 *   - Relative URL (e.g. `/menu/photo.jpg`):
 *       In `next dev` it's returned as-is because `/cdn-cgi/image/` is not
 *       available on localhost. In production it becomes
 *       `/cdn-cgi/image/<options>/<path>`, resolved against the app's own zone.
 */

const CDN_BASE_URL: string = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

function buildTransformOptions(width: number, quality?: number): string {
  // Default to quality=80 to match the canonical CDN URL shape used across the app.
  const q = quality != null && quality > 0 ? quality : 80;
  return `width=${350},quality=${q},format=auto,metadata=none`;
}

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  const options = buildTransformOptions(width, quality);

  if (CDN_BASE_URL && src.startsWith(`${CDN_BASE_URL}/`)) {
    const path = src.slice(CDN_BASE_URL.length).replace(/^\/+/, "");
    if (path.startsWith("cdn-cgi/image/")) {
      return src;
    }
    return `${CDN_BASE_URL}/cdn-cgi/image/${options}/${path}`;
  }

  if (/^https?:\/\//i.test(src)) {
    return src;
  }

  if (process.env.NODE_ENV === "development") {
    return src;
  }

  const pathPart = src.startsWith("/") ? src.slice(1) : src;
  return `/cdn-cgi/image/${options}/${pathPart}`;
}
