import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  createCategoryWithAuthServer,
  getCategoriesWithAuthServer,
} from "@/lib/auth-api";
import {
  isLocationExportStrict,
  postCatalogOptionsForCategory,
  schedulePostCatalogChangePipeline,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getCategoriesWithAuthServer(token, restaurantId);
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
  const rawDescription =
    typeof body === "object" && body !== null && "description" in body
      ? (body as { description?: unknown }).description
      : undefined;
  const rawCoverPhoto =
    typeof body === "object" && body !== null && "coverPhoto" in body
      ? (body as { coverPhoto?: unknown }).coverPhoto
      : undefined;
  const rawMenuSection =
    typeof body === "object" && body !== null && "menuSection" in body
      ? (body as { menuSection?: unknown }).menuSection
      : undefined;
  if (typeof rawName !== "string" || !rawName.trim().length) {
    return NextResponse.json(
      { error: "invalid_body", message: "name is required" },
      { status: 400 },
    );
  }
  if (rawDescription !== undefined && typeof rawDescription !== "string") {
    return NextResponse.json(
      { error: "invalid_body", message: "description must be a string" },
      { status: 400 },
    );
  }
  if (rawCoverPhoto !== undefined && typeof rawCoverPhoto !== "string") {
    return NextResponse.json(
      { error: "invalid_body", message: "coverPhoto must be a string" },
      { status: 400 },
    );
  }

  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";
  const coverPhoto = typeof rawCoverPhoto === "string" ? rawCoverPhoto.trim() : "";

  const menuSection =
    rawMenuSection === "dishes" || rawMenuSection === "beverages"
      ? rawMenuSection
      : undefined;

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await createCategoryWithAuthServer(
    token,
    {
      name: rawName.trim(),
      description: description || undefined,
      coverPhoto: coverPhoto || undefined,
      menuSection,
    },
    restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const categoryId = result.data.category.id;
  const exportBatchResult = await schedulePostCatalogChangePipeline(
    token,
    postCatalogOptionsForCategory(categoryId, result.data.category, {
      textFieldsChanged: result.data.meta?.textFieldsChanged !== false,
    }),
  );
  if (!exportBatchResult.ok) {
    console.error(
      "[POST categories] restaurant location export batch failed",
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

  void trackStaffMutation(PlatformEvent.CATALOG_CATEGORY_CREATED, {
    categoryId,
    menuSection,
  });

  return NextResponse.json(
    {
      ...result.data,
      locationExportBatch: exportBatchResult,
    },
    { status: 201 },
  );
}
