import type { Metadata } from "next";
import { NewLocationWizard } from "@/app/components/restaurants/new-location-wizard";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    title: `${t("restaurants.newWizard.editPageTitle")} · Menu Platform`,
    description: t("restaurants.newWizard.editPageSubtitle"),
  };
}

export default async function EditRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <NewLocationWizard initialLocationId={decoded} />
      </div>
    </div>
  );
}
