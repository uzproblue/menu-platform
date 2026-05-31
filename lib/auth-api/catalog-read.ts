import { authApiJson } from "./client";
import type { CategoriesResponse, GlobalMenuResponse } from "./types";

export async function getCategoriesWithAuthServer(
  accessToken: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: CategoriesResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<CategoriesResponse>({
    path: "/api/categories",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function getGlobalMenuWithAuthServer(
  accessToken: string,
  restaurantId?: string,
): Promise<
  | { ok: true; data: GlobalMenuResponse }
  | { ok: false; status: number; error: string; message?: string }
> {
  return authApiJson<GlobalMenuResponse>({
    path: "/api/global-menu",
    method: "GET",
    accessToken,
    restaurantId,
  });
}
