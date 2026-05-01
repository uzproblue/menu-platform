"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";
import { loadGlobalMenuDraft, saveGlobalMenuDraft } from "@/lib/global-menu-storage";

export type UsePersistedGlobalMenuOptions = {
  /** When false, skip localStorage draft load/save and follow `initialData` from the server. */
  persistDraft?: boolean;
};

/**
 * Keeps global menu in React state. With `persistDraft: true` (default), mirrors
 * to localStorage so drafts align across routes until fully API-backed.
 */
export function usePersistedGlobalMenu(
  initialData: GlobalMenuData,
  options?: UsePersistedGlobalMenuOptions,
) {
  const persistDraft = options?.persistDraft !== false;
  const initialRef = useRef(initialData);
  initialRef.current = initialData;

  const [data, setData] = useState<GlobalMenuData>(() =>
    structuredClone(initialRef.current),
  );
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    if (persistDraft) {
      setData(loadGlobalMenuDraft(initialRef.current));
    }
    setHydrated(true);
  }, [persistDraft]);

  useLayoutEffect(() => {
    if (!hydrated || !persistDraft) return;
    saveGlobalMenuDraft(data);
  }, [data, hydrated, persistDraft]);

  useEffect(() => {
    if (!persistDraft) {
      setData(structuredClone(initialData));
    }
  }, [initialData, persistDraft]);

  return { data, setData };
}
