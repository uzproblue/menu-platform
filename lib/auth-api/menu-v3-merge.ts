import { authApiJson } from "./client";

export type MenuV3CategoryPreview = {
  posCategoryId: string;
  posName: string;
  matchKind: "id" | "sku" | "name" | null;
  suggestedCatalogCategoryId: string | null;
  suggestedCatalogName: string | null;
  bucket: "matchedById" | "suggested" | "unmatchedPos";
};

export type MenuV3ItemPreview = {
  posMenuItemId: string;
  posProductSizeId: string;
  posCategoryId: string;
  posName: string;
  sku: string | null;
  priceAmount: string | null;
  matchKind: "id" | "sku" | "name" | null;
  suggestedCatalogItemId: string | null;
  suggestedCatalogName: string | null;
  currentCatalogPrice: string | null;
  currentLocationPrice: string | null;
  bucket: "matchedById" | "suggested" | "unmatchedPos";
};

export type MenuV3MissingInPos = {
  id: string;
  name: string;
  posMenuItemId: string | null;
  posCategoryId: string | null;
  sku: string | null;
  kind: "item" | "category";
};

export type MenuV3PreviewResponse = {
  ok: boolean;
  locationId: string;
  locationName: string;
  currency: string;
  externalMenuId: string;
  menuName: string | null;
  summary: {
    matchedById: number;
    suggested: number;
    unmatchedPos: number;
    missingInPos: number;
  };
  categories: MenuV3CategoryPreview[];
  items: MenuV3ItemPreview[];
  missingInPos: MenuV3MissingInPos[];
  catalogCategories: Array<{
    id: string;
    name: string;
    posCategoryId: string | null;
  }>;
  catalogItems: Array<{
    id: string;
    name: string;
    categoryId: string;
    posMenuItemId: string | null;
    sku: string | null;
  }>;
};

export type MenuV3MergeAction =
  | { type: "linkCategory"; catalogCategoryId: string; posCategoryId: string }
  | { type: "createCategory"; posCategoryId: string; name: string }
  | {
      type: "linkItem";
      menuItemId: string;
      posMenuItemId: string;
      posProductSizeId?: string | null;
      sku?: string | null;
      priceAmount?: string | null;
      catalogCategoryId?: string | null;
    }
  | {
      type: "createItem";
      posMenuItemId: string;
      posProductSizeId?: string | null;
      posCategoryId: string;
      name: string;
      sku?: string | null;
      priceAmount: string;
      catalogCategoryId?: string | null;
    };

export type MenuV3ApplyResponse = {
  ok: boolean;
  locationId: string;
  linkedCategories: number;
  createdCategories: number;
  linkedItems: number;
  createdItems: number;
  pricesUpdated: number;
  errors: Array<{ action: string; message: string }>;
};

export async function previewMenuV3MergeWithAuthServer(
  accessToken: string,
  locationId: string,
  input: { externalMenuId?: string } | undefined,
  restaurantId?: string,
): Promise<
  | { ok: true; data: MenuV3PreviewResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<MenuV3PreviewResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/menu/v3/preview`,
    method: "POST",
    accessToken,
    restaurantId,
    body: input ?? {},
  });
}

export async function applyMenuV3MergeWithAuthServer(
  accessToken: string,
  locationId: string,
  actions: MenuV3MergeAction[],
  restaurantId?: string,
): Promise<
  | { ok: true; data: MenuV3ApplyResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<MenuV3ApplyResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/menu/v3/apply`,
    method: "POST",
    accessToken,
    restaurantId,
    body: { actions },
  });
}
