import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  analyticsSqlDateTime,
  buildTrendBuckets,
  type ResolvedDashboardRange,
  type TrendBucket,
} from "./date-range";
import { queryAnalyticsEngine, restaurantFilter } from "./query";
import type {
  GuestDashboardData,
  GuestDashboardRange,
  GuestDashboardSummary,
  GuestFunnelStep,
  GuestTrendPoint,
} from "./types";

export type { GuestDashboardData } from "./types";

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

const EMPTY_SUMMARY: GuestDashboardSummary = {
  uniqueVisitors: 0,
  totalEvents: 0,
  pageViews: 0,
  cartAdds: 0,
  loyaltyEnrolls: 0,
  loyaltyEnrollStarted: 0,
};

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

function rangeMeta(range: ResolvedDashboardRange): GuestDashboardRange {
  return {
    from: range.from,
    to: range.to,
    previousFrom: range.previousFrom,
    previousTo: range.previousTo,
    bucket: range.bucket,
  };
}

function emptyTrend(buckets: TrendBucket[]): GuestTrendPoint[] {
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    visitors: 0,
    pageViews: 0,
    cartAdds: 0,
  }));
}

function emptyDashboard(range: ResolvedDashboardRange): GuestDashboardData {
  return {
    configured: false,
    range: rangeMeta(range),
    summary: { ...EMPTY_SUMMARY },
    previousSummary: { ...EMPTY_SUMMARY },
    trend: emptyTrend(buildTrendBuckets(range)),
    topPages: [],
    topCategories: [],
    topItemsViewed: [],
    topItemsCarted: [],
    locations: [],
    eventBreakdown: [],
    languages: [],
    hourlyActivity: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    funnel: [
      { stepKey: "menuOpen", count: 0 },
      { stepKey: "category", count: 0 },
      { stepKey: "itemView", count: 0 },
      { stepKey: "cartAdd", count: 0 },
    ],
  };
}

