import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getLocationsWithAuthServer } from "@/lib/auth-api";
import { isGuestMenuThemeId } from "@/lib/guest-menu-theme";
import { resolveMenuPublicBaseUrl } from "@/lib/location-menu-url.server";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  buildThemePreviewShareUrl,
  isThemePreviewSigningConfigured,
  signThemePreview,
} from "@/lib/theme-preview";

async function authorize() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  if (!restaurantId) {
    return {
      response: NextResponse.json(
        { error: "invalid_body", message: "restaurant context required" },
        { status: 400 },
      ),
    };
  }
  return { token, restaurantId };
}

/**
 * Mint a signed guest-menu theme preview link (does not publish/save theme).
 * Body: { locationId, guestMenuThemeId, ttlSeconds? }
 */
export async function POST(req: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  if (!isThemePreviewSigningConfigured()) {
    return NextResponse.json(
      {
        error: "preview_not_configured",
        message: "MENU_THEME_PREVIEW_SECRET is not configured",
      },
      { status: 503 },
    );
  }

  const menuBase = resolveMenuPublicBaseUrl();
  if (!menuBase) {
    return NextResponse.json(
      {
        error: "menu_url_not_configured",
        message: "MENU_URL / NEXT_PUBLIC_MENU_URL is not configured",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    locationId?: unknown;
    guestMenuThemeId?: unknown;
    ttlSeconds?: unknown;
  } | null;

  const locationId =
    typeof body?.locationId === "string" ? body.locationId.trim() : "";
  const guestMenuThemeId =
    typeof body?.guestMenuThemeId === "string" ? body.guestMenuThemeId.trim() : "";
  if (!locationId || !isGuestMenuThemeId(guestMenuThemeId)) {
    return NextResponse.json(
      {
        error: "invalid_body",
        message: "locationId and guestMenuThemeId are required",
      },
      { status: 400 },
    );
  }

  const locationsRes = await getLocationsWithAuthServer(
    auth.token,
    auth.restaurantId,
  );
  if (!locationsRes.ok) {
    return NextResponse.json(
      { error: locationsRes.error, message: locationsRes.message },
      { status: locationsRes.status },
    );
  }
  const owned = locationsRes.data.locations.some((loc) => loc.id === locationId);
  if (!owned) {
    return NextResponse.json(
      { error: "forbidden", message: "location not in restaurant" },
      { status: 403 },
    );
  }

  const ttlSeconds =
    typeof body?.ttlSeconds === "number" && Number.isFinite(body.ttlSeconds)
      ? Math.floor(body.ttlSeconds)
      : undefined;

  const signed = await signThemePreview({
    locationId,
    themeId: guestMenuThemeId,
    ttlSeconds,
  });
  if (!signed) {
    return NextResponse.json(
      { error: "sign_failed", message: "could not sign preview token" },
      { status: 500 },
    );
  }

  const url = buildThemePreviewShareUrl({
    menuBaseUrl: menuBase,
    locationId,
    token: signed.token,
  });

  return NextResponse.json({
    url,
    locationId,
    guestMenuThemeId,
    expiresAt: signed.expiresAt,
  });
}
