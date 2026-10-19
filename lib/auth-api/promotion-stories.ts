import { authApiJson, authApiVoid } from "./client";
import type {
  PromotionStoriesListResponse,
  PromotionStoryMutationBody,
  PromotionStoryResponse,
  PublishedPromotionStoriesResponse,
} from "./types/promotion-stories";

export async function listPromotionStoriesWithAuthServer(
  accessToken: string,
  restaurantId?: string,
) {
  return authApiJson<PromotionStoriesListResponse>({
    path: "/api/promotion-stories",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function getPromotionStoryWithAuthServer(
  accessToken: string,
  storyId: string,
  restaurantId?: string,
) {
  return authApiJson<PromotionStoryResponse>({
    path: `/api/promotion-stories/${encodeURIComponent(storyId)}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function createPromotionStoryWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  body: PromotionStoryMutationBody,
) {
  return authApiJson<PromotionStoryResponse>({
    path: "/api/promotion-stories",
    method: "POST",
    accessToken,
    restaurantId,
    body,
  });
}

export async function updatePromotionStoryWithAuthServer(
  accessToken: string,
  storyId: string,
  restaurantId: string | undefined,
  body: PromotionStoryMutationBody,
) {
  return authApiJson<PromotionStoryResponse>({
    path: `/api/promotion-stories/${encodeURIComponent(storyId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body,
  });
}

export async function deletePromotionStoryWithAuthServer(
  accessToken: string,
  storyId: string,
  restaurantId?: string,
) {
  return authApiVoid({
    path: `/api/promotion-stories/${encodeURIComponent(storyId)}`,
    method: "DELETE",
    accessToken,
    restaurantId,
  });
}

export async function reorderPromotionStoriesWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  orderedIds: string[],
) {
  return authApiJson<PromotionStoriesListResponse>({
    path: "/api/promotion-stories/reorder",
    method: "POST",
    accessToken,
    restaurantId,
    body: { orderedIds },
  });
}

export async function getPublishedPromotionStoriesForLocationWithAuthServer(
  accessToken: string,
  locationId: string,
  restaurantId?: string,
  opts?: { forExport?: boolean },
) {
  const qs = opts?.forExport ? "?forExport=1" : "";
  return authApiJson<PublishedPromotionStoriesResponse>({
    path: `/api/locations/${encodeURIComponent(locationId)}/published-promotion-stories${qs}`,
    method: "GET",
    accessToken,
    restaurantId,
    timeoutMs: 30_000,
  });
}
