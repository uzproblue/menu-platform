"use client";

import { createContext, useContext } from "react";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";

export type GlobalMenuCatalogLayoutValue = {
  initialData: GlobalMenuData;
  loadError: string | null;
};

const GlobalMenuCatalogLayoutContext = createContext<GlobalMenuCatalogLayoutValue | null>(
  null,
);

export function GlobalMenuCatalogLayoutProvider({
  value,
  children,
}: {
  value: GlobalMenuCatalogLayoutValue;
  children: React.ReactNode;
}) {
  return (
    <GlobalMenuCatalogLayoutContext.Provider value={value}>
      {children}
    </GlobalMenuCatalogLayoutContext.Provider>
  );
}

export function useGlobalMenuCatalogLayout(): GlobalMenuCatalogLayoutValue {
  const value = useContext(GlobalMenuCatalogLayoutContext);
  if (!value) {
    throw new Error("useGlobalMenuCatalogLayout must be used within global-menu layout");
  }
  return value;
}
