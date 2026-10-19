import { loyaltyApiJson } from "./client";
import type {
  SegmentActionsResponse,
  SegmentMembersResponse,
  SegmentRunResponse,
  SegmentsListResponse,
  LoyaltySegmentAction,
} from "./types";

export async function listSegmentsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
) {
  return loyaltyApiJson<SegmentsListResponse>({
    path: "/api/admin/segments",
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function listSegmentMembersWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  segmentKey: string,
  params: { page?: number; limit?: number } = {},
) {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString();
  return loyaltyApiJson<SegmentMembersResponse>({
    path: `/api/admin/segments/${encodeURIComponent(segmentKey)}/members${qs ? `?${qs}` : ""}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function listSegmentActionsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  params: { date?: string; status?: string } = {},
) {
  const search = new URLSearchParams();
  if (params.date) search.set("date", params.date);
  if (params.status) search.set("status", params.status);
  const qs = search.toString();
  return loyaltyApiJson<SegmentActionsResponse>({
    path: `/api/admin/segments/actions${qs ? `?${qs}` : ""}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function updateSegmentActionWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  actionId: string,
  body: { status: "open" | "dismissed" | "acted" },
) {
  return loyaltyApiJson<{ action: LoyaltySegmentAction }>({
    path: `/api/admin/segments/actions/${encodeURIComponent(actionId)}`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body,
  });
}

export async function runSegmentationWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
) {
  return loyaltyApiJson<SegmentRunResponse>({
    path: "/api/admin/segments/run",
    method: "POST",
    accessToken,
    restaurantId,
    body: {},
  });
}
