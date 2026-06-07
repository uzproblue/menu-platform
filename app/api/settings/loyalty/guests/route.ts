import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { listGuestsWithAuthServer } from "@/lib/loyalty-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await listGuestsWithAuthServer(token, restaurantId, q);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
