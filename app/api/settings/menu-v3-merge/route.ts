import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  getLocationsWithAuthServer,
  getMyRestaurantsWithAuthServer,
} from "@/lib/auth-api";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const [restaurantsRes, locationsRes] = await Promise.all([
    getMyRestaurantsWithAuthServer(token, restaurantId),
    getLocationsWithAuthServer(token, restaurantId),
  ]);

  const isOwner = Boolean(
    (restaurantsRes.ok && restaurantsRes.data.isOwner) || session.user?.isOwner,
  );

  if (!isOwner) {
    return NextResponse.json(
      { error: "forbidden", message: "Only owner accounts can access menu merge" },
      { status: 403 },
    );
  }

  const locations = locationsRes.ok
    ? locationsRes.data.locations
        .filter((l) => l.isActive)
        .map((loc) => ({
          id: loc.id,
          name: loc.name,
          posOrganizationId: loc.posOrganizationId ?? null,
          externalMenuId: loc.externalMenuId ?? null,
          hasPos: Boolean(loc.posOrganizationId?.trim()),
        }))
    : [];

  return NextResponse.json({
    ok: true,
    isOwner,
    locations,
  });
}
