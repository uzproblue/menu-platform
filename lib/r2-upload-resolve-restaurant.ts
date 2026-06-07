import {
  getLocationsWithAuthServer,
  getTeammatesWithAuthServer,
} from "@/lib/auth-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

export async function resolveRestaurantIdForR2Upload(
  accessToken: string,
): Promise<
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string; message?: string }
> {
  const scopeRestaurantId = await getSelectedRestaurantIdFromCookies();
  if (scopeRestaurantId) {
    return { ok: true, restaurantId: scopeRestaurantId };
  }

  const locationsResult = await getLocationsWithAuthServer(accessToken);
  if (locationsResult.ok) {
    return { ok: true, restaurantId: locationsResult.data.restaurantId };
  }

  const teammatesResult = await getTeammatesWithAuthServer(accessToken);
  if (teammatesResult.ok) {
    return { ok: true, restaurantId: teammatesResult.data.restaurantId };
  }

  return {
    ok: false,
    status: locationsResult.status,
    error: locationsResult.error,
    message: locationsResult.message ?? "could not resolve restaurant",
  };
}
