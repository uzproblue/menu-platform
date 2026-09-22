import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { cloneLocationMenuWithAuthServer } from "@/lib/auth-api";
import {
  syncAndPurgeLocationPublicExport,
  toLocationExportApiField,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ locationId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { locationId } = await ctx.params;
  const trimmedId = locationId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "locationId is required" },
      { status: 400 },
    );
  }

  let sourceLocationId: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body === "object" && "sourceLocationId" in body) {
      if (typeof body.sourceLocationId === "string" && body.sourceLocationId.trim()) {
        sourceLocationId = body.sourceLocationId.trim();
      }
    }
  } catch {
    // Body is optional
  }

  try {
    const result = await cloneLocationMenuWithAuthServer(
      token,
      trimmedId,
      { sourceLocationId },
      restaurantId,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status },
      );
    }

    const exportResult = await syncAndPurgeLocationPublicExport(
      token,
      trimmedId,
      { kind: "full" },
    );

    void trackStaffMutation(PlatformEvent.PIPELINE_LOCATION_EXPORT_SCHEDULED, {
      locationId: trimmedId,
      action: "clone_menu",
    });

    return NextResponse.json(
      {
        ok: true,
        data: result.data,
        message: "Menu cloned and published successfully",
        locationExport: toLocationExportApiField(exportResult),
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "clone_failed";
    console.error("[POST location clone-menu] unhandled error", trimmedId, err);
    return NextResponse.json(
      { error: "internal_error", message },
      { status: 500 },
    );
  }
}
