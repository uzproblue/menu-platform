import { loyaltyApiJson } from "./client";
import type { LoyaltyAnalytics } from "@/lib/analytics/loyalty-types";

export async function getLoyaltyAnalyticsWithAuthServer(
  accessToken: string,
  restaurantId: string,
  params: { from: string; to: string },
) {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  return loyaltyApiJson<LoyaltyAnalytics>({
    path: `/api/admin/guests/analytics?${query.toString()}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}
