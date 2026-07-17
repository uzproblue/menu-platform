import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  createMenuSectionWithAuthServer,
  getMenuSectionsWithAuthServer,
} from "@/lib/auth-api";
import {
  EMPTY_CATALOG_PIPELINE_OPTIONS,
} from "@/lib/catalog-pipeline-options";
import {
  isLocationExportStrict,
  schedulePostCatalogChangePipeline,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getMenuSectionsWithAuthServer(token, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}

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

  if (typeof rawName !== "string" || !rawName.trim().length) {
    return NextResponse.json(
      { error: "invalid_body", message: "name is required" },
      { status: 400 },
    );
  }
  if (
    rawBackgroundImage !== undefined &&
    rawBackgroundImage !== null &&
    typeof rawBackgroundImage !== "string"
  ) {
    return NextResponse.json(
      { error: "invalid_body", message: "backgroundImage must be a string" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await createMenuSectionWithAuthServer(
    token,
    {
      name: rawName.trim(),
      backgroundImage:
        typeof rawBackgroundImage === "string"
          ? rawBackgroundImage.trim() || null
          : rawBackgroundImage === null
            ? null
            : undefined,
      sortOrder:
        typeof rawSortOrder === "number" &&
        Number.isInteger(rawSortOrder) &&
        rawSortOrder >= 0
          ? rawSortOrder
          : undefined,
    },
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
      "[POST menu-sections] restaurant location export batch failed",
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

  void trackStaffMutation(PlatformEvent.CATALOG_MENU_SECTION_CREATED, {
    sectionId: result.data.section.id,
  });

  return NextResponse.json(
    {
      ...result.data,
      locationExportBatch: exportBatchResult,
    },
    { status: 201 },
  );
}
