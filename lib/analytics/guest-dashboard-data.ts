import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { queryAnalyticsEngine, restaurantFilter } from "./query";
import type { GuestDashboardData, GuestDailyTrendDay, GuestFunnelStep } from "./types";

export type { GuestDashboardData } from "./types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const GUEST_DATASET = "menu_guest_events";

function formatEventLabel(event: string): string {
  return event
    .replace(/^guest\./, "")
    .split(/[._]/)
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

function buildLast7DaysSkeleton(): GuestDailyTrendDay[] {
  const days: GuestDailyTrendDay[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      day: DAY_NAMES[d.getUTCDay()] ?? "—",
      visitors: 0,
      pageViews: 0,
      cartAdds: 0,
    });
  }
  return days;
}

function emptyDashboard(): GuestDashboardData {
  const skeleton = buildLast7DaysSkeleton();
  return {
    configured: false,
    summary: {
      uniqueVisitors: 0,
      totalEvents: 0,
      pageViews: 0,
      cartAdds: 0,
      loyaltyEnrolls: 0,
    },
    dailyTrend: skeleton,
    topPages: [],
    topCategories: [],
    topItemsViewed: [],
    topItemsCarted: [],
    locations: [],
    eventBreakdown: [],
    languages: [],
    hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    funnel: [
      { step: "Menu open", count: 0 },
      { step: "Category", count: 0 },
      { step: "Item view", count: 0 },
      { step: "Cart add", count: 0 },
    ],
  };
}

function scopedWhere(restaurantId: string | null): string {
  return `timestamp >= NOW() - INTERVAL '7' DAY AND ${restaurantFilter(restaurantId)}`;
}

