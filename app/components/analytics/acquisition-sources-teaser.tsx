"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SourceRow = {
  source: string;
  visitors: number;
  pageViews: number;
  loyaltyEnrolls: number;
};

function labelFor(t: (key: string) => string, source: string): string {
  if (source === "2gis") return t("acquisition.source.2gis");
  if (source === "direct") return t("acquisition.source.direct");
  return source;
}

export function AcquisitionSourcesTeaser({
  restaurantId,
  from,
  to,
  timeZone,
}: {
  restaurantId: string;
  from: string;
  to: string;
  timeZone?: string;
}) {
  const { t } = useI18n();
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ from, to, restaurantId });
    if (timeZone) params.set("timeZone", timeZone);
    void (async () => {
      try {
        const res = await fetch(`/api/analytics/acquisition/sources?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok || controller.signal.aborted) return;
        const data = (await res.json()) as { sources?: SourceRow[] };
        if (controller.signal.aborted) return;
        setSources(data.sources ?? []);
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    })();
    return () => controller.abort();
  }, [restaurantId, from, to, timeZone]);

  const ranked = sources
    .filter((s) => s.visitors > 0 || s.loyaltyEnrolls > 0 || s.source === "2gis")
    .slice(0, 5);

  return (
    <Card className="shadow-none">
      <CardHeader className="border-b sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle>{t("acquisition.teaserTitle")}</CardTitle>
          <CardDescription>{t("acquisition.teaserHint")}</CardDescription>
        </div>
        <Link
          href="/analytics/acquisition?source=2gis"
          className="text-sm font-medium underline underline-offset-4"
        >
          {t("acquisition.teaserLink")}
        </Link>
      </CardHeader>
      <CardContent className="pt-(--card-spacing)">
        {!loaded ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("acquisition.teaserEmpty")}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((row) => (
              <li key={row.source}>
                <Link
                  href={`/analytics/acquisition?source=${encodeURIComponent(row.source)}`}
                  className="block rounded-xl border px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {labelFor(t, row.source)}
                    </p>
                    {row.source === "2gis" ? (
                      <Badge variant="secondary">2GIS</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("acquisition.sourceMeta", {
                      visitors: String(row.visitors),
                      enrolls: String(row.loyaltyEnrolls),
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
