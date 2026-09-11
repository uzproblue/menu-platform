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
    <div className="flex h-full min-h-0 flex-col">
      <MenuItemVideosClient bunnyLibraryId={bunnyLibraryId} title={t("menuItemVideos.title")} subtitle={t("menuItemVideos.subtitle")} />
    </div>
  );
}
