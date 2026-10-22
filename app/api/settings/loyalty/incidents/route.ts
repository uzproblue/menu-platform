import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { listLoyaltyIncidentsWithAuthServer } from "@/lib/loyalty-api";
import type { LoyaltyIncidentStatus } from "@/lib/loyalty-api/operations";
import { requireLoyaltyRestaurantAccess } from "@/lib/loyalty-api/restaurant-access";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const statusRaw = searchParams.get("status");
  const status: LoyaltyIncidentStatus | undefined =
    statusRaw === "open" || statusRaw === "resolved" || statusRaw === "ignored"
      ? statusRaw
      : undefined;
  const before = Number(searchParams.get("before")) || undefined;
  const result = await listLoyaltyIncidentsWithAuthServer(token, access.restaurantId, {
    status,
    before,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data);
}
