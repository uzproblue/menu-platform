import { NextResponse } from "next/server";
import {
  fetchGuestDashboardData,
  getStaffAnalyticsContext,
} from "@/lib/analytics/server";

export async function GET() {
  const ctx = await getStaffAnalyticsContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await fetchGuestDashboardData(ctx.restaurantId);
  return NextResponse.json(data, { status: 200 });
}
