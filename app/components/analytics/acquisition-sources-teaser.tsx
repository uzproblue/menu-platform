"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";

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
}: {
  restaurantId: string;
  from: string;
  to: string;
}) {
  const { t } = useI18n();
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ from, to, restaurantId });
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
  }, [restaurantId, from, to]);

  const ranked = sources
    .filter((s) => s.visitors > 0 || s.loyaltyEnrolls > 0 || s.source === "2gis")
    .slice(0, 5);

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background/50 px-4 py-4 ring-1 ring-foreground/5 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {t("acquisition.teaserTitle")}
          </h3>
          <p className="mt-1 text-sm text-foreground/60">
            {t("acquisition.teaserHint")}
          </p>
        </div>
        <Link
          href="/analytics/acquisition?source=2gis"
          className="text-sm font-medium underline underline-offset-2"
        >
          {t("acquisition.teaserLink")}
        </Link>
      </div>
      {!loaded ? (
        <p className="mt-3 text-sm text-foreground/45">{t("acquisition.loading")}</p>
      ) : ranked.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/45">
          {t("acquisition.teaserEmpty")}
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((row) => (
            <li key={row.source}>
              <Link
                href={`/analytics/acquisition?source=${encodeURIComponent(row.source)}`}
                className="block rounded-xl border border-foreground/10 px-3 py-2 transition hover:border-foreground/25"
              >
                <p className="text-sm font-semibold">{labelFor(t, row.source)}</p>
                <p className="mt-0.5 text-xs text-foreground/55">
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
    </section>
  );
}
