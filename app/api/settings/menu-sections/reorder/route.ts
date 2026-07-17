import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { reorderMenuSectionsWithAuthServer } from "@/lib/auth-api";
import { EMPTY_CATALOG_PIPELINE_OPTIONS } from "@/lib/catalog-pipeline-options";
import {
  isLocationExportStrict,
  schedulePostCatalogChangePipeline,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "invalid_body", message: "expected JSON object" },
      { status: 400 },
    );
  }

  const rawIds = (body as Record<string, unknown>).sectionIds;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json(
      { error: "invalid_body", message: "sectionIds must be an array" },
      { status: 400 },
    );
  }

  const sectionIds: string[] = [];
  for (const x of rawIds) {
    if (typeof x !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "sectionIds must be an array of strings" },
        { status: 400 },
      );
    }
    const id = x.trim();
    if (id) sectionIds.push(id);
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await reorderMenuSectionsWithAuthServer(
    token,
    { sectionIds },
    restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await schedulePostCatalogChangePipeline(
    token,
    EMPTY_CATALOG_PIPELINE_OPTIONS,
  );
  if (!exportBatchResult.ok) {
    console.error(
      "[PUT menu-sections/reorder] restaurant location export batch failed",
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

  void trackStaffMutation(PlatformEvent.CATALOG_MENU_SECTIONS_REORDERED, {
    sectionCount: sectionIds.length,
  });

  return NextResponse.json(
    {
      ...result.data,
      locationExportBatch: exportBatchResult,
    },
    { status: 200 },
  );
}
