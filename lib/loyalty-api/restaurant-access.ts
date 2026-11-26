import { getMyRestaurantsWithAuthServer } from "@/lib/auth-api/teammates";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

export type LoyaltyRestaurantAccess =
  | { ok: true; restaurantId: string }
  | {
      ok: false;
      status: 403 | 503;
      error: "restaurant_forbidden" | "restaurant_access_unavailable";
      message: string;
    };

/**
 * Defense-in-depth for platform loyalty proxies. The loyalty service still
 * authorizes requests, but platform routes must not trust a stale/tampered
 * restaurant-context cookie before forwarding staff credentials.
 *
 * Prefer an explicit `requestedRestaurantId` (query/body) over the cookie so
 * dashboard fetches stay aligned with the UI-selected restaurant.
 */
export async function requireLoyaltyRestaurantAccess(
  accessToken: string,
  requestedRestaurantId?: string | null,
): Promise<LoyaltyRestaurantAccess> {
  const cookieRestaurantId = (await getSelectedRestaurantIdFromCookies())?.trim();
  const requested = requestedRestaurantId?.trim() || "";
  const preferredId = requested || cookieRestaurantId || undefined;

  const memberships = await getMyRestaurantsWithAuthServer(
    accessToken,
    preferredId,
  );
  if (!memberships.ok) {
    return {
      ok: false,
      status: 503,
      error: "restaurant_access_unavailable",
      message: "Restaurant access could not be verified",
    };
  }

  const restaurantId =
    preferredId ||
    memberships.data.currentRestaurantId ||
    memberships.data.restaurants[0]?.id;
  if (!restaurantId) {
    return {
      ok: false,
      status: 403,
      error: "restaurant_forbidden",
      message: "Select an accessible restaurant before using loyalty",
    };
  }

  if (!memberships.data.restaurants.some(({ id }) => id === restaurantId)) {
    return {
      ok: false,
      status: 403,
      error: "restaurant_forbidden",
      message: "Restaurant is not accessible",
    };
  }

  return { ok: true, restaurantId };
}
