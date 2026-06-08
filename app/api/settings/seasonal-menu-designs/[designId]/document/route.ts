import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { getSeasonalMenuDesignWithAuthServer } from "@/lib/auth-api";
import type { SeasonalMenuDocument } from "@/lib/seasonal-menu/document-types";
import { createEmptySeasonalMenuDocument } from "@/lib/seasonal-menu/empty-document";
import {
  getSeasonalMenuDesignFromR2,
  putSeasonalMenuDesignToR2,
} from "@/lib/r2-seasonal-menu-design";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

type RouteContext = { params: Promise<{ designId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { designId } = await context.params;
  const meta = await getSeasonalMenuDesignWithAuthServer(token, designId, restaurantId);
  if (!meta.ok) {
    return NextResponse.json(
      { error: meta.error, message: meta.message },
      { status: meta.status },
    );
  }

  const loaded = await getSeasonalMenuDesignFromR2(meta.data.design.r2ObjectKey);
  if (loaded.ok) {
    return NextResponse.json({ document: loaded.document }, { status: 200 });
  }

  if (loaded.error === "not_found") {
    const empty = createEmptySeasonalMenuDocument();
    await putSeasonalMenuDesignToR2(meta.data.design.r2ObjectKey, empty);
    return NextResponse.json({ document: empty }, { status: 200 });
  }

  return NextResponse.json(
    { error: loaded.error, message: loaded.message },
    { status: loaded.error === "too_large" ? 413 : 400 },
  );
}

export async function PUT(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const { designId } = await context.params;
  const meta = await getSeasonalMenuDesignWithAuthServer(token, designId, restaurantId);
  if (!meta.ok) {
    return NextResponse.json(
      { error: meta.error, message: meta.message },
      { status: meta.status },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }

  const document =
    typeof body === "object" && body !== null && "document" in body
      ? (body as { document: SeasonalMenuDocument }).document
      : null;

  if (!document || document.version !== 1 || !Array.isArray(document.pages)) {
    return NextResponse.json(
      { error: "invalid_body", message: "document must be version 1 with pages" },
      { status: 400 },
    );
  }

  const putResult = await putSeasonalMenuDesignToR2(meta.data.design.r2ObjectKey, document);
  if (!putResult.ok) {
    return NextResponse.json(
      { error: putResult.error, message: putResult.message },
      { status: putResult.error === "too_large" ? 413 : 400 },
    );
  }

  void trackStaffMutation(PlatformEvent.SEASONAL_DOCUMENT_SAVED, { designId });

  return NextResponse.json({ ok: true }, { status: 200 });
}
