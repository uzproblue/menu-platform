import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { updateLocationCategoriesWithAuthServer } from "@/lib/auth-api";
import {
  isLocationExportStrict,
  syncAndPurgeLocationPublicExport,
  toLocationExportApiField,
} from "@/lib/sync-location-public-export";

export async function PATCH(
  req: Request,
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

  const rawIds = (body as Record<string, unknown>).categoryIds;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json(
      { error: "invalid_body", message: "categoryIds must be an array" },
      { status: 400 },
    );
  }

  const categoryIds: string[] = [];
  for (const x of rawIds) {
    if (typeof x !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "categoryIds must be an array of strings" },
        { status: 400 },
      );
    }
    categoryIds.push(x.trim());
  }

  const result = await updateLocationCategoriesWithAuthServer(token, trimmedId, {
    categoryIds,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportResult = await syncAndPurgeLocationPublicExport(token, trimmedId);
  if (!exportResult.ok) {
    console.error(
      "[PATCH location categories] location public export failed",
      trimmedId,
      exportResult.message,
    );
    if (isLocationExportStrict()) {
      return NextResponse.json(
        {
          ...result.data,
          error: "location_export_failed",
          message: exportResult.message,
          locationExport: { ok: false as const, message: exportResult.message },
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    {
      ...result.data,
      locationExport: toLocationExportApiField(exportResult),
    },
    { status: 200 },
  );
}
