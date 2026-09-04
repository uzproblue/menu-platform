import type { CatalogPriceApi, GlobalMenuItemApi, GlobalMenuResponse } from "@/lib/auth-api";
import { CUSTOM_PRICE_SELECTION, MANUAL_PRICE_SELECTION } from "./constants";
import type { SelectedItemRow } from "./types";

export function getMatchingCatalogPrices(
  item: GlobalMenuItemApi,
  locationCurrency: string,
): CatalogPriceApi[] {
  return item.prices.filter((p) => p.currency === locationCurrency);
}

export function formatPriceSummary(p: CatalogPriceApi): string {
  const cleaned = p.price.replace(/([.,]00)(?!\d)/g, "").trim();
  return `${cleaned} ${p.currency}`;
}

export function computeOverrideFromRow(
  row: SelectedItemRow,
  matching: CatalogPriceApi[],
): string {
  if (matching.length === 0 || row.priceSelection === MANUAL_PRICE_SELECTION) {
    return row.overridePrice;
  }
  if (row.priceSelection === CUSTOM_PRICE_SELECTION) {
    return row.customPriceDraft.trim();
  }
  const found = matching.find((p) => p.id === row.priceSelection);
  return found ? found.price : matching[0]?.price ?? "";
}

export function createDefaultItemRow(
  categoryId: string,
  item: GlobalMenuItemApi,
  locationCurrency: string,
): SelectedItemRow {
  const matching = getMatchingCatalogPrices(item, locationCurrency);
  if (matching.length === 0) {
    return {
      categoryId,
      name: item.name,
      overridePrice: "",
      priceSelection: MANUAL_PRICE_SELECTION,
      customPriceDraft: "",
      customOptionAdded: false,
    };
  }
  const first = matching[0]!;
  return {
    categoryId,
    name: item.name,
    overridePrice: first.price,
    priceSelection: first.id,
    customPriceDraft: "",
    customOptionAdded: false,
  };
}

export function reconcileItemRow(
  row: SelectedItemRow,
  item: GlobalMenuItemApi,
  locationCurrency: string,
): SelectedItemRow {
  const m = getMatchingCatalogPrices(item, locationCurrency);
  if (m.length === 0) {
    return {
      ...row,
      priceSelection: MANUAL_PRICE_SELECTION,
      customOptionAdded: false,
      customPriceDraft: "",
      overridePrice:
        row.priceSelection === MANUAL_PRICE_SELECTION ? row.overridePrice : "",
    };
  }
  let sel = row.priceSelection;
  if (sel === MANUAL_PRICE_SELECTION) sel = m[0]!.id;
  if (sel === CUSTOM_PRICE_SELECTION && !row.customOptionAdded) sel = m[0]!.id;
  if (sel !== CUSTOM_PRICE_SELECTION && !m.some((p) => p.id === sel)) sel = m[0]!.id;
  const next: SelectedItemRow = {
    ...row,
    priceSelection: sel,
    customPriceDraft: row.customPriceDraft,
    customOptionAdded: row.customOptionAdded,
  };
  return { ...next, overridePrice: computeOverrideFromRow(next, m) };
}

export function findMenuItemInGlobalMenu(
  menu: GlobalMenuResponse | null,
  menuItemId: string,
): GlobalMenuItemApi | null {
  if (!menu) return null;
  for (const cat of menu.categories) {
    const found = cat.items.find((i) => i.id === menuItemId);
    if (found) return found;
  }
  return null;
}

/**
 * Build step-3 rows from catalog only. Publish persists via PUT .../menu-items.
 * Edit flow: reopening the wizard does not yet hydrate rows from saved LocationMenuItem (GET omits them).
 */
export function buildSelectedItemsForAllMenuItems(
  categoryIds: string[],
  menu: GlobalMenuResponse | null,
  locationCurrency: string,
): Record<string, SelectedItemRow> {
  const next: Record<string, SelectedItemRow> = {};
  if (!menu) return next;
  const catSet = new Set(categoryIds);
  for (const cat of menu.categories) {
    if (!catSet.has(cat.id)) continue;
    for (const item of cat.items) {
      if (item.active === false) continue;
      next[item.id] = createDefaultItemRow(cat.id, item, locationCurrency);
    }
  }
  return next;
}
