import type { GlobalMenuResponse, Location } from "@/lib/auth-api";

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

export function buildLocationPublicExport(
  location: Location,
  menu: GlobalMenuResponse,
): LocationPublicExport {
  return {
    schemaVersion: LOCATION_PUBLIC_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    restaurantId: menu.restaurantId,
    location,
    menu: { categories: menu.categories },
  };
}
