import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { updateMenuItemActivationWithAuthServer } from "@/lib/auth-api";
import {
  isLocationExportStrict,
  scheduleOrAwaitAllRestaurantLocationExports,
} from "@/lib/sync-location-public-export";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { itemId } = await ctx.params;
  const trimmedItemId = itemId?.trim();
  if (!trimmedItemId) {
    return NextResponse.json(
      { error: "invalid_body", message: "itemId is required" },
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

  const rawIsActive =
    typeof body === "object" && body !== null && "isActive" in body
      ? (body as { isActive?: unknown }).isActive
      : undefined;
  if (typeof rawIsActive !== "boolean") {
    return NextResponse.json(
      { error: "invalid_body", message: "isActive must be a boolean" },
      { status: 400 },
    );
  }

  const result = await updateMenuItemActivationWithAuthServer(token, trimmedItemId, {
    isActive: rawIsActive,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatchResult = await scheduleOrAwaitAllRestaurantLocationExports(token);
  if (!exportBatchResult.ok) {
    console.error(
      "[PATCH menu-item activation] restaurant location export batch failed",
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
