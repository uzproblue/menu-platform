import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getLocationsWithAuthServer } from "@/lib/auth-api/locations-core";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

export type WhatsappRouteAuth = {
  token: string;
  restaurantId: string;
  locationId: string;
};

function readLocationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function requireWhatsappLocationAccess(
  locationIdRaw: unknown,
): Promise<WhatsappRouteAuth | { response: NextResponse }> {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const locationId = readLocationId(locationIdRaw);
  if (!locationId) {
    return {
      response: NextResponse.json(
        { error: "invalid_body", message: "locationId is required" },
        { status: 400 },
      ),
    };
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

  const belongs = locations.data.locations.some((loc) => loc.id === locationId);
  if (!belongs) {
    return {
      response: NextResponse.json(
        { error: "forbidden", message: "Location is not in the selected restaurant." },
        { status: 403 },
      ),
    };
  }

  return { token, restaurantId: access.restaurantId, locationId };
}
