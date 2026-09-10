import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { batchReassignMenuItemsWithAuthServer } from "@/lib/auth-api/catalog-menu-items";
import { EMPTY_CATALOG_PIPELINE_OPTIONS } from "@/lib/catalog-pipeline-options";
import {
  isLocationExportStrict,
  schedulePostCatalogChangePipeline,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function POST(req: Request) {
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

  const o = body as Record<string, unknown>;
  const targetCategoryId = typeof o.targetCategoryId === "string" ? o.targetCategoryId.trim() : "";
  const itemIds = Array.isArray(o.itemIds)
    ? o.itemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (!targetCategoryId || itemIds.length === 0) {
    return NextResponse.json(
      { error: "invalid_body", message: "targetCategoryId and non-empty itemIds are required" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await batchReassignMenuItemsWithAuthServer(
    token,
    itemIds,
    targetCategoryId,
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
      "[POST menu-items batch-reassign] restaurant location export batch failed",
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

  void trackStaffMutation(PlatformEvent.CATALOG_MENU_ITEM_UPDATED, {
    itemIds,
    targetCategoryId,
  });

  return NextResponse.json(
    {
      ...result.data,
      locationExportBatch: exportBatchResult,
    },
    { status: 200 },
  );
}
