export type TranslationTextApi = {
  lang: string;
  name: string;
  description?: string | null;
};

export type MenuSectionKind = "standard" | "unassigned";

export type MenuSectionEntity = {
  id: string;
  name: string;
  backgroundImage: string | null;
  sortOrder: number;
  kind: MenuSectionKind;
  categoriesCount: number;
  translations?: TranslationTextApi[];
};

export type TranslationSyncMeta = {
  written: number;
  skippedReason?: "unconfigured" | "ai_failed" | "ai_empty";
};

export type CatalogPriceApi = {
  id: string;
  price: string;
  currency: string;
};

export type CatalogChangeMeta = {
  textFieldsChanged: boolean;
};
