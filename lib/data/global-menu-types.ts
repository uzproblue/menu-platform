import type { TranslationTextApi } from "@/lib/auth-api";

/** Shape used by global menu UI (API-backed). */
export type CatalogPriceRow = {
  id: string;
  price: string;
  currency: string;
};

export type MenuItem = {
  id: string;
  name: string;
  /** When false, item is hidden from guest-facing menus until persisted via API. */
  active?: boolean;
  /** Per-location publish toggle (restaurant detail); independent of global `active`. */
  locationEnabled?: boolean;
  image?: string;
  /** Catalog prices; may include multiple currencies. */
  prices: CatalogPriceRow[];
  description?: string;
  tags?: string[];
  /** Guest-language rows from menu-server; optional on older optimistic snapshots. */
  translations?: TranslationTextApi[];
};

export type MenuCategory = {
  id: string;
  name: string;
  /** Catalog description; guest copy may come from `translations` per locale. */
  description?: string | null;
  coverPhoto?: string | null;
  translations?: TranslationTextApi[];
  items: MenuItem[];
};

export type GlobalMenuData = {
  categories: MenuCategory[];
};
