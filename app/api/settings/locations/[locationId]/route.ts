import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  deleteLocationWithAuthServer,
  getLocationWithAuthServer,
  updateLocationDetailsWithAuthServer,
} from "@/lib/auth-api";
import { validateTranslationLangsInput } from "@/lib/menu-translation-langs";
import {
  isLocationExportStrict,
  purgeLocationPublicExportUrl,
  syncAndPurgeLocationPublicExport,
  toLocationExportApiField,
} from "@/lib/sync-location-public-export";

export async function GET(
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

  const result = await getLocationWithAuthServer(token, trimmedId);
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

  if (
    payload.name === undefined &&
    payload.currency === undefined &&
    payload.logoUrl === undefined &&
    payload.address === undefined &&
    payload.translationLangs === undefined
  ) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message:
          "at least one of name, currency, logoUrl, address, translationLangs is required",
      },
      { status: 400 },
    );
  }

  const result = await updateLocationDetailsWithAuthServer(token, trimmedId, payload);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportResult = await syncAndPurgeLocationPublicExport(token, trimmedId);
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

  const { locationId } = await ctx.params;
  const trimmedId = locationId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "locationId is required" },
      { status: 400 },
    );
  }

  const result = await deleteLocationWithAuthServer(token, trimmedId);
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

  return new NextResponse(null, { status: 204 });
}
