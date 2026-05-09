import type { ImageLoaderProps } from "next/image";
import { looksLikeR2ObjectKey } from "@/lib/r2-object-key";

const CDN_BASE: string = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
  process.env.R2_PUBLIC_BASE_URL ||
  ""
)
  .trim()
  .replace(/\/+$/, "");

function trimSrc(src: ImageLoaderProps["src"]): string {
  return typeof src === "string" ? src.trim() : String(src).trim();
}

function isAbsoluteHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  const t = trimSrc(src);
  if (!t.length || t.startsWith("blob:") || t.startsWith("data:")) {
    return t;
  }

  const q = quality != null && quality > 0 ? quality : 75;
  const params = `width=${width},quality=${q},format=auto`;

  if (isAbsoluteHttpUrl(t)) {
    if (!CDN_BASE) return t;
    try {
      const u = new URL(t);
      const baseUrl = new URL(CDN_BASE);
      if (u.origin !== baseUrl.origin) {
        return t;
      }
      const path = u.pathname.replace(/^\/+/, "");
      if (path.startsWith("cdn-cgi/image/")) {
        return t;
      }
      return `${CDN_BASE}/cdn-cgi/image/${params}/${path}`;
    } catch {
      return t;
    }
  }

  const key = t.replace(/^\/+/, "");
  if (!looksLikeR2ObjectKey(key)) {
    return t;
  }
  if (!CDN_BASE) {
    return t;
  }
  return `${CDN_BASE}/cdn-cgi/image/${params}/${key}`;
}
