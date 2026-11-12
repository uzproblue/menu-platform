import type { Metadata } from "next";
import { MealConstructorsClient } from "@/app/components/global-menu/meal-constructors-client";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: `${t("constructors.title")} · Menu Platform` };
}

export default async function MealConstructorsPage() {
  const { t } = await getServerT();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("constructors.title")}</h1>
        <p className="mt-2 text-sm text-foreground/60">{t("constructors.pageHint")}</p>
        <div className="mt-8">
          <MealConstructorsClient />
        </div>
      </div>
    </div>
  );
}
