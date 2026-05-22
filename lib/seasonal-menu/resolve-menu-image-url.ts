import { expandR2AssetToPublicUrl } from "@/lib/r2-object-key";

const PRINT_IMAGE_WIDTH = 2000;

function readPublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");
}

/**
 * Absolute URL suitable for Konva.Image and print PDF (high-width CDN transform when possible).
 */
export function resolveMenuImageUrlForCanvas(
  image: string | undefined | null,
): string | undefined {
  if (image == null) return undefined;
  const t = image.trim();
  if (!t.length) return undefined;

  const base = readPublicBaseUrl();
  const expanded = base ? expandR2AssetToPublicUrl(t, base) : t;
  if (!expanded) return undefined;

  if (!/^https?:\/\//i.test(expanded)) return expanded;

  try {
    const u = new URL(expanded);
    const cdnBase = base ? new URL(base) : null;
    if (cdnBase && u.origin === cdnBase.origin) {
      const path = u.pathname.replace(/^\/+/, "");
      if (!path.startsWith("cdn-cgi/image/")) {
        const params = `width=${PRINT_IMAGE_WIDTH},quality=90,format=auto`;
        return `${base}/cdn-cgi/image/${params}/${path}`;
      }
    }
  } catch {
    return expanded;
  }

  return expanded;
}
