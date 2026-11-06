import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getLocationsWithAuthServer } from "@/lib/auth-api/locations-core";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

export type WhatsappRouteAuth = {
  token: string;
  restaurantId: string;
  /** Any location of the restaurant — required to mint the gateway JWT. */
  locationId: string;
};

/**
 * Restaurant-scoped WhatsApp access. Picks the first location of the selected
 * restaurant so menu-server can authorize the gateway token mint.
 */
export async function requireWhatsappRestaurantAccess(): Promise<
  WhatsappRouteAuth | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const access = await requireLoyaltyRestaurantAccess(token);
  if (!access.ok) {
    return {
      response: NextResponse.json(
        { error: access.error, message: access.message },
        { status: access.status },
      ),
    };
  }

  const locations = await getLocationsWithAuthServer(token, access.restaurantId);
  if (!locations.ok) {
    return {
      response: NextResponse.json(
        { error: locations.error, message: locations.message },
        { status: locations.status },
      ),
    };
  }

  const locationId = locations.data.locations[0]?.id?.trim() ?? "";
  if (!locationId) {
    return {
      response: NextResponse.json(
        {
          error: "no_locations",
          message: "Add a location before linking WhatsApp for this restaurant.",
        },
        { status: 400 },
      ),
    };
  }

  return { token, restaurantId: access.restaurantId, locationId };
}
