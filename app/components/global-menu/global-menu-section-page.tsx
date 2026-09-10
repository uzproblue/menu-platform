"use client";

import { GlobalMenuPageClient } from "./global-menu-page-client";
import { useGlobalMenuCatalogLayout } from "./global-menu-catalog-layout-context";
import { UnassignedPageClient } from "./unassigned/unassigned-page-client";

type GlobalMenuSectionPageProps = {
  sectionId: string;
};

export function GlobalMenuSectionPage({ sectionId }: GlobalMenuSectionPageProps) {
  const { initialData, loadError } = useGlobalMenuCatalogLayout();
  const section = initialData.sections?.find((s) => s.id === sectionId);
  const sectionName = section?.name ?? sectionId;

  if (section?.kind === "unassigned") {
    return <UnassignedPageClient />;
  }

  return (
    <GlobalMenuPageClient
      sectionId={sectionId}
      sectionName={sectionName}
      initialData={initialData}
      loadError={loadError}
    />
  );
}
