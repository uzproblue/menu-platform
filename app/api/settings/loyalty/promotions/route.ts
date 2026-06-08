import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  createPromotionWithAuthServer,
  listPromotionsWithAuthServer,
} from "@/lib/loyalty-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { PlatformEvent, trackStaffMutation } from "@/lib/analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await listPromotionsWithAuthServer(token, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
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
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await createPromotionWithAuthServer(
    token,
    restaurantId,
    body as Record<string, unknown>,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  void trackStaffMutation(PlatformEvent.LOYALTY_PROMOTION_CREATED, {
    promotionId: result.data.promotion?.id,
  });

  return NextResponse.json(result.data, { status: 201 });
}
