import type { CreatedMenuItemApi, GlobalMenuItemApi, GlobalMenuResponse } from "@/lib/auth-api";
import type { GlobalMenuData, MenuItem, MenuSection } from "@/lib/data/global-menu-types";

function normalizeMenuSection(value: string | undefined): MenuSection {
  return value === "beverages" ? "beverages" : "dishes";
}

export function mapGlobalMenuItemApiToMenuItem(i: GlobalMenuItemApi | CreatedMenuItemApi): MenuItem {
  const item: MenuItem = {
    id: i.id,
    name: i.name,
    active: i.active,
    prices: i.prices.map((p) => ({
      id: p.id,
      price: p.price,
      currency: p.currency,
    })),
    tags: i.tags,
    translations: Array.isArray(i.translations) ? i.translations : [],
  };
  if (i.description) item.description = i.description;
  if (i.image) item.image = i.image;
  if (i.videoId) item.videoId = i.videoId;
  if (i.gramm) item.gramm = i.gramm;
  return item;
}

export function mapGlobalMenuResponseToData(api: GlobalMenuResponse): GlobalMenuData {
  return {
    categories: api.categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      coverPhoto: c.coverPhoto ?? null,
      menuSection: normalizeMenuSection(c.menuSection),
      translations: Array.isArray(c.translations) ? c.translations : [],
      items: c.items.map((i): MenuItem => mapGlobalMenuItemApiToMenuItem(i)),
    })),
  };
}
