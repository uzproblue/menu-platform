import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { patchLocationMenuItemEnabledWithAuthServer } from "@/lib/auth-api";
import {
  isLocationExportStrict,
  scheduleOrAwaitLocationPublicExport,
  toLocationExportApiField,
} from "@/lib/sync-location-public-export";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ locationId: string; menuItemId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { locationId, menuItemId } = await ctx.params;
  const trimmedLocationId = locationId?.trim();
  const trimmedMenuItemId = menuItemId?.trim();
  if (!trimmedLocationId) {
    return NextResponse.json(
      { error: "invalid_body", message: "locationId is required" },
      { status: 400 },
    );
  }
  if (!trimmedMenuItemId) {
    return NextResponse.json(
      { error: "invalid_body", message: "menuItemId is required" },
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

  const rawEnabled =
    typeof body === "object" && body !== null && "enabled" in body
      ? (body as { enabled?: unknown }).enabled
      : undefined;
  if (typeof rawEnabled !== "boolean") {
    return NextResponse.json(
      { error: "invalid_body", message: "enabled must be a boolean" },
      { status: 400 },
    );
  }

  const rawPrice =
    typeof body === "object" && body !== null && "price" in body
      ? (body as { price?: unknown }).price
      : undefined;
  const price =
    typeof rawPrice === "string" && rawPrice.trim().length
      ? rawPrice.trim()
      : undefined;

  const o = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const patchInput: {
    enabled: boolean;
    price?: string;
    grammUseDefault?: boolean;
    gramm?: string | null;
  } = { enabled: rawEnabled, price };
  if (typeof o.grammUseDefault === "boolean") {
    patchInput.grammUseDefault = o.grammUseDefault;
  }
  if (Object.prototype.hasOwnProperty.call(o, "gramm")) {
    if (typeof o.gramm === "string") {
      patchInput.gramm = o.gramm.trim() || null;
    } else if (o.gramm === null) {
      patchInput.gramm = null;
    }
  }

  const result = await patchLocationMenuItemEnabledWithAuthServer(
    token,
    trimmedLocationId,
    trimmedMenuItemId,
    patchInput,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportResult = await scheduleOrAwaitLocationPublicExport(
    token,
    trimmedLocationId,
  );
  if (!exportResult.ok) {
    console.error(
      "[PATCH location menu-item enabled] location public export failed",
      trimmedLocationId,
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

  return NextResponse.json({
    ...result.data,
    locationExport: toLocationExportApiField(exportResult),
  });
}
