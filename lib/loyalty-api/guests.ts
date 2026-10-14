import { loyaltyApiJson } from "./client";
import { buildGuestsListQuery } from "./guests-query";
import type {
  GuestDetailResponse,
  GuestsListParams,
  GuestsListResponse,
  PointsMutationResponse,
} from "./types";

export { buildGuestsListQuery } from "./guests-query";

export async function listGuestsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  params: GuestsListParams = {},
) {
  const qs = buildGuestsListQuery(params);
  return loyaltyApiJson<GuestsListResponse>({
    path: `/api/admin/guests${qs}`,
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
