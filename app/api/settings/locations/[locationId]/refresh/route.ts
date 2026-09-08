import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  syncAndPurgeLocationPublicExport,
  toLocationExportApiField,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ locationId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { locationId } = await ctx.params;
  const trimmedId = locationId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "locationId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await syncAndPurgeLocationPublicExport(
      token,
      trimmedId,
      { kind: "full" },
    );

    if (!result.ok) {
      console.error(
        "[POST location refresh] syncAndPurgeLocationPublicExport failed",
        trimmedId,
        result.message,
      );
      return NextResponse.json(
        {
          error: "location_export_failed",
          message: result.message,
        },
        { status: 500 },
      );
    }

    void trackStaffMutation(PlatformEvent.PIPELINE_LOCATION_EXPORT_SCHEDULED, {
      locationId: trimmedId,
      action: "manual_refresh",
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Location menu refreshed and cache purged successfully",
        locationExport: toLocationExportApiField(result),
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "refresh_failed";
    console.error("[POST location refresh] unhandled error", trimmedId, err);
    return NextResponse.json(
      { error: "internal_error", message },
      { status: 500 },
    );
  }
}
