import { authApiJson, authApiVoid } from "./client";
import type {
  MenuSectionEntity,
  SyncMenuSectionTranslationsResponse,
  TranslationTextApi,
} from "./types";

export type MenuSectionsResponse = {
  restaurantId: string;
  sections: MenuSectionEntity[];
};

export type MenuSectionResponse = {
  section: MenuSectionEntity;
};

export async function getMenuSectionsWithAuthServer(
  accessToken: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: MenuSectionsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<MenuSectionsResponse>({
    path: "/api/menu-sections",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function createMenuSectionWithAuthServer(
  accessToken: string,
  input: { name: string; backgroundImage?: string | null; sortOrder?: number },
  restaurantId?: string,
): Promise<
  | { ok: true; data: MenuSectionResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<MenuSectionResponse>({
    path: "/api/menu-sections",
    method: "POST",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function updateMenuSectionWithAuthServer(
  accessToken: string,
  sectionId: string,
  input: {
    name?: string;
    backgroundImage?: string | null;
    sortOrder?: number;
  },
  restaurantId?: string,
): Promise<
  | { ok: true; data: MenuSectionResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<MenuSectionResponse>({
    path: `/api/menu-sections/${encodeURIComponent(sectionId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function deleteMenuSectionWithAuthServer(
  accessToken: string,
  sectionId: string,
  restaurantId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string; message?: string }> {
  return authApiVoid({
    path: `/api/menu-sections/${encodeURIComponent(sectionId)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}

export async function reorderMenuSectionsWithAuthServer(
  accessToken: string,
  input: { sectionIds: string[] },
  restaurantId?: string,
): Promise<
  | { ok: true; data: MenuSectionsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<MenuSectionsResponse>({
    path: "/api/menu-sections/reorder",
    method: "PUT",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function updateLocationSectionsWithAuthServer(
  accessToken: string,
  locationId: string,
  input: { sectionIds: string[] },
  restaurantId?: string,
): Promise<
  | {
      ok: true;
      data: {
        location: {
          id: string;
          enabledSectionIds: string[];
          updatedAt: string;
        };
      };
    }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson({
    path: `/api/locations/${encodeURIComponent(locationId)}/sections`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: input,
  });
}

export async function putMenuSectionTranslationsWithAuthServer(
  accessToken: string,
  sectionId: string,
  input: { translations: TranslationTextApi[] },
  restaurantId?: string,
): Promise<
  | { ok: true; data: MenuSectionResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<MenuSectionResponse>({
    path: `/api/menu-sections/${encodeURIComponent(sectionId)}/translations`,
    method: "PUT",
    accessToken,
    restaurantId,
    body: input,
    timeoutMs: 30_000,
  });
}

export async function syncMenuSectionTranslationsWithAuthServer(
  accessToken: string,
  sectionId: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: SyncMenuSectionTranslationsResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<SyncMenuSectionTranslationsResponse>({
    path: `/api/menu-sections/${encodeURIComponent(sectionId)}/sync-translations`,
    method: "POST",
    accessToken,
    restaurantId,
    timeoutMs: 30_000,
  });
}
