"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import type {
  GlobalMenuItemApi,
  GlobalMenuResponse,
  LocationMenuItemRow,
} from "@/lib/auth-api";
import type {
  GlobalMenuData,
  MenuCategory,
  MenuItem,
} from "@/lib/data/global-menu-types";
import type { RestaurantDisplayInfo } from "@/lib/data/restaurant-detail";
import { GlobalMenuCategorySection } from "@/app/components/global-menu/global-menu-category-section";
import { useI18n } from "../i18n-provider";
import {
  EditLocationCategoryModal,
  type EditLocationCategoryRow,
} from "./edit-location-category-modal";
import { computeLocationCategoryItemDelta } from "./location-category-item-delta";
import {
  AddLocationCategoriesModal,
  type AvailableCategory,
} from "./add-location-categories-modal";

export type CategoryCatalogEntry = {
  id: string;
  name: string;
  sortOrder: number;
  itemsCount: number;
};

type RestaurantDetailClientProps = {
  restaurant: RestaurantDisplayInfo;
  initialCatalog: GlobalMenuData;
  initialGlobalMenu: GlobalMenuResponse | null;
  initialManageItems: LocationMenuItemRow[];
  enabledCategoryIds: string[];
  categoriesCatalog: CategoryCatalogEntry[];
};

type AddCategoryState = {
  open: boolean;
  saving: boolean;
  error: string | null;
};

type EnabledSection = {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
};

type CatalogState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: GlobalMenuResponse }
  | { status: "error"; message: string };

/** Normalize catalog/API `prices[0].price` for PUT merge (JSON may use string or number). */
function menuPriceToPutString(price: unknown): string | null {
  if (typeof price === "number") {
    if (!Number.isFinite(price) || price < 0) return null;
    return String(price);
  }
  if (typeof price === "string") {
    const trimmed = price.trim();
    if (!trimmed.length) return null;
    const num = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(num) || num < 0) return null;
    return trimmed.replace(",", ".");
  }
  return null;
}

function buildLocationDisplayItem(
  row: LocationMenuItemRow,
  catalogItem: MenuItem | undefined,
  currency: string,
): MenuItem {
  const price = menuPriceToPutString(row.price) ?? "0";
  const item: MenuItem = {
    id: row.menuItemId,
    name: catalogItem?.name ?? row.menuItemId,
    locationEnabled: row.enabled,
    prices: [
      {
        id: `local-${row.menuItemId}`,
        price,
        currency,
      },
    ],
  };
  if (catalogItem?.active !== undefined) item.active = catalogItem.active;
  if (catalogItem?.image) item.image = catalogItem.image;
  if (catalogItem?.description) item.description = catalogItem.description;
  if (catalogItem?.tags?.length) item.tags = catalogItem.tags;
  return item;
}

