export type LoyaltyAnalyticsBucket = "hour" | "day" | "week";

export type LoyaltyAnalyticsKpis = {
  newMembers: number;
  acquiredMembers: number;
  membersWithoutOrder: number;
  orders: number;
  revenueMinor: number;
  pointsEarned: number;
  pointsRedeemed: number;
  repeatGuests: number;
  walletInstalls: number;
};

export type LoyaltyAnalyticsTrendPoint = {
  key: string;
  label: string;
  newMembers: number;
  orders: number;
  pointsEarned: number;
  pointsRedeemed: number;
};

export type LoyaltyAnalyticsWaiter = {
  waiterId: string;
  waiterName: string;
  unknown: boolean;
  members: number;
  share: number;
  firstOrderRevenueMinor: number;
  firstOrderPoints: number;
};

export type LoyaltyAnalytics = {
  currency: string | null;
  range: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    bucket: LoyaltyAnalyticsBucket;
  };
  summary: LoyaltyAnalyticsKpis;
  previousSummary: LoyaltyAnalyticsKpis;
  trend: LoyaltyAnalyticsTrendPoint[];
  waiters: LoyaltyAnalyticsWaiter[];
};
