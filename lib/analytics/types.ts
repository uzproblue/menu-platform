export type StaffActivityDay = {
  date: string;
  day: string;
  events: number;
  pageViews: number;
};

export type StaffActionCount = {
  event: string;
  count: number;
  label: string;
};

export type StaffDashboardData = {
  configured: boolean;
  activityLast7Days: StaffActivityDay[];
  topActions: StaffActionCount[];
  locationActions: StaffActionCount[];
};

export type GuestDashboardSummary = {
  uniqueVisitors: number;
  totalEvents: number;
  pageViews: number;
  cartAdds: number;
  loyaltyEnrolls: number;
};

export type GuestDailyTrendDay = {
  date: string;
  day: string;
  visitors: number;
  pageViews: number;
  cartAdds: number;
};

export type GuestRankedCount = {
  page?: string;
  categoryId?: string;
  itemId?: string;
  locationId?: string;
  lang?: string;
  event?: string;
  label?: string;
  count: number;
};

export type GuestFunnelStep = {
  step: string;
  count: number;
};

export type GuestDashboardData = {
  configured: boolean;
  summary: GuestDashboardSummary;
  dailyTrend: GuestDailyTrendDay[];
  topPages: { page: string; count: number }[];
  topCategories: { categoryId: string; count: number }[];
  topItemsViewed: { itemId: string; count: number }[];
  topItemsCarted: { itemId: string; count: number }[];
  locations: { locationId: string; events: number; visitors: number }[];
  eventBreakdown: { event: string; count: number; label: string }[];
  languages: { lang: string; count: number }[];
  hourlyActivity: { hour: number; count: number }[];
  funnel: GuestFunnelStep[];
};
