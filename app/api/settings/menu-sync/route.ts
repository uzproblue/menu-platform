import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  getLocationsWithAuthServer,
  getMyRestaurantsWithAuthServer,
} from "@/lib/auth-api";
import { posSyncWorkerFetch } from "@/lib/pos-sync-api/client";

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

  // 1. Verify owner authorization
  const restaurantsRes = await getMyRestaurantsWithAuthServer(token, restaurantId);
  const isOwner = Boolean(
    (restaurantsRes.ok && restaurantsRes.data.isOwner) || session.user?.isOwner,
  );

  if (!isOwner) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Only owner accounts can refresh menu from POS",
      },
      { status: 403 },
    );
  }

  // 2. Fetch locations for this restaurant
  const locationsRes = await getLocationsWithAuthServer(token, restaurantId);
  if (!locationsRes.ok) {
    return NextResponse.json(
      {
        error: locationsRes.error,
        message: locationsRes.message ?? "Failed to fetch locations",
      },
      { status: locationsRes.status },
    );
  }

  const allLocations = locationsRes.data.locations;
  const posLocations = allLocations.filter(
    (loc) => Boolean(loc.posOrganizationId?.trim()) && loc.isActive,
  );

  if (posLocations.length === 0) {
    return NextResponse.json(
      {
        error: "no_pos_configured",
        message:
          "No active locations with POS integration found for this restaurant. Please configure POS credentials in location settings.",
      },
      { status: 400 },
    );
  }

  // 3. Resolve target location
  const requestedLocationId =
    typeof body.locationId === "string" ? body.locationId.trim() : "";

  let targetLocation = posLocations[0];
  if (requestedLocationId) {
    const matched = posLocations.find((loc) => loc.id === requestedLocationId);
    if (!matched) {
      return NextResponse.json(
        {
          error: "invalid_location",
          message: "Specified location does not have active POS integration configured",
        },
        { status: 400 },
      );
    }
    targetLocation = matched;
  }

  // 4. Trigger synchronous POS menu sync on menu-pos-sync-worker
  try {
    const workerRes = await posSyncWorkerFetch("/v1/menu/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locationId: targetLocation.id,
        direct: true,
      }),
    });

    const workerData = (await workerRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!workerRes.ok) {
      const message =
        typeof workerData.message === "string"
          ? workerData.message
          : typeof workerData.error === "string"
            ? workerData.error
            : "Menu sync failed on worker";

      return NextResponse.json(
        {
          error: "menu_sync_failed",
          message,
        },
        { status: workerRes.status },
      );
    }

    const apply = (workerData.apply as Record<string, unknown>) ?? {};
    const exportResult = (workerData.export as Record<string, unknown>) ?? {};

    const createdItems = typeof apply.createdItems === "number" ? apply.createdItems : 0;
    const pricesUpdated = typeof apply.pricesUpdated === "number" ? apply.pricesUpdated : 0;
    const createdCategories =
      typeof apply.createdCategories === "number" ? apply.createdCategories : 0;
    const publicUrl =
      typeof exportResult.publicUrl === "string" ? exportResult.publicUrl : undefined;

    return NextResponse.json({
      ok: true,
      locationId: targetLocation.id,
      locationName: targetLocation.name,
      createdItems,
      pricesUpdated,
      createdCategories,
      publicUrl,
      message: "Menu synchronized with POS successfully",
    });
  } catch (err) {
    console.error("[POST /api/settings/menu-sync] unhandled error", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: err instanceof Error ? err.message : "Failed to trigger menu sync",
      },
      { status: 500 },
    );
  }
}
