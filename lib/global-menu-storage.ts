import type { GlobalMenuData } from "@/lib/data/global-menu-types";

const STORAGE_KEY = "menu-platform:global-menu-draft:v1";

function isValid(data: unknown): data is GlobalMenuData {
  return (
    typeof data === "object" &&
    data !== null &&
    "categories" in data &&
    Array.isArray((data as GlobalMenuData).categories) &&
    (data as GlobalMenuData).categories.every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as { id?: unknown }).id === "string" &&
        typeof (c as { name?: unknown }).name === "string" &&
        Array.isArray((c as { items?: unknown }).items) &&
        (c as { items: unknown[] }).items.every((it) => {
          if (typeof it !== "object" || it === null) return false;
          const row = it as { prices?: unknown };
          return Array.isArray(row.prices);
        }),
    )
  );
}

export function loadGlobalMenuDraft(fallback: GlobalMenuData): GlobalMenuData {
  if (typeof window === "undefined") {
    return structuredClone(fallback);
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(fallback);
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) return structuredClone(fallback);
    return parsed;
  } catch {
    return structuredClone(fallback);
  }
}

export function saveGlobalMenuDraft(data: GlobalMenuData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota or private mode */
  }
}
