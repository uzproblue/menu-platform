/**
 * Public guest-menu URLs for location QR codes.
 * Set MENU_URL (build) / NEXT_PUBLIC_MENU_URL (client bundle) to the menu-customer origin.
 */

function trimBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/$/, "") ?? "";
}

/** Configured menu-customer origin, or empty when unset. */
export function getMenuPublicBaseUrl(): string {
  return trimBaseUrl(process.env.NEXT_PUBLIC_MENU_URL);
}

/** Full URL to a location's guest menu (for QR encoding and copy). */
export function buildLocationMenuPublicUrl(locationId: string): string {
  const id = locationId.trim();
  const configured = getMenuPublicBaseUrl();
  const base =
    configured.length > 0
      ? configured
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  if (!base.length) return `/${id}/menu`;
  return `${base}/${id}/menu`;
}
