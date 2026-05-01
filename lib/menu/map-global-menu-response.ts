import type { GlobalMenuResponse } from "@/lib/auth-api";
import type { GlobalMenuData, MenuItem } from "@/lib/data/global-menu-types";

export function mapGlobalMenuResponseToData(api: GlobalMenuResponse): GlobalMenuData {
  return {
    categories: api.categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.map((i): MenuItem => {
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
        };
        if (i.description) item.description = i.description;
        if (i.image) item.image = i.image;
        return item;
      }),
    })),
  };
}
