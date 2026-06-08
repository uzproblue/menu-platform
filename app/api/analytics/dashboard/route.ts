import { NextResponse } from "next/server";
import { fetchStaffDashboardData } from "@/lib/analytics/dashboard-data";
import { getStaffAnalyticsContext } from "@/lib/analytics/context";

export async function GET() {
  const ctx = await getStaffAnalyticsContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await fetchStaffDashboardData(ctx.restaurantId);
  return NextResponse.json(data, { status: 200 });
}
