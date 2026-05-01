import type { Metadata } from "next";
import Link from "next/link";
import { RestaurantsList } from "@/app/components/restaurants/restaurants-list";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Restaurants · Menu Platform",
  description: "Restaurant management",
};

export default async function RestaurantsPage() {
  const { t } = await getServerT();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("restaurants.title")}
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              {t("restaurants.subtitle")}
            </p>
          </div>
          <Link
            href="/restaurants/new"
            className="mt-4 inline-flex shrink-0 items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 sm:mt-0"
          >
            {t("restaurants.newWizard.entryCta")}
          </Link>
        </div>
        <div className="mt-8">
          <RestaurantsList />
        </div>
      </div>
    </div>
  );
}
