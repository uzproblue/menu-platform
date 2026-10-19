/** Offset of `timeZone` relative to UTC at the given instant (ms). */
function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** Convert a calendar date + local clock time in `timeZone` to an ISO UTC string. */
export function zonedLocalToUtcIso(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  let utc = Date.UTC(y, mo - 1, d, hour, minute, second, ms);
  for (let i = 0; i < 3; i++) {
    const offset = getTimezoneOffsetMs(new Date(utc), timeZone);
    utc = Date.UTC(y, mo - 1, d, hour, minute, second, ms) - offset;
  }
  return new Date(utc).toISOString();
}

export function startOfDayUtcIso(ymd: string, timeZone: string): string {
  return zonedLocalToUtcIso(ymd, 0, 0, 0, 0, timeZone);
}

export function endOfDayUtcIso(ymd: string, timeZone: string): string {
  return zonedLocalToUtcIso(ymd, 23, 59, 59, 999, timeZone);
}

/** Format an ISO instant as YYYY-MM-DD in `timeZone`. */
export function isoToYmdInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
