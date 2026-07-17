import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  type TranslationTextApi,
  putMenuSectionTranslationsWithAuthServer,
} from "@/lib/auth-api";
import {
  isLocationExportStrict,
  scheduleOrAwaitAllRestaurantLocationExports,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function PUT(
  req: Request,
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

  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }

  const translations =
    typeof body === "object" && body !== null && "translations" in body
      ? (body as { translations?: unknown }).translations
      : undefined;
  if (!Array.isArray(translations)) {
    return NextResponse.json(
      { error: "invalid_body", message: "translations array is required" },
      { status: 400 },
    );
  }

  const result = await putMenuSectionTranslationsWithAuthServer(
    token,
    trimmedId,
    {
      translations: translations as TranslationTextApi[],
    },
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
      "[PUT menu-section translations] restaurant location export batch failed",
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

  void trackStaffMutation(PlatformEvent.CATALOG_MENU_SECTION_TRANSLATIONS_UPDATED, {
    sectionId: trimmedId,
  });

  return NextResponse.json(
    {
      ...result.data,
      locationExportBatch: exportBatchResult,
    },
    { status: 200 },
  );
}
