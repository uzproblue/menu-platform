import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  patchLocationMenuItemsWithAuthServer,
  publishLocationMenuItemsWithAuthServer,
} from "@/lib/auth-api";
import {
  isLocationExportStrict,
  scheduleOrAwaitLocationPublicExport,
  toLocationExportApiField,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ locationId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

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

  const items: {
    menuItemId: string;
    price: string | number;
    grammUseDefault?: boolean;
    gramm?: string | null;
    imageUseDefault?: boolean;
    image?: string | null;
  }[] = [];
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

    const item: {
      menuItemId: string;
      price: string | number;
      grammUseDefault?: boolean;
      gramm?: string | null;
      imageUseDefault?: boolean;
      image?: string | null;
    } = { menuItemId, price };
    if (typeof o.grammUseDefault === "boolean") {
      item.grammUseDefault = o.grammUseDefault;
    }
    if (Object.prototype.hasOwnProperty.call(o, "gramm")) {
      if (typeof o.gramm === "string") {
        item.gramm = o.gramm.trim() || null;
      } else if (o.gramm === null) {
        item.gramm = null;
      }
    }
    if (typeof o.imageUseDefault === "boolean") {
      item.imageUseDefault = o.imageUseDefault;
    }
    if (Object.prototype.hasOwnProperty.call(o, "image")) {
      if (typeof o.image === "string") {
        item.image = o.image.trim() || null;
      } else if (o.image === null) {
        item.image = null;
      }
    }
    items.push(item);
  }

  const result = await publishLocationMenuItemsWithAuthServer(token, trimmedId, {
    items,
  }, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportResult = await scheduleOrAwaitLocationPublicExport(token, trimmedId);
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

  void trackStaffMutation(PlatformEvent.LOCATION_MENU_PUBLISHED, {
    locationId: trimmedId,
    itemCount: items.length,
  });

  return NextResponse.json(
    {
      ...result.data,
      locationExport: toLocationExportApiField(exportResult),
    },
    { status: 200 },
  );
}

const PATCH_MAX_PER_ARRAY = 500;

function parsePatchPriceRows(
  raw: unknown,
  fieldName: string,
):
  | {
      ok: true;
      rows: {
        menuItemId: string;
        price: string | number;
        grammUseDefault?: boolean;
        gramm?: string | null;
        imageUseDefault?: boolean;
        image?: string | null;
      }[];
    }
  | { ok: false; message: string } {
  if (raw === undefined) {
    return { ok: true, rows: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: `${fieldName} must be an array when provided` };
  }
  if (raw.length > PATCH_MAX_PER_ARRAY) {
    return {
      ok: false,
      message: `at most ${PATCH_MAX_PER_ARRAY} entries in ${fieldName}`,
    };
  }
  const rows: {
    menuItemId: string;
    price: string | number;
    grammUseDefault?: boolean;
    gramm?: string | null;
    imageUseDefault?: boolean;
    image?: string | null;
  }[] = [];
  const seen = new Set<string>();
  for (const el of raw) {
    if (typeof el !== "object" || el === null) {
      return { ok: false, message: `each ${fieldName} entry must be an object` };
    }
    const o = el as Record<string, unknown>;
    if (typeof o.menuItemId !== "string") {
      return { ok: false, message: `each ${fieldName} entry.menuItemId must be a string` };
    }
    const menuItemId = o.menuItemId.trim();
    if (!menuItemId.length || menuItemId.length > 128) {
      return {
        ok: false,
        message: `each ${fieldName} entry.menuItemId must be non-empty (max 128 chars)`,
      };
    }
    if (seen.has(menuItemId)) {
      return { ok: false, message: `duplicate menuItemId in ${fieldName}` };
    }
    seen.add(menuItemId);
    const price = o.price;
    if (typeof price !== "string" && typeof price !== "number") {
      return {
        ok: false,
        message: `each ${fieldName} entry.price must be a string or number`,
      };
    }
    const row: {
      menuItemId: string;
      price: string | number;
      grammUseDefault?: boolean;
      gramm?: string | null;
      imageUseDefault?: boolean;
      image?: string | null;
    } = { menuItemId, price };
    if (typeof o.grammUseDefault === "boolean") {
      row.grammUseDefault = o.grammUseDefault;
    }
    if (Object.prototype.hasOwnProperty.call(o, "gramm")) {
      if (typeof o.gramm === "string") {
        row.gramm = o.gramm.trim() || null;
      } else if (o.gramm === null) {
        row.gramm = null;
      }
    }
    if (typeof o.imageUseDefault === "boolean") {
      row.imageUseDefault = o.imageUseDefault;
    }
    if (Object.prototype.hasOwnProperty.call(o, "image")) {
      if (typeof o.image === "string") {
        row.image = o.image.trim() || null;
      } else if (o.image === null) {
        row.image = null;
      }
    }
    rows.push(row);
  }
  return { ok: true, rows };
}

