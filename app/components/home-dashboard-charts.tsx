"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
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
import type { StaffDashboardData } from "@/lib/analytics/types";

const activityConfig = {
  events: {
    label: "Staff actions",
    color: "var(--chart-1)",
  },
  pageViews: {
    label: "Page views",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const topActionsConfig = {
  count: {
    label: "Actions",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const locationConfig = {
  count: {
    label: "Location actions",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

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

const EMPTY_DASHBOARD: StaffDashboardData = {
  configured: false,
  activityLast7Days: [],
  topActions: [],
  locationActions: [],
};

export function HomeDashboardCharts() {
  const gradId = useId().replace(/:/g, "");
  const [dashboard, setDashboard] = useState<StaffDashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/analytics/dashboard")
      .then(async (res) =>
        res.ok ? ((await res.json()) as StaffDashboardData) : EMPTY_DASHBOARD,
      )
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch(() => {
        if (!cancelled) setDashboard(EMPTY_DASHBOARD);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activity = dashboard.activityLast7Days;
  const topActions = dashboard.topActions.map((row) => ({
    action: row.label,
    count: row.count,
  }));
  const locationActions = dashboard.locationActions.map((row) => ({
    action: row.label,
    count: row.count,
  }));

  if (loading) {
    return (
      <p className="mt-8 text-sm text-foreground/50">Loading staff activity…</p>
    );
  }

  if (!dashboard.configured) {
    return (
      <p className="mt-8 rounded-xl border border-foreground/10 bg-background/40 px-4 py-3 text-sm text-foreground/60">
        Staff analytics will appear here once{" "}
        <code className="text-xs">CF_ACCOUNT_ID</code> and{" "}
        <code className="text-xs">CF_ANALYTICS_API_TOKEN</code> are configured on
        the Worker. Events are already being collected via Analytics Engine.
      </p>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
      <ChartCard
        className="lg:col-span-2"
        title="Staff activity (last 7 days)"
        description="Total platform actions and page views per day for the selected restaurant."
      >
        <ChartContainer
          config={activityConfig}
          className="h-[min(22rem,55vw)] w-full min-h-[220px] sm:h-80"
        >
          <ComposedChart
            accessibilityLayer
            data={activity}
            margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`fillEvents-${gradId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-events)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-events)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 6" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 11 }}
            />
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
              dataKey="events"
              stroke="var(--color-events)"
              strokeWidth={2}
              fill={`url(#fillEvents-${gradId})`}
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
          </ComposedChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="Top staff actions"
        description="Most frequent platform events this week."
      >
        <ChartContainer
          config={topActionsConfig}
          className="h-[min(20rem,50vw)] w-full min-h-[220px] sm:h-72"
        >
          <BarChart
            accessibilityLayer
            data={topActions}
            layout="vertical"
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 6" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="action"
              type="category"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[0, 10, 10, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="Location management"
        description="Location-related staff actions — publishes, toggles, and edits."
      >
        <ChartContainer
          config={locationConfig}
          className="h-[min(20rem,50vw)] w-full min-h-[220px] sm:h-72"
        >
          <BarChart
            accessibilityLayer
            data={locationActions}
            layout="vertical"
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 6" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="action"
              type="category"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[0, 10, 10, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
