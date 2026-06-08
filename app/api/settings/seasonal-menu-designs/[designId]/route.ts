import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  deleteSeasonalMenuDesignWithAuthServer,
  getSeasonalMenuDesignWithAuthServer,
  patchSeasonalMenuDesignWithAuthServer,
} from "@/lib/auth-api";
import { deleteSeasonalMenuDesignFromR2 } from "@/lib/r2-seasonal-menu-design";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

type RouteContext = { params: Promise<{ designId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { designId } = await context.params;
  const result = await getSeasonalMenuDesignWithAuthServer(token, designId, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { designId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }

  const input: { title?: string; locationId?: string | null } = {};
  if (typeof body === "object" && body !== null) {
    if ("title" in body) {
      if (typeof (body as { title?: unknown }).title !== "string") {
        return NextResponse.json(
          { error: "invalid_body", message: "title must be a string" },
          { status: 400 },
        );
      }
      input.title = (body as { title: string }).title.trim();
    }
    if ("locationId" in body) {
      const loc = (body as { locationId?: unknown }).locationId;
      if (loc !== null && typeof loc !== "string") {
        return NextResponse.json(
          { error: "invalid_body", message: "locationId must be a string or null" },
          { status: 400 },
        );
      }
      input.locationId =
        loc === null ? null : typeof loc === "string" ? loc.trim() || null : undefined;
    }
  }

  const result = await patchSeasonalMenuDesignWithAuthServer(token, designId, input, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  void trackStaffMutation(PlatformEvent.SEASONAL_DESIGN_METADATA_SAVED, {
    designId,
  });

  return NextResponse.json(result.data, { status: 200 });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { designId } = await context.params;
  const result = await deleteSeasonalMenuDesignWithAuthServer(token, designId, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  await deleteSeasonalMenuDesignFromR2(result.data.r2ObjectKey);

  void trackStaffMutation(PlatformEvent.SEASONAL_DESIGN_DELETED, { designId });

  return NextResponse.json(result.data, { status: 200 });
}
