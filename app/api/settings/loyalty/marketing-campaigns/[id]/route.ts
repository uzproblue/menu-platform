import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { getMarketingCampaignWithAuthServer } from "@/lib/loyalty-api/marketing-campaigns";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const access = await requireLoyaltyRestaurantAccess(token);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, message: access.message },
      { status: access.status },
    );
  }

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = await getMarketingCampaignWithAuthServer(
    token,
    access.restaurantId,
    id.trim(),
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
