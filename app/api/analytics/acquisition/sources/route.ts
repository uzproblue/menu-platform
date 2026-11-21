import { NextResponse } from "next/server";
import {
  isResolvedDashboardRange,
  resolveDashboardRange,
} from "@/lib/analytics/date-range";
import { resolveAnalyticsRestaurantId } from "@/lib/analytics/resolve-restaurant-id";
import {
  fetchAcquisitionSources,
  getStaffAnalyticsContext,
} from "@/lib/analytics/server";

export async function GET(req: Request) {
  const ctx = await getStaffAnalyticsContext();
  if (!ctx) {
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

  const restaurantId = await resolveAnalyticsRestaurantId(
    url.searchParams.get("restaurantId"),
  );
  const data = await fetchAcquisitionSources(restaurantId, range);
  return NextResponse.json(data, { status: 200 });
}