export function RestaurantDetailClient({
  restaurant,
  initialCatalog,
  initialGlobalMenu,
  initialManageItems,
  enabledCategoryIds: initialEnabledCategoryIds,
  categoriesCatalog,
}: RestaurantDetailClientProps) {
  const { t } = useI18n();
  const [catalog] = useState<GlobalMenuData>(() => structuredClone(initialCatalog));
  const [manageItems, setManageItems] = useState<LocationMenuItemRow[]>(
    () => initialManageItems,
  );
  const [toggleBusyIds, setToggleBusyIds] = useState<Set<string>>(() => new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [enabledCategoryIds, setEnabledCategoryIds] = useState<string[]>(
    () => initialEnabledCategoryIds,
  );
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catalogState, setCatalogState] = useState<CatalogState>(() =>
    initialGlobalMenu
      ? { status: "loaded", data: initialGlobalMenu }
      : { status: "idle" },
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addState, setAddState] = useState<AddCategoryState>({
    open: false,
    saving: false,
    error: null,
  });

  const displayName = restaurant.name.trim().length
    ? restaurant.name
    : t("restaurantDetail.unknownRestaurant");

  const hasLogo = restaurant.logoUrl.trim().length > 0;
  const currency = restaurant.currency?.trim();
  const isActive = restaurant.isActive;

  const catalogById = useMemo(() => {
    const m = new Map<string, CategoryCatalogEntry>();
    for (const c of categoriesCatalog) m.set(c.id, c);
    return m;
  }, [categoriesCatalog]);

  const catalogCategoriesById = useMemo(() => {
    const m = new Map<string, MenuCategory>();
    for (const c of catalog.categories) m.set(c.id, c);
    return m;
  }, [catalog]);

  const catalogItemsById = useMemo(() => {
    const m = new Map<string, MenuItem>();
    for (const c of catalog.categories) {
      for (const item of c.items) m.set(item.id, item);
    }
    return m;
  }, [catalog]);

  const manageByItemId = useMemo(() => {
    const m = new Map<string, LocationMenuItemRow>();
    for (const row of manageItems) {
      m.set(row.menuItemId, row);
    }
    return m;
  }, [manageItems]);

  const enabledSections: EnabledSection[] = useMemo(() => {
    const currency = restaurant.currency ?? "";
    const sections: EnabledSection[] = [];
    for (const id of enabledCategoryIds) {
      const cat = catalogById.get(id);
      const catalogCategory = catalogCategoriesById.get(id);
      if (!cat && !catalogCategory) continue;

      const catalogItemIdsInCategory = new Set(
        catalogCategory?.items.map((i) => i.id) ?? [],
      );
      const rowsInCategory = manageItems.filter(
        (row) =>
          row.categoryId === id || catalogItemIdsInCategory.has(row.menuItemId),
      );
      const items = rowsInCategory
        .map((row) =>
          buildLocationDisplayItem(
            row,
            catalogItemsById.get(row.menuItemId),
            currency,
          ),
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      sections.push({
        id,
        name: cat?.name ?? catalogCategory?.name ?? id,
        sortOrder: cat?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        items,
      });
    }
    sections.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    return sections;
  }, [
    enabledCategoryIds,
    catalogById,
    catalogCategoriesById,
    catalogItemsById,
    manageItems,
    restaurant.currency,
  ]);

  const hasEnabledCategories = enabledSections.length > 0;
  const hasPublishedMenu = enabledSections.some((s) =>
    s.items.some((i) => i.locationEnabled === true),
  );

  const availableToAdd: AvailableCategory[] = useMemo(() => {
    const enabledSet = new Set(enabledCategoryIds);
    return categoriesCatalog
      .filter((c) => !enabledSet.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, itemsCount: c.itemsCount }))
      .sort(
        (a, b) =>
          (catalogById.get(a.id)?.sortOrder ?? 0) -
            (catalogById.get(b.id)?.sortOrder ?? 0) ||
          a.name.localeCompare(b.name),
      );
  }, [categoriesCatalog, enabledCategoryIds, catalogById]);

  const canShowAddButton = categoriesCatalog.length > 0;
  const addButtonDisabled = availableToAdd.length === 0;

  const handleToggleActive = useCallback(
    (categoryId: string, itemId: string) => {
      if (toggleBusyIds.has(itemId)) return;

      const currentlyOn = manageByItemId.get(itemId)?.enabled === true;
      const nextEnabled = !currentlyOn;

      setToggleError(null);
      setToggleBusyIds((prev) => new Set(prev).add(itemId));

      void (async () => {
        try {
          const res = await fetch(
            `/api/settings/locations/${encodeURIComponent(restaurant.id)}/menu-items/${encodeURIComponent(itemId)}`,
            {
              method: "PATCH",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ enabled: nextEnabled }),
            },
          );
          if (!res.ok) {
            let detail: string | undefined;
            try {
              const body = (await res.json()) as { message?: string; error?: string };
              const parts = [body?.error, body?.message].filter(
                (x): x is string => typeof x === "string" && x.trim().length > 0,
              );
              if (parts.length) detail = parts.join(" — ");
            } catch {
              /* ignore */
            }
            setToggleError(
              detail ?? t("restaurantDetail.editCategoryItemsSaveFailed"),
            );
            return;
          }

          const body = (await res.json()) as {
            menuItemId: string;
            enabled: boolean;
            price: string;
          };

          setManageItems((prev) => {
            const idx = prev.findIndex((r) => r.menuItemId === itemId);
            const row: LocationMenuItemRow = {
              menuItemId: itemId,
              categoryId,
              price: body.price,
              enabled: body.enabled,
            };
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = row;
              return next;
            }
            return [...prev, row];
          });
        } catch {
          setToggleError(t("restaurantDetail.editCategoryItemsSaveFailed"));
        } finally {
          setToggleBusyIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }
      })();
    },
    [manageByItemId, restaurant.id, t, toggleBusyIds],
  );

  const noopEdit = useCallback((categoryId: string, itemId: string) => {
    void categoryId;
    void itemId;
  }, []);
  const noopDelete = useCallback((categoryId: string, itemId: string) => {
    void categoryId;
    void itemId;
  }, []);

  const ensureCatalogLoaded = useCallback(async (): Promise<GlobalMenuResponse | null> => {
    if (catalogState.status === "loaded") return catalogState.data;
    setCatalogState({ status: "loading" });
    try {
      const res = await fetch("/api/settings/global-menu", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        const message = t("restaurantDetail.editCategoryItemsCatalogLoadFailed");
        setCatalogState({ status: "error", message });
        return null;
      }
      const data = (await res.json()) as GlobalMenuResponse;
      setCatalogState({ status: "loaded", data });
      return data;
    } catch {
      const message = t("restaurantDetail.editCategoryItemsCatalogLoadFailed");
      setCatalogState({ status: "error", message });
      return null;
    }
  }, [catalogState, t]);

  const handleOpenEdit = useCallback(
    (categoryId: string) => {
      setSaveError(null);
      setEditingCategoryId(categoryId);
      void ensureCatalogLoaded();
    },
    [ensureCatalogLoaded],
  );

  const handleCloseEdit = useCallback(() => {
    if (saving) return;
    setEditingCategoryId(null);
    setSaveError(null);
  }, [saving]);

  const editingCategoryName = useMemo(() => {
    if (!editingCategoryId) return "";
    const cat = catalogById.get(editingCategoryId);
    if (cat) return cat.name;
    const fromCatalog = catalogCategoriesById.get(editingCategoryId);
    return fromCatalog?.name ?? editingCategoryId;
  }, [editingCategoryId, catalogById, catalogCategoriesById]);

  const editingCatalogItems: GlobalMenuItemApi[] = useMemo(() => {
    if (!editingCategoryId) return [];
    if (catalogState.status !== "loaded") return [];
    const cat = catalogState.data.categories.find(
      (c) => c.id === editingCategoryId,
    );
    return cat?.items ?? [];
  }, [editingCategoryId, catalogState]);

  const editingInitiallyEnabled: Record<string, string> = useMemo(() => {
    if (!editingCategoryId) return {};
    const catalogIds =
      catalogState.status === "loaded"
        ? new Set(
            catalogState.data.categories
              .find((c) => c.id === editingCategoryId)
              ?.items.map((i) => i.id) ?? [],
          )
        : null;
    const out: Record<string, string> = {};
    for (const row of manageItems) {
      const inCategory =
        row.categoryId === editingCategoryId ||
        (catalogIds?.has(row.menuItemId) ?? false);
      if (!inCategory || !row.enabled) continue;
      const normalized = menuPriceToPutString(row.price);
      if (normalized !== null) {
        out[row.menuItemId] = normalized;
      }
    }
    return out;
  }, [editingCategoryId, manageItems, catalogState]);

  const editingPublishedByItemId = useMemo(() => {
    if (!editingCategoryId) return {};
    const catalogIds =
      catalogState.status === "loaded"
        ? new Set(
            catalogState.data.categories
              .find((c) => c.id === editingCategoryId)
              ?.items.map((i) => i.id) ?? [],
          )
        : null;
    const out: Record<string, { price: string; enabled: boolean }> = {};
    for (const row of manageItems) {
      const inCategory =
        row.categoryId === editingCategoryId ||
        (catalogIds?.has(row.menuItemId) ?? false);
      if (!inCategory) continue;
      const normalized = menuPriceToPutString(row.price);
      if (normalized !== null) {
        out[row.menuItemId] = { price: normalized, enabled: row.enabled };
      }
    }
    return out;
  }, [editingCategoryId, manageItems, catalogState]);

  const handleSaveCategoryItems = useCallback(
    async (rows: EditLocationCategoryRow[]) => {
      if (!editingCategoryId) return;
      setSaving(true);
      setSaveError(null);
      try {
        const delta = computeLocationCategoryItemDelta(
          editingInitiallyEnabled,
          rows,
          (price) => menuPriceToPutString(price),
        );

        if (
          delta.add.length === 0 &&
          delta.update.length === 0 &&
          delta.remove.length === 0
        ) {
          setEditingCategoryId(null);
          return;
        }

        const res = await fetch(
          `/api/settings/locations/${encodeURIComponent(restaurant.id)}/menu-items`,
          {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              add: delta.add.length > 0 ? delta.add : undefined,
              update: delta.update.length > 0 ? delta.update : undefined,
              remove: delta.remove.length > 0 ? delta.remove : undefined,
            }),
          },
        );

        if (!res.ok) {
          let detail: string | undefined;
          try {
            const body = (await res.json()) as { message?: string; error?: string };
            const parts = [body?.error, body?.message].filter(
              (x): x is string => typeof x === "string" && x.trim().length > 0,
            );
            if (parts.length) detail = parts.join(" — ");
          } catch {
            /* ignore */
          }
          setSaveError(
            detail ?? t("restaurantDetail.editCategoryItemsSaveFailed"),
          );
          return;
        }

        setManageItems((prev) => {
          const map = new Map(prev.map((r) => [r.menuItemId, r]));
          for (const id of delta.remove) {
            const row = map.get(id);
            if (row) {
              map.set(id, { ...row, enabled: false });
            }
          }
          for (const row of delta.update) {
            const existing = map.get(row.menuItemId);
            map.set(row.menuItemId, {
              ...existing,
              menuItemId: row.menuItemId,
              categoryId: editingCategoryId,
              price: row.price,
              enabled: true,
            });
          }
          for (const row of delta.add) {
            map.set(row.menuItemId, {
              menuItemId: row.menuItemId,
              categoryId: editingCategoryId,
              price: row.price,
              enabled: true,
            });
          }
          return Array.from(map.values());
        });

        setEditingCategoryId(null);
      } catch {
        setSaveError(t("restaurantDetail.editCategoryItemsSaveFailed"));
      } finally {
        setSaving(false);
      }
    },
    [editingCategoryId, editingInitiallyEnabled, restaurant.id, t],
  );

  const handleOpenAdd = useCallback(() => {
    if (addButtonDisabled) return;
    setAddState({ open: true, saving: false, error: null });
  }, [addButtonDisabled]);

  const handleCloseAdd = useCallback(() => {
    setAddState((prev) => (prev.saving ? prev : { ...prev, open: false, error: null }));
  }, []);

  const handleSaveAddCategories = useCallback(
    async (addedIds: string[]) => {
      if (addedIds.length === 0) return;
      const cleanAdded = addedIds.filter(
        (id) => !enabledCategoryIds.includes(id),
      );
      if (cleanAdded.length === 0) {
        setAddState((prev) => ({ ...prev, open: false, error: null }));
        return;
      }
      setAddState((prev) => ({ ...prev, saving: true, error: null }));
      const nextIds = [...enabledCategoryIds, ...cleanAdded];
      try {
        const res = await fetch(
          `/api/settings/locations/${encodeURIComponent(restaurant.id)}/categories`,
          {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categoryIds: nextIds }),
          },
        );
        if (!res.ok) {
          let detail: string | undefined;
          try {
            const body = (await res.json()) as { message?: string };
            if (typeof body?.message === "string") detail = body.message;
          } catch {
            /* ignore */
          }
          setAddState({
            open: true,
            saving: false,
            error: detail ?? t("restaurantDetail.addCategorySaveFailed"),
          });
          return;
        }
        setEnabledCategoryIds(nextIds);
        setAddState({ open: false, saving: false, error: null });
      } catch {
        setAddState({
          open: true,
          saving: false,
          error: t("restaurantDetail.addCategorySaveFailed"),
        });
      }
    },
    [enabledCategoryIds, restaurant.id, t],
  );

  const renderEditButton = useCallback(
    (categoryId: string, name: string) => (
      <button
        type="button"
        onClick={() => handleOpenEdit(categoryId)}
        aria-label={t("restaurantDetail.editCategoryItemsAria", { name })}
        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-foreground/20 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5"
      >
        {t("restaurantDetail.editCategoryItemsButton")}
      </button>
    ),
    [handleOpenEdit, t],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/restaurants"
            className="text-sm font-medium text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
          >
            {`← ${t("restaurantDetail.backToList")}`}
          </Link>
          <Link
            href={`/restaurants/${encodeURIComponent(restaurant.id)}/edit`}
            className="text-sm font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("restaurantDetail.editLocation")}
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-foreground/10 bg-background/80 ring-1 ring-foreground/5">
            {hasLogo ? (
              <Image
                src={restaurant.logoUrl}
                alt={t("restaurants.logoAlt", { name: displayName })}
                width={80}
                height={80}
                className="size-full object-cover"
                sizes="80px"
                priority
                unoptimized={imageSrcIsNonOptimizable(restaurant.logoUrl)}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-lg font-semibold text-foreground/40">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 font-mono text-xs text-foreground/45">{restaurant.id}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {currency ? (
                <span className="inline-flex items-center rounded-full border border-foreground/15 px-2 py-0.5 text-xs font-medium text-foreground/80">
                  {currency}
                </span>
              ) : null}
              {typeof isActive === "boolean" ? (
                <span
                  className={
                    isActive
                      ? "inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200"
                      : "inline-flex items-center rounded-full border border-foreground/15 px-2 py-0.5 text-xs text-foreground/60"
                  }
                >
                  {isActive
                    ? t("restaurantDetail.statusActive")
                    : t("restaurantDetail.statusInactive")}
                </span>
              ) : null}
            </div>
            {restaurant.address.trim().length ? (
              <p className="mt-3 text-sm text-foreground/65">{restaurant.address}</p>
            ) : (
              <p className="mt-3 text-sm text-foreground/45">
                {t("restaurantDetail.noAddress")}
              </p>
            )}
            <p className="mt-3 text-sm text-foreground/50">
              {hasPublishedMenu
                ? t("restaurantDetail.savedMenuNote")
                : t("restaurantDetail.noPublishedMenu")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {t("restaurantDetail.menuHeading")}
          </h2>
          {canShowAddButton ? (
            <button
              type="button"
              onClick={handleOpenAdd}
              disabled={addButtonDisabled}
              aria-disabled={addButtonDisabled}
              title={
                addButtonDisabled
                  ? t("restaurantDetail.addCategoryNoneAvailable")
                  : undefined
              }
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("restaurantDetail.addCategoryButton")}
            </button>
          ) : null}
        </div>
        {toggleError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {toggleError}
          </p>
        ) : null}
        {hasEnabledCategories ? (
          enabledSections.map((section) => (
            <GlobalMenuCategorySection
              key={section.id}
              category={{
                id: section.id,
                name: section.name,
                items: section.items,
              }}
              onEditItem={noopEdit}
              onToggleActive={handleToggleActive}
              onDeleteItem={noopDelete}
              isItemBusy={(itemId) => toggleBusyIds.has(itemId)}
              hideEditButton
              useLocationMenuToggle
              headerActions={renderEditButton(section.id, section.name)}
              emptyMessage={t("restaurantDetail.emptyCategoryHint")}
            />
          ))
        ) : (
          <p className="text-sm text-foreground/55">{t("restaurantDetail.menuEmptyHint")}</p>
        )}
      </div>

      <EditLocationCategoryModal
        open={editingCategoryId !== null}
        categoryId={editingCategoryId}
        categoryName={editingCategoryName}
        currency={restaurant.currency ?? ""}
        catalogItems={editingCatalogItems}
        initiallyEnabledByItemId={editingInitiallyEnabled}
        publishedByItemId={editingPublishedByItemId}
        catalogLoading={catalogState.status === "loading"}
        catalogError={
          catalogState.status === "error" ? catalogState.message : null
        }
        saving={saving}
        saveError={saveError}
        onClose={handleCloseEdit}
        onSave={handleSaveCategoryItems}
      />

      <AddLocationCategoriesModal
        open={addState.open}
        availableCategories={availableToAdd}
        saving={addState.saving}
        saveError={addState.error}
        onClose={handleCloseAdd}
        onSave={handleSaveAddCategories}
      />
    </div>
  );
}
