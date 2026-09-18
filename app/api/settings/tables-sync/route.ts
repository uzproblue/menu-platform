import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { triggerLocationTablesSyncWithAuthServer } from "@/lib/auth-api";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!session.user?.isOwner) {
    return NextResponse.json(
      { error: "forbidden", message: "Only owner accounts can sync tables from POS" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim().length) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const requestedLocationId =
    typeof body.locationId === "string" ? body.locationId.trim() : undefined;

  const result = await triggerLocationTablesSyncWithAuthServer(
    token,
    restaurantId,
    requestedLocationId,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message ?? "Failed to trigger tables sync",
      },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
