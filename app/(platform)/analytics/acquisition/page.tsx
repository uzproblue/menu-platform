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
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("acquisition.pageTitle")}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("acquisition.pageSubtitle")}
        </p>
      </div>
      <AcquisitionExplorerClient initialSource={initialSource} />
    </div>
  );
}
