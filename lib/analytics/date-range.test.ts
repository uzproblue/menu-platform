import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTrendBuckets, resolveDashboardRange } from "./date-range.ts";

const NOW = new Date("2026-11-18T15:00:00.000Z");

describe("resolveDashboardRange", () => {
  it("uses today, the current Monday-start week, and the calendar month in UTC", () => {
    const day = resolveDashboardRange({ preset: "day", now: NOW });
    const week = resolveDashboardRange({ preset: "week", now: NOW });
    const month = resolveDashboardRange({ preset: "month", now: NOW });
    assert.equal("error" in day, false);
    assert.equal("error" in week, false);
    assert.equal("error" in month, false);
    if ("error" in day || "error" in week || "error" in month) return;

    assert.deepEqual([day.from, day.to, day.bucket], ["2026-11-18", "2026-11-18", "hour"]);
    assert.deepEqual([day.previousFrom, day.previousTo], ["2026-11-17", "2026-11-17"]);
    assert.deepEqual([week.from, week.to, week.bucket], ["2026-11-16", "2026-11-18", "day"]);
    assert.deepEqual([week.previousFrom, week.previousTo], ["2026-11-13", "2026-11-15"]);
    assert.deepEqual([month.from, month.to], ["2026-11-01", "2026-11-18"]);
    assert.deepEqual([month.previousFrom, month.previousTo], ["2026-10-14", "2026-10-31"]);
  });

  it("accepts an inclusive custom range and rejects an inverted or oversized one", () => {
    const ok = resolveDashboardRange({ from: "2026-01-01", to: "2026-03-15" });
    const inverted = resolveDashboardRange({ from: "2026-03-02", to: "2026-03-01" });
    const tooLong = resolveDashboardRange({ from: "2024-01-01", to: "2025-01-01" });
    assert.equal("error" in ok, false);
    if (!("error" in ok)) {
      assert.equal(ok.bucket, "week");
      assert.equal(ok.dayCount, 74);
    }
    assert.deepEqual(inverted, { error: "invalid_range" });
    assert.deepEqual(tooLong, { error: "range_too_long" });
  });
});

describe("buildTrendBuckets", () => {
  it("builds 24 hours, weekday labels, and Monday-aligned weeks", () => {
    const day = resolveDashboardRange({ preset: "day", now: NOW });
    const week = resolveDashboardRange({ preset: "week", now: NOW });
    const custom = resolveDashboardRange({ from: "2026-01-01", to: "2026-03-15" });
    assert.equal("error" in day || "error" in week || "error" in custom, false);
    if ("error" in day || "error" in week || "error" in custom) return;

    const hours = buildTrendBuckets(day);
    assert.equal(hours.length, 24);
    assert.equal(hours[0]?.key, "00");
    assert.equal(hours[23]?.label, "23");

    const days = buildTrendBuckets(week);
    assert.deepEqual(days.map((bucket) => bucket.label), ["Mon", "Tue", "Wed"]);

    const weeks = buildTrendBuckets(custom);
    assert.equal(custom.bucket, "week");
    assert.equal(weeks[0]?.key, "2026-01-01");
    assert.equal(weeks[0]?.endMs, Date.parse("2026-01-05T00:00:00.000Z"));
    assert.equal(weeks[1]?.key, "2026-01-05");
    assert.equal(weeks.at(-1)?.endMs, Date.parse("2026-03-16T00:00:00.000Z"));
  });
});
