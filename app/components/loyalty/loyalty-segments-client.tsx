"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  LoyaltyGuest,
  LoyaltySegmentAction,
  LoyaltySegmentSummary,
  SegmentActionsResponse,
  SegmentMembersResponse,
  SegmentsListResponse,
} from "@/lib/loyalty-api/types";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "KZT",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency || "KZT"}`;
  }
}

function formatRelativeUpdated(
  iso: string | null,
  locale: string,
  neverLabel: string,
): string {
  if (!iso) return neverLabel;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return neverLabel;
  const diffSec = Math.round((Date.now() - ms) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 48) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(-diffDay, "day");
}

function promotionHref(action: LoyaltySegmentAction): string {
  const payload = action.ctaPayload ?? {};
  const params = new URLSearchParams();
  if (typeof payload.suggestedName === "string") {
    params.set("name", payload.suggestedName);
  }
  if (typeof payload.suggestedType === "string") {
    params.set("type", payload.suggestedType);
  }
  if (typeof payload.segmentKey === "string") {
    params.set("segment", payload.segmentKey);
  } else if (action.segmentKey) {
    params.set("segment", action.segmentKey);
  }
  const qs = params.toString();
  return `/loyalty/promotions/points/new${qs ? `?${qs}` : ""}`;
}

function segmentLabel(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  const translated = t(`loyalty.segment.${key}`);
  return translated === `loyalty.segment.${key}` ? fallback : translated;
}

function segmentDescription(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  const translated = t(`loyalty.segment.${key}Desc`);
  return translated === `loyalty.segment.${key}Desc` ? fallback : translated;
}

function toneForSegment(key: string): string {
  switch (key) {
    case "champions":
    case "loyal":
      return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
    case "potential_loyalists":
    case "new_members":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
    case "at_risk":
      return "bg-amber-500/15 text-amber-900 dark:text-amber-300";
    case "lapsed":
    case "hibernating":
      return "bg-rose-500/15 text-rose-800 dark:text-rose-300";
    case "birthday_this_week":
      return "bg-violet-500/15 text-violet-800 dark:text-violet-300";
    case "high_balance":
      return "bg-foreground/10 text-foreground/80";
    default:
      return "bg-foreground/10 text-foreground/70";
  }
}

export function LoyaltySegmentsClient() {
  const { t, locale } = useI18n();
  const [segments, setSegments] = useState<LoyaltySegmentSummary[]>([]);
  const [actions, setActions] = useState<LoyaltySegmentAction[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [members, setMembers] = useState<LoyaltyGuest[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    setError(null);
    try {
      const [segRes, actRes] = await Promise.all([
        fetch("/api/settings/loyalty/segments"),
        fetch("/api/settings/loyalty/segments/actions?status=open"),
      ]);
      if (!segRes.ok) {
        throw new Error(
          await readErrorMessage(segRes, t("loyalty.errLoadSegments")),
        );
      }
      if (!actRes.ok) {
        throw new Error(
          await readErrorMessage(actRes, t("loyalty.errLoadSegmentActions")),
        );
      }
      const segData = (await segRes.json()) as SegmentsListResponse;
      const actData = (await actRes.json()) as SegmentActionsResponse;
      const nextSegments = segData.segments ?? [];
      setSegments(nextSegments);
      setLastUpdated(
        segData.lastRun?.finishedAt ?? segData.lastRun?.startedAt ?? null,
      );
      setActions(actData.actions ?? []);
      setSelectedKey((prev) => {
        if (prev && nextSegments.some((s) => s.key === prev)) return prev;
        const firstWithMembers = nextSegments.find(
          (s) => !s.isOverlay && s.memberCount > 0,
        );
        return firstWithMembers?.key ?? nextSegments.find((s) => !s.isOverlay)?.key ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loyalty.errLoadSegments"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onContext = () => {
      void load({ quiet: true });
    };
    window.addEventListener("restaurant-context-changed", onContext);
    return () => window.removeEventListener("restaurant-context-changed", onContext);
  }, [load]);

  const selected = useMemo(
    () => segments.find((s) => s.key === selectedKey) ?? null,
    [segments, selectedKey],
  );

  const primary = useMemo(
    () => segments.filter((s) => !s.isOverlay),
    [segments],
  );
  const overlays = useMemo(
    () => segments.filter((s) => s.isOverlay),
    [segments],
  );
  const totalMembers = useMemo(
    () => primary.reduce((sum, s) => sum + s.memberCount, 0),
    [primary],
  );

  useEffect(() => {
    if (!selectedKey) {
      setMembers([]);
      setMembersTotal(0);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/settings/loyalty/segments/${encodeURIComponent(selectedKey)}/members?limit=40`,
        );
        if (!res.ok) {
          throw new Error(
            await readErrorMessage(res, t("loyalty.errLoadSegmentMembers")),
          );
        }
        const data = (await res.json()) as SegmentMembersResponse;
        if (cancelled) return;
        setMembers(data.guests ?? []);
        setMembersTotal(data.total ?? 0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("loyalty.errLoadSegmentMembers"),
          );
        }
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKey, t]);

  const runNow = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/loyalty/segments/run", {
        method: "POST",
      });
      if (!res.ok && res.status !== 202) {
        throw new Error(await readErrorMessage(res, t("loyalty.errRunSegments")));
      }
      await new Promise((r) => setTimeout(r, res.status === 202 ? 2800 : 500));
      await load({ quiet: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loyalty.errRunSegments"));
    } finally {
      setRunning(false);
    }
  };

  const patchAction = async (id: string, status: "dismissed" | "acted") => {
    setDismissingId(id);
    const previous = actions;
    setActions((prev) => prev.filter((a) => a.id !== id));
    try {
      const res = await fetch(
        `/api/settings/loyalty/segments/actions/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, t("loyalty.errUpdateSegmentAction")),
        );
      }
    } catch (err) {
      setActions(previous);
      setError(
        err instanceof Error ? err.message : t("loyalty.errUpdateSegmentAction"),
      );
    } finally {
      setDismissingId(null);
    }
  };

  const selectSegment = (key: string) => {
    setSelectedKey(key);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!primary.length) return;
    const keys = [...primary, ...overlays].map((s) => s.key);
    const idx = selectedKey ? keys.indexOf(selectedKey) : -1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = keys[Math.min(keys.length - 1, Math.max(0, idx + 1))];
      if (next) selectSegment(next);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = keys[Math.max(0, idx - 1)];
      if (next) selectSegment(next);
    }
  };

  const neverRun = !loading && !lastUpdated && primary.every((s) => s.memberCount === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-foreground/55">
            {formatRelativeUpdated(
              lastUpdated,
              locale,
              t("loyalty.segmentsNeverRun"),
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load({ quiet: true })}
            disabled={loading || running}
            className="rounded-xl border border-foreground/12 px-3 py-2 text-sm text-foreground/75 transition hover:bg-foreground/5 disabled:opacity-50"
          >
            {t("loyalty.segmentsRefresh")}
          </button>
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={loading || running}
            className="rounded-xl bg-foreground px-3.5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {running ? t("loyalty.segmentsRunning") : t("loyalty.segmentsRunNow")}
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-foreground/[0.04]"
              />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-foreground/[0.04]" />
        </div>
      ) : neverRun ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 bg-foreground/[0.02] px-6 py-12 text-center">
          <p className="text-base font-medium">{t("loyalty.segmentsEmptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground/60">
            {t("loyalty.segmentsEmptyHint")}
          </p>
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={running}
            className="mt-6 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {running ? t("loyalty.segmentsRunning") : t("loyalty.segmentsRunNow")}
          </button>
        </div>
      ) : (
        <>
          {actions.length > 0 ? (
            <section aria-labelledby="segments-focus-heading" className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2
                  id="segments-focus-heading"
                  className="text-sm font-medium text-foreground/70"
                >
                  {t("loyalty.segmentsTodayActions")}
                </h2>
                <span className="text-xs text-foreground/40">
                  {t("loyalty.segmentsActionCount", {
                    count: String(actions.length),
                  })}
                </span>
              </div>
              <ul className="space-y-2">
                {actions.map((action) => {
                  const primaryCta =
                    action.ctaType === "create_promotion" ||
                    action.ctaType === "birthday_campaign"
                      ? "promo"
                      : "members";
                  return (
                    <li
                      key={action.id}
                      className={`rounded-2xl border border-foreground/10 bg-background/70 p-4 transition ${
                        dismissingId === action.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium leading-snug">{action.title}</p>
                            {action.segmentKey ? (
                              <button
                                type="button"
                                onClick={() => selectSegment(action.segmentKey!)}
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneForSegment(action.segmentKey)}`}
                              >
                                {segmentLabel(t, action.segmentKey, action.segmentKey)}
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-foreground/65">
                            {action.body}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {primaryCta === "promo" ? (
                            <Link
                              href={promotionHref(action)}
                              onClick={() => void patchAction(action.id, "acted")}
                              className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
                            >
                              {t("loyalty.segmentsCtaCreatePromo")}
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (action.segmentKey) {
                                  selectSegment(action.segmentKey);
                                }
                                void patchAction(action.id, "acted");
                              }}
                              className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
                            >
                              {t("loyalty.segmentsCtaViewMembers")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void patchAction(action.id, "dismissed")}
                            className="rounded-xl px-3 py-2 text-sm text-foreground/50 transition hover:bg-foreground/5 hover:text-foreground/80"
                          >
                            {t("loyalty.segmentsDismiss")}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div
            className="grid gap-4 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.2fr)] lg:items-start"
            onKeyDown={onListKeyDown}
          >
            <section
              aria-labelledby="segments-audience-heading"
              className="rounded-2xl border border-foreground/10 bg-background/50 p-2 ring-1 ring-foreground/5"
            >
              <div className="flex items-center justify-between px-3 pb-2 pt-2">
                <h2
                  id="segments-audience-heading"
                  className="text-sm font-medium text-foreground/70"
                >
                  {t("loyalty.segmentsPrimary")}
                </h2>
                <span className="text-xs tabular-nums text-foreground/40">
                  {t("loyalty.membersCount", { total: String(totalMembers) })}
                </span>
              </div>

              <div className="space-y-0.5" role="listbox" aria-label={t("loyalty.segmentsPrimary")}>
                {primary.map((seg) => {
                  const active = seg.key === selectedKey;
                  const share =
                    totalMembers > 0 ? (seg.memberCount / totalMembers) * 100 : 0;
                  return (
                    <button
                      key={seg.key}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => selectSegment(seg.key)}
                      className={`group w-full rounded-xl px-3 py-2.5 text-left transition ${
                        active
                          ? "bg-foreground text-background"
                          : "hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {segmentLabel(t, seg.key, seg.labelEn)}
                        </span>
                        <span
                          className={`tabular-nums text-sm ${
                            active ? "text-background/80" : "text-foreground/55"
                          }`}
                        >
                          {seg.memberCount}
                        </span>
                      </div>
                      <div
                        className={`mt-2 h-1 overflow-hidden rounded-full ${
                          active ? "bg-background/20" : "bg-foreground/10"
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${
                            active ? "bg-background/80" : "bg-foreground/35"
                          }`}
                          style={{ width: `${Math.max(share, seg.memberCount ? 4 : 0)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {overlays.length > 0 ? (
                <div className="mt-3 border-t border-foreground/8 px-2 pb-2 pt-3">
                  <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-foreground/40">
                    {t("loyalty.segmentsOverlays")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {overlays.map((seg) => {
                      const active = seg.key === selectedKey;
                      return (
                        <button
                          key={seg.key}
                          type="button"
                          onClick={() => selectSegment(seg.key)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            active
                              ? "bg-foreground text-background"
                              : `${toneForSegment(seg.key)} hover:opacity-90`
                          }`}
                        >
                          <span>{segmentLabel(t, seg.key, seg.labelEn)}</span>
                          <span className="tabular-nums opacity-70">{seg.memberCount}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>

            <section
              aria-live="polite"
              className="min-h-[22rem] rounded-2xl border border-foreground/10 bg-background/60 p-4 ring-1 ring-foreground/5 sm:p-5"
            >
              {selected ? (
                <div className="flex h-full flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toneForSegment(selected.key)}`}
                      >
                        {selected.isOverlay
                          ? t("loyalty.segmentsOverlays")
                          : t("loyalty.segmentsPrimary")}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight">
                        {segmentLabel(t, selected.key, selected.labelEn)}
                      </h3>
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-foreground/60">
                        {segmentDescription(
                          t,
                          selected.key,
                          selected.descriptionEn,
                        )}
                      </p>
                    </div>
                    <Link
                      href={`/loyalty/promotions/points/new?segment=${encodeURIComponent(selected.key)}`}
                      className="rounded-xl border border-foreground/12 px-3 py-2 text-sm transition hover:bg-foreground/5"
                    >
                      {t("loyalty.segmentsCtaCreatePromo")}
                    </Link>
                  </div>

                  <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-foreground/8 py-4">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-foreground/45">
                        {t("loyalty.segmentsAvgSpend")}
                      </dt>
                      <dd className="mt-1 text-sm font-medium tabular-nums">
                        {formatMoney(selected.avgSpendMinor, "KZT", locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-foreground/45">
                        {t("loyalty.segmentsAvgVisits")}
                      </dt>
                      <dd className="mt-1 text-sm font-medium tabular-nums">
                        {selected.avgVisits}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-foreground/45">
                        {t("loyalty.segmentsAvgDays")}
                      </dt>
                      <dd className="mt-1 text-sm font-medium tabular-nums">
                        {selected.avgDaysSinceVisit == null
                          ? t("loyalty.neverVisited")
                          : selected.avgDaysSinceVisit}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="text-sm text-foreground/60">
                      {t("loyalty.membersCount", {
                        total: String(membersTotal),
                      })}
                    </p>
                    <Link
                      href="/loyalty/members"
                      className="text-sm text-foreground/55 underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {t("loyalty.segmentsOpenMembers")}
                    </Link>
                  </div>

                  <div className="mt-3 min-h-0 flex-1">
                    {membersLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-12 animate-pulse rounded-xl bg-foreground/[0.04]"
                          />
                        ))}
                      </div>
                    ) : members.length === 0 ? (
                      <p className="py-8 text-center text-sm text-foreground/50">
                        {t("loyalty.segmentsEmptyMembers")}
                      </p>
                    ) : (
                      <ul className="divide-y divide-foreground/8 overflow-hidden rounded-xl border border-foreground/8">
                        {members.map((g) => (
                          <li
                            key={g.id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{g.name}</p>
                              <p className="truncate text-foreground/50">
                                {g.phoneE164}
                              </p>
                            </div>
                            <div className="shrink-0 text-right text-xs text-foreground/50">
                              <p className="tabular-nums font-medium text-foreground/70">
                                {g.balance}
                              </p>
                              <p className="tabular-nums">
                                {formatMoney(g.lifetimeSpendMinor, "KZT", locale)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <p className="py-16 text-center text-sm text-foreground/50">
                  {t("loyalty.segmentsPickHint")}
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
