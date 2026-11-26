import { isoToYmdInZone, startOfDayUtcIso } from "../zoned-datetime.js";

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
  timeZone: string;
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

function parseCalendarDate(iso: string): Date | null {
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

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addCalendarDays(ymd: string, days: number): string {
  const date = parseCalendarDate(ymd);
  if (!date) return ymd;
  return formatCalendarDate(new Date(date.getTime() + days * DAY_MS));
}

function calendarWeekday(ymd: string): number {
  return parseCalendarDate(ymd)?.getUTCDay() ?? 0;
}

function startOfWeekMondayYmd(ymd: string): string {
  const weekday = calendarWeekday(ymd);
  const offset = weekday === 0 ? 6 : weekday - 1;
  return addCalendarDays(ymd, -offset);
}

function startOfMonthYmd(ymd: string): string {
  return `${ymd.slice(0, 8)}01`;
}

function dayStartMs(ymd: string, timeZone: string): number {
  return Date.parse(startOfDayUtcIso(ymd, timeZone));
}

export function todayYmdInZone(now: Date = new Date(), timeZone = "UTC"): string {
  return isoToYmdInZone(now.toISOString(), timeZone);
}

function bucketForDayCount(dayCount: number): AnalyticsBucket {
  if (dayCount <= 1) return "hour";
  if (dayCount > 62) return "week";
  return "day";
}

function finishRange(
  preset: DashboardPreset,
  fromYmd: string,
  toYmd: string,
  timeZone: string,
): ResolvedDashboardRange | DashboardRangeError {
  const fromDate = parseCalendarDate(fromYmd);
  const toDate = parseCalendarDate(toYmd);
  if (!fromDate || !toDate) return { error: "invalid_range" };
  if (fromDate.getTime() > toDate.getTime()) return { error: "invalid_range" };
  const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
  if (dayCount > ANALYTICS_MAX_DAYS) return { error: "range_too_long" };

  const previousFrom = addCalendarDays(fromYmd, -dayCount);
  const previousTo = addCalendarDays(fromYmd, -1);
  const fromMs = dayStartMs(fromYmd, timeZone);
  const toExclusiveMs = dayStartMs(addCalendarDays(toYmd, 1), timeZone);
  const previousFromMs = dayStartMs(previousFrom, timeZone);

  return {
    preset,
    from: fromYmd,
    to: toYmd,
    fromMs,
    toExclusiveMs,
    previousFrom,
    previousTo,
    previousFromMs,
    previousToExclusiveMs: fromMs,
    bucket: bucketForDayCount(dayCount),
    dayCount,
    timeZone,
  };
}

export function resolveDashboardRange(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
  timeZone?: string | null;
} = {}): ResolvedDashboardRange | DashboardRangeError {
  const timeZone = input.timeZone?.trim() || "UTC";
  const from = input.from?.trim() ?? "";
  const to = input.to?.trim() ?? "";
  if (from || to) {
    if (!parseCalendarDate(from) || !parseCalendarDate(to)) return { error: "invalid_range" };
    const preset =
      input.preset === "day" || input.preset === "week" || input.preset === "month"
        ? input.preset
        : "custom";
    return finishRange(preset, from, to, timeZone);
  }

  const now = input.now ?? new Date();
  const today = todayYmdInZone(now, timeZone);
  const preset = input.preset ?? "week";
  if (preset === "day") return finishRange("day", today, today, timeZone);
  if (preset === "week") {
    return finishRange("week", startOfWeekMondayYmd(today), today, timeZone);
  }
  if (preset === "month") {
    return finishRange("month", startOfMonthYmd(today), today, timeZone);
  }
  if (preset === "custom") return { error: "invalid_range" };
  return finishRange("week", startOfWeekMondayYmd(today), today, timeZone);
}

function nextMondayExclusiveMs(
  startMs: number,
  timeZone: string,
  toExclusiveMs: number,
): number {
  const ymd = isoToYmdInZone(new Date(startMs).toISOString(), timeZone);
  const weekday = calendarWeekday(ymd);
  const daysUntilNextMonday = weekday === 1 ? 7 : weekday === 0 ? 1 : 8 - weekday;
  const nextYmd = addCalendarDays(ymd, daysUntilNextMonday);
  return Math.min(dayStartMs(nextYmd, timeZone), toExclusiveMs);
}

export function buildTrendBuckets(range: ResolvedDashboardRange): TrendBucket[] {
  const timeZone = range.timeZone || "UTC";

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
    for (let ymd = range.from; ; ymd = addCalendarDays(ymd, 1)) {
      const startMs = dayStartMs(ymd, timeZone);
      if (startMs >= range.toExclusiveMs) break;
      const endMs = dayStartMs(addCalendarDays(ymd, 1), timeZone);
      buckets.push({
        key: ymd,
        label: range.dayCount <= 7 ? (WEEKDAY_LABELS[calendarWeekday(ymd)] ?? ymd) : ymd.slice(5),
        startMs,
        endMs,
      });
    }
    return buckets;
  }

  const buckets: TrendBucket[] = [];
  let cursor = range.fromMs;
  while (cursor < range.toExclusiveMs) {
    const end = nextMondayExclusiveMs(cursor, timeZone, range.toExclusiveMs);
    const key = isoToYmdInZone(new Date(cursor).toISOString(), timeZone);
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
