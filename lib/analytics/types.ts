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
