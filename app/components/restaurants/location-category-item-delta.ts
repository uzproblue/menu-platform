import type { EditLocationCategoryRow } from "./edit-location-category-modal";

export type LocationCategoryItemDelta = {
  add: EditLocationCategoryRow[];
  update: EditLocationCategoryRow[];
  remove: string[];
};

/** Diff published location items vs modal selection for one category edit. */
export function computeLocationCategoryItemDelta(
  initiallyEnabledByItemId: Record<string, string>,
  rows: EditLocationCategoryRow[],
  normalizePrice: (price: string) => string | null,
): LocationCategoryItemDelta {
  const finalById = new Map<string, string>();
  for (const row of rows) {
    const normalized = normalizePrice(row.price);
    if (normalized !== null) {
      finalById.set(row.menuItemId, normalized);
    }
  }

  const add: EditLocationCategoryRow[] = [];
  const update: EditLocationCategoryRow[] = [];
  const remove: string[] = [];

  for (const [menuItemId, price] of finalById) {
    if (!(menuItemId in initiallyEnabledByItemId)) {
      add.push({ menuItemId, price });
    } else if (initiallyEnabledByItemId[menuItemId] !== price) {
      update.push({ menuItemId, price });
    }
  }

  for (const menuItemId of Object.keys(initiallyEnabledByItemId)) {
    if (!finalById.has(menuItemId)) {
      remove.push(menuItemId);
    }
  }

  return { add, update, remove };
}
