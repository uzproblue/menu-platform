import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  deleteLocationWithAuthServer,
  getLocationWithAuthServer,
  updateLocationDetailsWithAuthServer,
} from "@/lib/auth-api";
import { validateTranslationLangsInput } from "@/lib/menu-translation-langs";
import {
  isLocationExportStrict,
  purgeLocationPublicExportUrl,
  scheduleOrAwaitLocationPublicExport,
  toLocationExportApiField,
} from "@/lib/sync-location-public-export";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";

export async function GET(
  _req: Request,
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

  const result = await getLocationWithAuthServer(token, trimmedId, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
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
  const payload: {
    name?: string;
    currency?: string;
    logoUrl?: string;
    address?: string | null;
    translationLangs?: string[];
    posOrganizationId?: string | null;
    posTerminalGroupId?: string | null;
    chefAlertChatId?: string | null;
    instagramUrl?: string | null;
    twoGisUrl?: string | null;
    ordersEnabled?: boolean;
  } = {};

  if ("name" in o) {
    if (typeof o.name !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "name must be a string" },
        { status: 400 },
      );
    }
    payload.name = o.name.trim();
  }
  if ("currency" in o) {
    if (typeof o.currency !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "currency must be a string" },
        { status: 400 },
      );
    }
    payload.currency = o.currency.trim().toUpperCase();
  }
  if ("logoUrl" in o) {
    if (typeof o.logoUrl !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "logoUrl must be a string" },
        { status: 400 },
      );
    }
    payload.logoUrl = o.logoUrl.trim();
  }
  if ("address" in o) {
    if (o.address === null) {
      payload.address = null;
    } else if (typeof o.address === "string") {
      const a = o.address.trim();
      if (a.length > 1000) {
        return NextResponse.json(
          { error: "invalid_body", message: "address must be at most 1000 characters" },
          { status: 400 },
        );
      }
      payload.address = a.length ? a : null;
    } else {
      return NextResponse.json(
        { error: "invalid_body", message: "address must be a string or null" },
        { status: 400 },
      );
    }
  }
  if ("translationLangs" in o) {
    if (!Array.isArray(o.translationLangs)) {
      return NextResponse.json(
        { error: "invalid_body", message: "translationLangs must be an array" },
        { status: 400 },
      );
    }
    const candidates = o.translationLangs.filter((x): x is string => typeof x === "string");
    const parsed = validateTranslationLangsInput(candidates);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "invalid_body", message: parsed.message },
        { status: 400 },
      );
    }
    payload.translationLangs = parsed.value;
  }
  if ("posOrganizationId" in o) {
    if (o.posOrganizationId !== null && typeof o.posOrganizationId !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "posOrganizationId must be a string or null" },
        { status: 400 },
      );
    }
    const v =
      o.posOrganizationId === null ? null : (o.posOrganizationId as string).trim();
    payload.posOrganizationId = v?.length ? v : null;
  }
  if ("posTerminalGroupId" in o) {
    if (o.posTerminalGroupId !== null && typeof o.posTerminalGroupId !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "posTerminalGroupId must be a string or null" },
        { status: 400 },
      );
    }
    const v =
      o.posTerminalGroupId === null ? null : (o.posTerminalGroupId as string).trim();
    payload.posTerminalGroupId = v?.length ? v : null;
  }
  if ("chefAlertChatId" in o) {
    if (o.chefAlertChatId !== null && typeof o.chefAlertChatId !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "chefAlertChatId must be a string or null" },
        { status: 400 },
      );
    }
    const v = o.chefAlertChatId === null ? null : (o.chefAlertChatId as string).trim();
    payload.chefAlertChatId = v?.length ? v : null;
  }
  if ("instagramUrl" in o) {
    if (o.instagramUrl !== null && typeof o.instagramUrl !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "instagramUrl must be a string or null" },
        { status: 400 },
      );
    }
    const v = o.instagramUrl === null ? null : (o.instagramUrl as string).trim();
    if (v && v.length > 2048) {
      return NextResponse.json(
        { error: "invalid_body", message: "instagramUrl must be at most 2048 characters" },
        { status: 400 },
      );
    }
    payload.instagramUrl = v?.length ? v : null;
  }
  if ("twoGisUrl" in o) {
    if (o.twoGisUrl !== null && typeof o.twoGisUrl !== "string") {
      return NextResponse.json(
        { error: "invalid_body", message: "twoGisUrl must be a string or null" },
        { status: 400 },
      );
    }
    const v = o.twoGisUrl === null ? null : (o.twoGisUrl as string).trim();
    if (v && v.length > 2048) {
      return NextResponse.json(
        { error: "invalid_body", message: "twoGisUrl must be at most 2048 characters" },
        { status: 400 },
      );
    }
    payload.twoGisUrl = v?.length ? v : null;
  }
  if ("ordersEnabled" in o) {
    if (typeof o.ordersEnabled !== "boolean") {
      return NextResponse.json(
        { error: "invalid_body", message: "ordersEnabled must be a boolean" },
        { status: 400 },
      );
    }
    payload.ordersEnabled = o.ordersEnabled;
  }

  if (
    payload.name === undefined &&
    payload.currency === undefined &&
    payload.logoUrl === undefined &&
    payload.address === undefined &&
    payload.translationLangs === undefined &&
    payload.posOrganizationId === undefined &&
    payload.posTerminalGroupId === undefined &&
    payload.chefAlertChatId === undefined &&
    payload.instagramUrl === undefined &&
    payload.twoGisUrl === undefined &&
    payload.ordersEnabled === undefined
  ) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message:
          "at least one of name, currency, logoUrl, address, translationLangs, posOrganizationId, posTerminalGroupId, chefAlertChatId, instagramUrl, twoGisUrl, ordersEnabled is required",
      },
      { status: 400 },
    );
  }

  const result = await updateLocationDetailsWithAuthServer(token, trimmedId, payload, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportResult = await scheduleOrAwaitLocationPublicExport(token, trimmedId);
  if (!exportResult.ok) {
    console.error(
      "[PATCH location] location public export failed",
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

  void trackStaffMutation(PlatformEvent.LOCATION_UPDATED, { locationId: trimmedId });

  return NextResponse.json(
    {
      ...result.data,
      locationExport: toLocationExportApiField(exportResult),
    },
    { status: 200 },
  );
}

export async function DELETE(
  _req: Request,
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

  const result = await deleteLocationWithAuthServer(token, trimmedId, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const purgeResult = await purgeLocationPublicExportUrl(trimmedId);
  if (!purgeResult.ok) {
    console.error(
      "[DELETE location] location public export purge failed",
      trimmedId,
      purgeResult.message,
    );
    if (isLocationExportStrict()) {
      return NextResponse.json(
        {
          error: "location_export_failed",
          message: purgeResult.message,
        },
        { status: 503 },
      );
    }
  }

  void trackStaffMutation(PlatformEvent.LOCATION_DELETED, { locationId: trimmedId });

  return new NextResponse(null, { status: 204 });
}
