import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth-options";
import {
  getMyRestaurantsWithAuthServer,
  type MyRestaurantsResponse,
} from "@/lib/auth-api";
import {
  getSelectedRestaurantIdFromCookies,
  selectedRestaurantCookieOptions,
  SELECTED_RESTAURANT_COOKIE,
} from "@/lib/restaurant-context";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cookieRestaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getMyRestaurantsWithAuthServer(token, cookieRestaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  const data: MyRestaurantsResponse & { selectedRestaurantId: string | null } = {
    ...result.data,
    selectedRestaurantId: cookieRestaurantId ?? result.data.currentRestaurantId,
  };

  return NextResponse.json(data, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "invalid JSON body" },
      { status: 400 },
    );
  }

  const rawId =
    typeof body === "object" && body !== null && "restaurantId" in body
      ? (body as { restaurantId?: unknown }).restaurantId
      : undefined;
  if (typeof rawId !== "string" || !rawId.trim().length) {
    return NextResponse.json(
      { error: "invalid_body", message: "restaurantId is required" },
      { status: 400 },
    );
  }

  const restaurantId = rawId.trim();
  const listResult = await getMyRestaurantsWithAuthServer(token, restaurantId);
  if (!listResult.ok) {
    return NextResponse.json(
      { error: listResult.error, message: listResult.message },
      { status: listResult.status },
    );
  }

  const allowed = listResult.data.restaurants.some((r) => r.id === restaurantId);
  if (!allowed) {
    return NextResponse.json(
      { error: "forbidden", message: "restaurant is not accessible" },
      { status: 403 },
    );
  }

  const jar = await cookies();
  jar.set(selectedRestaurantCookieOptions(restaurantId));

  void trackStaffMutation(PlatformEvent.RESTAURANT_CONTEXT_SWITCHED, {
    restaurantId,
  });

  return NextResponse.json(
    {
      ok: true as const,
      restaurantId,
      restaurants: listResult.data.restaurants,
      isOwner: listResult.data.isOwner,
    },
    { status: 200 },
  );
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jar = await cookies();
  jar.delete(SELECTED_RESTAURANT_COOKIE);

  return NextResponse.json({ ok: true as const }, { status: 200 });
}