function timestampWhere(restaurantId: string, fromMs: number, toExclusiveMs: number): string {
  const from = analyticsSqlDateTime(fromMs);
  const to = analyticsSqlDateTime(toExclusiveMs);
  return `timestamp >= toDateTime('${from}') AND timestamp < toDateTime('${to}') AND ${restaurantFilter(restaurantId)}`;
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

function summaryFromEvents(
  uniqueVisitors: number,
  eventMap: Map<string, number>,
): GuestDashboardSummary {
  const totalEvents = [...eventMap.values()].reduce((sum, n) => sum + n, 0);
  return {
    uniqueVisitors,
    totalEvents,
    pageViews: eventMap.get("guest.page_viewed") ?? 0,
    cartAdds: eventMap.get("guest.cart_add") ?? 0,
    loyaltyEnrolls: eventMap.get("guest.loyalty_enrolled") ?? 0,
    loyaltyEnrollStarted: eventMap.get("guest.loyalty_enroll_started") ?? 0,
  };
}

async function fetchSummary(where: string): Promise<GuestDashboardSummary> {
  const [uniqueVisitorRows, eventRows] = await Promise.all([
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
    `),
  ]);
  const eventMap = new Map(
    eventRows.map((row) => [String(row.event ?? ""), Number(row.n ?? 0)]),
  );
  return summaryFromEvents(Number(uniqueVisitorRows[0]?.uniqueVisitors ?? 0), eventMap);
}

function hourKey(raw: string): string | null {
  const hour = Number(raw);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return String(hour).padStart(2, "0");
}

function bucketKeyForDay(day: string, buckets: TrendBucket[]): string | null {
  const ms = Date.parse(`${day.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  const bucket = buckets.find((item) => ms >= item.startMs && ms < item.endMs);
  return bucket?.key ?? null;
}

export async function fetchGuestDashboardData(
  restaurantId: string | null,
  range: ResolvedDashboardRange,
): Promise<GuestDashboardData> {
  const configured = isAnalyticsConfigured();
  if (!configured) return emptyDashboard(range);
  if (!restaurantId) return { ...emptyDashboard(range), configured: true };

  const where = timestampWhere(restaurantId, range.fromMs, range.toExclusiveMs);
  const previousWhere = timestampWhere(
    restaurantId,
    range.previousFromMs,
    range.previousToExclusiveMs,
  );
  const buckets = buildTrendBuckets(range);
  const metadataEventList = METADATA_EVENTS.map((event) => `'${event}'`).join(", ");
  const hourlyTrend = range.bucket === "hour";

  const [
    previousSummary,
    eventRows,
    uniqueVisitorRows,
    trendEventRows,
    trendVisitorRows,
    metadataRows,
    locationRows,
    hourlyRows,
  ] = await Promise.all([
    fetchSummary(previousWhere),
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
      SELECT count(DISTINCT blob2) AS uniqueVisitors
      FROM ${GUEST_DATASET}
      WHERE ${where}
    `),
    hourlyTrend
      ? queryAnalyticsEngine(`
          SELECT
            toHour(timestamp) AS bucket,
            blob1 AS event,
            SUM(_sample_interval * double1) AS n
          FROM ${GUEST_DATASET}
          WHERE ${where}
            AND blob1 IN ('guest.page_viewed', 'guest.cart_add')
          GROUP BY bucket, event
          ORDER BY bucket
        `)
      : queryAnalyticsEngine(`
          SELECT
            toDate(timestamp) AS bucket,
            blob1 AS event,
            SUM(_sample_interval * double1) AS n
          FROM ${GUEST_DATASET}
          WHERE ${where}
            AND blob1 IN ('guest.page_viewed', 'guest.cart_add')
          GROUP BY bucket, event
          ORDER BY bucket
        `),
    hourlyTrend
      ? queryAnalyticsEngine(`
          SELECT
            toHour(timestamp) AS bucket,
            blob2 AS visitor
          FROM ${GUEST_DATASET}
          WHERE ${where}
          GROUP BY bucket, visitor
        `)
      : queryAnalyticsEngine(`
          SELECT
            toDate(timestamp) AS bucket,
            blob2 AS visitor
          FROM ${GUEST_DATASET}
          WHERE ${where}
          GROUP BY bucket, visitor
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
  const summary = summaryFromEvents(
    Number(uniqueVisitorRows[0]?.uniqueVisitors ?? 0),
    eventMap,
  );

  const visitorsByBucket = new Map<string, Set<string>>();
  for (const row of trendVisitorRows) {
    const raw = String(row.bucket ?? "");
    const visitor = String(row.visitor ?? "");
    if (!raw || !visitor) continue;
    const key = hourlyTrend ? hourKey(raw) : bucketKeyForDay(raw, buckets);
    if (!key) continue;
    if (!visitorsByBucket.has(key)) visitorsByBucket.set(key, new Set());
    visitorsByBucket.get(key)!.add(visitor);
  }

  const eventsByBucket = new Map<string, { pageViews: number; cartAdds: number }>();
  for (const row of trendEventRows) {
    const raw = String(row.bucket ?? "");
    const event = String(row.event ?? "");
    const n = Number(row.n ?? 0);
    const key = hourlyTrend ? hourKey(raw) : bucketKeyForDay(raw, buckets);
    if (!key) continue;
    const entry = eventsByBucket.get(key) ?? { pageViews: 0, cartAdds: 0 };
    if (event === "guest.page_viewed") entry.pageViews += n;
    if (event === "guest.cart_add") entry.cartAdds += n;
    eventsByBucket.set(key, entry);
  }

  const trend: GuestTrendPoint[] = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    visitors: visitorsByBucket.get(bucket.key)?.size ?? 0,
    pageViews: eventsByBucket.get(bucket.key)?.pageViews ?? 0,
    cartAdds: eventsByBucket.get(bucket.key)?.cartAdds ?? 0,
  }));

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
    { stepKey: "menuOpen", count: summary.pageViews },
    {
      stepKey: "category",
      count:
        (eventMap.get("guest.category_clicked") ?? 0) +
        (eventMap.get("guest.category_selected") ?? 0),
    },
    { stepKey: "itemView", count: eventMap.get("guest.item_viewed") ?? 0 },
    { stepKey: "cartAdd", count: summary.cartAdds },
  ];

  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const row of hourlyRows) {
    const hour = Number(row.hour ?? -1);
    if (hour < 0 || hour > 23) continue;
    hourlyActivity[hour] = { hour, count: Number(row.n ?? 0) };
  }

  return {
    configured: true,
    range: rangeMeta(range),
    summary,
    previousSummary,
    trend,
    topPages: topNFromMap(pageCounts).map(({ key, count }) => ({ page: key, count })),
    topCategories: topNFromMap(categoryCounts).map(({ key, count }) => ({
      categoryId: key,
      name: key,
      count,
    })),
    topItemsViewed: topNFromMap(itemViewedCounts).map(({ key, count }) => ({
      itemId: key,
      name: key,
      count,
    })),
    topItemsCarted: topNFromMap(itemCartedCounts).map(({ key, count }) => ({
      itemId: key,
      name: key,
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
    languages: topNFromMap(languageCounts).map(({ key, count }) => ({ lang: key, count })),
    hourlyActivity,
    funnel,
  };
}
