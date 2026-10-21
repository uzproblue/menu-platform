import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { testLocationPosWithAuthServer } from "@/lib/auth-api";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ locationId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!session.user?.isOwner) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Only owner accounts can test POS credentials",
      },
      { status: 403 },
    );
  }

  const { locationId } = await ctx.params;
  const trimmedId = locationId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "locationId is required" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await testLocationPosWithAuthServer(
    token,
    trimmedId,
    restaurantId,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: result.message ?? "POS credential test failed",
      },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data, { status: 200 });
}
