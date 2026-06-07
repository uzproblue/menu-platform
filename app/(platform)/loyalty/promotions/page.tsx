import type { Metadata } from "next";
import { LoyaltyPromotionsClient } from "@/app/components/loyalty/loyalty-promotions-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.promotionsTitle")} · Menu Platform` };
}

export default async function LoyaltyPromotionsPage() {
  const { t } = await getServerT();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("loyalty.promotionsTitle")}</h1>
        <p className="mt-2 text-sm text-foreground/60">{t("loyalty.promotionsSubtitle")}</p>
        <div className="mt-8">
          <LoyaltyPromotionsClient />
        </div>
      </div>
    </div>
  );
}
