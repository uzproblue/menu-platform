/** Normalize type=time values (HH:mm or HH:mm:ss) to strict HH:mm. */
export function normalizeHhMm(raw: string): string | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(raw.trim());
  if (!m) return null;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

export type StorySchedulePayloadResult =
  | {
      ok: true;
      activeTimeStart: string | null;
      activeTimeEnd: string | null;
      activeDaysOfWeek: number[] | null;
    }
  | {
      ok: false;
      errorKey: "stories.scheduleLimitRequired" | "stories.scheduleTimePairRequired";
    };

/** Build recurring schedule fields for promotion story create/update. */
export function buildStorySchedulePayload(opts: {
  scheduleLimited: boolean;
  activeTimeStart: string;
  activeTimeEnd: string;
  activeDaysOfWeek: number[];
}): StorySchedulePayloadResult {
  if (!opts.scheduleLimited) {
    return {
      ok: true,
      activeTimeStart: null,
      activeTimeEnd: null,
      activeDaysOfWeek: null,
    };
  }

  const startRaw = opts.activeTimeStart.trim();
  const endRaw = opts.activeTimeEnd.trim();
  const hasAnyTime = Boolean(startRaw || endRaw);
  const start = startRaw ? normalizeHhMm(startRaw) : null;
  const end = endRaw ? normalizeHhMm(endRaw) : null;

  if (hasAnyTime && (!start || !end)) {
    return { ok: false, errorKey: "stories.scheduleTimePairRequired" };
  }

  const days =
    opts.activeDaysOfWeek.length > 0
      ? [...opts.activeDaysOfWeek].sort((a, b) => a - b)
      : null;

  if (!start && !end && !days) {
    return { ok: false, errorKey: "stories.scheduleLimitRequired" };
  }

  return {
    ok: true,
    activeTimeStart: start && end ? start : null,
    activeTimeEnd: start && end ? end : null,
    activeDaysOfWeek: days,
  };
}
