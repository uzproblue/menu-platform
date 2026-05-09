/**
 * Cross-page handoff for create / edit / delete actions on categories and menu
 * items. The destination list pages overlay these mutations on top of every
 * server read so the UI stays correct even when an intermediate cache (e.g.
 * Hyperdrive's read cache during its TTL window) returns a stale snapshot.
 *
 * Each mutation auto-retires the next time the server's content matches it.
 * Mutations are deduped on append: only the latest upsert / delete per id is
 * kept, so toggle-then-edit-then-delete of the same item collapses cleanly.
 */

import type { TranslationTextApi } from "@/lib/auth-api";
import type { GlobalMenuData, MenuItem } from "./data/global-menu-types";

const CATEGORY_KEY = "menu-platform.pendingCategoryMutations";
const MENU_ITEM_KEY = "menu-platform.pendingMenuItemMutations";

export type CategoryShape = {
  id: string;
  name: string;
  description: string | null;
  coverPhoto: string | null;
  sortOrder: number;
  itemsCount: number;
  /** Present on reads from menu-server; omitted on older pending upserts in sessionStorage. */
  translations?: TranslationTextApi[];
};

export type CategoryMutation =
  | { kind: "upsert"; value: CategoryShape }
  | { kind: "delete"; id: string };

export type MenuItemMutation =
  | { kind: "upsert"; categoryId: string; item: MenuItem }
  | { kind: "delete"; categoryId: string; id: string };

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readJsonArray<T>(key: string, validate: (raw: unknown) => raw is T): T[] {
  if (!isBrowser()) return [];
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return [];
  }
  if (raw == null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(validate);
}

function writeJsonArray(key: string, value: unknown[]): void {
  if (!isBrowser()) return;
  try {
    if (value.length === 0) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* quota / private mode — non-fatal, optimistic overlay is best-effort */
  }
}

function isTranslationTextApi(value: unknown): value is TranslationTextApi {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (typeof o.lang !== "string" || typeof o.name !== "string") return false;
  if (
    o.description !== undefined &&
    o.description !== null &&
    typeof o.description !== "string"
  ) {
    return false;
  }
  return true;
}

function isCategoryShape(value: unknown): value is CategoryShape {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    typeof v.name !== "string" ||
    typeof v.sortOrder !== "number" ||
    typeof v.itemsCount !== "number" ||
    (v.description !== null && typeof v.description !== "string") ||
    (v.coverPhoto !== null && typeof v.coverPhoto !== "string")
  ) {
    return false;
  }
  if (v.translations !== undefined) {
    if (!Array.isArray(v.translations)) return false;
    if (!v.translations.every(isTranslationTextApi)) return false;
  }
  return true;
}

function isCategoryMutation(value: unknown): value is CategoryMutation {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.kind === "delete") return typeof v.id === "string";
  if (v.kind === "upsert") return isCategoryShape(v.value);
  return false;
}

function isMenuItemShape(value: unknown): value is MenuItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (!Array.isArray(v.prices)) return false;
  for (const row of v.prices) {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    if (
      typeof r.id !== "string" ||
      typeof r.price !== "string" ||
      typeof r.currency !== "string"
    ) {
      return false;
    }
  }
  if (v.translations !== undefined) {
    if (!Array.isArray(v.translations)) return false;
    if (!v.translations.every(isTranslationTextApi)) return false;
  }
  return true;
}

function isMenuItemMutation(value: unknown): value is MenuItemMutation {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.categoryId !== "string") return false;
  if (v.kind === "delete") return typeof v.id === "string";
  if (v.kind === "upsert") return isMenuItemShape(v.item);
  return false;
}

function categoryMutationId(m: CategoryMutation): string {
  return m.kind === "upsert" ? m.value.id : m.id;
}

function menuItemMutationId(m: MenuItemMutation): string {
  return m.kind === "upsert" ? m.item.id : m.id;
}

export function getPendingCategoryMutations(): CategoryMutation[] {
  return readJsonArray(CATEGORY_KEY, isCategoryMutation);
}

export function setPendingCategoryMutations(value: CategoryMutation[]): void {
  writeJsonArray(CATEGORY_KEY, value);
}

export function appendCategoryMutation(m: CategoryMutation): void {
  const id = categoryMutationId(m);
  const next = getPendingCategoryMutations().filter(
    (existing) => categoryMutationId(existing) !== id,
  );
  next.push(m);
  setPendingCategoryMutations(next);
}

export function getPendingMenuItemMutations(): MenuItemMutation[] {
  return readJsonArray(MENU_ITEM_KEY, isMenuItemMutation);
}

export function setPendingMenuItemMutations(value: MenuItemMutation[]): void {
  writeJsonArray(MENU_ITEM_KEY, value);
}

