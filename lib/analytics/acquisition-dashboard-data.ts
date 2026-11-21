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

export const DIRECT_ACQUISITION_SOURCE = "direct";

export type AcquisitionSourceSummary = {
  source: string;
  visitors: number;
  pageViews: number;
  loyaltyEnrolls: number;
};

export type AcquisitionVisitorRow = {
  visitorId: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  eventCount: number;
  pageViews: number;
  cartAdds: number;
  enrolled: boolean;
  guestId: string | null;
};

export type AcquisitionVisitorEvent = {
  timestamp: string;
  event: string;
  locationId: string;
  metadata: Record<string, unknown>;
};

const EMPTY_SUMMARY: GuestDashboardSummary = {
  uniqueVisitors: 0,
  totalEvents: 0,
  pageViews: 0,
  cartAdds: 0,
  loyaltyEnrolls: 0,
  loyaltyEnrollStarted: 0,
};

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
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

/** SQL fragment filtering blob6 acquisitionSource (or lack thereof for direct). */
export function acquisitionSourceWhere(source: string): string {
  const normalized = source.trim().toLowerCase();
  if (!normalized || normalized === DIRECT_ACQUISITION_SOURCE) {
    return `(blob6 = '' OR blob6 = '{}' OR blob6 NOT LIKE '%"acquisitionSource"%')`;
  }
  const needle = escapeSqlString(`%"acquisitionSource":"${normalized}"%`);
  return `blob6 LIKE '${needle}'`;
}

