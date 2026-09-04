import type { MenuItem } from "@/lib/data/global-menu-types";

export function formatMenuItemPrice(item: MenuItem): string {
  const row = item.prices[0];
  if (!row) return "";
  const cleaned = row.price.replace(/([.,]00)(?!\d)/g, "").trim();
  return `${cleaned} ${row.currency}`.trim();
}

export function flattenMenuItems(
  categories: Array<{ items: MenuItem[]; menuSectionId?: string }>,
  sectionId?: string,
): MenuItem[] {
  const out: MenuItem[] = [];
  for (const cat of categories) {
    if (sectionId && cat.menuSectionId && cat.menuSectionId !== sectionId) continue;
    for (const item of cat.items) {
      if (item.active === false) continue;
      out.push(item);
    }
  }
  return out;
}
