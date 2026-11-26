import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  getRestaurantGuestMenuThemeWithAuthServer,
  patchRestaurantGuestMenuThemeWithAuthServer,
} from "@/lib/auth-api";
import { isGuestMenuThemeId } from "@/lib/guest-menu-theme";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { syncAndPurgeAllRestaurantLocationExports } from "@/lib/sync-location-public-export";

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

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const result = await getRestaurantGuestMenuThemeWithAuthServer(
    auth.token,
    auth.restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}

export async function PATCH(req: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => null)) as {
    guestMenuThemeId?: unknown;
  } | null;
  if (!body || typeof body.guestMenuThemeId !== "string") {
    return NextResponse.json(
      { error: "invalid_body", message: "guestMenuThemeId is required" },
      { status: 400 },
    );
  }
  const guestMenuThemeId = body.guestMenuThemeId.trim();
  if (!isGuestMenuThemeId(guestMenuThemeId)) {
    return NextResponse.json(
      { error: "invalid_body", message: "unknown guestMenuThemeId" },
      { status: 400 },
    );
  }

  const result = await patchRestaurantGuestMenuThemeWithAuthServer(
    auth.token,
    auth.restaurantId,
    guestMenuThemeId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const exportBatch = await syncAndPurgeAllRestaurantLocationExports(
    auth.token,
    4,
    auth.restaurantId,
  );

  return NextResponse.json({
    ...result.data,
    export: {
      ok: exportBatch.ok,
      total: exportBatch.total,
      succeeded: exportBatch.succeeded,
      failed: exportBatch.failed,
      failures: exportBatch.failures,
    },
  });
}
