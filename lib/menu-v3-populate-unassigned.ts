import type { MenuV3MergeAction, MenuV3PreviewResponse } from "@/lib/auth-api";

/** Build createCategory/createItem actions for all unmatched POS rows (land in Unassigned). */
export function buildImportActions(
  preview: MenuV3PreviewResponse,
): MenuV3MergeAction[] {
  const actions: MenuV3MergeAction[] = [];
  const categoryIdByPos = new Map<string, string>();

  for (const cat of preview.categories) {
    if (cat.bucket === "unmatchedPos") {
      actions.push({
        type: "createCategory",
        posCategoryId: cat.posCategoryId,
        name: cat.posName,
      });
    } else if (cat.suggestedCatalogCategoryId) {
      categoryIdByPos.set(cat.posCategoryId, cat.suggestedCatalogCategoryId);
    }
  }

  for (const item of preview.items) {
    if (item.bucket !== "unmatchedPos") continue;
    actions.push({
      type: "createItem",
      posMenuItemId: item.posMenuItemId,
      posProductSizeId: item.posProductSizeId || null,
      posCategoryId: item.posCategoryId,
      name: item.posName,
      updateSku: Boolean(item.sku),
      sku: item.sku,
      updateGramm: item.weight != null,
      gramm: item.weight != null ? String(item.weight) : null,
      priceAmount: item.priceAmount,
      catalogCategoryId: categoryIdByPos.get(item.posCategoryId) ?? null,
    });
  }

  return actions;
}
