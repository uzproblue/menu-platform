import { loyaltyApiJson } from "./client";
import type { LoyaltyAnalytics, LoyaltyWaiterMembers } from "@/lib/analytics/loyalty-types";

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

export async function getLoyaltyWaiterMembersWithAuthServer(
  accessToken: string,
  restaurantId: string,
  params: {
    from: string;
    to: string;
    waiterId: string;
    waiterName: string;
    unknown: boolean;
  },
) {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
    waiterId: params.waiterId,
    waiterName: params.waiterName,
  });
  if (params.unknown) query.set("unknown", "1");
  return loyaltyApiJson<LoyaltyWaiterMembers>({
    path: `/api/admin/guests/analytics/members?${query.toString()}`,
    method: "GET",
    accessToken,
    restaurantId,
  });
}
