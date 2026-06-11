/**
 * Public guest-menu URLs for location QR codes (client-safe).
 *
 * Runtime `MENU_URL` from the Worker is exposed on `<body data-menu-public-base-url>`
 * in the root layout — see `resolveMenuPublicBaseUrl` in `location-menu-url.server.ts`.
 */

/** `data-menu-public-base-url` on `<body>` — set in root layout from runtime env. */
export const MENU_PUBLIC_BASE_URL_DATA_ATTR = "data-menu-public-base-url";

function trimBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/$/, "") ?? "";
}

/** Client: build-time env, then runtime body attribute, then platform origin. */
export function getMenuPublicBaseUrlForClient(): string {
  const fromBuild = trimBaseUrl(process.env.NEXT_PUBLIC_MENU_URL);
  if (fromBuild.length > 0) return fromBuild;

  if (typeof document !== "undefined") {
    const fromDom = trimBaseUrl(
      document.body.getAttribute(MENU_PUBLIC_BASE_URL_DATA_ATTR) ?? undefined,
    );
    if (fromDom.length > 0) return fromDom;
  }

  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Full URL to a location's guest menu (for QR encoding and copy). */
export function buildLocationMenuPublicUrl(locationId: string): string {
  const id = locationId.trim();
  const base = getMenuPublicBaseUrlForClient();
  if (!base.length) return `/${id}/menu`;
  return `${base}/${id}/menu`;
}

/** Full URL to a location's guest menu scoped to a dining table (future guest routing). */
export function buildTableMenuPublicUrl(
  locationId: string,
  tableId: string,
): string {
  const base = buildLocationMenuPublicUrl(locationId);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}table=${encodeURIComponent(tableId.trim())}`;
}
