import { loyaltyApiJson } from "./client";
import type {
  GuestDetailResponse,
  GuestsListResponse,
  PointsMutationResponse,
} from "./types";

export async function listGuestsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  q?: string,
) {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return loyaltyApiJson<GuestsListResponse>({
    path: `/api/admin/guests${qs ? `?${qs}` : ""}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function getGuestWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  guestId: string,
) {
  return loyaltyApiJson<GuestDetailResponse>({
    path: `/api/admin/guests/${encodeURIComponent(guestId)}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function mutateGuestPointsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  guestId: string,
  body: {
    kind: "earn" | "redeem" | "adjust";
    points: number;
    note?: string;
    reference?: string;
    idempotencyKey?: string;
  },
) {
  return loyaltyApiJson<PointsMutationResponse>({
    path: `/api/admin/guests/${encodeURIComponent(guestId)}/points`,
    method: "POST",
    accessToken,
    restaurantId,
    body,
  });
}
