import type { Metadata } from "next";
import Link from "next/link";
import { LoyaltyPromotionsClient } from "@/app/components/loyalty/loyalty-promotions-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.promotionsTitle")} · Menu Platform` };
}

export default async function LoyaltyPointsPromotionsPage() {
  const { t } = await getServerT();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("loyalty.promotionsTitle")}
            </h1>
            <p className="mt-2 text-sm text-foreground/60">{t("loyalty.promotionsSubtitle")}</p>
          </div>
          <Link
            href="/loyalty/promotions"
            className="text-sm text-foreground/70 underline underline-offset-2"
          >
            {t("stories.backToStories")}
          </Link>
        </div>
        <div className="mt-8">
          <LoyaltyPromotionsClient />
        </div>
      </div>
    </div>
  );
}
