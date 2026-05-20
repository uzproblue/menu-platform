"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isMenuCatalogViewMode,
  type MenuCatalogViewMode,
} from "./menu-catalog-view-mode";

export function useMenuCatalogView(storageKey: string) {
  const [viewMode, setViewModeState] = useState<MenuCatalogViewMode>("grid");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && isMenuCatalogViewMode(stored)) {
        setViewModeState(stored);
      }
    } catch {
      // ignore private mode / quota errors
    }
  }, [storageKey]);

  const setViewMode = useCallback(
    (next: MenuCatalogViewMode) => {
      setViewModeState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  return [viewMode, setViewMode] as const;
}
