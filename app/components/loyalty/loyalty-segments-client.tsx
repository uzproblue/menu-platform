"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

export function LoyaltySegmentsClient() {
  const { t, locale } = useI18n();
  const [segments, setSegments] = useState<LoyaltySegmentSummary[]>([]);
  const [actions, setActions] = useState<LoyaltySegmentAction[]>([]);
  const [runDate, setRunDate] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [members, setMembers] = useState<LoyaltyGuest[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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
      setSegments(segData.segments ?? []);
      setRunDate(segData.runDate ?? actData.runDate ?? null);
      setLastUpdated(segData.lastRun?.finishedAt ?? segData.lastRun?.startedAt ?? null);
      setActions(actData.actions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loyalty.errLoadSegments"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSegment = async (key: string) => {
    setSelectedKey(key);
    setMembersLoading(true);
    setMembers([]);
    setMembersTotal(0);
    try {
      const res = await fetch(
        `/api/settings/loyalty/segments/${encodeURIComponent(key)}/members?limit=50`,
      );
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, t("loyalty.errLoadSegmentMembers")),
        );
      }
      const data = (await res.json()) as SegmentMembersResponse;
      setMembers(data.guests ?? []);
      setMembersTotal(data.total ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("loyalty.errLoadSegmentMembers"),
      );
    } finally {
      setMembersLoading(false);
    }
  };

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
      // Give the queue a moment, then refresh.
      await new Promise((r) => setTimeout(r, res.status === 202 ? 2500 : 400));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loyalty.errRunSegments"));
    } finally {
      setRunning(false);
    }
  };

  const patchAction = async (id: string, status: "dismissed" | "acted") => {
    try {
      const res = await fetch(`/api/settings/loyalty/segments/actions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, t("loyalty.errUpdateSegmentAction")),
        );
      }
      setActions((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("loyalty.errUpdateSegmentAction"),
      );
    }
  };

  const primary = segments.filter((s) => !s.isOverlay);
  const overlays = segments.filter((s) => s.isOverlay);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-foreground/60">
          {lastUpdated ? (
            <span>
              {t("loyalty.segmentsLastUpdated")}:{" "}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(lastUpdated))}
            </span>
          ) : (
            <span>{t("loyalty.segmentsNeverRun")}</span>
          )}
          {runDate ? (
            <span className="ml-2 text-foreground/40">({runDate})</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || running}
            className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-50"
          >
            {t("loyalty.segmentsRefresh")}
          </button>
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={loading || running}
            className="rounded-lg bg-foreground px-3 py-1.5 text-sm text-background hover:opacity-90 disabled:opacity-50"
          >
            {running ? t("loyalty.segmentsRunning") : t("loyalty.segmentsRunNow")}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
              {t("loyalty.segmentsTodayActions")}
            </h2>
            {actions.length === 0 ? (
              <p className="mt-3 text-sm text-foreground/60">
                {t("loyalty.segmentsNoActions")}
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {actions.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-xl border border-foreground/10 bg-background/80 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{action.title}</p>
                        <p className="mt-1 text-sm text-foreground/65">{action.body}</p>
                        {action.segmentKey ? (
                          <p className="mt-2 text-xs uppercase tracking-wide text-foreground/40">
                            {action.segmentKey}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {action.ctaType === "create_promotion" ||
                        action.ctaType === "birthday_campaign" ? (
                          <Link
                            href={promotionHref(action)}
                            onClick={() => void patchAction(action.id, "acted")}
                            className="rounded-lg bg-foreground px-3 py-1.5 text-sm text-background"
                          >
                            {t("loyalty.segmentsCtaCreatePromo")}
                          </Link>
                        ) : null}
                        {(action.ctaType === "view_members" ||
                          action.segmentKey) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (action.segmentKey) void openSegment(action.segmentKey);
                              void patchAction(action.id, "acted");
                            }}
                            className="rounded-lg border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/5"
                          >
                            {t("loyalty.segmentsCtaViewMembers")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void patchAction(action.id, "dismissed")}
                          className="rounded-lg px-3 py-1.5 text-sm text-foreground/50 hover:bg-foreground/5"
                        >
                          {t("loyalty.segmentsDismiss")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
              {t("loyalty.segmentsPrimary")}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {primary.map((seg) => (
                <button
                  key={seg.key}
                  type="button"
                  onClick={() => void openSegment(seg.key)}
                  className="rounded-xl border border-foreground/10 bg-background/80 p-4 text-left transition hover:border-foreground/25 hover:bg-foreground/[0.03]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-medium">{seg.labelEn}</h3>
                    <span className="text-lg font-semibold tabular-nums">
                      {seg.memberCount}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-foreground/55">
                    {seg.descriptionEn}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-foreground/60">
                    <div>
                      <dt>{t("loyalty.segmentsAvgSpend")}</dt>
                      <dd className="font-medium text-foreground/80">
                        {formatMoney(seg.avgSpendMinor, "KZT", locale)}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("loyalty.segmentsAvgVisits")}</dt>
                      <dd className="font-medium text-foreground/80">
                        {seg.avgVisits}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt>{t("loyalty.segmentsAvgDays")}</dt>
                      <dd className="font-medium text-foreground/80">
                        {seg.avgDaysSinceVisit == null
                          ? t("loyalty.neverVisited")
                          : seg.avgDaysSinceVisit}
                      </dd>
                    </div>
                  </dl>
                </button>
              ))}
            </div>
          </section>

          {overlays.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
                {t("loyalty.segmentsOverlays")}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {overlays.map((seg) => (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => void openSegment(seg.key)}
                    className="rounded-xl border border-dashed border-foreground/15 bg-background/50 p-4 text-left hover:border-foreground/30"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-medium">{seg.labelEn}</h3>
                      <span className="text-lg font-semibold tabular-nums">
                        {seg.memberCount}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-foreground/55">
                      {seg.descriptionEn}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {selectedKey ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-0 sm:p-4">
          <div className="flex h-full w-full max-w-md flex-col border border-foreground/10 bg-background shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
              <div>
                <h3 className="font-semibold">{selectedKey}</h3>
                <p className="text-xs text-foreground/50">
                  {t("loyalty.membersCount", { total: String(membersTotal) })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className="rounded-lg px-2 py-1 text-sm hover:bg-foreground/5"
              >
                {t("loyalty.segmentsClose")}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {membersLoading ? (
                <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-foreground/60">
                  {t("loyalty.segmentsEmptyMembers")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {members.map((g) => (
                    <li
                      key={g.id}
                      className="rounded-lg border border-foreground/10 px-3 py-2 text-sm"
                    >
                      <p className="font-medium">{g.name}</p>
                      <p className="text-foreground/55">{g.phoneE164}</p>
                      <p className="mt-1 text-xs text-foreground/45">
                        {t("loyalty.balance")}: {g.balance} ·{" "}
                        {t("loyalty.ordersValue")}:{" "}
                        {formatMoney(g.lifetimeSpendMinor, "KZT", locale)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-foreground/10 p-3">
              <Link
                href="/loyalty/members"
                className="block text-center text-sm text-foreground/70 underline-offset-2 hover:underline"
              >
                {t("loyalty.segmentsOpenMembers")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
