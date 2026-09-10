import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  getLocationsWithAuthServer,
  getMyRestaurantsWithAuthServer,
  triggerLocationPosSyncWithAuthServer,
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

  const rawLocations = locationsRes.ok ? locationsRes.data.locations : [];
  const locations = rawLocations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    posOrganizationId: loc.posOrganizationId ?? null,
    hasPos: Boolean(loc.posOrganizationId?.trim()),
    isActive: loc.isActive,
  }));

  const posLocations = locations.filter((l) => l.hasPos && l.isActive);

  return NextResponse.json({
    ok: true,
    isOwner,
    hasPos: posLocations.length > 0,
    posLocations,
    locations,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim().length) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const requestedLocationId =
    typeof body.locationId === "string" ? body.locationId.trim() : undefined;

  // Forward request to menu-server via authenticated client
  const result = await triggerLocationPosSyncWithAuthServer(
    token,
    restaurantId,
    requestedLocationId,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message ?? "Failed to trigger menu sync",
      },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
