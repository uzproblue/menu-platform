import type { CreatedMenuItemApi, GlobalMenuItemApi, GlobalMenuResponse } from "@/lib/auth-api";
import type { GlobalMenuData, MenuItem } from "@/lib/data/global-menu-types";

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
      translations: Array.isArray(c.translations) ? c.translations : [],
      items: c.items.map((i): MenuItem => mapGlobalMenuItemApiToMenuItem(i)),
    })),
  };
}
