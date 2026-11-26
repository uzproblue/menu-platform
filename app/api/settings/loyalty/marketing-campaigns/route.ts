import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  createMarketingCampaignWithAuthServer,
  listMarketingCampaignsWithAuthServer,
} from "@/lib/loyalty-api/marketing-campaigns";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

export async function GET() {
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

  const result = await listMarketingCampaignsWithAuthServer(
    token,
    access.restaurantId,
  );
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

  const access = await requireLoyaltyRestaurantAccess(token);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, message: access.message },
      { status: access.status },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    filters?: unknown;
    message?: unknown;
  } | null;
  if (!body || typeof body.message !== "string") {
    return NextResponse.json(
      { error: "invalid_body", message: "message is required" },
      { status: 400 },
    );
  }

  const filters =
    body.filters && typeof body.filters === "object" && !Array.isArray(body.filters)
      ? (body.filters as Record<string, unknown>)
      : {};

  const result = await createMarketingCampaignWithAuthServer(
    token,
    access.restaurantId,
    { filters, message: body.message },
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
