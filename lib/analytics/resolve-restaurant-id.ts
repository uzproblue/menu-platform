import "server-only";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getMyRestaurantsWithAuthServer } from "@/lib/auth-api/teammates";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

export async function resolveAnalyticsRestaurantId(
  requestedId: string | null,
): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) return null;

  const cookieId = await getSelectedRestaurantIdFromCookies();
  const candidate = requestedId?.trim() || cookieId?.trim() || null;
  if (!candidate) {
    const list = await getMyRestaurantsWithAuthServer(token);
    if (!list.ok) return null;
    return list.data.currentRestaurantId ?? list.data.restaurants[0]?.id ?? null;
  }

  const list = await getMyRestaurantsWithAuthServer(token, candidate);
  if (!list.ok) return null;
  const allowed = list.data.restaurants.some((r) => r.id === candidate);
  return allowed ? candidate : null;
}
