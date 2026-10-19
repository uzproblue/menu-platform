import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { runSegmentationWithAuthServer } from "@/lib/loyalty-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

export async function POST() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await runSegmentationWithAuthServer(token, restaurantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, {
    status: result.data.queued ? 202 : 200,
  });
}
