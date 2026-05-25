import { cookies } from "next/headers";

export const SELECTED_RESTAURANT_COOKIE = "menu-selected-restaurant-id";

export async function getSelectedRestaurantIdFromCookies(): Promise<
  string | undefined
> {
  const value = (await cookies()).get(SELECTED_RESTAURANT_COOKIE)?.value?.trim();
  return value?.length ? value : undefined;
}

export function selectedRestaurantCookieOptions(restaurantId: string) {
  return {
    name: SELECTED_RESTAURANT_COOKIE,
    value: restaurantId,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
