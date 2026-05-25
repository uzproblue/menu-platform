import {
  getCategoriesWithAuthServer,
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

  const categoriesResult = await getCategoriesWithAuthServer(
    accessToken,
    scopeRestaurantId,
  );
  if (categoriesResult.ok) {
    return { ok: true, restaurantId: categoriesResult.data.restaurantId };
  }

  const locationsResult = await getLocationsWithAuthServer(
    accessToken,
    scopeRestaurantId,
  );
  if (locationsResult.ok) {
    return { ok: true, restaurantId: locationsResult.data.restaurantId };
  }

  const teammatesResult = await getTeammatesWithAuthServer(
    accessToken,
    scopeRestaurantId,
  );
  if (teammatesResult.ok) {
    return { ok: true, restaurantId: teammatesResult.data.restaurantId };
  }

  return {
    ok: false,
    status: categoriesResult.status,
    error: categoriesResult.error,
    message: categoriesResult.message ?? "could not resolve restaurant",
  };
}
