import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  isResolvedDashboardRange,
  resolveDashboardRange,
} from "@/lib/analytics/date-range";
import { getLoyaltyWaiterMembersWithAuthServer } from "@/lib/loyalty-api";
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

  const url = new URL(req.url);
  const range = resolveDashboardRange({
    preset: url.searchParams.get("preset"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!isResolvedDashboardRange(range)) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const result = await getLoyaltyWaiterMembersWithAuthServer(token, access.restaurantId, {
    from: range.from,
    to: range.to,
    waiterId: url.searchParams.get("waiterId")?.trim() ?? "",
    waiterName: url.searchParams.get("waiterName")?.trim() ?? "",
    unknown: url.searchParams.get("unknown") === "1",
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }
  return NextResponse.json(result.data, { status: 200 });
}
