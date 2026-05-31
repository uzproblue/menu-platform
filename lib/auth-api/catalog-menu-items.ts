import { authApiJson, authApiVoid } from "./client";
import type {
  CreateMenuItemInput,
  CreateMenuItemResponse,
  SyncMenuItemTranslationsResponse,
  TranslationTextApi,
  UpdateMenuItemActivationResponse,
  UpdateMenuItemInput,
  UpdateMenuItemResponse,
  UpdateMenuItemVideoInput,
  UpdateMenuItemVideoResponse,
} from "./types";

export async function createMenuItemWithAuthServer(
  accessToken: string,
  input: CreateMenuItemInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: CreateMenuItemResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<CreateMenuItemResponse>({
    path: "/api/menu-items",
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function updateMenuItemActivationWithAuthServer(
  accessToken: string,
  itemId: string,
  input: { isActive: boolean },
  restaurantId?: string,
): Promise<
  | { ok: true; data: UpdateMenuItemActivationResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<UpdateMenuItemActivationResponse>({
    path: `/api/menu-items/${encodeURIComponent(itemId)}/activation`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function updateMenuItemWithAuthServer(
  accessToken: string,
  itemId: string,
  input: UpdateMenuItemInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: UpdateMenuItemResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<UpdateMenuItemResponse>({
    path: `/api/menu-items/${encodeURIComponent(itemId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function updateMenuItemVideoWithAuthServer(
  accessToken: string,
  itemId: string,
  input: UpdateMenuItemVideoInput,
  restaurantId?: string,
): Promise<
  | { ok: true; data: UpdateMenuItemVideoResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<UpdateMenuItemVideoResponse>({
    path: `/api/menu-items/${encodeURIComponent(itemId)}/video`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function syncMenuItemTranslationsWithAuthServer(
  accessToken: string,
  itemId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: SyncMenuItemTranslationsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<SyncMenuItemTranslationsResponse>({
    path: `/api/menu-items/${encodeURIComponent(itemId)}/sync-translations`,
    method: "POST",
    accessToken,
    restaurantId,
    timeoutMs: 30_000,
  });
}

export async function updateMenuItemTranslationsWithAuthServer(
  accessToken: string,
  itemId: string,
  input: { translations: TranslationTextApi[] },
  restaurantId?: string,
): Promise<
  | { ok: true; data: UpdateMenuItemResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<UpdateMenuItemResponse>({
    path: `/api/menu-items/${encodeURIComponent(itemId)}/translations`,
    method: "PUT",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 30_000,
  });
}

export async function deleteMenuItemWithAuthServer(
  accessToken: string,
  itemId: string,
  restaurantId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
  return authApiVoid({
    path: `/api/menu-items/${encodeURIComponent(itemId)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}
