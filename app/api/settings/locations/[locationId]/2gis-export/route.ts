import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getLocationWithAuthServer } from "@/lib/auth-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { makeTwoGisExportPublicUrl } from "@/lib/2gis-export-url";
import { requestTwoGisLocationExport } from "@/lib/2gis-worker-client";
import { purgeCloudflareUrls } from "@/lib/cloudflare-cache";

export async function POST(
  _req: Request,
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

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const existing = await getLocationWithAuthServer(token, trimmedId, restaurantId);
  if (!existing.ok) {
    return NextResponse.json(
      { error: existing.error, message: existing.message },
      { status: existing.status },
    );
  }

  const selectedIds = existing.data.location.twoGisExportCategoryIds ?? [];
  if (!selectedIds.length) {
    return NextResponse.json(
      {
        error: "skipped",
        reason: "no_categories_selected",
        message: "Select at least one category before generating the 2GIS feed",
        publicUrl: makeTwoGisExportPublicUrl(trimmedId),
      },
      { status: 400 },
    );
  }

  const result = await requestTwoGisLocationExport(trimmedId);
  if (!result.ok) {
    const status =
      result.status === 409
        ? 409
        : result.status >= 400
          ? result.status
          : 502;
    return NextResponse.json(
      {
        error: result.error,
        message: result.message,
        reason: result.reason,
        publicUrl: result.publicUrl ?? makeTwoGisExportPublicUrl(trimmedId),
      },
      { status },
    );
  }

  const publicUrl = result.publicUrl || makeTwoGisExportPublicUrl(trimmedId);
  const purgeRes = await purgeCloudflareUrls([publicUrl]);
  if (!purgeRes.ok) {
    console.warn("[2gis-export] CDN purge failed or skipped", {
      locationId: trimmedId,
      publicUrl,
      skipped: Boolean(purgeRes.skipped),
      message: purgeRes.message,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      locationId: result.locationId,
      publicUrl,
      objectKey: result.objectKey,
      offerCount: result.offerCount,
      categoryCount: result.categoryCount,
      purge: {
        ok: purgeRes.ok,
        skipped: !purgeRes.ok ? Boolean(purgeRes.skipped) : false,
        message: !purgeRes.ok ? purgeRes.message : undefined,
      },
    },
    { status: 200 },
  );
}
