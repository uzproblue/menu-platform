import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  createLocationWithAuthServer,
  getLocationsWithAuthServer,
} from "@/lib/auth-api";
import { validateTranslationLangsInput } from "@/lib/menu-translation-langs";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics/server";
import { syncDeliveryDomainKV } from "@/lib/delivery-domain-kv";
import { scheduleOrAwaitLocationPublicExport } from "@/lib/sync-location-public-export";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getLocationsWithAuthServer(token, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const currency = typeof o.currency === "string" ? o.currency.trim().toUpperCase() : "";
  const logoUrl = typeof o.logoUrl === "string" ? o.logoUrl.trim() : "";
  const rawAddress = typeof o.address === "string" ? o.address.trim() : "";
  const rawTranslationLangs = Array.isArray(o.translationLangs)
    ? o.translationLangs
    : undefined;
  if (rawAddress.length > 1000) {
    return NextResponse.json(
      { error: "invalid_body", message: "address must be at most 1000 characters" },
      { status: 400 },
    );
  }
  if (!name.length) {
    return NextResponse.json(
      { error: "invalid_body", message: "name is required" },
      { status: 400 },
    );
  }
  if (!currency || currency.length !== 3) {
    return NextResponse.json(
      { error: "invalid_body", message: "currency is required (ISO 4217)" },
      { status: 400 },
    );
  }
  const translationCandidates = (rawTranslationLangs ?? []).filter(
    (x): x is string => typeof x === "string",
  );
  const translationParsed = validateTranslationLangsInput(translationCandidates);
  if (!translationParsed.ok) {
    return NextResponse.json(
      { error: "invalid_body", message: translationParsed.message },
      { status: 400 },
    );
  }
  const translationLangs = translationParsed.value;

  const type = o.type === "delivery" ? ("delivery" as const) : ("dine_in" as const);
  const coverImageUrl = typeof o.coverImageUrl === "string" ? o.coverImageUrl.trim() : "";
  const phoneNumber = typeof o.phoneNumber === "string" ? o.phoneNumber.trim() : "";
  const customDomain = typeof o.customDomain === "string" ? o.customDomain.trim() : undefined;
  const copyMenuFromLocationId =
    typeof o.copyMenuFromLocationId === "string" ? o.copyMenuFromLocationId.trim() : undefined;
  const latitude =
    typeof o.latitude === "number" && Number.isFinite(o.latitude) ? o.latitude : undefined;
  const longitude =
    typeof o.longitude === "number" && Number.isFinite(o.longitude) ? o.longitude : undefined;

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await createLocationWithAuthServer(
    token,
    {
      name,
      type,
      currency,
      translationLangs,
      logoUrl: logoUrl || undefined,
      coverImageUrl: coverImageUrl || undefined,
      address: rawAddress || undefined,
      phoneNumber: phoneNumber || undefined,
      latitude,
      longitude,
      customDomain: customDomain || undefined,
      copyMenuFromLocationId: copyMenuFromLocationId || undefined,
    },
    restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const createdId = result.data.location?.id;
  if (createdId) {
    void trackStaffMutation(PlatformEvent.LOCATION_CREATED, {
      locationId: createdId,
    });

    if (customDomain) {
      await syncDeliveryDomainKV({
        newDomain: customDomain,
        locationId: createdId,
      }).catch((err) => {
        console.error("[POST locations] KV sync failed:", err);
      });
    }

    // Immediately trigger initial R2 public menu snapshot generation
    await scheduleOrAwaitLocationPublicExport(token, createdId).catch((err) => {
      console.error("[POST locations] Initial R2 export failed:", err);
    });
  }

  return NextResponse.json(result.data, { status: 201 });
}
