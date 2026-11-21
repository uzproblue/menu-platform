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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  UsersIcon,
} from "lucide-react";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/app/components/i18n-provider";
import {
  isResolvedDashboardRange,
  resolveDashboardRange,
  type DashboardPreset,
} from "@/lib/analytics/date-range";
import type { GuestDashboardData, GuestFunnelStepKey } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

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

function sourceLabel(t: (key: string) => string, source: string): string {
  if (source === "2gis") return t("acquisition.source.2gis");
  if (source === "direct") return t("acquisition.source.direct");
  return source;
}

function formatWhen(value: string | null, locale: string): string {
  if (!value) return "—";
  const ms = Date.parse(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );
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
  return (
    <Card size="sm" className="shadow-none">
      <CardHeader className="pb-0">
        <CardDescription className="text-[11px] font-medium tracking-wide uppercase">
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">
          {value.toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-xs font-medium tabular-nums",
            delta.tone === "up" && "text-emerald-600 dark:text-emerald-400",
            delta.tone === "down" && "text-rose-600 dark:text-rose-400",
            delta.tone === "flat" && "text-muted-foreground",
          )}
        >
          {delta.text}
        </p>
      </CardContent>
    </Card>
  );
}

function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-(--card-spacing)">{children}</CardContent>
    </Card>
  );
}

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
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRow | null>(
    null,
  );
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineMember, setTimelineMember] = useState<VisitorMember | null>(
    null,
  );
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

  const closeDrawer = useCallback(() => {
    setSelectedVisitor(null);
    setTimeline([]);
    setTimelineMember(null);
  }, []);

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
    closeDrawer();
  }, [source, rangeKey, restaurantId, closeDrawer]);

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
          setSelectedVisitor((prev) =>
            prev
              ? { ...prev, guestId: data.guestId!, enrolled: true }
              : prev,
          );
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

  const sourceOptions = sources.length
    ? sources
    : [
        { source: "2gis", visitors: 0, pageViews: 0, loyaltyEnrolls: 0 },
        { source: "direct", visitors: 0, pageViews: 0, loyaltyEnrolls: 0 },
      ];

  const totalPages = Math.max(1, Math.ceil(visitorsTotal / 50));
  const activeMember = timelineMember ?? selectedVisitor?.member ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={preset}
          onValueChange={(value) => setPreset(value as DashboardPreset)}
        >
          <TabsList>
            {PRESETS.map((p) => (
              <TabsTrigger key={p} value={p}>
                {t(`dashboard.range.${p}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {preset === "custom" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            />
          </div>
        ) : null}
      </div>

      {restaurantId === null ? (
        <Card className="shadow-none">
          <CardContent className="py-6 text-sm text-muted-foreground">
            {t("dashboard.selectRestaurant")}
          </CardContent>
        </Card>
      ) : null}

      {restaurantId ? (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">
                {t("acquisition.sourcesHeading")}
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sourceOptions.map((row) => {
                const active = source === row.source;
                return (
                  <button
                    key={row.source}
                    type="button"
                    onClick={() => setSource(row.source)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {sourceLabel(t, row.source)}
                      </p>
                      {active ? (
                        <Badge
                          variant="secondary"
                          className="bg-background/15 text-background"
                        >
                          {t("acquisition.source.active")}
                        </Badge>
                      ) : null}
                    </div>
                    <p
                      className={cn(
                        "mt-1 text-xs tabular-nums",
                        active ? "text-background/70" : "text-muted-foreground",
                      )}
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : null}

          {error && !dashboard ? (
            <Card className="shadow-none">
              <CardContent className="py-6 text-sm text-destructive">
                {t("acquisition.loadError")}
              </CardContent>
            </Card>
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
                  <p className="mt-1 text-sm text-muted-foreground">
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
                <ChartPanel
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
                </ChartPanel>

                <ChartPanel
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
                    <BarChart
                      data={funnelData}
                      layout="vertical"
                      margin={{ left: 12 }}
                    >
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
                </ChartPanel>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ChartPanel
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
                </ChartPanel>
                <ChartPanel
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
                </ChartPanel>
                <ChartPanel
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
                </ChartPanel>
              </div>
            </>
          ) : null}

          <Card className="shadow-none">
            <CardHeader className="border-b">
              <CardTitle>{t("acquisition.customersHeading")}</CardTitle>
              <CardDescription>{t("acquisition.customersHint")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("acquisition.col.visitor")}</TableHead>
                    <TableHead>{t("acquisition.col.lastActive")}</TableHead>
                    <TableHead className="text-right">
                      {t("acquisition.col.events")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("acquisition.col.pages")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("acquisition.col.carts")}
                    </TableHead>
                    <TableHead>{t("acquisition.col.member")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitors.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-28 text-center text-muted-foreground"
                      >
                        {loading
                          ? t("acquisition.loading")
                          : t("acquisition.noCustomers")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visitors.map((row) => (
                      <TableRow
                        key={row.visitorId}
                        className="cursor-pointer"
                        data-state={
                          selectedVisitor?.visitorId === row.visitorId
                            ? "selected"
                            : undefined
                        }
                        onClick={() => setSelectedVisitor(row)}
                      >
                        <TableCell className="font-mono text-xs">
                          {shortVisitorId(row.visitorId)}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatWhen(row.lastSeenAt, locale)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.eventCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.pageViews}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.cartAdds}
                        </TableCell>
                        <TableCell>
                          {row.member ? (
                            <span className="font-medium">{row.member.name}</span>
                          ) : row.enrolled ? (
                            <Badge variant="secondary">
                              {t("acquisition.enrolled")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {visitorsTotal > 50 ? (
                <>
                  <Separator />
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      {t("acquisition.pageOf", {
                        page: String(page),
                        pages: String(totalPages),
                        total: String(visitorsTotal),
                      })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeftIcon />
                        {t("acquisition.prev")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        {t("acquisition.next")}
                        <ChevronRightIcon />
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Sheet
        open={selectedVisitor != null}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-md"
          showCloseButton
        >
          <SheetHeader className="border-b p-4">
            <SheetTitle>{t("acquisition.drawerTitle")}</SheetTitle>
            <SheetDescription className="font-mono text-xs break-all">
              {selectedVisitor?.visitorId}
            </SheetDescription>
          </SheetHeader>

          {activeMember ? (
            <div className="border-b px-4 py-3">
              <div className="rounded-xl border bg-muted/40 px-3 py-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-md bg-background p-1.5 ring-1 ring-border">
                    <UsersIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{activeMember.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {activeMember.phoneE164}
                    </p>
                    <Link
                      href={`/loyalty/members?guest=${encodeURIComponent(activeMember.id)}`}
                      className="mt-2 inline-flex text-sm font-medium text-foreground underline underline-offset-4 hover:opacity-80"
                    >
                      {t("acquisition.openMember")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <ScrollArea className="h-[min(70dvh,calc(100dvh-12rem))]">
            <div className="space-y-3 p-4">
              {timelineLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : timeline.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("acquisition.noEvents")}
                </p>
              ) : (
                timeline.map((ev, idx) => (
                  <div
                    key={`${ev.timestamp}-${ev.event}-${idx}`}
                    className="rounded-xl border px-3 py-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">
                        {eventLabel(t, ev.event)}
                      </p>
                      <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatWhen(ev.timestamp, locale)}
                      </p>
                    </div>
                    <EventMeta metadata={ev.metadata} />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
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
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
    );
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2.5">
      {rows.slice(0, 8).map((row) => (
        <li key={row.label} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="tabular-nums text-muted-foreground">{row.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/50"
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
    <p className="mt-1 truncate text-xs text-muted-foreground">
      {bits.join(" · ")}
    </p>
  );
}
