import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { updateLocationCategoriesWithAuthServer } from "@/lib/auth-api";
import {
  isLocationExportStrict,
  scheduleOrAwaitLocationPublicExport,
  toLocationExportApiField,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

function parseIdList(
  raw: unknown,
  fieldName: string,
): { ok: true; ids: string[] } | { ok: false; message: string } {
  if (raw === undefined) {
    return { ok: true, ids: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: `${fieldName} must be an array of strings` };
  }
  const ids: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") {
      return { ok: false, message: `${fieldName} must be an array of strings` };
    }
    ids.push(x.trim());
  }
  return { ok: true, ids };
}

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

  const record = body as Record<string, unknown>;
  const addParsed = parseIdList(record.add, "add");
  if (!addParsed.ok) {
    return NextResponse.json(
      { error: "invalid_body", message: addParsed.message },
      { status: 400 },
    );
  }
  const removeParsed = parseIdList(record.remove, "remove");
  if (!removeParsed.ok) {
    return NextResponse.json(
      { error: "invalid_body", message: removeParsed.message },
      { status: 400 },
    );
  }
  const hasOrder = Object.prototype.hasOwnProperty.call(record, "order");
  const orderParsed = parseIdList(record.order, "order");
  if (!orderParsed.ok) {
    return NextResponse.json(
      { error: "invalid_body", message: orderParsed.message },
      { status: 400 },
    );
  }

  if (
    addParsed.ids.length === 0 &&
    removeParsed.ids.length === 0 &&
    !hasOrder
  ) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "at least one of add, remove, or order must be provided",
      },
      { status: 400 },
    );
  }

  const input: {
    add?: string[];
    remove?: string[];
    order?: string[];
  } = {};
  if (addParsed.ids.length > 0) input.add = addParsed.ids;
  if (removeParsed.ids.length > 0) input.remove = removeParsed.ids;
  if (hasOrder) input.order = orderParsed.ids;

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await updateLocationCategoriesWithAuthServer(
    token,
    trimmedId,
    input,
    restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportResult = await scheduleOrAwaitLocationPublicExport(token, trimmedId);
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

  void trackStaffMutation(PlatformEvent.LOCATION_CATEGORIES_ASSIGNED, {
    locationId: trimmedId,
    addCount: addParsed.ids.length,
    removeCount: removeParsed.ids.length,
    orderCount: hasOrder ? orderParsed.ids.length : 0,
  });

  return NextResponse.json(
    {
      ...result.data,
      locationExport: toLocationExportApiField(exportResult),
    },
    { status: 200 },
  );
}
