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
  /** Published sections + categories + items (same as GET /api/locations/:id/menu). */
  menu: {
    sections: GlobalMenuResponse["sections"];
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
): {
  sections: GlobalMenuResponse["sections"];
  categories: GlobalMenuResponse["categories"];
} {
  const sections = (menu.sections ?? []).map((s) => ({
    ...s,
    backgroundImage:
      expandR2AssetToPublicUrl(s.backgroundImage, publicBaseUrl) ?? s.backgroundImage,
  }));
  const categories = menu.categories.map((cat) => ({
    ...cat,
    coverPhoto:
      expandR2AssetToPublicUrl(cat.coverPhoto, publicBaseUrl) ?? cat.coverPhoto,
    items: cat.items.map((item) => ({
      ...item,
      image:
        expandR2AssetToPublicUrl(item.image, publicBaseUrl) ?? item.image,
    })),
  }));
  return { sections, categories };
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
    menu: expandMenuForExport(menu, base),
  };
}