export function appendMenuItemMutation(m: MenuItemMutation): void {
  const id = menuItemMutationId(m);
  const next = getPendingMenuItemMutations().filter(
    (existing) => menuItemMutationId(existing) !== id,
  );
  next.push(m);
  setPendingMenuItemMutations(next);
}

function categoryFieldsMatch(server: CategoryShape, optimistic: CategoryShape): boolean {
  return (
    server.name === optimistic.name &&
    (server.description ?? null) === (optimistic.description ?? null) &&
    (server.coverPhoto ?? null) === (optimistic.coverPhoto ?? null) &&
    server.sortOrder === optimistic.sortOrder
    // itemsCount intentionally skipped: it's a derived count whose value can
    // legitimately differ between an optimistic snapshot and the server's
    // recomputed total without indicating that our edit is still pending.
  );
}

function pricesEqual(
  a: MenuItem["prices"],
  b: MenuItem["prices"],
): boolean {
  if (a.length !== b.length) return false;
  // Compare by (currency, price); the row id can differ between an optimistic
  // shadow row and the persisted server row for the same currency.
  const sortRows = (rows: MenuItem["prices"]) =>
    [...rows].sort((x, y) => x.currency.localeCompare(y.currency));
  const sa = sortRows(a);
  const sb = sortRows(b);
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i].currency !== sb[i].currency || sa[i].price !== sb[i].price) {
      return false;
    }
  }
  return true;
}

function tagsEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const aa = a ?? [];
  const bb = b ?? [];
  if (aa.length !== bb.length) return false;
  const sa = [...aa].sort();
  const sb = [...bb].sort();
  for (let i = 0; i < sa.length; i += 1) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

function menuItemFieldsMatch(server: MenuItem, optimistic: MenuItem): boolean {
  return (
    server.name === optimistic.name &&
    (server.description ?? "") === (optimistic.description ?? "") &&
    (server.image ?? "") === (optimistic.image ?? "") &&
    (server.active ?? true) === (optimistic.active ?? true) &&
    pricesEqual(server.prices, optimistic.prices) &&
    tagsEqual(server.tags, optimistic.tags)
  );
}

export type ApplyCategoryResult = {
  list: CategoryShape[];
  retained: CategoryMutation[];
};

export function applyCategoryMutations(
  server: CategoryShape[],
  mutations: CategoryMutation[],
): ApplyCategoryResult {
  const byId = new Map(server.map((c) => [c.id, c]));
  const retained: CategoryMutation[] = [];
  for (const m of mutations) {
    if (m.kind === "delete") {
      if (byId.has(m.id)) {
        byId.delete(m.id);
        retained.push(m);
      }
      continue;
    }
    const existing = byId.get(m.value.id);
    if (existing && categoryFieldsMatch(existing, m.value)) {
      // server caught up — drop mutation
      continue;
    }
    const mergedTranslations =
      m.value.translations !== undefined
        ? m.value.translations
        : (existing?.translations ?? []);
    byId.set(m.value.id, { ...m.value, translations: mergedTranslations });
    retained.push(m);
  }
  return { list: [...byId.values()], retained };
}

export type ApplyMenuItemResult = {
  data: GlobalMenuData;
  retained: MenuItemMutation[];
};

export function applyMenuItemMutations(
  server: GlobalMenuData,
  mutations: MenuItemMutation[],
): ApplyMenuItemResult {
  const categories = server.categories.map((c) => ({ ...c, items: [...c.items] }));
  const indexById = new Map<string, number>();
  for (let i = 0; i < categories.length; i += 1) {
    indexById.set(categories[i].id, i);
  }
  const retained: MenuItemMutation[] = [];
  for (const m of mutations) {
    const catIdx = indexById.get(m.categoryId);
    if (catIdx === undefined) {
      // Category missing from server data — drop mutation; we can't render it.
      continue;
    }
    const cat = categories[catIdx];
    if (m.kind === "delete") {
      const exists = cat.items.some((i) => i.id === m.id);
      if (exists) {
        cat.items = cat.items.filter((i) => i.id !== m.id);
        retained.push(m);
      }
      continue;
    }
    const existingIdx = cat.items.findIndex((i) => i.id === m.item.id);
    const existing = existingIdx >= 0 ? cat.items[existingIdx] : null;
    if (existing && menuItemFieldsMatch(existing, m.item)) {
      // server caught up — drop mutation
      continue;
    }
    const mergedTranslations =
      m.item.translations !== undefined
        ? m.item.translations
        : (existing?.translations ?? []);
    const mergedItem = { ...m.item, translations: mergedTranslations };
    if (existingIdx >= 0) {
      cat.items[existingIdx] = mergedItem;
    } else {
      cat.items.push(mergedItem);
    }
    retained.push(m);
  }
  return { data: { categories }, retained };
}
