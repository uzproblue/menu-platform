import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  deleteMenuSectionWithAuthServer,
  updateMenuSectionWithAuthServer,
} from "@/lib/auth-api";
import { EMPTY_CATALOG_PIPELINE_OPTIONS } from "@/lib/catalog-pipeline-options";
import {
  isLocationExportStrict,
  schedulePostCatalogChangePipeline,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ sectionId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  const rawName =
    typeof body === "object" && body !== null && "name" in body
      ? (body as { name?: unknown }).name
      : undefined;
  const rawBackgroundImage =
    typeof body === "object" && body !== null && "backgroundImage" in body
      ? (body as { backgroundImage?: unknown }).backgroundImage
      : undefined;
  const rawSortOrder =
    typeof body === "object" && body !== null && "sortOrder" in body
      ? (body as { sortOrder?: unknown }).sortOrder
      : undefined;

  const payload: {
    name?: string;
    backgroundImage?: string | null;
    sortOrder?: number;
  } = {};
  if (typeof rawName === "string" && rawName.trim().length) {
    payload.name = rawName.trim();
  }
  if (rawBackgroundImage === null) {
    payload.backgroundImage = null;
  } else if (typeof rawBackgroundImage === "string") {
    payload.backgroundImage = rawBackgroundImage.trim() || null;
  }
  if (
    typeof rawSortOrder === "number" &&
    Number.isInteger(rawSortOrder) &&
    rawSortOrder >= 0
  ) {
    payload.sortOrder = rawSortOrder;
  }

  if (
    payload.name === undefined &&
    payload.backgroundImage === undefined &&
    payload.sortOrder === undefined
  ) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "name, backgroundImage or sortOrder is required",
      },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await updateMenuSectionWithAuthServer(
    token,
    trimmedId,
    payload,
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
      "[PATCH menu-section] restaurant location export batch failed",
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

  void trackStaffMutation(PlatformEvent.CATALOG_MENU_SECTION_UPDATED, {
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

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ sectionId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { sectionId } = await ctx.params;
  const trimmedId = sectionId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "sectionId is required" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await deleteMenuSectionWithAuthServer(token, trimmedId, restaurantId);
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
      "[DELETE menu-section] restaurant location export batch failed",
      exportBatchResult.failures,
    );
    if (isLocationExportStrict()) {
      return NextResponse.json(
        {
          error: "location_export_failed",
          message: "One or more location exports failed",
          locationExportBatch: exportBatchResult,
        },
        { status: 503 },
      );
    }
  }

  void trackStaffMutation(PlatformEvent.CATALOG_MENU_SECTION_DELETED, {
    sectionId: trimmedId,
  });

  return new NextResponse(null, { status: 204 });
}
