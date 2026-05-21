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
import {
  ToastStack,
  type ToastEntry,
} from "@/app/components/ui/toast-stack";
import { useSerializedAsyncQueue } from "@/lib/use-serialized-async-queue";
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
import { ReorderLocationCategoriesModal } from "./reorder-location-categories-modal";

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
  items: MenuItem[];
};

type ReorderCategoryState = {
  open: boolean;
  saving: boolean;
  error: string | null;
};

async function patchLocationCategories(
  locationId: string,
  categoryIds: string[],
): Promise<{ ok: true } | { ok: false; message?: string }> {
  try {
    const res = await fetch(
      `/api/settings/locations/${encodeURIComponent(locationId)}/categories`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryIds }),
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
      return { ok: false, message: detail };
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

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
  if (catalogItem?.gramm) item.gramm = catalogItem.gramm;
  const resolvedGramm =
    row.resolvedGramm ??
    (row.grammUseDefault !== false
      ? catalogItem?.gramm
      : row.gramm);
  if (resolvedGramm?.trim()) item.resolvedGramm = resolvedGramm.trim();
  if (row.grammUseDefault !== undefined) item.grammUseDefault = row.grammUseDefault;
  const resolvedImage =
    row.resolvedImage ??
    (row.imageUseDefault !== false
      ? row.globalImage ?? catalogItem?.image
      : row.image);
  if (resolvedImage?.trim()) item.resolvedImage = resolvedImage.trim();
  if (row.imageUseDefault !== undefined) item.imageUseDefault = row.imageUseDefault;
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
  const enqueueToggle = useSerializedAsyncQueue();
  const [catalog] = useState<GlobalMenuData>(() => structuredClone(initialCatalog));
  const [manageItems, setManageItems] = useState<LocationMenuItemRow[]>(
    () => initialManageItems,
  );
  const [toggleBusyIds, setToggleBusyIds] = useState<Set<string>>(() => new Set());
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
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
  const [reorderState, setReorderState] = useState<ReorderCategoryState>({
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
        items,
      });
    }
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

  const modalCategories: AvailableCategory[] = useMemo(() => {
    return categoriesCatalog
      .map((c) => ({ id: c.id, name: c.name, itemsCount: c.itemsCount }))
      .sort(
        (a, b) =>
          (catalogById.get(a.id)?.sortOrder ?? 0) -
            (catalogById.get(b.id)?.sortOrder ?? 0) ||
          a.name.localeCompare(b.name),
      );
  }, [categoriesCatalog, catalogById]);

  const canShowAddButton = categoriesCatalog.length > 0;
  const canReorderCategories = enabledCategoryIds.length >= 2;

  const reorderableCategories = useMemo(
    () =>
      enabledCategoryIds.map((id) => {
        const cat = catalogById.get(id);
        const catalogCategory = catalogCategoriesById.get(id);
        return {
          id,
          name: cat?.name ?? catalogCategory?.name ?? id,
        };
      }),
    [enabledCategoryIds, catalogById, catalogCategoriesById],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const upsertToast = useCallback((entry: ToastEntry) => {
    setToasts((prev) => {
      const idx = prev.findIndex((toast) => toast.id === entry.id);
      if (idx < 0) return [...prev, entry];
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  }, []);

  const resolveItemName = useCallback(
    (itemId: string) => catalogItemsById.get(itemId)?.name ?? itemId,
    [catalogItemsById],
  );

  const handleToggleActive = useCallback(
    (categoryId: string, itemId: string) => {
      if (toggleBusyIds.has(itemId)) return;

      const currentlyOn = manageByItemId.get(itemId)?.enabled === true;
      const nextEnabled = !currentlyOn;
      const itemName = resolveItemName(itemId);
      const toastId = `toggle-${itemId}`;

      setToggleBusyIds((prev) => new Set(prev).add(itemId));
      upsertToast({
        id: toastId,
        variant: "loading",
        message: nextEnabled
          ? t("restaurantDetail.itemToggleEnabling", { name: itemName })
          : t("restaurantDetail.itemToggleDisabling", { name: itemName }),
      });

      void enqueueToggle(async () => {
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
            upsertToast({
              id: toastId,
              variant: "error",
              message:
                detail ??
                t("restaurantDetail.itemToggleFailed", { name: itemName }),
              durationMs: 6000,
            });
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

          upsertToast({
            id: toastId,
            variant: "success",
            message: body.enabled
              ? t("restaurantDetail.itemToggleEnabled", { name: itemName })
              : t("restaurantDetail.itemToggleDisabled", { name: itemName }),
            durationMs: 3500,
          });
        } catch {
          upsertToast({
            id: toastId,
            variant: "error",
            message: t("restaurantDetail.itemToggleFailed", { name: itemName }),
            durationMs: 6000,
          });
        } finally {
          setToggleBusyIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }
      });
    },
    [
      enqueueToggle,
      manageByItemId,
      resolveItemName,
      restaurant.id,
      t,
      toggleBusyIds,
      upsertToast,
    ],
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
    const out: Record<
      string,
      {
        price: string;
        enabled: boolean;
        grammUseDefault?: boolean;
        gramm?: string;
        imageUseDefault?: boolean;
        image?: string;
      }
    > = {};
    for (const row of manageItems) {
      const inCategory =
        row.categoryId === editingCategoryId ||
        (catalogIds?.has(row.menuItemId) ?? false);
      if (!inCategory) continue;
      const normalized = menuPriceToPutString(row.price);
      if (normalized !== null) {
        out[row.menuItemId] = {
          price: normalized,
          enabled: row.enabled,
          grammUseDefault: row.grammUseDefault,
          gramm: row.gramm,
          imageUseDefault: row.imageUseDefault,
          image: row.image,
        };
      }
    }
    return out;
  }, [editingCategoryId, manageItems, catalogState]);

  const editingPublishedGrammByItemId = useMemo(() => {
    const out: Record<string, { grammUseDefault: boolean; gramm?: string }> = {};
    for (const [id, row] of Object.entries(editingPublishedByItemId)) {
      if (!row.enabled) continue;
      out[id] = {
        grammUseDefault: row.grammUseDefault !== false,
        gramm: row.gramm,
      };
    }
    return out;
  }, [editingPublishedByItemId]);

  const editingPublishedImageByItemId = useMemo(() => {
    const out: Record<string, { imageUseDefault: boolean; image?: string }> = {};
    for (const [id, row] of Object.entries(editingPublishedByItemId)) {
      if (!row.enabled) continue;
      out[id] = {
        imageUseDefault: row.imageUseDefault !== false,
        image: row.image,
      };
    }
    return out;
  }, [editingPublishedByItemId]);

  const handleSaveCategoryItems = useCallback(
    async (rows: EditLocationCategoryRow[]) => {
      if (!editingCategoryId) return;
      setSaving(true);
      setSaveError(null);
      try {
        const delta = computeLocationCategoryItemDelta(
          editingInitiallyEnabled,
          editingPublishedGrammByItemId,
          editingPublishedImageByItemId,
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
              grammUseDefault: row.grammUseDefault,
              gramm: row.grammUseDefault ? undefined : row.gramm,
              imageUseDefault: row.imageUseDefault,
              image: row.imageUseDefault ? undefined : row.image,
            });
          }
          for (const row of delta.add) {
            map.set(row.menuItemId, {
              menuItemId: row.menuItemId,
              categoryId: editingCategoryId,
              price: row.price,
              enabled: true,
              grammUseDefault: row.grammUseDefault,
              gramm: row.grammUseDefault ? undefined : row.gramm,
              imageUseDefault: row.imageUseDefault,
              image: row.imageUseDefault ? undefined : row.image,
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
    [
      editingCategoryId,
      editingInitiallyEnabled,
      editingPublishedGrammByItemId,
      editingPublishedImageByItemId,
      restaurant.id,
      t,
    ],
  );

  const handleOpenAdd = useCallback(() => {
    setAddState({ open: true, saving: false, error: null });
  }, []);

  const handleCloseAdd = useCallback(() => {
    setAddState((prev) => (prev.saving ? prev : { ...prev, open: false, error: null }));
  }, []);

  const handleSaveAddCategories = useCallback(
    async (selectedIds: string[]) => {
      const selectedSet = new Set(selectedIds);
      const nextIds = categoriesCatalog
        .filter((c) => selectedSet.has(c.id))
        .map((c) => c.id);
      const unchanged =
        nextIds.length === enabledCategoryIds.length &&
        nextIds.every((id, i) => id === enabledCategoryIds[i]);
      if (unchanged) {
        setAddState((prev) => ({ ...prev, open: false, error: null }));
        return;
      }
      setAddState((prev) => ({ ...prev, saving: true, error: null }));
      const result = await patchLocationCategories(restaurant.id, nextIds);
      if (!result.ok) {
        setAddState({
          open: true,
          saving: false,
          error: result.message ?? t("restaurantDetail.addCategorySaveFailed"),
        });
        return;
      }
      setEnabledCategoryIds(nextIds);
      setAddState({ open: false, saving: false, error: null });
    },
    [categoriesCatalog, enabledCategoryIds, restaurant.id, t],
  );

  const handleOpenReorder = useCallback(() => {
    if (!canReorderCategories) return;
    setReorderState({ open: true, saving: false, error: null });
  }, [canReorderCategories]);

  const handleCloseReorder = useCallback(() => {
    setReorderState((prev) =>
      prev.saving ? prev : { ...prev, open: false, error: null },
    );
  }, []);

  const handleSaveReorder = useCallback(
    async (orderedIds: string[]) => {
      const unchanged =
        orderedIds.length === enabledCategoryIds.length &&
        orderedIds.every((id, i) => id === enabledCategoryIds[i]);
      if (unchanged) {
        setReorderState((prev) => ({ ...prev, open: false, error: null }));
        return;
      }
      setReorderState((prev) => ({ ...prev, saving: true, error: null }));
      const result = await patchLocationCategories(restaurant.id, orderedIds);
      if (!result.ok) {
        setReorderState({
          open: true,
          saving: false,
          error: result.message ?? t("restaurantDetail.reorderCategoriesSaveFailed"),
        });
        return;
      }
      setEnabledCategoryIds(orderedIds);
      setReorderState({ open: false, saving: false, error: null });
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
          <div className="flex flex-wrap items-center gap-2">
            {canReorderCategories ? (
              <button
                type="button"
                onClick={handleOpenReorder}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-background/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
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
                    d="M4 8h16M4 16h16"
                  />
                </svg>
                {t("restaurantDetail.reorderCategoriesButton")}
              </button>
            ) : null}
            {canShowAddButton ? (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
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
        categories={modalCategories}
        initialSelectedIds={enabledCategoryIds}
        saving={addState.saving}
        saveError={addState.error}
        onClose={handleCloseAdd}
        onSave={handleSaveAddCategories}
      />

      <ReorderLocationCategoriesModal
        open={reorderState.open}
        categories={reorderableCategories}
        initialOrderIds={enabledCategoryIds}
        saving={reorderState.saving}
        saveError={reorderState.error}
        onClose={handleCloseReorder}
        onSave={handleSaveReorder}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
