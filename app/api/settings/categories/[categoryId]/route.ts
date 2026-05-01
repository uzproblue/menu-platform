import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  deleteCategoryWithAuthServer,
  updateCategoryWithAuthServer,
} from "@/lib/auth-api";
import {
  isLocationExportStrict,
  syncAndPurgeAllRestaurantLocationExports,
} from "@/lib/sync-location-public-export";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ categoryId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { categoryId } = await ctx.params;
  const trimmedId = categoryId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "categoryId is required" },
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
  const rawDescription =
    typeof body === "object" && body !== null && "description" in body
      ? (body as { description?: unknown }).description
      : undefined;
  const rawCoverPhoto =
    typeof body === "object" && body !== null && "coverPhoto" in body
      ? (body as { coverPhoto?: unknown }).coverPhoto
      : undefined;
  const rawSortOrder =
    typeof body === "object" && body !== null && "sortOrder" in body
      ? (body as { sortOrder?: unknown }).sortOrder
      : undefined;

  const payload: {
    name?: string;
    description?: string;
    coverPhoto?: string;
    sortOrder?: number;
  } = {};
  if (typeof rawName === "string" && rawName.trim().length) {
    payload.name = rawName.trim();
  }
  if (typeof rawDescription === "string") {
    payload.description = rawDescription.trim();
  }
  if (typeof rawCoverPhoto === "string") {
    payload.coverPhoto = rawCoverPhoto.trim();
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
    payload.description === undefined &&
    payload.coverPhoto === undefined &&
    payload.sortOrder === undefined
  ) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "name, description, coverPhoto or sortOrder is required",
      },
      { status: 400 },
    );
  }

  const result = await updateCategoryWithAuthServer(token, trimmedId, payload);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await syncAndPurgeAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok) {
    console.error(
      "[PATCH category] restaurant location export batch failed",
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

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ categoryId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { categoryId } = await ctx.params;
  const trimmedId = categoryId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "categoryId is required" },
      { status: 400 },
    );
  }

  const result = await deleteCategoryWithAuthServer(token, trimmedId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await syncAndPurgeAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok) {
    console.error(
      "[DELETE category] restaurant location export batch failed",
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

  return new NextResponse(null, { status: 204 });
}
