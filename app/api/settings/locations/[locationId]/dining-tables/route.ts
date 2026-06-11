import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getLocationDiningTablesWithAuthServer } from "@/lib/auth-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

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

  const result = await getLocationDiningTablesWithAuthServer(
    token,
    trimmedId,
    restaurantId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
