import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { SeasonalMenusListClient } from "@/app/components/seasonal-menu/seasonal-menus-list-client";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  listSeasonalMenuDesignsWithAuthServer,
  type SeasonalMenuDesignApi,
} from "@/lib/auth-api";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Seasonal menus · Menu Platform",
  description: "Design printable seasonal menus",
};

export default async function SeasonalMenusPage() {
  const { t } = await getServerT();
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;

  let designs: SeasonalMenuDesignApi[] = [];
  let loadError: string | null = null;

  if (!token) {
    loadError = "unauthorized";
  } else {
    const restaurantId = await getSelectedRestaurantIdFromCookies();
    const result = await listSeasonalMenuDesignsWithAuthServer(token, restaurantId);
    if (result.ok) {
      designs = result.data.designs;
    } else {
      loadError = result.message ?? result.error;
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("seasonalMenu.title")}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">{t("seasonalMenu.subtitle")}</p>
        <div className="mt-8">
          <SeasonalMenusListClient
            initialDesigns={designs}
            loadError={loadError}
          />
        </div>
      </div>
    </div>
  );
}
