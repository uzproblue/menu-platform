import type { TranslationTextApi } from "@/lib/auth-api";

export type MenuSection = "dishes" | "beverages";

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
  /** Global default portion size (free text, e.g. "350 g"). */
  gramm?: string;
  /** Resolved gramm for location detail view (when published). */
  resolvedGramm?: string;
  /** Per-location: inherit global gramm vs custom override. */
  grammUseDefault?: boolean;
  /** Resolved image for location detail view (when published). */
  resolvedImage?: string;
  /** Per-location: inherit global image vs custom override. */
  imageUseDefault?: boolean;
  /** Guest-language rows from menu-server; optional on older optimistic snapshots. */
  translations?: TranslationTextApi[];
};

export type MenuCategory = {
  id: string;
  name: string;
  /** Catalog description; guest copy may come from `translations` per locale. */
  description?: string | null;
  coverPhoto?: string | null;
  menuSection?: MenuSection;
  translations?: TranslationTextApi[];
  items: MenuItem[];
};

export type GlobalMenuData = {
  categories: MenuCategory[];
};