function sanitizeSourceKey(raw: string): string {
  const value = raw.trim().toLowerCase().slice(0, 64);
  return value.replace(/[^\w.\-+]/g, "") || DIRECT_ACQUISITION_SOURCE;
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

function parseMetadataObject(blob6: string): Record<string, unknown> {
  if (!blob6?.trim()) return {};
  try {
    const parsed = JSON.parse(blob6) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
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

function formatEventLabel(event: string): string {
  return event
    .replace(/^guest\./, "")
    .split(/[._]/)
    .map((part) => part.replace(/_/g, " "))
    .join(" · ");
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

export async function fetchAcquisitionSources(
  restaurantId: string | null,
  range: ResolvedDashboardRange,
): Promise<{ configured: boolean; sources: AcquisitionSourceSummary[] }> {
  const configured = isAnalyticsConfigured();
  if (!configured) return { configured: false, sources: [] };
  if (!restaurantId) return { configured: true, sources: [] };

  const where = timestampWhere(restaurantId, range.fromMs, range.toExclusiveMs);
  const rows = await queryAnalyticsEngine(`
    SELECT
      blob2 AS visitor,
      blob1 AS event,
      blob6 AS metadata,
      SUM(_sample_interval * double1) AS n
    FROM ${GUEST_DATASET}
    WHERE ${where}
    GROUP BY visitor, event, metadata
  `);

  type Agg = { visitors: Set<string>; pageViews: number; loyaltyEnrolls: number };
  const bySource = new Map<string, Agg>();

  const ensure = (source: string): Agg => {
    if (!bySource.has(source)) {
      bySource.set(source, { visitors: new Set(), pageViews: 0, loyaltyEnrolls: 0 });
    }
    return bySource.get(source)!;
  };

  // Always seed known sources so the UI can select them before traffic arrives.
  ensure("2gis");
  ensure(DIRECT_ACQUISITION_SOURCE);

  for (const row of rows) {
    const visitor = String(row.visitor ?? "").trim();
    const event = String(row.event ?? "");
    const metadata = String(row.metadata ?? "");
    const n = Number(row.n ?? 0);
    const rawSource = parseMetadataField(metadata, "acquisitionSource");
    const source = rawSource
      ? sanitizeSourceKey(rawSource)
      : DIRECT_ACQUISITION_SOURCE;
    const agg = ensure(source);
    if (visitor) agg.visitors.add(visitor);
    if (event === "guest.page_viewed") agg.pageViews += n;
    if (event === "guest.loyalty_enrolled") agg.loyaltyEnrolls += n;
  }

  const sources = [...bySource.entries()]
    .map(([source, agg]) => ({
      source,
      visitors: agg.visitors.size,
      pageViews: agg.pageViews,
      loyaltyEnrolls: agg.loyaltyEnrolls,
    }))
    .sort((a, b) => {
      if (a.source === "2gis") return -1;
      if (b.source === "2gis") return 1;
      if (a.source === DIRECT_ACQUISITION_SOURCE) return 1;
      if (b.source === DIRECT_ACQUISITION_SOURCE) return -1;
      return b.visitors - a.visitors || a.source.localeCompare(b.source);
    });

  return { configured: true, sources };
}

export async function fetchAcquisitionDashboardData(
  restaurantId: string | null,
  range: ResolvedDashboardRange,
  source: string,
): Promise<GuestDashboardData & { source: string }> {
  const configured = isAnalyticsConfigured();
  const sourceKey = sanitizeSourceKey(source || DIRECT_ACQUISITION_SOURCE);
  if (!configured) return { ...emptyDashboard(range), source: sourceKey };
  if (!restaurantId) {
    return { ...emptyDashboard(range), configured: true, source: sourceKey };
  }

  const sourceFilter = acquisitionSourceWhere(sourceKey);
  const where = `${timestampWhere(restaurantId, range.fromMs, range.toExclusiveMs)} AND ${sourceFilter}`;
  const previousWhere = `${timestampWhere(
    restaurantId,
    range.previousFromMs,
    range.previousToExclusiveMs,
  )} AND ${sourceFilter}`;
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
    source: sourceKey,
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

export async function fetchAcquisitionVisitors(
  restaurantId: string | null,
  range: ResolvedDashboardRange,
  source: string,
  options?: { limit?: number; offset?: number },
): Promise<{
  configured: boolean;
  source: string;
  total: number;
  visitors: AcquisitionVisitorRow[];
}> {
  const configured = isAnalyticsConfigured();
  const sourceKey = sanitizeSourceKey(source || DIRECT_ACQUISITION_SOURCE);
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  if (!configured) {
    return { configured: false, source: sourceKey, total: 0, visitors: [] };
  }
  if (!restaurantId) {
    return { configured: true, source: sourceKey, total: 0, visitors: [] };
  }

  const where = `${timestampWhere(restaurantId, range.fromMs, range.toExclusiveMs)} AND ${acquisitionSourceWhere(sourceKey)}`;

  const [aggRows, enrollRows] = await Promise.all([
    queryAnalyticsEngine(`
      SELECT
        blob2 AS visitorId,
        blob1 AS event,
        min(timestamp) AS firstSeen,
        max(timestamp) AS lastSeen,
        SUM(_sample_interval * double1) AS n
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob2 != ''
      GROUP BY visitorId, event
    `),
    queryAnalyticsEngine(`
      SELECT
        blob2 AS visitorId,
        blob6 AS metadata
      FROM ${GUEST_DATASET}
      WHERE ${where}
        AND blob1 = 'guest.loyalty_enrolled'
        AND blob2 != ''
      ORDER BY timestamp DESC
      LIMIT 2000
    `),
  ]);

  const guestIdByVisitor = new Map<string, string>();
  for (const row of enrollRows) {
    const visitorId = String(row.visitorId ?? "").trim();
    if (!visitorId || guestIdByVisitor.has(visitorId)) continue;
    const guestId = parseMetadataField(String(row.metadata ?? ""), "guestId");
    if (guestId) guestIdByVisitor.set(visitorId, guestId);
  }

  type Agg = {
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    eventCount: number;
    pageViews: number;
    cartAdds: number;
    enrolls: number;
  };
  const byVisitor = new Map<string, Agg>();

  for (const row of aggRows) {
    const visitorId = String(row.visitorId ?? "").trim();
    if (!visitorId) continue;
    const event = String(row.event ?? "");
    const n = Number(row.n ?? 0);
    const firstSeen = row.firstSeen != null ? String(row.firstSeen) : null;
    const lastSeen = row.lastSeen != null ? String(row.lastSeen) : null;
    const entry = byVisitor.get(visitorId) ?? {
      firstSeenAt: null,
      lastSeenAt: null,
      eventCount: 0,
      pageViews: 0,
      cartAdds: 0,
      enrolls: 0,
    };
    entry.eventCount += n;
    if (event === "guest.page_viewed") entry.pageViews += n;
    if (event === "guest.cart_add") entry.cartAdds += n;
    if (event === "guest.loyalty_enrolled") entry.enrolls += n;
    if (
      firstSeen &&
      (!entry.firstSeenAt || firstSeen < entry.firstSeenAt)
    ) {
      entry.firstSeenAt = firstSeen;
    }
    if (lastSeen && (!entry.lastSeenAt || lastSeen > entry.lastSeenAt)) {
      entry.lastSeenAt = lastSeen;
    }
    byVisitor.set(visitorId, entry);
  }

  const all = [...byVisitor.entries()]
    .map(([visitorId, entry]) => ({
      visitorId,
      firstSeenAt: entry.firstSeenAt,
      lastSeenAt: entry.lastSeenAt,
      eventCount: entry.eventCount,
      pageViews: entry.pageViews,
      cartAdds: entry.cartAdds,
      enrolled: entry.enrolls > 0 || guestIdByVisitor.has(visitorId),
      guestId: guestIdByVisitor.get(visitorId) ?? null,
    }))
    .sort((a, b) => {
      const aKey = a.lastSeenAt ?? "";
      const bKey = b.lastSeenAt ?? "";
      return bKey.localeCompare(aKey);
    });

  const total = all.length;
  const visitors = all.slice(offset, offset + limit);

  return { configured: true, source: sourceKey, total, visitors };
}

export async function fetchAcquisitionVisitorEvents(
  restaurantId: string | null,
  range: ResolvedDashboardRange,
  visitorId: string,
  options?: { limit?: number },
): Promise<{
  configured: boolean;
  visitorId: string;
  events: AcquisitionVisitorEvent[];
  guestId: string | null;
}> {
  const configured = isAnalyticsConfigured();
  const id = visitorId.trim().slice(0, 128);
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 500);

  if (!configured || !restaurantId || !id) {
    return {
      configured,
      visitorId: id,
      events: [],
      guestId: null,
    };
  }

  const where = `${timestampWhere(restaurantId, range.fromMs, range.toExclusiveMs)} AND blob2 = '${escapeSqlString(id)}'`;
  const rows = await queryAnalyticsEngine(`
    SELECT
      timestamp,
      blob1 AS event,
      blob4 AS locationId,
      blob6 AS metadata
    FROM ${GUEST_DATASET}
    WHERE ${where}
    ORDER BY timestamp DESC
    LIMIT ${limit}
  `);

  let guestId: string | null = null;
  const events: AcquisitionVisitorEvent[] = rows.map((row) => {
    const metadata = parseMetadataObject(String(row.metadata ?? ""));
    if (!guestId && typeof metadata.guestId === "string" && metadata.guestId.trim()) {
      guestId = metadata.guestId.trim();
    }
    return {
      timestamp: row.timestamp != null ? String(row.timestamp) : "",
      event: String(row.event ?? ""),
      locationId: String(row.locationId ?? ""),
      metadata,
    };
  });

  return { configured: true, visitorId: id, events, guestId };
}
