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

export type WhatsappBlastResponse = {
  ok: true;
  targeted: number;
  succeeded: number;
  failed: number;
  errors: Array<{ guestId: string; message: string }>;
};

export type GuestBlastChannel = "whatsapp" | "telegram" | "wallet" | "webpush";

export type GuestBlastPreviewResponse = {
  selected: number;
  channels: Record<
    GuestBlastChannel,
    { restaurantReady: boolean; reachable: number }
  >;
};

export type GuestBlastResponse = WhatsappBlastResponse;

export async function previewGuestBlastsWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  body: { guestIds: string[] },
) {
  return loyaltyApiJson<GuestBlastPreviewResponse>({
    path: "/api/admin/guests/blasts/preview",
    method: "POST",
    accessToken,
    restaurantId,
    body,
  });
}

export async function sendGuestBlastWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  body: {
    channel: GuestBlastChannel;
    guestIds: string[];
    message?: string;
    title?: string;
    url?: string;
    locationId?: string;
  },
) {
  return loyaltyApiJson<GuestBlastResponse>({
    path: "/api/admin/guests/blasts",
    method: "POST",
    accessToken,
    restaurantId,
    body,
  });
}

export async function sendGuestsWhatsappBlastWithAuthServer(
  accessToken: string,
  restaurantId: string | undefined,
  body: {
    message: string;
    guestIds: string[];
    /** Optional legacy loc-* fallback; restaurant session is preferred. */
    locationId?: string;
  },
) {
  return loyaltyApiJson<WhatsappBlastResponse>({
    path: "/api/admin/guests/whatsapp-blast",
    method: "POST",
    accessToken,
    restaurantId,
    body,
  });
}
