import { authApiJson } from "@/lib/auth-api/client";

export type RestaurantTelegramConfig = {
  restaurantId: string;
  username: string | null;
  botTokenMasked: string | null;
  hasBotToken: boolean;
  hasWebhookSecret: boolean;
  enabled: boolean;
  webhookSync?: {
    ok: boolean;
    action?: string;
    webhookUrl?: string;
    error?: string;
    message?: string;
  };
};

export async function getRestaurantTelegramWithAuthServer(
  accessToken: string,
  restaurantId: string,
) {
  return authApiJson<RestaurantTelegramConfig>({
    path: `/api/restaurants/${encodeURIComponent(restaurantId)}/telegram`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function putRestaurantTelegramWithAuthServer(
  accessToken: string,
  restaurantId: string,
  body: {
    username?: string | null;
    botToken?: string | null;
    enabled?: boolean;
  },
) {
  return authApiJson<RestaurantTelegramConfig>({
    path: `/api/restaurants/${encodeURIComponent(restaurantId)}/telegram`,
    method: "PUT",
    accessToken,
    restaurantId,
    body,
    timeoutMs: 30_000,
  });
}
