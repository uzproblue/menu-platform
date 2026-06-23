/** R2 object key prefixes used for uploads in this project. */
export function looksLikeR2ObjectKey(s: string): boolean {
  const t = s.trim().replace(/^\/+/, "");
  return (
    t.startsWith("menu-items/") ||
    t.startsWith("category-covers/") ||
    t.startsWith("locations/") ||
    t.startsWith("qr-center-images/")
  );
}

/**
 * Turns a stored object key into an absolute public object URL for guest-facing JSON.
 * Leaves full `http(s)` URLs unchanged.
 */
export function expandR2AssetToPublicUrl(
  value: string | undefined | null,
  publicBaseUrl: string,
): string | undefined {
  if (value == null) return undefined;
  const t = value.trim();
  if (!t.length) return undefined;
  if (t.includes("://")) return t;
  if (!looksLikeR2ObjectKey(t)) return t;
  const b = publicBaseUrl.trim().replace(/\/+$/, "");
  const k = t.replace(/^\/+/, "");
  return `${b}/${k}`;
}
