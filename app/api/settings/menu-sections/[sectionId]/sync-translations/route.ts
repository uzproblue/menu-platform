import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { syncMenuSectionTranslationsWithAuthServer } from "@/lib/auth-api";
import {
  isLocationExportStrict,
  scheduleOrAwaitAllRestaurantLocationExports,
} from "@/lib/sync-location-public-export";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ sectionId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { sectionId } = await ctx.params;
  const trimmedId = sectionId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "sectionId is required" },
      { status: 400 },
    );
  }

  const result = await syncMenuSectionTranslationsWithAuthServer(
    token,
    trimmedId,
    restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult =
    await scheduleOrAwaitAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok) {
    console.error(
      "[POST menu-section sync-translations] restaurant location export batch failed",
      exportBatchResult.failures,
    );
    if (isLocationExportStrict()) {
      return NextResponse.json(
        {
          ...result.data,
          error: "location_export_failed",
          message: "One or more location exports failed",
          locationExportBatch: exportBatchResult,
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    {
      ...result.data,
      locationExportBatch: exportBatchResult,
    },
    { status: 200 },
  );
}
