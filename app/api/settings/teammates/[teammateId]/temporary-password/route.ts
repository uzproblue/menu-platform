import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { revealTemporaryPasswordWithAuthServer } from "@/lib/auth-api";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ teammateId: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { teammateId } = await ctx.params;
  const trimmedId = teammateId?.trim();
  if (!trimmedId) {
    return NextResponse.json(
      { error: "invalid_body", message: "teammateId is required" },
      { status: 400 },
    );
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await revealTemporaryPasswordWithAuthServer(
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

  return NextResponse.json(result.data, { status: 201 });
}