function parsePatchRemoveIds(
  raw: unknown,
): { ok: true; ids: string[] } | { ok: false; message: string } {
  if (raw === undefined) {
    return { ok: true, ids: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: "remove must be an array when provided" };
  }
  if (raw.length > PATCH_MAX_PER_ARRAY) {
    return { ok: false, message: `at most ${PATCH_MAX_PER_ARRAY} entries in remove` };
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const el of raw) {
    if (typeof el !== "string") {
      return { ok: false, message: "each remove entry must be a menuItemId string" };
    }
    const menuItemId = el.trim();
    if (!menuItemId.length || menuItemId.length > 128) {
      return {
        ok: false,
        message: "each remove menuItemId must be non-empty (max 128 chars)",
      };
    }
    if (seen.has(menuItemId)) {
      return { ok: false, message: "duplicate menuItemId in remove" };
    }
    seen.add(menuItemId);
    ids.push(menuItemId);
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

  const restaurantId = await getSelectedRestaurantIdFromCookies();

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

  const o = body as Record<string, unknown>;
  const addParsed = parsePatchPriceRows(o.add, "add");
  if (!addParsed.ok) {
    return NextResponse.json({ error: "invalid_body", message: addParsed.message }, { status: 400 });
  }
  const updateParsed = parsePatchPriceRows(o.update, "update");
  if (!updateParsed.ok) {
    return NextResponse.json(
      { error: "invalid_body", message: updateParsed.message },
      { status: 400 },
    );
  }
  const removeParsed = parsePatchRemoveIds(o.remove);
  if (!removeParsed.ok) {
    return NextResponse.json(
      { error: "invalid_body", message: removeParsed.message },
      { status: 400 },
    );
  }

  if (
    addParsed.rows.length === 0 &&
    updateParsed.rows.length === 0 &&
    removeParsed.ids.length === 0
  ) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "at least one of add, update, or remove must be non-empty",
      },
      { status: 400 },
    );
  }

  const result = await patchLocationMenuItemsWithAuthServer(token, trimmedId, {
    add: addParsed.rows.length > 0 ? addParsed.rows : undefined,
    update: updateParsed.rows.length > 0 ? updateParsed.rows : undefined,
    remove: removeParsed.ids.length > 0 ? removeParsed.ids : undefined,
  }, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportResult = await scheduleOrAwaitLocationPublicExport(token, trimmedId);
  if (!exportResult.ok) {
    console.error(
      "[PATCH menu-items] location public export failed",
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

  void trackStaffMutation(PlatformEvent.LOCATION_MENU_ITEMS_BULK_UPDATED, {
    locationId: trimmedId,
    added: addParsed.rows.length,
    updated: updateParsed.rows.length,
    removed: removeParsed.ids.length,
  });

  return NextResponse.json(
    {
      ...result.data,
      locationExport: toLocationExportApiField(exportResult),
    },
    { status: 200 },
  );
}
