import type { MenuItem } from "@/lib/data/global-menu-types";

export function formatMenuItemPrice(item: MenuItem): string {
  const row = item.prices[0];
  if (!row) return "";
  return `${row.price} ${row.currency}`.trim();
}

export function flattenMenuItems(
  categories: Array<{ items: MenuItem[]; menuSection?: string }>,
  section?: "dishes" | "beverages",
): MenuItem[] {
  const out: MenuItem[] = [];
  for (const cat of categories) {
    if (section && cat.menuSection && cat.menuSection !== section) continue;
    for (const item of cat.items) {
      if (item.active === false) continue;
      out.push(item);
    }
  }
  return out;
}
