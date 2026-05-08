"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import type {
  GlobalMenuItemApi,
  GlobalMenuResponse,
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
  initialMenu: GlobalMenuData;
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

export function RestaurantDetailClient({
  restaurant,
  initialMenu,
  enabledCategoryIds: initialEnabledCategoryIds,
  categoriesCatalog,
}: RestaurantDetailClientProps) {
  const { t } = useI18n();
  const [menu, setMenu] = useState<GlobalMenuData>(() =>
    structuredClone(initialMenu),
  );
  const [enabledCategoryIds, setEnabledCategoryIds] = useState<string[]>(
    () => initialEnabledCategoryIds,
  );
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catalogState, setCatalogState] = useState<CatalogState>({ status: "idle" });
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

  const menuByCategoryId = useMemo(() => {
    const m = new Map<string, MenuCategory>();
    for (const c of menu.categories) m.set(c.id, c);
    return m;
  }, [menu]);

  const enabledSections: EnabledSection[] = useMemo(() => {
    const sections: EnabledSection[] = [];
    for (const id of enabledCategoryIds) {
      const cat = catalogById.get(id);
      const fromMenu = menuByCategoryId.get(id);
      if (!cat && !fromMenu) continue;
      sections.push({
        id,
        name: cat?.name ?? fromMenu?.name ?? id,
        sortOrder: cat?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        items: fromMenu?.items ?? [],
      });
    }
    sections.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    return sections;
  }, [enabledCategoryIds, catalogById, menuByCategoryId]);

  const hasEnabledCategories = enabledSections.length > 0;
  const hasPublishedMenu = enabledSections.some((s) => s.items.length > 0);

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

  const handleToggleActive = useCallback((categoryId: string, itemId: string) => {
    setMenu((prev) => ({
      categories: prev.categories.map((c) =>
        c.id !== categoryId
          ? c
          : {
              ...c,
              items: c.items.map((i) => {
                if (i.id !== itemId) return i;
                const on = i.active !== false;
                return { ...i, active: !on };
              }),
            },
      ),
    }));
  }, []);

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
    const fromMenu = menuByCategoryId.get(editingCategoryId);
    return fromMenu?.name ?? editingCategoryId;
  }, [editingCategoryId, catalogById, menuByCategoryId]);

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
    const fromMenu = menuByCategoryId.get(editingCategoryId);
    if (!fromMenu) return {};
    const out: Record<string, string> = {};
    for (const item of fromMenu.items) {
      const price = item.prices[0]?.price;
      if (typeof price === "string" && price.length > 0) {
        out[item.id] = price;
      }
    }
    return out;
  }, [editingCategoryId, menuByCategoryId]);

  const handleSaveCategoryItems = useCallback(
    async (rows: EditLocationCategoryRow[]) => {
      if (!editingCategoryId) return;
      setSaving(true);
      setSaveError(null);
      try {
        const mergedItems: { menuItemId: string; price: string }[] = [];
        for (const section of enabledSections) {
          if (section.id === editingCategoryId) continue;
          for (const item of section.items) {
            const price = item.prices[0]?.price;
            if (typeof price !== "string" || price.length === 0) continue;
            mergedItems.push({ menuItemId: item.id, price });
          }
        }
        for (const row of rows) {
          mergedItems.push({ menuItemId: row.menuItemId, price: row.price });
        }

        if (mergedItems.length === 0) {
          setSaveError(t("restaurantDetail.editCategoryItemsRequireAtLeastOne"));
          return;
        }

        const res = await fetch(
          `/api/settings/locations/${encodeURIComponent(restaurant.id)}/menu-items`,
          {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: mergedItems }),
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
          setSaveError(
            detail ?? t("restaurantDetail.editCategoryItemsSaveFailed"),
          );
          return;
        }

        const catalogItemById = new Map<string, GlobalMenuItemApi>();
        for (const item of editingCatalogItems) catalogItemById.set(item.id, item);

        const updatedItems: MenuItem[] = rows.map((row) => {
          const catalogItem = catalogItemById.get(row.menuItemId);
          const item: MenuItem = {
            id: row.menuItemId,
            name: catalogItem?.name ?? row.menuItemId,
            prices: [
              {
                id: `local-${row.menuItemId}`,
                price: row.price,
                currency: restaurant.currency ?? "",
              },
            ],
          };
          if (catalogItem) {
            if (typeof catalogItem.active === "boolean") {
              item.active = catalogItem.active;
            }
            if (catalogItem.image) item.image = catalogItem.image;
            if (catalogItem.description) item.description = catalogItem.description;
            if (catalogItem.tags?.length) item.tags = catalogItem.tags;
          }
          return item;
        });

        setMenu((prev) => {
          const seen = prev.categories.some((c) => c.id === editingCategoryId);
          const nextCategories = seen
            ? prev.categories.map((c) =>
                c.id === editingCategoryId ? { ...c, items: updatedItems } : c,
              )
            : [
                ...prev.categories,
                {
                  id: editingCategoryId,
                  name: editingCategoryName,
                  items: updatedItems,
                },
              ];
          return { categories: nextCategories };
        });

        setEditingCategoryId(null);
      } catch {
        setSaveError(t("restaurantDetail.editCategoryItemsSaveFailed"));
      } finally {
        setSaving(false);
      }
    },
    [
      editingCategoryId,
      editingCategoryName,
      editingCatalogItems,
      enabledSections,
      restaurant.id,
      restaurant.currency,
      t,
    ],
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
              hideEditButton
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
