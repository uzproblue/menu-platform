import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  previewMenuV3MergeWithAuthServer,
  type MenuV3PreviewResponse,
} from "@/lib/auth-api";
import { expandR2AssetToPublicUrl } from "@/lib/r2-object-key";

function readPublicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");
}

function expandCatalogCoverPhotos(
  data: MenuV3PreviewResponse,
): MenuV3PreviewResponse {
  const base = readPublicBaseUrl();
  if (!base) return data;
  return {
    ...data,
    catalogCategories: data.catalogCategories.map((cat) => ({
      ...cat,
      coverPhoto:
        expandR2AssetToPublicUrl(cat.coverPhoto, base) ?? cat.coverPhoto,
    })),
  };
}

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
      { error: "forbidden", message: "Only owner accounts can fetch POS menu for merge" },
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

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim().length) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const externalMenuId =
    typeof body.externalMenuId === "string" ? body.externalMenuId.trim() : undefined;

  const result = await previewMenuV3MergeWithAuthServer(
    token,
    locationId,
    externalMenuId ? { externalMenuId } : {},
    restaurantId,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message ?? "Failed to preview POS menu",
      },
      { status: result.status },
    );
  }

  return NextResponse.json(expandCatalogCoverPhotos(result.data));
}
