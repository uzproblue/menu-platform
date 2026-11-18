"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Area,
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
  type ResolvedDashboardRange,
} from "@/lib/analytics/date-range";
import type { LoyaltyAnalytics } from "@/lib/analytics/loyalty-types";
import type { GuestDashboardData, GuestFunnelStepKey } from "@/lib/analytics/types";
import { formatMinorCurrency } from "@/lib/currency-minor-units";

const PRESETS: DashboardPreset[] = ["day", "week", "month", "custom"];

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border border-foreground/10 bg-background/60 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md ${className}`}
    >
      <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-foreground/60 sm:text-sm">{description}</p>
      </div>
      <div className="min-h-0 flex-1 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function formatDelta(current: number, previous: number, freshLabel: string): {
  text: string;
  tone: "up" | "down" | "flat";
} {
  if (previous === 0) {
    if (current === 0) return { text: "0%", tone: "flat" };
    return { text: freshLabel, tone: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
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
  display,
}: {
  label: string;
  value: number;
  previous: number;
  display?: string;
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
      <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {display ?? value.toLocaleString()}
      </p>
      <p className={`mt-1 text-xs font-medium tabular-nums ${toneClass}`}>{delta.text}</p>
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{hint}</p>
    </div>
  );
}

function guestEventLabel(t: (key: string) => string, event: string, fallback: string): string {
  const suffix = event.replace(/^guest\./, "");
  const key = `dashboard.guestEvent.${suffix}`;
  const translated = t(key);
  return translated !== key ? translated : fallback;
}

function pageLabel(t: (key: string) => string, page: string): string {
  const key = `dashboard.page.${page}`;
  const translated = t(key);
  return translated !== key ? translated : page;
}

function HorizontalBarChart({
  data,
  config,
  emptyLabel,
  wide = false,
  heightClass,
}: {
  data: { label: string; count: number }[];
  config: ChartConfig;
  emptyLabel: string;
  wide?: boolean;
  heightClass?: string;
}) {
  if (data.length === 0) {
    return <p className="flex h-72 items-center justify-center text-sm text-foreground/50">{emptyLabel}</p>;
  }

  return (
    <ChartContainer
      config={config}
      className={`w-full ${heightClass ?? (wide ? "h-96" : "h-72")}`}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 6" />
        <XAxis type="number" hide />
        <YAxis
          dataKey="label"
          type="category"
          width={wide ? 180 : 128}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 10, 10, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}

function localizeTrend<T extends { key: string; label: string }>(points: T[], locale: string): T[] {
  return points.map((point) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.key) || point.label.length > 3) return point;
    const label = new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(`${point.key}T00:00:00.000Z`));
    return { ...point, label };
  });
}

function waiterLabel(
  row: { waiterName: string; waiterId: string; unknown: boolean },
  unknownLabel: string,
): string {
  if (row.unknown) return unknownLabel;
  return row.waiterName || row.waiterId;
}

export function HomeDashboardCharts() {
  const { t, locale } = useI18n();
  const gradId = useId().replace(/:/g, "");
  const [preset, setPreset] = useState<DashboardPreset>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [restaurantId, setRestaurantId] = useState<string | null | undefined>(undefined);
  const [guest, setGuest] = useState<GuestDashboardData | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyAnalytics | null>(null);
  const [guestError, setGuestError] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const guestRef = useRef<GuestDashboardData | null>(null);
  const loyaltyRef = useRef<LoyaltyAnalytics | null>(null);
  const seenRestaurant = useRef<string | null | undefined>(undefined);

  const resolved = useMemo(() => {
    if (preset === "custom") {
      return resolveDashboardRange({ preset: "custom", from: customFrom, to: customTo });
    }
    return resolveDashboardRange({ preset });
  }, [preset, customFrom, customTo]);
  const rangeKey = isResolvedDashboardRange(resolved) ? `${resolved.from}:${resolved.to}` : "";

  const trendConfig = useMemo(
    () =>
      ({
        visitors: { label: t("dashboard.series.visitors"), color: "var(--chart-1)" },
        pageViews: { label: t("dashboard.series.pageViews"), color: "var(--chart-2)" },
        cartAdds: { label: t("dashboard.series.cartAdds"), color: "var(--chart-3)" },
      }) satisfies ChartConfig,
    [t],
  );
  const barConfig = useMemo(
    () => ({ count: { label: t("dashboard.series.count"), color: "var(--chart-5)" } }) satisfies ChartConfig,
    [t],
  );
  const hourlyConfig = useMemo(
    () => ({ count: { label: t("dashboard.series.activity"), color: "var(--chart-1)" } }) satisfies ChartConfig,
    [t],
  );
  const funnelConfig = useMemo(
    () => ({ count: { label: t("dashboard.series.events"), color: "var(--chart-4)" } }) satisfies ChartConfig,
    [t],
  );
  const loyaltyTrendConfig = useMemo(
    () =>
      ({
        newMembers: { label: t("dashboard.series.newMembers"), color: "var(--chart-1)" },
        orders: { label: t("dashboard.series.orders"), color: "var(--chart-2)" },
      }) satisfies ChartConfig,
    [t],
  );
  const pointsConfig = useMemo(
    () =>
      ({
        pointsEarned: { label: t("dashboard.series.pointsEarned"), color: "var(--chart-3)" },
        pointsRedeemed: { label: t("dashboard.series.pointsRedeemed"), color: "var(--chart-4)" },
      }) satisfies ChartConfig,
    [t],
  );
  const waiterConfig = useMemo(
    () => ({ count: { label: t("dashboard.series.members"), color: "var(--chart-5)" } }) satisfies ChartConfig,
    [t],
  );

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/restaurant-context", { cache: "no-store" });
      if (!res.ok) return null;
      const payload = (await res.json()) as {
        selectedRestaurantId?: string | null;
        currentRestaurantId?: string | null;
      };
      return payload.selectedRestaurantId ?? payload.currentRestaurantId ?? null;
    } catch {
      return null;
    }
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
      const nextId = (event as CustomEvent<{ restaurantId?: string | null }>).detail?.restaurantId ?? null;
      setRestaurantId(nextId);
    };
    window.addEventListener("restaurant-context-changed", onContextChange);
    return () => window.removeEventListener("restaurant-context-changed", onContextChange);
  }, []);

  useEffect(() => {
    if (restaurantId === undefined) return;
    if (seenRestaurant.current !== undefined && seenRestaurant.current !== restaurantId) {
      guestRef.current = null;
      loyaltyRef.current = null;
      setGuest(null);
      setLoyalty(null);
      setGuestError(false);
      setLoyaltyError(false);
      setLoaded(false);
    }
    seenRestaurant.current = restaurantId;
    if (!restaurantId || !rangeKey) {
      setLoaded(true);
      setRefreshing(false);
      return;
    }
    const [from, to] = rangeKey.split(":");
    const controller = new AbortController();
    setRefreshing(true);

    const guestUrl = new URL("/api/analytics/guest-dashboard", window.location.origin);
    guestUrl.searchParams.set("from", from ?? "");
    guestUrl.searchParams.set("to", to ?? "");
    guestUrl.searchParams.set("restaurantId", restaurantId);
    const loyaltyUrl = new URL("/api/analytics/loyalty", window.location.origin);
    loyaltyUrl.searchParams.set("from", from ?? "");
    loyaltyUrl.searchParams.set("to", to ?? "");

    void (async () => {
      try {
        const [guestRes, loyaltyRes] = await Promise.all([
          fetch(guestUrl, { cache: "no-store", signal: controller.signal }).catch(() => null),
          fetch(loyaltyUrl, { cache: "no-store", signal: controller.signal }).catch(() => null),
        ]);
        if (controller.signal.aborted) return;

        if (guestRes?.ok) {
          const data = (await guestRes.json()) as GuestDashboardData;
          if (controller.signal.aborted) return;
          guestRef.current = data;
          setGuest(data);
          setGuestError(false);
        } else if (!guestRef.current) {
          setGuestError(true);
        }

        if (loyaltyRes?.ok) {
          const data = (await loyaltyRes.json()) as LoyaltyAnalytics;
          if (controller.signal.aborted) return;
          loyaltyRef.current = data;
          setLoyalty(data);
          setLoyaltyError(false);
        } else if (!loyaltyRef.current) {
          setLoyaltyError(true);
        }
      } catch {
        if (controller.signal.aborted) return;
        if (!guestRef.current) setGuestError(true);
        if (!loyaltyRef.current) setLoyaltyError(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoaded(true);
          setRefreshing(false);
        }
      }
    })();

    return () => controller.abort();
  }, [restaurantId, rangeKey]);

  function selectPreset(next: DashboardPreset) {
    if (next === "custom" && (!customFrom || !customTo)) {
      const week = resolveDashboardRange({ preset: "week" });
      if (isResolvedDashboardRange(week)) {
        setCustomFrom(week.from);
        setCustomTo(week.to);
      }
    }
    setPreset(next);
  }

  const activeRange: ResolvedDashboardRange | null = isResolvedDashboardRange(resolved) ? resolved : null;

  return (
    <div className="w-full space-y-8" aria-busy={refreshing}>
      <div className="sticky top-0 z-20 -mx-3 -mt-4 border-b border-foreground/10 bg-background/85 px-3 pb-4 pt-4 backdrop-blur-md sm:-mx-5 sm:-mt-5 sm:px-5 sm:pt-5 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("home.welcome")}</h1>
            <p className="mt-1 text-sm text-foreground/60">{t("home.subtitle")}</p>
            {activeRange ? (
              <p className="mt-2 text-xs text-foreground/55">
                <span className="font-medium text-foreground/80">
                  {t("dashboard.range.active", { from: activeRange.from, to: activeRange.to })}
                </span>
                <span className="mx-2 text-foreground/30">·</span>
                {t("dashboard.range.vsPrevious", {
                  from: activeRange.previousFrom,
                  to: activeRange.previousTo,
                })}
                {refreshing ? <span className="ml-2">{t("dashboard.range.updating")}</span> : null}
              </p>
            ) : (
              <p className="mt-2 text-xs text-rose-700 dark:text-rose-400">{t("dashboard.range.invalid")}</p>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="inline-flex flex-wrap rounded-xl border border-foreground/10 bg-background/70 p-1" role="group">
              {PRESETS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={preset === item}
                  onClick={() => selectPreset(item)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    preset === item
                      ? "bg-foreground text-background"
                      : "text-foreground/70 hover:bg-foreground/5"
                  }`}
                >
                  {t(`dashboard.range.${item}`)}
                </button>
              ))}
            </div>
            {preset === "custom" ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-foreground/60">
                  {t("dashboard.range.from")}
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="mt-1 block rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-foreground/60">
                  {t("dashboard.range.to")}
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="mt-1 block rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {restaurantId === null ? (
        <p className="rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm text-foreground/60">
          {t("dashboard.selectRestaurant")}
        </p>
      ) : null}

      {restaurantId ? (
        <section className="space-y-4">
          <SectionHeading title={t("dashboard.section.guest")} hint={t("dashboard.section.guestHint")} />
          {!loaded ? <KpiSkeleton count={4} /> : null}
          {guestError && !guest ? (
            <p className="rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm text-foreground/60">
              {t("dashboard.unavailable")}
            </p>
          ) : null}
          {guest && !guest.configured ? (
            <p className="rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm text-foreground/60">
              {t("dashboard.notConfigured")}
            </p>
          ) : null}
          {guest?.configured ? (
            <GuestSection
              guest={guest}
              locale={locale}
              t={t}
              gradId={gradId}
              trendConfig={trendConfig}
              funnelConfig={funnelConfig}
              hourlyConfig={hourlyConfig}
              barConfig={barConfig}
            />
          ) : null}
        </section>
      ) : null}

      {restaurantId ? (
        <section className="space-y-4">
          <SectionHeading title={t("dashboard.section.loyalty")} hint={t("dashboard.section.loyaltyHint")} />
          {guest?.configured ? (
            <p className="text-sm text-foreground/60">
              {t("dashboard.loyalty.enrollFunnel", {
                started: guest.summary.loyaltyEnrollStarted.toLocaleString(locale),
                enrolled: guest.summary.loyaltyEnrolls.toLocaleString(locale),
              })}
            </p>
          ) : null}
          {!loaded ? <KpiSkeleton count={9} wide /> : null}
          {loyaltyError && !loyalty ? (
            <p className="rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm text-foreground/60">
              {t("dashboard.loyalty.unavailable")}
            </p>
          ) : null}
          {loyalty ? (
            <LoyaltySection
              loyalty={loyalty}
              locale={locale}
              gradId={gradId}
              trendConfig={loyaltyTrendConfig}
              pointsConfig={pointsConfig}
              waiterConfig={waiterConfig}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function KpiSkeleton({ count, wide = false }: { count: number; wide?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${wide ? "xl:grid-cols-5" : ""}`}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-[5.25rem] animate-pulse rounded-xl border border-foreground/10 bg-foreground/5" />
      ))}
    </div>
  );
}

function GuestSection({
  guest,
  locale,
  t,
  gradId,
  trendConfig,
  funnelConfig,
  hourlyConfig,
  barConfig,
}: {
  guest: GuestDashboardData;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  gradId: string;
  trendConfig: ChartConfig;
  funnelConfig: ChartConfig;
  hourlyConfig: ChartConfig;
  barConfig: ChartConfig;
}) {
  const { summary, previousSummary } = guest;
  const topItemsViewed = guest.topItemsViewed.map((row) => ({ label: row.name, count: row.count }));
  const topItemsCarted = guest.topItemsCarted.map((row) => ({ label: row.name, count: row.count }));
  const topCategories = guest.topCategories.map((row) => ({ label: row.name, count: row.count }));
  const topPages = guest.topPages.map((row) => ({ label: pageLabel(t, row.page), count: row.count }));
  const eventBreakdown = guest.eventBreakdown.map((row) => ({
    label: guestEventLabel(t, row.event, row.label),
    count: row.count,
  }));
  const funnelData = guest.funnel.map((row) => ({
    step: t(`dashboard.funnel.${row.stepKey as GuestFunnelStepKey}`),
    count: row.count,
  }));
  const locations = guest.locations.map((row) => ({ label: row.locationId, count: row.events }));
  const trend = localizeTrend(guest.trend, locale);
  const tickInterval = trend.length > 16 ? ("preserveStartEnd" as const) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label={t("dashboard.kpi.uniqueVisitors")} value={summary.uniqueVisitors} previous={previousSummary.uniqueVisitors} />
        <KpiCard label={t("dashboard.kpi.pageViews")} value={summary.pageViews} previous={previousSummary.pageViews} />
        <KpiCard label={t("dashboard.kpi.cartAdds")} value={summary.cartAdds} previous={previousSummary.cartAdds} />
        <KpiCard label={t("dashboard.kpi.loyaltyEnrolls")} value={summary.loyaltyEnrolls} previous={previousSummary.loyaltyEnrolls} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <ChartCard className="lg:col-span-12" title={t("dashboard.chart.guestActivity.title")} description={t("dashboard.chart.guestActivity.description")}>
          <ChartContainer config={trendConfig} className="h-80 w-full">
            <ComposedChart accessibilityLayer data={trend} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={`fillVisitors-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-visitors)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-visitors)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="label" interval={tickInterval} tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <ChartTooltip
                cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.08 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { key?: string };
                      return row?.key ?? "";
                    }}
                  />
                }
              />
              <Area yAxisId="left" type="monotone" dataKey="visitors" stroke="var(--color-visitors)" strokeWidth={2} fill={`url(#fillVisitors-${gradId})`} fillOpacity={1} />
              <Line yAxisId="right" type="monotone" dataKey="pageViews" stroke="var(--color-pageViews)" strokeWidth={2.5} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="cartAdds" stroke="var(--color-cartAdds)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard className="lg:col-span-6" title={t("dashboard.chart.funnel.title")} description={t("dashboard.chart.funnel.description")}>
          <ChartContainer config={funnelConfig} className="h-72 w-full">
            <BarChart data={funnelData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="step" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[8, 8, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard className="lg:col-span-6" title={t("dashboard.chart.hourly.title")} description={t("dashboard.chart.hourly.description")}>
          <ChartContainer config={hourlyConfig} className="h-72 w-full">
            <BarChart data={guest.hourlyActivity} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard className="lg:col-span-6 xl:col-span-4" title={t("dashboard.chart.topItemsViewed.title")} description={t("dashboard.chart.topItemsViewed.description")}>
          <HorizontalBarChart data={topItemsViewed} config={barConfig} emptyLabel={t("dashboard.noData")} />
        </ChartCard>
        <ChartCard className="lg:col-span-6 xl:col-span-4" title={t("dashboard.chart.topItemsCarted.title")} description={t("dashboard.chart.topItemsCarted.description")}>
          <HorizontalBarChart data={topItemsCarted} config={barConfig} emptyLabel={t("dashboard.noData")} />
        </ChartCard>
        <ChartCard className="lg:col-span-6 xl:col-span-4" title={t("dashboard.chart.topCategories.title")} description={t("dashboard.chart.topCategories.description")}>
          <HorizontalBarChart data={topCategories} config={barConfig} emptyLabel={t("dashboard.noData")} />
        </ChartCard>
        <ChartCard className="lg:col-span-6 xl:col-span-4" title={t("dashboard.chart.topPages.title")} description={t("dashboard.chart.topPages.description")}>
          <HorizontalBarChart data={topPages} config={barConfig} emptyLabel={t("dashboard.noData")} />
        </ChartCard>

        {locations.length > 1 ? (
          <ChartCard className="lg:col-span-12" title={t("dashboard.chart.locations.title")} description={t("dashboard.chart.locations.description")}>
            <ChartContainer config={barConfig} className="h-64 w-full">
              <BarChart data={locations} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 6" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
        ) : null}

        {guest.languages.length > 0 ? (
          <ChartCard className="lg:col-span-6 xl:col-span-4" title={t("dashboard.chart.languages.title")} description={t("dashboard.chart.languages.description")}>
            <HorizontalBarChart
              data={guest.languages.map((row) => ({ label: row.lang, count: row.count }))}
              config={barConfig}
              emptyLabel={t("dashboard.noData")}
            />
          </ChartCard>
        ) : null}

        <ChartCard className="lg:col-span-12" title={t("dashboard.chart.eventBreakdown.title")} description={t("dashboard.chart.eventBreakdown.description")}>
          <HorizontalBarChart data={eventBreakdown} config={barConfig} emptyLabel={t("dashboard.noData")} wide />
        </ChartCard>
      </div>
    </div>
  );
}

function LoyaltySection({
  loyalty,
  locale,
  gradId,
  trendConfig,
  pointsConfig,
  waiterConfig,
}: {
  loyalty: LoyaltyAnalytics;
  locale: string;
  gradId: string;
  trendConfig: ChartConfig;
  pointsConfig: ChartConfig;
  waiterConfig: ChartConfig;
}) {
  const { t } = useI18n();
  const { summary, previousSummary, currency } = loyalty;
  const money = (amount: number) => formatMinorCurrency(amount, currency, locale);
  const unknown = t("dashboard.loyalty.unknownWaiter");
  const waiterBars = loyalty.waiters.slice(0, 8).map((row) => ({
    label: waiterLabel(row, unknown),
    count: row.members,
  }));
  const trend = localizeTrend(loyalty.trend, locale);
  const tickInterval = trend.length > 16 ? ("preserveStartEnd" as const) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard label={t("dashboard.loyalty.newMembers")} value={summary.newMembers} previous={previousSummary.newMembers} />
        <KpiCard label={t("dashboard.loyalty.acquired")} value={summary.acquiredMembers} previous={previousSummary.acquiredMembers} />
        <KpiCard label={t("dashboard.loyalty.noOrder")} value={summary.membersWithoutOrder} previous={previousSummary.membersWithoutOrder} />
        <KpiCard label={t("dashboard.loyalty.orders")} value={summary.orders} previous={previousSummary.orders} />
        <KpiCard label={t("dashboard.loyalty.revenue")} value={summary.revenueMinor} previous={previousSummary.revenueMinor} display={money(summary.revenueMinor)} />
        <KpiCard label={t("dashboard.loyalty.pointsEarned")} value={summary.pointsEarned} previous={previousSummary.pointsEarned} />
        <KpiCard label={t("dashboard.loyalty.pointsRedeemed")} value={summary.pointsRedeemed} previous={previousSummary.pointsRedeemed} />
        <KpiCard label={t("dashboard.loyalty.repeatGuests")} value={summary.repeatGuests} previous={previousSummary.repeatGuests} />
        <KpiCard label={t("dashboard.loyalty.walletInstalls")} value={summary.walletInstalls} previous={previousSummary.walletInstalls} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
        <ChartCard className="xl:col-span-6" title={t("dashboard.loyalty.trendTitle")} description={t("dashboard.loyalty.trendDescription")}>
          <ChartContainer config={trendConfig} className="h-72 w-full">
            <ComposedChart data={trend} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={`fillMembers-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-newMembers)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-newMembers)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="label" interval={tickInterval} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { key?: string };
                      return row?.key ?? "";
                    }}
                  />
                }
              />
              <Area type="monotone" dataKey="newMembers" stroke="var(--color-newMembers)" fill={`url(#fillMembers-${gradId})`} strokeWidth={2} />
              <Line type="monotone" dataKey="orders" stroke="var(--color-orders)" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard className="xl:col-span-6" title={t("dashboard.loyalty.pointsTitle")} description={t("dashboard.loyalty.pointsDescription")}>
          <ChartContainer config={pointsConfig} className="h-72 w-full">
            <BarChart data={trend} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="label" interval={tickInterval} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11 }} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { key?: string };
                      return row?.key ?? "";
                    }}
                  />
                }
              />
              <Bar dataKey="pointsEarned" fill="var(--color-pointsEarned)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="pointsRedeemed" fill="var(--color-pointsRedeemed)" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard className="xl:col-span-4" title={t("dashboard.loyalty.waitersTitle")} description={t("dashboard.loyalty.waitersDescription")}>
          <HorizontalBarChart
            data={waiterBars}
            config={waiterConfig}
            emptyLabel={t("dashboard.noData")}
            heightClass="h-80"
          />
        </ChartCard>

        <div className="flex min-w-0 flex-col rounded-2xl border border-foreground/10 bg-background/60 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md xl:col-span-8">
          <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
            <h3 className="text-base font-semibold tracking-tight text-foreground">{t("dashboard.loyalty.waitersTitle")}</h3>
            <p className="mt-1 text-xs text-foreground/60 sm:text-sm">{t("dashboard.loyalty.waitersDescription")}</p>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            {loyalty.waiters.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-foreground/50">{t("dashboard.noData")}</p>
            ) : (
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-background/95 text-xs uppercase tracking-wide text-foreground/50 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("dashboard.loyalty.table.waiter")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("dashboard.loyalty.table.members")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("dashboard.loyalty.table.share")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("dashboard.loyalty.table.revenue")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t("dashboard.loyalty.table.points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loyalty.waiters.map((row) => (
                    <tr key={`${row.waiterId}:${row.waiterName}:${row.unknown}`} className="border-t border-foreground/10">
                      <td className="px-4 py-3 font-medium text-foreground">{waiterLabel(row, unknown)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.members.toLocaleString(locale)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(row.share * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(row.firstOrderRevenueMinor)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.firstOrderPoints.toLocaleString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