export async function fetchGuestDashboardData(
  restaurantId: string | null,
): Promise<GuestDashboardData> {
  const configured = isAnalyticsConfigured();
  if (!configured) {
    return emptyDashboard();
  }
  if (!restaurantId) {
    return { ...emptyDashboard(), configured: true };
  }

  const where = scopedWhere(restaurantId);
  const skeleton = buildLast7DaysSkeleton();

  const [
    summaryRows,
    dailyVisitorRows,
    dailyEventRows,
    topPageRows,
    topCategoryRows,
    topViewedRows,
    topCartedRows,
    locationRows,
    eventRows,
    languageRows,
    hourlyRows,
    funnelRows,
  ] = await Promise.all([
    queryAnalyticsEngine(`
      SELECT
        COUNT(DISTINCT blob2) AS uniqueVisitors,
        SUM(_sample_interval * double1) AS totalEvents,
        sumIf(_sample_interval * double1, blob1 = 'guest.page_viewed') AS pageViews,
        sumIf(_sample_interval * double1, blob1 = 'guest.cart_add') AS cartAdds,
        sumIf(_sample_interval * double1, blob1 = 'guest.loyalty_enrolled') AS loyaltyEnrolls
      FROM ${GUEST_DATASET}
      WHERE ${where}
    `),
    queryAnalyticsEngine(`
      SELECT
        toDate(timestamp) AS day,
        COUNT(DISTINCT blob2) AS visitors
      FROM ${GUEST_DATASET}
      WHERE ${where}
      GROUP BY day
      ORDER BY day
    `),
    queryAnalyticsEngine(`
      SELECT
        toDate(timestamp) AS day,
        blob1 AS event,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 IN ('guest.page_viewed', 'guest.cart_add')
      GROUP BY day, event
      ORDER BY day
    `),
    queryAnalyticsEngine(`
      SELECT
        JSONExtractString(blob6, 'page') AS page,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 = 'guest.page_viewed'
        AND page != ''
      GROUP BY page
      ORDER BY n DESC
      LIMIT 10
    `),
    queryAnalyticsEngine(`
      SELECT
        JSONExtractString(blob6, 'categoryId') AS categoryId,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 IN (
          'guest.category_clicked',
          'guest.category_selected',
          'guest.category_scrolled'
        )
        AND categoryId != ''
      GROUP BY categoryId
      ORDER BY n DESC
      LIMIT 10
    `),
    queryAnalyticsEngine(`
      SELECT
        JSONExtractString(blob6, 'itemId') AS itemId,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 = 'guest.item_viewed'
        AND itemId != ''
      GROUP BY itemId
      ORDER BY n DESC
      LIMIT 10
    `),
    queryAnalyticsEngine(`
      SELECT
        JSONExtractString(blob6, 'itemId') AS itemId,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 = 'guest.cart_add'
        AND itemId != ''
      GROUP BY itemId
      ORDER BY n DESC
      LIMIT 10
    `),
    queryAnalyticsEngine(`
      SELECT
        blob4 AS locationId,
        SUM(_sample_interval * double1) AS events,
        COUNT(DISTINCT blob2) AS visitors
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND locationId != ''
      GROUP BY locationId
      ORDER BY events DESC
      LIMIT 20
    `),
    queryAnalyticsEngine(`
      SELECT
        blob1 AS event,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
      GROUP BY event
      ORDER BY n DESC
      LIMIT 50
    `),
    queryAnalyticsEngine(`
      SELECT
        JSONExtractString(blob6, 'lang') AS lang,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 IN ('guest.language_first_pick', 'guest.language_changed')
        AND lang != ''
      GROUP BY lang
      ORDER BY n DESC
      LIMIT 10
    `),
    queryAnalyticsEngine(`
      SELECT
        toHour(timestamp) AS hour,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
      GROUP BY hour
      ORDER BY hour
    `),
    queryAnalyticsEngine(`
      SELECT
        blob1 AS event,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 IN (
          'guest.page_viewed',
          'guest.category_clicked',
          'guest.category_selected',
          'guest.item_viewed',
          'guest.cart_add'
        )
      GROUP BY event
    `),
  ]);

  const summaryRow = summaryRows[0] ?? {};
  const byDay = new Map(skeleton.map((d) => [d.date, { ...d }]));

  for (const row of dailyVisitorRows) {
    const day = String(row.day ?? "").slice(0, 10);
    const entry = byDay.get(day);
    if (!entry) continue;
    entry.visitors = Number(row.visitors ?? 0);
  }

  for (const row of dailyEventRows) {
    const day = String(row.day ?? "").slice(0, 10);
    const event = String(row.event ?? "");
    const n = Number(row.n ?? 0);
    const entry = byDay.get(day);
    if (!entry) continue;
    if (event === "guest.page_viewed") entry.pageViews += n;
    if (event === "guest.cart_add") entry.cartAdds += n;
  }

  const funnelMap = new Map(
    funnelRows.map((row) => [String(row.event ?? ""), Number(row.n ?? 0)]),
  );
  const menuOpen = funnelMap.get("guest.page_viewed") ?? 0;
  const category =
    (funnelMap.get("guest.category_clicked") ?? 0) +
    (funnelMap.get("guest.category_selected") ?? 0);
  const itemView = funnelMap.get("guest.item_viewed") ?? 0;
  const cartAdd = funnelMap.get("guest.cart_add") ?? 0;

  const funnel: GuestFunnelStep[] = [
    { step: "Menu open", count: menuOpen },
    { step: "Category", count: category },
    { step: "Item view", count: itemView },
    { step: "Cart add", count: cartAdd },
  ];

  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
  }));
  for (const row of hourlyRows) {
    const hour = Number(row.hour ?? -1);
    if (hour < 0 || hour > 23) continue;
    hourlyActivity[hour] = { hour, count: Number(row.n ?? 0) };
  }

  return {
    configured: true,
    summary: {
      uniqueVisitors: Number(summaryRow.uniqueVisitors ?? 0),
      totalEvents: Number(summaryRow.totalEvents ?? 0),
      pageViews: Number(summaryRow.pageViews ?? 0),
      cartAdds: Number(summaryRow.cartAdds ?? 0),
      loyaltyEnrolls: Number(summaryRow.loyaltyEnrolls ?? 0),
    },
    dailyTrend: [...byDay.values()],
    topPages: topPageRows.map((row) => ({
      page: String(row.page ?? "unknown"),
      count: Number(row.n ?? 0),
    })),
    topCategories: topCategoryRows.map((row) => ({
      categoryId: String(row.categoryId ?? ""),
      count: Number(row.n ?? 0),
    })),
    topItemsViewed: topViewedRows.map((row) => ({
      itemId: String(row.itemId ?? ""),
      count: Number(row.n ?? 0),
    })),
    topItemsCarted: topCartedRows.map((row) => ({
      itemId: String(row.itemId ?? ""),
      count: Number(row.n ?? 0),
    })),
    locations: locationRows.map((row) => ({
      locationId: String(row.locationId ?? ""),
      events: Number(row.events ?? 0),
      visitors: Number(row.visitors ?? 0),
    })),
    eventBreakdown: eventRows.map((row) => {
      const event = String(row.event ?? "");
      return {
        event,
        count: Number(row.n ?? 0),
        label: formatEventLabel(event),
      };
    }),
    languages: languageRows.map((row) => ({
      lang: String(row.lang ?? ""),
      count: Number(row.n ?? 0),
    })),
    hourlyActivity,
    funnel,
  };
}
