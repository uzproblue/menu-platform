export type MenuCatalogViewMode = "grid" | "table";

export const GLOBAL_MENU_VIEW_STORAGE_KEY = "menu-platform.globalMenu.viewMode";
export const MENU_CATEGORIES_VIEW_STORAGE_KEY = "menu-platform.menuCategories.viewMode";

export function isMenuCatalogViewMode(value: string): value is MenuCatalogViewMode {
  return value === "grid" || value === "table";
}
