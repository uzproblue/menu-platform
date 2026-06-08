import { getCloudflareContext } from "@opennextjs/cloudflare";
import { queryAnalyticsEngine, restaurantFilter } from "./query";

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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatEventLabel(event: string): string {
  return event
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" · ");
}

function isAnalyticsConfigured(): boolean {
  try {
    const { env } = getCloudflareContext();
    return Boolean(
      env.CF_ACCOUNT_ID?.trim()?.length && env.CF_ANALYTICS_API_TOKEN?.trim()?.length,
    );
  } catch {
    return Boolean(
      process.env.CF_ACCOUNT_ID?.trim()?.length &&
        process.env.CF_ANALYTICS_API_TOKEN?.trim()?.length,
    );
  }
}

function buildLast7DaysSkeleton(): StaffActivityDay[] {
  const days: StaffActivityDay[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      day: DAY_NAMES[d.getUTCDay()] ?? "—",
      events: 0,
      pageViews: 0,
    });
  }
  return days;
}

export async function fetchStaffDashboardData(
  restaurantId: string | null,
): Promise<StaffDashboardData> {
  const configured = isAnalyticsConfigured();
  const skeleton = buildLast7DaysSkeleton();

  if (!configured) {
    return {
      configured: false,
      activityLast7Days: skeleton,
      topActions: [],
      locationActions: [],
    };
  }

  const filter = restaurantFilter(restaurantId);

  const [activityRows, topRows, locationRows] = await Promise.all([
    queryAnalyticsEngine(`
      SELECT
        toDate(timestamp) AS day,
        blob1 AS event,
        SUM(_sample_interval * double1) AS n
      FROM menu_platform_events
      WHERE timestamp >= NOW() - INTERVAL '7' DAY
        AND ${filter}
      GROUP BY day, event
      ORDER BY day
    `),
    queryAnalyticsEngine(`
      SELECT
        blob1 AS event,
        SUM(_sample_interval * double1) AS n
      FROM menu_platform_events
      WHERE timestamp >= NOW() - INTERVAL '7' DAY
        AND ${filter}
      GROUP BY event
      ORDER BY n DESC
      LIMIT 12
    `),
    queryAnalyticsEngine(`
      SELECT
        blob1 AS event,
        SUM(_sample_interval * double1) AS n
      FROM menu_platform_events
      WHERE timestamp >= NOW() - INTERVAL '7' DAY
        AND ${filter}
        AND blob1 LIKE 'location.%'
      GROUP BY event
      ORDER BY n DESC
      LIMIT 8
    `),
  ]);

  const byDay = new Map(skeleton.map((d) => [d.date, { ...d }]));

  for (const row of activityRows) {
    const day = String(row.day ?? "").slice(0, 10);
    const event = String(row.event ?? "");
    const n = Number(row.n ?? 0);
    const entry = byDay.get(day);
    if (!entry) continue;
    entry.events += n;
    if (event === "platform.page_viewed") {
      entry.pageViews += n;
    }
  }

  const topActions: StaffActionCount[] = topRows.map((row) => {
    const event = String(row.event ?? "");
    return {
      event,
      count: Number(row.n ?? 0),
      label: formatEventLabel(event),
    };
  });

  const locationActions: StaffActionCount[] = locationRows.map((row) => {
    const event = String(row.event ?? "");
    return {
      event,
      count: Number(row.n ?? 0),
      label: formatEventLabel(event),
    };
  });

  return {
    configured: true,
    activityLast7Days: [...byDay.values()],
    topActions,
    locationActions,
  };
}
