import { loyaltyApiJson, loyaltyApiVoid } from "./client";
import type { PromotionResponse, PromotionsListResponse } from "./types";

export async function listPromotionsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
) {
  return loyaltyApiJson<PromotionsListResponse>({
    path: "/api/admin/promotions",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function getPromotionWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  id: string,
) {
  return loyaltyApiJson<PromotionResponse>({
    path: `/api/admin/promotions/${encodeURIComponent(id)}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function createPromotionWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  body: Record<string, unknown>,
) {
  return loyaltyApiJson<PromotionResponse>({
    path: "/api/admin/promotions",
    method: "POST",
    accessToken,
    restaurantId,
    body,
  });
}

export async function updatePromotionWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  id: string,
  body: Record<string, unknown>,
) {
  return loyaltyApiJson<PromotionResponse>({
    path: `/api/admin/promotions/${encodeURIComponent(id)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body,
  });
}

export async function deletePromotionWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  id: string,
) {
  return loyaltyApiVoid({
    path: `/api/admin/promotions/${encodeURIComponent(id)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}
