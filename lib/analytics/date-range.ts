export const ANALYTICS_MAX_DAYS = 366;

export type DashboardPreset = "day" | "week" | "month" | "custom";

export type AnalyticsBucket = "hour" | "day" | "week";

export type ResolvedDashboardRange = {
  preset: DashboardPreset;
  from: string;
  to: string;
  fromMs: number;
  toExclusiveMs: number;
  previousFrom: string;
  previousTo: string;
  previousFromMs: number;
  previousToExclusiveMs: number;
  bucket: AnalyticsBucket;
  dayCount: number;
};

export type DashboardRangeError = {
  error: "invalid_range" | "range_too_long";
};

export type TrendBucket = {
  key: string;
  label: string;
  startMs: number;
  endMs: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function isResolvedDashboardRange(
  value: ResolvedDashboardRange | DashboardRangeError,
): value is ResolvedDashboardRange {
  return !("error" in value);
}

function parseUtcDate(iso: string): Date | null {
  if (!DATE_RE.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfUtcWeekMonday(day: Date): Date {
  const weekday = day.getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  return addUtcDays(day, -offset);
}

function startOfUtcMonth(day: Date): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
}

function bucketForDayCount(dayCount: number): AnalyticsBucket {
  if (dayCount <= 1) return "hour";
  if (dayCount > 62) return "week";
  return "day";
}

function finishRange(
  preset: DashboardPreset,
  fromDate: Date,
  toDate: Date,
): ResolvedDashboardRange | DashboardRangeError {
  if (fromDate.getTime() > toDate.getTime()) return { error: "invalid_range" };
  const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
  if (dayCount > ANALYTICS_MAX_DAYS) return { error: "range_too_long" };
  const toExclusive = addUtcDays(toDate, 1);
  const previousFrom = addUtcDays(fromDate, -dayCount);
  const previousTo = addUtcDays(fromDate, -1);
  return {
    preset,
    from: formatUtcDate(fromDate),
    to: formatUtcDate(toDate),
    fromMs: fromDate.getTime(),
    toExclusiveMs: toExclusive.getTime(),
    previousFrom: formatUtcDate(previousFrom),
    previousTo: formatUtcDate(previousTo),
    previousFromMs: previousFrom.getTime(),
    previousToExclusiveMs: fromDate.getTime(),
    bucket: bucketForDayCount(dayCount),
    dayCount,
  };
}

export function resolveDashboardRange(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
} = {}): ResolvedDashboardRange | DashboardRangeError {
  const from = input.from?.trim() ?? "";
  const to = input.to?.trim() ?? "";
  if (from || to) {
    const fromDate = parseUtcDate(from);
    const toDate = parseUtcDate(to);
    if (!fromDate || !toDate) return { error: "invalid_range" };
    const preset = input.preset === "day" || input.preset === "week" || input.preset === "month"
      ? input.preset
      : "custom";
    return finishRange(preset, fromDate, toDate);
  }

  const now = input.now ?? new Date();
  const today = startOfUtcDay(now);
  const preset = input.preset ?? "week";
  if (preset === "day") return finishRange("day", today, today);
  if (preset === "week") return finishRange("week", startOfUtcWeekMonday(today), today);
  if (preset === "month") return finishRange("month", startOfUtcMonth(today), today);
  if (preset === "custom") return { error: "invalid_range" };
  return finishRange("week", startOfUtcWeekMonday(today), today);
}

function nextMondayMs(ms: number): number {
  const weekday = new Date(ms).getUTCDay();
  const add = weekday === 0 ? 1 : weekday === 1 ? 7 : 8 - weekday;
  return ms + add * DAY_MS;
}

export function buildTrendBuckets(range: ResolvedDashboardRange): TrendBucket[] {
  if (range.bucket === "hour") {
    return Array.from({ length: 24 }, (_, hour) => {
      const label = String(hour).padStart(2, "0");
      return {
        key: label,
        label,
        startMs: range.fromMs + hour * 3_600_000,
        endMs: range.fromMs + (hour + 1) * 3_600_000,
      };
    });
  }

  if (range.bucket === "day") {
    const buckets: TrendBucket[] = [];
    for (let ms = range.fromMs; ms < range.toExclusiveMs; ms += DAY_MS) {
      const date = new Date(ms);
      const key = formatUtcDate(date);
      buckets.push({
        key,
        label: range.dayCount <= 7 ? (WEEKDAY_LABELS[date.getUTCDay()] ?? key) : key.slice(5),
        startMs: ms,
        endMs: ms + DAY_MS,
      });
    }
    return buckets;
  }

  const buckets: TrendBucket[] = [];
  let cursor = range.fromMs;
  while (cursor < range.toExclusiveMs) {
    const end = Math.min(nextMondayMs(cursor), range.toExclusiveMs);
    const key = formatUtcDate(new Date(cursor));
    buckets.push({
      key,
      label: key.slice(5),
      startMs: cursor,
      endMs: end,
    });
    cursor = end;
  }
  return buckets;
}

/** UTC timestamp literal safe to interpolate into Analytics Engine SQL. */
export function analyticsSqlDateTime(ms: number): string {
  const value = new Date(ms).toISOString().slice(0, 19).replace("T", " ");
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new Error("invalid analytics timestamp");
  }
  return value;
}
