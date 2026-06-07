import type { Metadata } from "next";
import { PromotionFormClient } from "@/app/components/loyalty/promotion-form-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("loyalty.newPromotion")} · Menu Platform` };
}

export default async function NewPromotionPage() {
  const { t } = await getServerT();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("loyalty.newPromotion")}</h1>
        <div className="mt-8">
          <PromotionFormClient />
        </div>
      </div>
    </div>
  );
}
