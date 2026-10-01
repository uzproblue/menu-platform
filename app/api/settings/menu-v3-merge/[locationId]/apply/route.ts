import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  applyMenuV3MergeWithAuthServer,
  type MenuV3MergeAction,
} from "@/lib/auth-api";
import { EMPTY_CATALOG_PIPELINE_OPTIONS } from "@/lib/catalog-pipeline-options";
import { schedulePostCatalogChangePipeline } from "@/lib/sync-location-public-export";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ locationId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!session.user?.isOwner) {
    return NextResponse.json(
      { error: "forbidden", message: "Only owner accounts can save menu merges" },
      { status: 403 },
    );
  }

  const { locationId: rawId } = await ctx.params;
  const locationId = rawId?.trim() ?? "";
  if (!locationId) {
    return NextResponse.json(
      { error: "invalid_body", message: "locationId is required" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.actions)) {
    return NextResponse.json(
      { error: "invalid_body", message: "actions must be an array" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await applyMenuV3MergeWithAuthServer(
    token,
    locationId,
    body.actions as MenuV3MergeAction[],
    restaurantId,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message ?? "Failed to apply menu merges",
      },
      { status: result.status },
    );
  }

  await schedulePostCatalogChangePipeline(
    token,
    EMPTY_CATALOG_PIPELINE_OPTIONS,
    restaurantId,
  );

  return NextResponse.json(result.data);
}
