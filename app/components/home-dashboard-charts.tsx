"use client";

import { useId, type ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import dashboard from "@/lib/data/home-dashboard.json";

const accessConfig = {
  minutes: {
    label: "Access time",
    color: "var(--chart-1)",
  },
  sessions: {
    label: "Sessions",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const categoryConfig = {
  views: {
    label: "Menu views",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const funnelConfig = {
  qrScans: {
    label: "QR scans",
    color: "var(--chart-4)",
  },
  orders: {
    label: "Orders placed",
    color: "var(--chart-1)",
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

export function HomeDashboardCharts() {
  const gradId = useId().replace(/:/g, "");
  const access = dashboard.menuAccessLast7Days;
  const categories = dashboard.menuViewsByCategory;
  const funnel = dashboard.qrScansVsOrders;

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
      <ChartCard
        className="lg:col-span-2"
        title="Menu access (last 7 days)"
        description="Total minutes guests spent browsing your menus, and session count per day."
      >
        <ChartContainer
          config={accessConfig}
          className="h-[min(22rem,55vw)] w-full min-h-[220px] sm:h-80"
        >
          <ComposedChart
            accessibilityLayer
            data={access}
            margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`fillMinutes-${gradId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-minutes)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-minutes)"
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
              tickFormatter={(v) => `${v}`}
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
              dataKey="minutes"
              stroke="var(--color-minutes)"
              strokeWidth={2}
              fill={`url(#fillMinutes-${gradId})`}
              fillOpacity={1}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="sessions"
              stroke="var(--color-sessions)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--color-sessions)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="Menu views by category"
        description="Static snapshot of which sections drew the most attention this week."
      >
        <ChartContainer
          config={categoryConfig}
          className="h-[min(20rem,50vw)] w-full min-h-[220px] sm:h-72"
        >
          <BarChart
            accessibilityLayer
            data={categories}
            layout="vertical"
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 6" />
            <XAxis type="number" hide />
            <YAxis
              dataKey="category"
              type="category"
              width={92}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="views"
              fill="var(--color-views)"
              radius={[0, 10, 10, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard
        title="QR scans vs orders"
        description="Compare digital menu opens with completed orders — spot conversion trends."
      >
        <ChartContainer
          config={funnelConfig}
          className="h-[min(20rem,50vw)] w-full min-h-[220px] sm:h-72"
        >
          <LineChart
            accessibilityLayer
            data={funnel}
            margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 6" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { date?: string };
                    return row?.date ?? "";
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="qrScans"
              stroke="var(--color-qrScans)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="orders"
              stroke="var(--color-orders)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>
    </div>
  );
}
