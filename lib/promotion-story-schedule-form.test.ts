import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStorySchedulePayload,
  normalizeHhMm,
} from "./promotion-story-schedule-form";

describe("normalizeHhMm", () => {
  it("accepts HH:mm and HH:mm:ss", () => {
    assert.equal(normalizeHhMm("06:00"), "06:00");
    assert.equal(normalizeHhMm("6:00"), "06:00");
    assert.equal(normalizeHhMm("23:00:00"), "23:00");
    assert.equal(normalizeHhMm("08:00:00"), "08:00");
  });

  it("rejects invalid values", () => {
    assert.equal(normalizeHhMm(""), null);
    assert.equal(normalizeHhMm("25:00"), null);
    assert.equal(normalizeHhMm("6:00 AM"), null);
  });
});

describe("buildStorySchedulePayload", () => {
  it("clears schedule when not limited", () => {
    const out = buildStorySchedulePayload({
      scheduleLimited: false,
      activeTimeStart: "06:00",
      activeTimeEnd: "23:00",
      activeDaysOfWeek: [1, 2],
    });
    assert.deepEqual(out, {
      ok: true,
      activeTimeStart: null,
      activeTimeEnd: null,
      activeDaysOfWeek: null,
    });
  });

  it("allows days-only without forcing a time window", () => {
    const out = buildStorySchedulePayload({
      scheduleLimited: true,
      activeTimeStart: "",
      activeTimeEnd: "",
      activeDaysOfWeek: [1, 2, 3, 4, 5],
    });
    assert.deepEqual(out, {
      ok: true,
      activeTimeStart: null,
      activeTimeEnd: null,
      activeDaysOfWeek: [1, 2, 3, 4, 5],
    });
  });

  it("persists 06:00–23:00 windows", () => {
    const out = buildStorySchedulePayload({
      scheduleLimited: true,
      activeTimeStart: "06:00",
      activeTimeEnd: "23:00:00",
      activeDaysOfWeek: [1, 2, 3, 4, 5],
    });
    assert.deepEqual(out, {
      ok: true,
      activeTimeStart: "06:00",
      activeTimeEnd: "23:00",
      activeDaysOfWeek: [1, 2, 3, 4, 5],
    });
  });

  it("rejects incomplete time pairs", () => {
    const out = buildStorySchedulePayload({
      scheduleLimited: true,
      activeTimeStart: "06:00",
      activeTimeEnd: "",
      activeDaysOfWeek: [1],
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.errorKey, "stories.scheduleTimePairRequired");
  });

  it("rejects empty limited schedule", () => {
    const out = buildStorySchedulePayload({
      scheduleLimited: true,
      activeTimeStart: "",
      activeTimeEnd: "",
      activeDaysOfWeek: [],
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.errorKey, "stories.scheduleLimitRequired");
  });
});
