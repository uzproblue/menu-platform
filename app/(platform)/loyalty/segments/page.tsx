import type { Metadata } from "next";
import { LoyaltySegmentsClient } from "@/app/components/loyalty/loyalty-segments-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.segmentsTitle")} · Menu Platform` };
}

export default async function LoyaltySegmentsPage() {
  const { t } = await getServerT();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-7">
        <header className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("loyalty.segmentsTitle")}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
            {t("loyalty.segmentsSubtitle")}
          </p>
        </header>
        <div className="mt-6">
          <LoyaltySegmentsClient />
        </div>
      </div>
    </div>
  );
}
