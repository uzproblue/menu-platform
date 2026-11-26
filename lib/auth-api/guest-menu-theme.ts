import { authApiJson } from "./client";

export type GuestMenuThemeOption = {
  id: string;
  label: string;
};

export type RestaurantGuestMenuThemeResponse = {
  restaurantId: string;
  guestMenuThemeId: string;
  options: GuestMenuThemeOption[];
};

export async function getRestaurantGuestMenuThemeWithAuthServer(
  accessToken: string,
  restaurantId: string,
) {
  return authApiJson<RestaurantGuestMenuThemeResponse>({
    path: `/api/restaurants/${encodeURIComponent(restaurantId)}/guest-menu-theme`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}

export async function patchRestaurantGuestMenuThemeWithAuthServer(
  accessToken: string,
  restaurantId: string,
  guestMenuThemeId: string,
) {
  return authApiJson<RestaurantGuestMenuThemeResponse>({
    path: `/api/restaurants/${encodeURIComponent(restaurantId)}/guest-menu-theme`,
    method: "PATCH",
    accessToken,
    restaurantId,
    body: { guestMenuThemeId },
  });
}
