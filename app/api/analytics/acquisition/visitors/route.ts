import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  isResolvedDashboardRange,
  resolveDashboardRange,
} from "@/lib/analytics/date-range";
import { resolveAnalyticsRestaurantId } from "@/lib/analytics/resolve-restaurant-id";
import {
  DIRECT_ACQUISITION_SOURCE,
  fetchAcquisitionVisitors,
  getStaffAnalyticsContext,
} from "@/lib/analytics/server";
import { getGuestWithAuthServer } from "@/lib/loyalty-api/guests";

export async function GET(req: Request) {
  const ctx = await getStaffAnalyticsContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const source =
    url.searchParams.get("source")?.trim().toLowerCase() ||
    DIRECT_ACQUISITION_SOURCE;
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(Math.floor(pageRaw), 1) : 1;
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 100)
    : 50;
  const offset = (page - 1) * limit;

  const restaurantId = await resolveAnalyticsRestaurantId(
    url.searchParams.get("restaurantId"),
  );
  const data = await fetchAcquisitionVisitors(restaurantId, range, source, {
    limit,
    offset,
  });

  const guestIds = [
    ...new Set(
      data.visitors
        .map((v) => v.guestId)
        .filter((id): id is string => Boolean(id)),
    ),
  ].slice(0, 50);

  const guestById = new Map<
    string,
    { id: string; name: string; phoneE164: string }
  >();

  if (restaurantId && guestIds.length > 0) {
    await Promise.all(
      guestIds.map(async (guestId) => {
        const res = await getGuestWithAuthServer(token, restaurantId, guestId);
        if (res.ok && res.data.guest) {
          guestById.set(guestId, {
            id: res.data.guest.id,
            name: res.data.guest.name,
            phoneE164: res.data.guest.phoneE164,
          });
        }
      }),
    );
  }

  return NextResponse.json(
    {
      ...data,
      page,
      limit,
      visitors: data.visitors.map((v) => ({
        ...v,
        member: v.guestId ? guestById.get(v.guestId) ?? null : null,
      })),
    },
    { status: 200 },
  );
}
