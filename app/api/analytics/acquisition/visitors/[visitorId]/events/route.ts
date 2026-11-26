import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  isResolvedDashboardRange,
  resolveDashboardRange,
} from "@/lib/analytics/date-range";
import { resolveAnalyticsRestaurantId } from "@/lib/analytics/resolve-restaurant-id";
import {
  fetchAcquisitionVisitorEvents,
  getStaffAnalyticsContext,
} from "@/lib/analytics/server";
import { getGuestWithAuthServer } from "@/lib/loyalty-api/guests";

export async function GET(
  req: Request,
  context: { params: Promise<{ visitorId: string }> },
) {
  const ctx = await getStaffAnalyticsContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { visitorId: rawVisitorId } = await context.params;
  const visitorId = decodeURIComponent(rawVisitorId ?? "").trim();
  if (!visitorId) {
    return NextResponse.json({ error: "invalid_visitor" }, { status: 400 });
  }

  const url = new URL(req.url);
  const range = resolveDashboardRange({
    preset: url.searchParams.get("preset"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    timeZone: url.searchParams.get("timeZone"),
  });
  if (!isResolvedDashboardRange(range)) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const restaurantId = await resolveAnalyticsRestaurantId(
    url.searchParams.get("restaurantId"),
  );
  const data = await fetchAcquisitionVisitorEvents(
    restaurantId,
    range,
    visitorId,
  );

  let member: { id: string; name: string; phoneE164: string } | null = null;
  if (restaurantId && data.guestId) {
    const res = await getGuestWithAuthServer(token, restaurantId, data.guestId);
    if (res.ok && res.data.guest) {
      member = {
        id: res.data.guest.id,
        name: res.data.guest.name,
        phoneE164: res.data.guest.phoneE164,
      };
    }
  }

  return NextResponse.json({ ...data, member }, { status: 200 });
}
