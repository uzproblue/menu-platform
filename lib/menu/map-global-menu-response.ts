import type { CreatedMenuItemApi, GlobalMenuItemApi, GlobalMenuResponse } from "@/lib/auth-api";
import type { GlobalMenuData, MenuItem, MenuSectionEntity } from "@/lib/data/global-menu-types";

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
  const sections: MenuSectionEntity[] = Array.isArray(api.sections)
    ? api.sections.map((s) => ({
        id: s.id,
        name: s.name,
        backgroundImage: s.backgroundImage,
        sortOrder: s.sortOrder,
        kind: s.kind === "unassigned" ? "unassigned" : "standard",
      }))
    : [];

  return {
    sections,
    categories: api.categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      coverPhoto: c.coverPhoto ?? null,
      menuSectionId: typeof c.menuSectionId === "string" ? c.menuSectionId : "",
      translations: Array.isArray(c.translations) ? c.translations : [],
      items: c.items.map((i): MenuItem => mapGlobalMenuItemApiToMenuItem(i)),
    })),
  };
}
