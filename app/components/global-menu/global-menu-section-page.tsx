"use client";

import { GlobalMenuPageClient } from "./global-menu-page-client";
import { useGlobalMenuCatalogLayout } from "./global-menu-catalog-layout-context";

type GlobalMenuSectionPageProps = {
  sectionId: string;
};

export function GlobalMenuSectionPage({ sectionId }: GlobalMenuSectionPageProps) {
  const { initialData, loadError } = useGlobalMenuCatalogLayout();
  const section = initialData.sections?.find((s) => s.id === sectionId);
  const sectionName = section?.name ?? sectionId;

  return (
    <GlobalMenuPageClient
      sectionId={sectionId}
      sectionName={sectionName}
      initialData={initialData}
      loadError={loadError}
    />
  );
}
