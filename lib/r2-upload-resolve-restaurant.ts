import {
  getCategoriesWithAuthServer,
  getLocationsWithAuthServer,
  getTeammatesWithAuthServer,
} from "@/lib/auth-api";

export async function resolveRestaurantIdForR2Upload(
  accessToken: string,
): Promise<
  | { ok: true; restaurantId: string }
  | { ok: false; status: number; error: string; message?: string }
> {
  const categoriesResult = await getCategoriesWithAuthServer(accessToken);
  if (categoriesResult.ok) {
    return { ok: true, restaurantId: categoriesResult.data.restaurantId };
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
    status: categoriesResult.status,
    error: categoriesResult.error,
    message: categoriesResult.message ?? "could not resolve restaurant",
  };
}
