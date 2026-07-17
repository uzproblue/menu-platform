import { authApiJson, authApiVoid } from "./client";
import type {
  CategoryResponse,
  SyncCategoryTranslationsResponse,
  TranslationTextApi,
} from "./types";

export async function createCategoryWithAuthServer(
  accessToken: string,
  input: {
    name: string;
    description?: string;
    coverPhoto?: string;
    menuSectionId?: string;
  },
  restaurantId?: string,
): Promise<
  | { ok: true; data: CategoryResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<CategoryResponse>({
    path: "/api/categories",
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function updateCategoryWithAuthServer(
  accessToken: string,
  categoryId: string,
  input: {
    name?: string;
    description?: string;
    coverPhoto?: string;
    sortOrder?: number;
    menuSectionId?: string;
  },
  restaurantId?: string,
): Promise<
  | { ok: true; data: CategoryResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<CategoryResponse>({
    path: `/api/categories/${encodeURIComponent(categoryId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function syncCategoryTranslationsWithAuthServer(
  accessToken: string,
  categoryId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: SyncCategoryTranslationsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<SyncCategoryTranslationsResponse>({
    path: `/api/categories/${encodeURIComponent(categoryId)}/sync-translations`,
    method: "POST",
    accessToken,
    restaurantId,
    timeoutMs: 30_000,
  });
}

export async function updateCategoryTranslationsWithAuthServer(
  accessToken: string,
  categoryId: string,
  input: { translations: TranslationTextApi[] },
  restaurantId?: string,
): Promise<
  | { ok: true; data: CategoryResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<CategoryResponse>({
    path: `/api/categories/${encodeURIComponent(categoryId)}/translations`,
    method: "PUT",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 30_000,
  });
}

export async function deleteCategoryWithAuthServer(
  accessToken: string,
  categoryId: string,
  restaurantId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
  return authApiVoid({
    path: `/api/categories/${encodeURIComponent(categoryId)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}
