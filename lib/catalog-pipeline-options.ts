export type PostCatalogChangeOptions = {
  itemIdsToSync: string[];
  categoryIdsToSync: string[];
};

export const EMPTY_CATALOG_PIPELINE_OPTIONS: PostCatalogChangeOptions = {
  itemIdsToSync: [],
  categoryIdsToSync: [],
};

/** When name/description changed or the item still has no guest translation rows. */
export function postCatalogOptionsForMenuItem(
  itemId: string,
  item: { translations?: unknown[] },
  meta?: { textFieldsChanged?: boolean },
): PostCatalogChangeOptions {
  const textFieldsChanged = meta?.textFieldsChanged === true;
  const translationsMissing = (item.translations?.length ?? 0) === 0;
  const needsSync = textFieldsChanged || translationsMissing;
  return {
    itemIdsToSync: needsSync ? [itemId] : [],
    categoryIdsToSync: [],
  };
}

/** When name/description changed or the category still has no guest translation rows. */
export function postCatalogOptionsForCategory(
  categoryId: string,
  category: { translations?: unknown[] },
  meta?: { textFieldsChanged?: boolean },
): PostCatalogChangeOptions {
  const textFieldsChanged = meta?.textFieldsChanged === true;
  const translationsMissing = (category.translations?.length ?? 0) === 0;
  const needsSync = textFieldsChanged || translationsMissing;
  return {
    itemIdsToSync: [],
    categoryIdsToSync: needsSync ? [categoryId] : [],
  };
}

export function mergeCatalogPipelineOptions(
  current: PostCatalogChangeOptions,
  next: PostCatalogChangeOptions,
): PostCatalogChangeOptions {
  return {
    itemIdsToSync: [...new Set([...current.itemIdsToSync, ...next.itemIdsToSync])],
    categoryIdsToSync: [
      ...new Set([...current.categoryIdsToSync, ...next.categoryIdsToSync]),
    ],
  };
}
