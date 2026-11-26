import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { previewMarketingCampaignWithAuthServer } from "@/lib/loyalty-api/marketing-campaigns";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

export async function POST(req: Request) {
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

  const body = (await req.json().catch(() => null)) as {
    filters?: unknown;
  } | null;

  const filters =
    body?.filters && typeof body.filters === "object" && !Array.isArray(body.filters)
      ? (body.filters as Record<string, unknown>)
      : {};

  const result = await previewMarketingCampaignWithAuthServer(
    token,
    access.restaurantId,
    filters,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
