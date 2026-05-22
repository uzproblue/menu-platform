import type { Metadata } from "next";
import { MenuItemVideosClient } from "@/app/components/menu-item-videos/menu-item-videos-client";
import { getBunnyStreamLibraryIdForPreview } from "@/lib/bunny-stream";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return {
    title: `${t("menuItemVideos.title")} · Menu Platform`,
    description: t("menuItemVideos.subtitle"),
  };
}

export default async function MenuItemVideosPage() {
  const { t } = await getServerT();
  const bunnyLibraryId = getBunnyStreamLibraryIdForPreview();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("menuItemVideos.title")}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">{t("menuItemVideos.subtitle")}</p>
        <MenuItemVideosClient bunnyLibraryId={bunnyLibraryId} />
      </div>
    </div>
  );
}
