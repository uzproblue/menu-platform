"use client";

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
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
import type { GuestDashboardData, GuestFunnelStepKey } from "@/lib/analytics/types";

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
      className={`flex flex-col rounded-2xl border border-foreground/10 bg-background/60 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md ${className}`}
    >
      <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </h2>
        <p className="mt-1 text-xs text-foreground/60 sm:text-sm">{description}</p>
      </div>
      <div className="min-h-0 flex-1 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background/50 px-4 py-3 ring-1 ring-foreground/5">
      <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
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

const EMPTY_DASHBOARD: GuestDashboardData = {
  configured: false,
  summary: {
    uniqueVisitors: 0,
    totalEvents: 0,
    pageViews: 0,
    cartAdds: 0,
    loyaltyEnrolls: 0,
  },
  dailyTrend: [],
  topPages: [],
  topCategories: [],
  topItemsViewed: [],
  topItemsCarted: [],
  locations: [],
  eventBreakdown: [],
  languages: [],
  hourlyActivity: [],
  funnel: [],
};

export function HomeDashboardCharts() {
  const { t } = useI18n();
  const gradId = useId().replace(/:/g, "");
  const [dashboard, setDashboard] = useState<GuestDashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const trendConfig = useMemo(
    () =>
      ({
        visitors: { label: t("dashboard.series.visitors"), color: "var(--chart-1)" },
        pageViews: { label: t("dashboard.series.pageViews"), color: "var(--chart-2)" },
        cartAdds: { label: t("dashboard.series.cartAdds"), color: "var(--chart-3)" },
      }) satisfies ChartConfig,
    [t],
  );

  const funnelConfig = useMemo(
    () =>
      ({
        count: { label: t("dashboard.series.events"), color: "var(--chart-4)" },
      }) satisfies ChartConfig,
    [t],
  );

  const barConfig = useMemo(
    () =>
      ({
        count: { label: t("dashboard.series.count"), color: "var(--chart-5)" },
      }) satisfies ChartConfig,
    [t],
  );

  const hourlyConfig = useMemo(
    () =>
      ({
        count: { label: t("dashboard.series.activity"), color: "var(--chart-1)" },
      }) satisfies ChartConfig,
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
      return (
        payload.selectedRestaurantId ??
        payload.currentRestaurantId ??
        null
      );
    } catch {
      return null;
    }
  }, []);

  const loadDashboard = useCallback(async (activeRestaurantId: string | null) => {
    setLoading(true);
    try {
      const url = activeRestaurantId
        ? `/api/analytics/guest-dashboard?restaurantId=${encodeURIComponent(activeRestaurantId)}`
        : "/api/analytics/guest-dashboard";
      const res = await fetch(url, { cache: "no-store" });
      const data = res.ok
        ? ((await res.json()) as GuestDashboardData)
        : EMPTY_DASHBOARD;
      setDashboard(data);
    } catch {
      setDashboard(EMPTY_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const id = await loadContext();
    setRestaurantId(id);
    await loadDashboard(id);
  }, [loadContext, loadDashboard]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onContextChange = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
      const nextId = detail?.restaurantId ?? null;
      if (nextId) setRestaurantId(nextId);
      void loadDashboard(nextId);
    };
    window.addEventListener("restaurant-context-changed", onContextChange);
    return () => window.removeEventListener("restaurant-context-changed", onContextChange);
  }, [loadDashboard]);

  if (loading) {
    return <p className="mt-8 text-sm text-foreground/50">{t("dashboard.loading")}</p>;
  }

  if (!dashboard.configured) {
    return (
      <p className="mt-8 rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm text-foreground/60">
        {t("dashboard.notConfigured")}
      </p>
    );
  }

  if (!restaurantId) {
    return (
      <p className="mt-8 rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm text-foreground/60">
        {t("dashboard.selectRestaurant")}
      </p>
    );
  }

  const { summary } = dashboard;
  const topItemsViewed = dashboard.topItemsViewed.map((row) => ({
    label: row.name,
    count: row.count,
  }));
  const topItemsCarted = dashboard.topItemsCarted.map((row) => ({
    label: row.name,
    count: row.count,
  }));
  const topCategories = dashboard.topCategories.map((row) => ({
    label: row.name,
    count: row.count,
  }));
  const topPages = dashboard.topPages.map((row) => ({
    label: pageLabel(t, row.page),
    count: row.count,
  }));
  const eventBreakdown = dashboard.eventBreakdown.map((row) => ({
    label: guestEventLabel(t, row.event, row.label),
    count: row.count,
  }));
  const funnelData = dashboard.funnel.map((row) => ({
    step: t(`dashboard.funnel.${row.stepKey as GuestFunnelStepKey}`),
    count: row.count,
  }));
  const locations = dashboard.locations.map((row) => ({
    label: row.locationId,
    count: row.events,
    visitors: row.visitors,
  }));

  return (
    <div className="mt-8 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <KpiCard label={t("dashboard.kpi.uniqueVisitors")} value={summary.uniqueVisitors} />
        <KpiCard label={t("dashboard.kpi.pageViews")} value={summary.pageViews} />
        <KpiCard label={t("dashboard.kpi.cartAdds")} value={summary.cartAdds} />
        <KpiCard label={t("dashboard.kpi.loyaltyEnrolls")} value={summary.loyaltyEnrolls} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <ChartCard
          className="lg:col-span-2"
          title={t("dashboard.chart.guestActivity.title")}
          description={t("dashboard.chart.guestActivity.description")}
        >
          <ChartContainer
            config={trendConfig}
            className="h-[min(22rem,55vw)] w-full min-h-[220px] sm:h-80"
          >
            <ComposedChart
              accessibilityLayer
              data={dashboard.dailyTrend}
              margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`fillVisitors-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-visitors)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-visitors)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <ChartTooltip
                cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.08 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { date?: string };
                      return row?.date ?? "";
                    }}
                  />
                }
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="visitors"
                stroke="var(--color-visitors)"
                strokeWidth={2}
                fill={`url(#fillVisitors-${gradId})`}
                fillOpacity={1}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="pageViews"
                stroke="var(--color-pageViews)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--color-pageViews)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cartAdds"
                stroke="var(--color-cartAdds)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2, fill: "var(--color-cartAdds)", strokeWidth: 0 }}
              />
            </ComposedChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.chart.funnel.title")}
          description={t("dashboard.chart.funnel.description")}
        >
          <ChartContainer config={funnelConfig} className="h-[min(18rem,45vw)] w-full min-h-[200px] sm:h-64">
            <BarChart data={funnelData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="step" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[8, 8, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.chart.hourly.title")}
          description={t("dashboard.chart.hourly.description")}
        >
          <ChartContainer config={hourlyConfig} className="h-[min(18rem,45vw)] w-full min-h-[200px] sm:h-64">
            <BarChart data={dashboard.hourlyActivity} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard
          title={t("dashboard.chart.topItemsViewed.title")}
          description={t("dashboard.chart.topItemsViewed.description")}
        >
          <HorizontalBarChart data={topItemsViewed} config={barConfig} emptyLabel={t("dashboard.noData")} />
        </ChartCard>

        <ChartCard
          title={t("dashboard.chart.topItemsCarted.title")}
          description={t("dashboard.chart.topItemsCarted.description")}
        >
          <HorizontalBarChart data={topItemsCarted} config={barConfig} emptyLabel={t("dashboard.noData")} />
        </ChartCard>

        <ChartCard
          title={t("dashboard.chart.topCategories.title")}
          description={t("dashboard.chart.topCategories.description")}
        >
          <HorizontalBarChart data={topCategories} config={barConfig} emptyLabel={t("dashboard.noData")} />
        </ChartCard>

        <ChartCard
          title={t("dashboard.chart.topPages.title")}
          description={t("dashboard.chart.topPages.description")}
        >
          <HorizontalBarChart data={topPages} config={barConfig} emptyLabel={t("dashboard.noData")} />
        </ChartCard>

        {locations.length > 1 ? (
          <ChartCard
            className="lg:col-span-2"
            title={t("dashboard.chart.locations.title")}
            description={t("dashboard.chart.locations.description")}
          >
            <ChartContainer config={barConfig} className="h-[min(16rem,40vw)] w-full min-h-[180px] sm:h-56">
              <BarChart
                data={locations}
                layout="vertical"
                margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 6" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={100}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 10, 10, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
        ) : null}

        {dashboard.languages.length > 0 ? (
          <ChartCard
            title={t("dashboard.chart.languages.title")}
            description={t("dashboard.chart.languages.description")}
          >
            <HorizontalBarChart
              data={dashboard.languages.map((row) => ({
                label: row.lang,
                count: row.count,
              }))}
              config={barConfig}
              emptyLabel={t("dashboard.noData")}
            />
          </ChartCard>
        ) : null}

        <ChartCard
          className="lg:col-span-2"
          title={t("dashboard.chart.eventBreakdown.title")}
          description={t("dashboard.chart.eventBreakdown.description")}
        >
          <HorizontalBarChart
            data={eventBreakdown}
            config={barConfig}
            emptyLabel={t("dashboard.noData")}
            wide
          />
        </ChartCard>
      </div>
    </div>
  );
}

function HorizontalBarChart({
  data,
  config,
  emptyLabel,
  wide = false,
}: {
  data: { label: string; count: number }[];
  config: ChartConfig;
  emptyLabel: string;
  wide?: boolean;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-foreground/50">{emptyLabel}</p>;
  }

  return (
    <ChartContainer
      config={config}
      className={`w-full min-h-[200px] ${wide ? "h-[min(28rem,70vw)] sm:h-96" : "h-[min(20rem,50vw)] sm:h-72"}`}
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
          width={wide ? 160 : 120}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
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
