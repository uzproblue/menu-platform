import type { EditLocationCategoryRow } from "./edit-location-category-modal";

export type LocationCategoryItemDelta = {
  add: EditLocationCategoryRow[];
  update: EditLocationCategoryRow[];
  remove: string[];
};

type PublishedGrammState = {
  grammUseDefault: boolean;
  gramm?: string;
};

function grammStateKey(row: PublishedGrammState): string {
  return `${row.grammUseDefault}:${row.gramm ?? ""}`;
}

/** Diff published location items vs modal selection for one category edit. */
export function computeLocationCategoryItemDelta(
  initiallyEnabledByItemId: Record<string, string>,
  initialPublishedGrammByItemId: Record<string, PublishedGrammState>,
  rows: EditLocationCategoryRow[],
  normalizePrice: (price: string) => string | null,
): LocationCategoryItemDelta {
  const finalById = new Map<string, EditLocationCategoryRow>();
  for (const row of rows) {
    const normalized = normalizePrice(row.price);
    if (normalized !== null) {
      finalById.set(row.menuItemId, { ...row, price: normalized });
    }
  }

  const add: EditLocationCategoryRow[] = [];
  const update: EditLocationCategoryRow[] = [];
  const remove: string[] = [];

  for (const [menuItemId, row] of finalById) {
    const wasEnabled = menuItemId in initiallyEnabledByItemId;
    const prevPrice = initiallyEnabledByItemId[menuItemId];
    const prevGramm = initialPublishedGrammByItemId[menuItemId] ?? {
      grammUseDefault: true,
    };
    const priceChanged = wasEnabled && prevPrice !== row.price;
    const grammChanged =
      wasEnabled && grammStateKey(prevGramm) !== grammStateKey(row);

    if (!wasEnabled) {
      add.push(row);
    } else if (priceChanged || grammChanged) {
      update.push(row);
    }
  }

  for (const menuItemId of Object.keys(initiallyEnabledByItemId)) {
    if (!finalById.has(menuItemId)) {
      remove.push(menuItemId);
    }
  }

  return { add, update, remove };
}
