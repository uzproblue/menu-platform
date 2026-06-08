import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { queryAnalyticsEngine, restaurantFilter } from "./query";
import type { GuestDashboardData, GuestDailyTrendDay, GuestFunnelStep } from "./types";

export type { GuestDashboardData } from "./types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const GUEST_DATASET = "menu_guest_events";

const METADATA_EVENTS = [
  "guest.page_viewed",
  "guest.category_clicked",
  "guest.category_selected",
  "guest.category_scrolled",
  "guest.item_viewed",
  "guest.cart_add",
  "guest.language_first_pick",
  "guest.language_changed",
] as const;

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

function scopedWhere(restaurantId: string): string {
  return `timestamp >= NOW() - INTERVAL '7' DAY AND ${restaurantFilter(restaurantId)}`;
}

function parseMetadataField(blob6: string, field: string): string {
  if (!blob6?.trim()) return "";
  try {
    const parsed = JSON.parse(blob6) as Record<string, unknown>;
    const value = parsed[field];
    return typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";
  } catch {
    return "";
  }
}

function topNFromMap(map: Map<string, number>, limit = 10): { key: string; count: number }[] {
  return [...map.entries()]
    .filter(([key]) => key.length > 0)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
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
  const metadataEventList = METADATA_EVENTS.map((e) => `'${e}'`).join(", ");

  const [
    uniqueVisitorRows,
    eventRows,
    dailyEventRows,
    dailyVisitorRows,
    metadataRows,
    locationRows,
    hourlyRows,
  ] = await Promise.all([
    queryAnalyticsEngine(`
      SELECT count(DISTINCT blob2) AS uniqueVisitors
      FROM ${GUEST_DATASET}
      WHERE ${where}
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
        toDate(timestamp) AS day,
        blob2 AS visitor
      FROM ${GUEST_DATASET}
      WHERE ${where}
      GROUP BY day, visitor
    `),
    queryAnalyticsEngine(`
      SELECT
        blob1 AS event,
        blob6 AS metadata,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 IN (${metadataEventList})
      GROUP BY event, metadata
      ORDER BY n DESC
      LIMIT 500
    `),
    queryAnalyticsEngine(`
      SELECT
        blob4 AS locationId,
        blob2 AS visitor,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob4 != ''
      GROUP BY locationId, visitor
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
  ]);

  const eventMap = new Map(
    eventRows.map((row) => [String(row.event ?? ""), Number(row.n ?? 0)]),
  );

  const totalEvents = [...eventMap.values()].reduce((sum, n) => sum + n, 0);
  const pageViews = eventMap.get("guest.page_viewed") ?? 0;
  const cartAdds = eventMap.get("guest.cart_add") ?? 0;
  const loyaltyEnrolls = eventMap.get("guest.loyalty_enrolled") ?? 0;
  const uniqueVisitors = Number(uniqueVisitorRows[0]?.uniqueVisitors ?? 0);

  const byDay = new Map(skeleton.map((d) => [d.date, { ...d }]));
  const visitorsByDay = new Map<string, Set<string>>();

  for (const row of dailyVisitorRows) {
    const day = String(row.day ?? "").slice(0, 10);
    const visitor = String(row.visitor ?? "");
    if (!day || !visitor) continue;
    if (!visitorsByDay.has(day)) visitorsByDay.set(day, new Set());
    visitorsByDay.get(day)!.add(visitor);
  }

  for (const [day, visitors] of visitorsByDay) {
    const entry = byDay.get(day);
    if (entry) entry.visitors = visitors.size;
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

  const pageCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const itemViewedCounts = new Map<string, number>();
  const itemCartedCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();

  for (const row of metadataRows) {
    const event = String(row.event ?? "");
    const metadata = String(row.metadata ?? "");
    const n = Number(row.n ?? 0);
    if (!n) continue;

    if (event === "guest.page_viewed") {
      const page = parseMetadataField(metadata, "page");
      if (page) pageCounts.set(page, (pageCounts.get(page) ?? 0) + n);
    }

    if (
      event === "guest.category_clicked" ||
      event === "guest.category_selected" ||
      event === "guest.category_scrolled"
    ) {
      const categoryId = parseMetadataField(metadata, "categoryId");
      if (categoryId) {
        categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + n);
      }
    }

    if (event === "guest.item_viewed") {
      const itemId = parseMetadataField(metadata, "itemId");
      if (itemId) itemViewedCounts.set(itemId, (itemViewedCounts.get(itemId) ?? 0) + n);
    }

    if (event === "guest.cart_add") {
      const itemId = parseMetadataField(metadata, "itemId");
      if (itemId) itemCartedCounts.set(itemId, (itemCartedCounts.get(itemId) ?? 0) + n);
    }

    if (event === "guest.language_first_pick" || event === "guest.language_changed") {
      const lang = parseMetadataField(metadata, "lang");
      if (lang) languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + n);
    }
  }

  const locationStats = new Map<string, { events: number; visitors: Set<string> }>();
  for (const row of locationRows) {
    const locationId = String(row.locationId ?? "");
    const visitor = String(row.visitor ?? "");
    const n = Number(row.n ?? 0);
    if (!locationId) continue;
    if (!locationStats.has(locationId)) {
      locationStats.set(locationId, { events: 0, visitors: new Set() });
    }
    const entry = locationStats.get(locationId)!;
    entry.events += n;
    if (visitor) entry.visitors.add(visitor);
  }

  const funnel: GuestFunnelStep[] = [
    { step: "Menu open", count: pageViews },
    {
      step: "Category",
      count:
        (eventMap.get("guest.category_clicked") ?? 0) +
        (eventMap.get("guest.category_selected") ?? 0),
    },
    { step: "Item view", count: eventMap.get("guest.item_viewed") ?? 0 },
    { step: "Cart add", count: cartAdds },
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
      uniqueVisitors,
      totalEvents,
      pageViews,
      cartAdds,
      loyaltyEnrolls,
    },
    dailyTrend: [...byDay.values()],
    topPages: topNFromMap(pageCounts).map(({ key, count }) => ({
      page: key,
      count,
    })),
    topCategories: topNFromMap(categoryCounts).map(({ key, count }) => ({
      categoryId: key,
      count,
    })),
    topItemsViewed: topNFromMap(itemViewedCounts).map(({ key, count }) => ({
      itemId: key,
      count,
    })),
    topItemsCarted: topNFromMap(itemCartedCounts).map(({ key, count }) => ({
      itemId: key,
      count,
    })),
    locations: [...locationStats.entries()]
      .map(([locationId, stats]) => ({
        locationId,
        events: stats.events,
        visitors: stats.visitors.size,
      }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 20),
    eventBreakdown: eventRows.map((row) => {
      const event = String(row.event ?? "");
      return {
        event,
        count: Number(row.n ?? 0),
        label: formatEventLabel(event),
      };
    }),
    languages: topNFromMap(languageCounts).map(({ key, count }) => ({
      lang: key,
      count,
    })),
    hourlyActivity,
    funnel,
  };
}
