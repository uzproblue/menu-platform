import type {
  CatalogChangeMeta,
  CatalogPriceApi,
  MenuSectionEntity,
  TranslationSyncMeta,
  TranslationTextApi,
} from "./shared";

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  coverPhoto?: string | null;
  sortOrder: number;
  menuSectionId: string;
  itemsCount: number;
  translations: TranslationTextApi[];
};

export type CategoriesResponse = {
  restaurantId: string;
  categories: Category[];
};

export type CategoryResponse = {
  category: Category;
  meta?: CatalogChangeMeta;
};

export type SyncCategoryTranslationsResponse = {
  translations: TranslationTextApi[];
  meta?: TranslationSyncMeta;
};

/** Menu item row from GET /api/global-menu (matches menu-server JSON). */
export type GlobalMenuItemApi = {
  id: string;
  name: string;
  active: boolean;
  prices: CatalogPriceApi[];
  tags: string[];
  description?: string;
  image?: string;
  videoId?: string;
  gramm?: string;
  translations: TranslationTextApi[];
};

export type GlobalMenuCategoryWithItemsApi = {
  id: string;
  name: string;
  description?: string;
  coverPhoto?: string | null;
  sortOrder: number;
  menuSectionId: string;
  translations: TranslationTextApi[];
  items: GlobalMenuItemApi[];
};

export type GlobalMenuSectionApi = {
  id: string;
  name: string;
  backgroundImage: string | null;
  sortOrder: number;
  kind: MenuSectionEntity["kind"];
};

export type GlobalMenuResponse = {
  restaurantId: string;
  sections: GlobalMenuSectionApi[];
  categories: GlobalMenuCategoryWithItemsApi[];
};

export type CatalogPriceInput = {
  price: string | number;
  currency: string;
};

export type CreateMenuItemInput = {
  categoryId: string;
  name: string;
  description?: string;
  image?: string;
  prices?: CatalogPriceInput[];
  active?: boolean;
  tags?: string[];
  gramm?: string;
};

export type CreatedMenuItemApi = {
  id: string;
  categoryId: string;
  name: string;
  active: boolean;
  prices: CatalogPriceApi[];
  tags: string[];
  description?: string;
  image?: string;
  videoId?: string;
  gramm?: string;
  translations: TranslationTextApi[];
};

export type UpdateMenuItemVideoInput = {
  videoId: string | null;
};

export type UpdateMenuItemVideoResponse = {
  item: CreatedMenuItemApi;
};

export type CreateMenuItemResponse = {
  item: CreatedMenuItemApi;
  meta?: CatalogChangeMeta;
};

export type UpdateMenuItemInput = {
  name: string;
  description?: string | null;
  image?: string | null;
  price: string | number;
  currency: string;
  /** When set, menu-server moves the item to this category (same restaurant). */
  categoryId?: string;
  gramm?: string | null;
};

export type UpdateMenuItemResponse = {
  item: CreatedMenuItemApi;
  meta?: CatalogChangeMeta;
};

export type SyncMenuItemTranslationsResponse = {
  translations: TranslationTextApi[];
  meta?: TranslationSyncMeta;
};

export type UpdateMenuItemActivationResponse = {
  item: {
    id: string;
    name: string;
    active: boolean;
  };
};
