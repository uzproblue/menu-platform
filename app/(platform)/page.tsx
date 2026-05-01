import { HomeDashboardCharts } from "../components/home-dashboard-charts";
import { getServerT } from "@/lib/i18n/server";

export default async function HomePage() {
  const { t } = await getServerT();
  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("home.welcome")}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          {t("home.subtitle")}
        </p>
      </div>
      <HomeDashboardCharts />
    </div>
  );
}
