"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useI18n } from "@/app/components/i18n-provider";
import {
  isResolvedDashboardRange,
  resolveDashboardRange,
  type DashboardPreset,
} from "@/lib/analytics/date-range";
import type { GuestDashboardData, GuestFunnelStepKey } from "@/lib/analytics/types";

const PRESETS: DashboardPreset[] = ["day", "week", "month", "custom"];

type SourceRow = {
  source: string;
  visitors: number;
  pageViews: number;
  loyaltyEnrolls: number;
};

type VisitorMember = { id: string; name: string; phoneE164: string };

type VisitorRow = {
  visitorId: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  eventCount: number;
  pageViews: number;
  cartAdds: number;
  enrolled: boolean;
  guestId: string | null;
  member: VisitorMember | null;
};

type TimelineEvent = {
  timestamp: string;
  event: string;
  locationId: string;
  metadata: Record<string, unknown>;
};

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-foreground/10 bg-background/60 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md">
      <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-xs text-foreground/60 sm:text-sm">{description}</p>
      </div>
      <div className="min-h-0 flex-1 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function formatDelta(
  current: number,
  previous: number,
  freshLabel: string,
): { text: string; tone: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { text: "0%", tone: "flat" };
    return { text: freshLabel, tone: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded =
    Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return {
    text: `${sign}${rounded}%`,
    tone: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat",
  };
}

function KpiCard({
  label,
  value,
  previous,
}: {
  label: string;
  value: number;
  previous: number;
}) {
  const { t } = useI18n();
  const delta = formatDelta(value, previous, t("dashboard.delta.new"));
  const toneClass =
    delta.tone === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : delta.tone === "down"
        ? "text-rose-700 dark:text-rose-400"
        : "text-foreground/45";
  return (
    <div className="rounded-xl border border-foreground/10 bg-background/50 px-4 py-3 ring-1 ring-foreground/5">
      <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
      <p className={`mt-1 text-xs font-medium tabular-nums ${toneClass}`}>
        {delta.text}
      </p>
    </div>
  );
}

function sourceLabel(t: (key: string) => string, source: string): string {
  if (source === "2gis") return t("acquisition.source.2gis");
  if (source === "direct") return t("acquisition.source.direct");
  return source;
}

function formatWhen(value: string | null, locale: string): string {
  if (!value) return "—";
  const ms = Date.parse(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortVisitorId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function eventLabel(t: (key: string) => string, event: string): string {
  const suffix = event.replace(/^guest\./, "");
  const key = `dashboard.guestEvent.${suffix}`;
  const translated = t(key);
  return translated !== key ? translated : event.replace(/^guest\./, "");
}

const FUNNEL_KEYS: GuestFunnelStepKey[] = [
  "menuOpen",
  "category",
  "itemView",
  "cartAdd",
];

export function AcquisitionExplorerClient({
  initialSource = "2gis",
}: {
  initialSource?: string;
}) {
  const { t, locale } = useI18n();
  const [restaurantId, setRestaurantId] = useState<string | null | undefined>(
    undefined,
  );
  const [preset, setPreset] = useState<DashboardPreset>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [source, setSource] = useState(initialSource || "2gis");
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [dashboard, setDashboard] = useState<
    (GuestDashboardData & { source?: string }) | null
  >(null);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [visitorsTotal, setVisitorsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineMember, setTimelineMember] = useState<VisitorMember | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const range = useMemo(() => {
    return resolveDashboardRange({
      preset,
      from: preset === "custom" ? customFrom : null,
      to: preset === "custom" ? customTo : null,
    });
  }, [preset, customFrom, customTo]);

  const rangeKey = useMemo(() => {
    if (!isResolvedDashboardRange(range)) return "";
    return `${range.from}:${range.to}`;
  }, [range]);

  const loadContext = useCallback(async () => {
    const res = await fetch("/api/settings/restaurant-context", {
      cache: "no-store",
    }).catch(() => null);
    if (!res?.ok) return null;
    const payload = (await res.json()) as {
      selectedRestaurantId?: string | null;
      currentRestaurantId?: string | null;
    };
    return payload.selectedRestaurantId ?? payload.currentRestaurantId ?? null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await loadContext();
      if (!cancelled) setRestaurantId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadContext]);

  useEffect(() => {
    const onContextChange = (event: Event) => {
      const nextId =
        (event as CustomEvent<{ restaurantId?: string | null }>).detail
          ?.restaurantId ?? null;
      setRestaurantId(nextId);
    };
    window.addEventListener("restaurant-context-changed", onContextChange);
    return () =>
      window.removeEventListener("restaurant-context-changed", onContextChange);
  }, []);

  useEffect(() => {
    if (restaurantId === undefined) return;
    if (!restaurantId || !rangeKey || !isResolvedDashboardRange(range)) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({
      from: range.from,
      to: range.to,
      restaurantId,
    });

    void (async () => {
      try {
        const [sourcesRes, dashRes, visitorsRes] = await Promise.all([
          fetch(`/api/analytics/acquisition/sources?${params}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(
            `/api/analytics/acquisition/dashboard?${params}&source=${encodeURIComponent(source)}`,
            { cache: "no-store", signal: controller.signal },
          ),
          fetch(
            `/api/analytics/acquisition/visitors?${params}&source=${encodeURIComponent(source)}&page=${page}&limit=50`,
            { cache: "no-store", signal: controller.signal },
          ),
        ]);
        if (controller.signal.aborted) return;

        if (sourcesRes.ok) {
          const data = (await sourcesRes.json()) as { sources?: SourceRow[] };
          setSources(data.sources ?? []);
        }
        if (dashRes.ok) {
          setDashboard(
            (await dashRes.json()) as GuestDashboardData & { source?: string },
          );
        } else {
          setError(true);
        }
        if (visitorsRes.ok) {
          const data = (await visitorsRes.json()) as {
            visitors?: VisitorRow[];
            total?: number;
          };
          setVisitors(data.visitors ?? []);
          setVisitorsTotal(data.total ?? 0);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [restaurantId, rangeKey, range, source, page]);

  useEffect(() => {
    setPage(1);
    setSelectedVisitor(null);
    setTimeline([]);
    setTimelineMember(null);
  }, [source, rangeKey, restaurantId]);

  useEffect(() => {
    if (!selectedVisitor || !restaurantId || !isResolvedDashboardRange(range)) {
      return;
    }
    const controller = new AbortController();
    setTimelineLoading(true);
    const params = new URLSearchParams({
      from: range.from,
      to: range.to,
      restaurantId,
    });
    void (async () => {
      try {
        const res = await fetch(
          `/api/analytics/acquisition/visitors/${encodeURIComponent(selectedVisitor.visitorId)}/events?${params}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!res.ok || controller.signal.aborted) return;
        const data = (await res.json()) as {
          events?: TimelineEvent[];
          member?: VisitorMember | null;
          guestId?: string | null;
        };
        if (controller.signal.aborted) return;
        setTimeline(data.events ?? []);
        setTimelineMember(data.member ?? null);
        if (data.guestId && selectedVisitor.guestId !== data.guestId) {
          setSelectedVisitor({
            ...selectedVisitor,
            guestId: data.guestId,
            enrolled: true,
          });
        }
      } finally {
        if (!controller.signal.aborted) setTimelineLoading(false);
      }
    })();
    return () => controller.abort();
  }, [selectedVisitor?.visitorId, restaurantId, rangeKey]);

  const trendConfig = useMemo(
    () =>
      ({
        visitors: {
          label: t("dashboard.series.visitors"),
          color: "var(--chart-1)",
        },
        pageViews: {
          label: t("dashboard.series.pageViews"),
          color: "var(--chart-2)",
        },
        cartAdds: {
          label: t("dashboard.series.cartAdds"),
          color: "var(--chart-3)",
        },
      }) satisfies ChartConfig,
    [t],
  );

  const funnelData = useMemo(() => {
    if (!dashboard) return [];
    return FUNNEL_KEYS.map((stepKey) => {
      const step = dashboard.funnel.find((f) => f.stepKey === stepKey);
      return {
        stepKey,
        label: t(`dashboard.funnel.${stepKey}`),
        count: step?.count ?? 0,
      };
    });
  }, [dashboard, t]);

  const totalPages = Math.max(1, Math.ceil(visitorsTotal / 50));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                preset === p
                  ? "bg-foreground text-background"
                  : "border border-foreground/15 text-foreground/70 hover:border-foreground/30"
              }`}
            >
              {t(`dashboard.range.${p}`)}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5"
            />
            <span className="text-foreground/40">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5"
            />
          </div>
        ) : null}
      </div>

      {restaurantId === null ? (
        <p className="text-sm text-foreground/60">
          {t("dashboard.selectRestaurant")}
        </p>
      ) : null}

      {restaurantId ? (
        <>
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground/50">
              {t("acquisition.sourcesHeading")}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(sources.length
                ? sources
                : [
                    { source: "2gis", visitors: 0, pageViews: 0, loyaltyEnrolls: 0 },
                    {
                      source: "direct",
                      visitors: 0,
                      pageViews: 0,
                      loyaltyEnrolls: 0,
                    },
                  ]
              ).map((row) => {
                const active = source === row.source;
                return (
                  <button
                    key={row.source}
                    type="button"
                    onClick={() => setSource(row.source)}
                    className={`min-w-[9rem] rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/15 bg-background/50 hover:border-foreground/30"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {sourceLabel(t, row.source)}
                    </p>
                    <p
                      className={`mt-1 text-xs tabular-nums ${
                        active ? "text-background/70" : "text-foreground/55"
                      }`}
                    >
                      {t("acquisition.sourceMeta", {
                        visitors: String(row.visitors),
                        enrolls: String(row.loyaltyEnrolls),
                      })}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {loading && !dashboard ? (
            <p className="text-sm text-foreground/60">{t("acquisition.loading")}</p>
          ) : null}
          {error && !dashboard ? (
            <p className="text-sm text-rose-700 dark:text-rose-400">
              {t("acquisition.loadError")}
            </p>
          ) : null}

          {dashboard ? (
            <>
              <section className="space-y-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {t("acquisition.cohortHeading", {
                      source: sourceLabel(t, source),
                    })}
                  </h2>
                  <p className="mt-1 text-sm text-foreground/60">
                    {t("acquisition.cohortHint")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label={t("dashboard.kpi.uniqueVisitors")}
                    value={dashboard.summary.uniqueVisitors}
                    previous={dashboard.previousSummary.uniqueVisitors}
                  />
                  <KpiCard
                    label={t("dashboard.kpi.pageViews")}
                    value={dashboard.summary.pageViews}
                    previous={dashboard.previousSummary.pageViews}
                  />
                  <KpiCard
                    label={t("dashboard.kpi.cartAdds")}
                    value={dashboard.summary.cartAdds}
                    previous={dashboard.previousSummary.cartAdds}
                  />
                  <KpiCard
                    label={t("dashboard.kpi.loyaltyEnrolls")}
                    value={dashboard.summary.loyaltyEnrolls}
                    previous={dashboard.previousSummary.loyaltyEnrolls}
                  />
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard
                  title={t("dashboard.chart.guestActivity.title")}
                  description={t("acquisition.trendHint")}
                >
                  <ChartContainer config={trendConfig} className="h-64 w-full">
                    <ComposedChart data={dashboard.trend}>
                      <CartesianGrid vertical={false} strokeOpacity={0.15} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        width={36}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        yAxisId="left"
                        dataKey="visitors"
                        fill="var(--color-visitors)"
                        radius={4}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="pageViews"
                        stroke="var(--color-pageViews)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cartAdds"
                        stroke="var(--color-cartAdds)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ChartContainer>
                </ChartCard>

                <ChartCard
                  title={t("dashboard.chart.funnel.title")}
                  description={t("acquisition.funnelHint")}
                >
                  <ChartContainer
                    config={{
                      count: {
                        label: t("dashboard.series.count"),
                        color: "var(--chart-1)",
                      },
                    }}
                    className="h-64 w-full"
                  >
                    <BarChart data={funnelData} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid horizontal={false} strokeOpacity={0.15} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={90}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="count"
                        fill="var(--color-count)"
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </ChartCard>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ChartCard
                  title={t("dashboard.chart.topItemsViewed.title")}
                  description={t("acquisition.topsHint")}
                >
                  <RankedList
                    rows={dashboard.topItemsViewed.map((r) => ({
                      label: r.name || r.itemId,
                      count: r.count,
                    }))}
                    empty={t("acquisition.emptyRank")}
                  />
                </ChartCard>
                <ChartCard
                  title={t("dashboard.chart.topItemsCarted.title")}
                  description={t("acquisition.topsHint")}
                >
                  <RankedList
                    rows={dashboard.topItemsCarted.map((r) => ({
                      label: r.name || r.itemId,
                      count: r.count,
                    }))}
                    empty={t("acquisition.emptyRank")}
                  />
                </ChartCard>
                <ChartCard
                  title={t("dashboard.chart.topCategories.title")}
                  description={t("acquisition.topsHint")}
                >
                  <RankedList
                    rows={dashboard.topCategories.map((r) => ({
                      label: r.name || r.categoryId,
                      count: r.count,
                    }))}
                    empty={t("acquisition.emptyRank")}
                  />
                </ChartCard>
              </div>
            </>
          ) : null}

          <section className="rounded-2xl border border-foreground/10 bg-background/60 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md">
            <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
              <h2 className="text-base font-semibold tracking-tight">
                {t("acquisition.customersHeading")}
              </h2>
              <p className="mt-1 text-sm text-foreground/60">
                {t("acquisition.customersHint")}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-foreground/10 text-xs uppercase tracking-wider text-foreground/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      {t("acquisition.col.visitor")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("acquisition.col.lastActive")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("acquisition.col.events")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("acquisition.col.pages")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("acquisition.col.carts")}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t("acquisition.col.member")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visitors.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-foreground/50"
                      >
                        {loading
                          ? t("acquisition.loading")
                          : t("acquisition.noCustomers")}
                      </td>
                    </tr>
                  ) : (
                    visitors.map((row) => (
                      <tr
                        key={row.visitorId}
                        className={`cursor-pointer border-b border-foreground/5 transition hover:bg-foreground/5 ${
                          selectedVisitor?.visitorId === row.visitorId
                            ? "bg-foreground/5"
                            : ""
                        }`}
                        onClick={() => setSelectedVisitor(row)}
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {shortVisitorId(row.visitorId)}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-foreground/80">
                          {formatWhen(row.lastSeenAt, locale)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{row.eventCount}</td>
                        <td className="px-4 py-3 tabular-nums">{row.pageViews}</td>
                        <td className="px-4 py-3 tabular-nums">{row.cartAdds}</td>
                        <td className="px-4 py-3">
                          {row.member ? (
                            <span className="font-medium">{row.member.name}</span>
                          ) : row.enrolled ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              {t("acquisition.enrolled")}
                            </span>
                          ) : (
                            <span className="text-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {visitorsTotal > 50 ? (
              <div className="flex items-center justify-between border-t border-foreground/10 px-4 py-3 text-sm">
                <span className="text-foreground/55">
                  {t("acquisition.pageOf", {
                    page: String(page),
                    pages: String(totalPages),
                    total: String(visitorsTotal),
                  })}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-foreground/15 px-3 py-1 disabled:opacity-40"
                  >
                    {t("acquisition.prev")}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-foreground/15 px-3 py-1 disabled:opacity-40"
                  >
                    {t("acquisition.next")}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {selectedVisitor ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t("acquisition.closeDrawer")}
            onClick={() => {
              setSelectedVisitor(null);
              setTimeline([]);
              setTimelineMember(null);
            }}
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-foreground/10 bg-background shadow-2xl">
            <div className="border-b border-foreground/10 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {t("acquisition.drawerTitle")}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-foreground/55">
                    {selectedVisitor.visitorId}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-foreground/15 px-2 py-1 text-sm"
                  onClick={() => {
                    setSelectedVisitor(null);
                    setTimeline([]);
                    setTimelineMember(null);
                  }}
                >
                  ✕
                </button>
              </div>
              {(timelineMember || selectedVisitor.member) && (
                <div className="mt-3 rounded-xl border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm">
                  <p className="font-medium">
                    {(timelineMember ?? selectedVisitor.member)!.name}
                  </p>
                  <p className="text-foreground/60">
                    {(timelineMember ?? selectedVisitor.member)!.phoneE164}
                  </p>
                  <Link
                    href={`/loyalty/members?guest=${encodeURIComponent(
                      (timelineMember ?? selectedVisitor.member)!.id,
                    )}`}
                    className="mt-2 inline-block text-sm font-medium underline underline-offset-2"
                  >
                    {t("acquisition.openMember")}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {timelineLoading ? (
                <p className="text-sm text-foreground/55">{t("acquisition.loading")}</p>
              ) : timeline.length === 0 ? (
                <p className="text-sm text-foreground/55">
                  {t("acquisition.noEvents")}
                </p>
              ) : (
                <ol className="space-y-3">
                  {timeline.map((ev, idx) => (
                    <li
                      key={`${ev.timestamp}-${ev.event}-${idx}`}
                      className="rounded-xl border border-foreground/10 px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">
                          {eventLabel(t, ev.event)}
                        </p>
                        <p className="shrink-0 text-xs tabular-nums text-foreground/50">
                          {formatWhen(ev.timestamp, locale)}
                        </p>
                      </div>
                      <EventMeta metadata={ev.metadata} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function RankedList({
  rows,
  empty,
}: {
  rows: { label: string; count: number }[];
  empty: string;
}) {
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-foreground/45">{empty}</p>;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2">
      {rows.slice(0, 8).map((row) => (
        <li key={row.label} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="tabular-nums text-foreground/60">{row.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-foreground/40"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EventMeta({ metadata }: { metadata: Record<string, unknown> }) {
  const bits: string[] = [];
  for (const key of ["page", "itemId", "categoryId", "lang"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      bits.push(`${key}: ${value.trim()}`);
    }
  }
  if (!bits.length) return null;
  return (
    <p className="mt-1 truncate text-xs text-foreground/50">{bits.join(" · ")}</p>
  );
}
