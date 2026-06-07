"use client";

import { GlobalMenuPageClient } from "./global-menu-page-client";
import { useGlobalMenuCatalogLayout } from "./global-menu-catalog-layout-context";
import type { MenuSection } from "@/lib/data/global-menu-types";

type GlobalMenuSectionPageProps = {
  menuSection: MenuSection;
};

export function GlobalMenuSectionPage({ menuSection }: GlobalMenuSectionPageProps) {
  const { initialData, loadError } = useGlobalMenuCatalogLayout();

  return (
    <GlobalMenuPageClient
      menuSection={menuSection}
      initialData={initialData}
      loadError={loadError}
    />
  );
}
