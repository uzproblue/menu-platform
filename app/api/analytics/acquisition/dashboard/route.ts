import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import {
  isResolvedDashboardRange,
  resolveDashboardRange,
} from "@/lib/analytics/date-range";
import { enrichGuestDashboardWithCatalogNames } from "@/lib/analytics/enrich-guest-dashboard";
import { resolveAnalyticsRestaurantId } from "@/lib/analytics/resolve-restaurant-id";
import {
  DIRECT_ACQUISITION_SOURCE,
  fetchAcquisitionDashboardData,
  getStaffAnalyticsContext,
} from "@/lib/analytics/server";

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
  });
  if (!isResolvedDashboardRange(range)) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const source =
    url.searchParams.get("source")?.trim().toLowerCase() ||
    DIRECT_ACQUISITION_SOURCE;
  const restaurantId = await resolveAnalyticsRestaurantId(
    url.searchParams.get("restaurantId"),
  );
  const raw = await fetchAcquisitionDashboardData(restaurantId, range, source);
  const data = await enrichGuestDashboardWithCatalogNames(
    raw,
    token,
    restaurantId,
  );
  return NextResponse.json({ ...data, source: raw.source }, { status: 200 });
}
