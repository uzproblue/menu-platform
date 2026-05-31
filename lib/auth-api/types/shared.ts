export type TranslationTextApi = {
  lang: string;
  name: string;
  description?: string | null;
};

export type MenuSection = "dishes" | "beverages";

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
