import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { publishLocationMenuItemsWithAuthServer } from "@/lib/auth-api";
import {
  isLocationExportStrict,
  syncAndPurgeLocationPublicExport,
} from "@/lib/sync-location-public-export";

export async function PUT(
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

  const rawItems = (body as Record<string, unknown>).items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json(
      { error: "invalid_body", message: "items must be a non-empty array" },
      { status: 400 },
    );
  }

  if (rawItems.length > 2000) {
    return NextResponse.json(
      { error: "invalid_body", message: "at most 2000 items allowed" },
      { status: 400 },
    );
  }

  const items: { menuItemId: string; price: string | number }[] = [];
  const seen = new Set<string>();

  for (const el of rawItems) {
    if (typeof el !== "object" || el === null) {
      return NextResponse.json(
        { error: "invalid_body", message: "each item must be an object" },
        { status: 400 },
      );
    }
    const o = el as Record<string, unknown>;
    if (typeof o.menuItemId !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "each item.menuItemId must be a string" },
        { status: 400 },
      );
    }
    const menuItemId = o.menuItemId.trim();
    if (!menuItemId.length || menuItemId.length > 128) {
      return NextResponse.json(
        {
          error: "invalid_body",
          message: "each item.menuItemId must be non-empty (max 128 chars)",
        },
        { status: 400 },
      );
    }
    if (seen.has(menuItemId)) {
      return NextResponse.json(
        { error: "invalid_body", message: "duplicate menuItemId in items" },
        { status: 400 },
      );
    }
    seen.add(menuItemId);

    const price = o.price;
    if (typeof price !== "string" && typeof price !== "number") {
      return NextResponse.json(
        { error: "invalid_body", message: "each item.price must be a string or number" },
        { status: 400 },
      );
    }

    items.push({ menuItemId, price });
  }

  const result = await publishLocationMenuItemsWithAuthServer(token, trimmedId, {
    items,
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
      "[PUT menu-items] location public export failed",
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
      locationExport: exportResult.ok
        ? { ok: true as const, publicUrl: exportResult.publicUrl }
        : { ok: false as const, message: exportResult.message },
    },
    { status: 200 },
  );
}
