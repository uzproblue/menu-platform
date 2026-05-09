import type { GlobalMenuResponse, Location } from "@/lib/auth-api";
import { expandR2AssetToPublicUrl } from "@/lib/r2-object-key";

export const LOCATION_PUBLIC_EXPORT_SCHEMA_VERSION = 2 as const;

/**
 * Public snapshot written to R2 after menu publish. Safe for anonymous guest menu apps.
 * Shape is stable for `schemaVersion` 2; includes category/item translations.
 */
export type LocationPublicExport = {
  schemaVersion: typeof LOCATION_PUBLIC_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  restaurantId: string;
  location: Location;
  /** Published categories + items (same as GET /api/locations/:id/menu `categories`). */
  menu: {
    categories: GlobalMenuResponse["categories"];
  };
};

function expandLocationLogoForExport(
  location: Location,
  publicBaseUrl: string,
): Location {
  const logoUrl =
    expandR2AssetToPublicUrl(location.logoUrl, publicBaseUrl) ?? location.logoUrl;
  return { ...location, logoUrl };
}

function expandMenuForExport(
  menu: GlobalMenuResponse,
  publicBaseUrl: string,
): GlobalMenuResponse["categories"] {
  return menu.categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => ({
      ...item,
      image:
        expandR2AssetToPublicUrl(item.image, publicBaseUrl) ?? item.image,
    })),
  }));
}

/**
 * @param publicBaseUrl — `R2_PUBLIC_BASE_URL` (no trailing slash). Object keys in DB are expanded to full HTTPS URLs in this snapshot only.
 */
export function buildLocationPublicExport(
  location: Location,
  menu: GlobalMenuResponse,
  publicBaseUrl: string,
): LocationPublicExport {
  const base = publicBaseUrl.trim();
  return {
    schemaVersion: LOCATION_PUBLIC_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    restaurantId: menu.restaurantId,
    location: expandLocationLogoForExport(location, base),
    menu: { categories: expandMenuForExport(menu, base) },
  };
}
