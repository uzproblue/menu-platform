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
  image?: string;
  /** Catalog prices; may include multiple currencies. */
  prices: CatalogPriceRow[];
  description?: string;
  tags?: string[];
};

export type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

export type GlobalMenuData = {
  categories: MenuCategory[];
};
