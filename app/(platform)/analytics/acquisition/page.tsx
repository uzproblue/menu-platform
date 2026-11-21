import type { Metadata } from "next";
import { AcquisitionExplorerClient } from "@/app/components/analytics/acquisition-explorer-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("acquisition.pageTitle")} · Menu Platform` };
}

export default async function AcquisitionAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { t } = await getServerT();
  const params = await searchParams;
  const initialSource =
    typeof params.source === "string" && params.source.trim()
      ? params.source.trim().toLowerCase()
      : "2gis";

  return (
    <div className="w-full max-w-[1600px]">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-4 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("acquisition.pageTitle")}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          {t("acquisition.pageSubtitle")}
        </p>
        <div className="mt-6">
          <AcquisitionExplorerClient initialSource={initialSource} />
        </div>
      </div>
    </div>
  );
}
