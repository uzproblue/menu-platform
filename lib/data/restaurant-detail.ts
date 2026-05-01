import restaurantsSample from "./restaurants.json";

type SampleRestaurantRow = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  address: string;
  active: boolean;
  categoryCount: number;
  menuItemCount: number;
};

export type RestaurantDisplayInfo = {
  id: string;
  name: string;
  logoUrl: string;
  address: string;
  /** ISO 4217 operating currency from the location record. */
  currency?: string;
  /** Whether the location is active in admin / list views. */
  isActive?: boolean;
};

/**
 * Resolves display fields for `/restaurants/[id]` from sample JSON when the id matches;
 * otherwise returns a generic shell (name left empty for i18n fallback in UI).
 */
export function getRestaurantDisplayInfo(restaurantId: string): RestaurantDisplayInfo {
  const rows = restaurantsSample.restaurants as SampleRestaurantRow[];
  const found = rows.find((r) => r.id === restaurantId);
  if (found) {
    return {
      id: found.id,
      name: found.name,
      logoUrl: found.logoUrl,
      address: found.address,
    };
  }
  return {
    id: restaurantId,
    name: "",
    logoUrl: "/restaurants/placeholder.svg",
    address: "",
  };
}
