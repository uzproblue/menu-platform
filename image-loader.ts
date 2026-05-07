import type { ImageLoaderProps } from "next/image";

/**
 * Cloudflare zone Image Resizing (URL interface).
 * @see https://developers.cloudflare.com/images/transform-images/transform-via-url/
 *
 * In `next dev`, returns the original `src` because `/cdn-cgi/image/` is not available on localhost.
 * In production, requests must be served on a hostname where transformations are enabled in the dashboard.
 */
export default function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (process.env.NODE_ENV === "development") {
    return src;
  }

  const opts = [`width=${width}`, "format=auto"];
  if (quality != null && quality > 0) {
    opts.push(`quality=${quality}`);
  }
  const optsStr = opts.join(",");

  // Absolute remote URLs (for example public R2 URLs) can fail through
  // `/cdn-cgi/image/.../<absolute-url>` when zone allowlists are restrictive.
  // Use the original URL to keep rendering reliable.
  if (/^https?:\/\//i.test(src)) {
    return src;
  }

  const pathPart = src.startsWith("/") ? src.slice(1) : src;
  return `/cdn-cgi/image/${optsStr}/${pathPart}`;
}
