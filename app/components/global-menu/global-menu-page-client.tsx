"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreatedMenuItemApi, TranslationTextApi } from "@/lib/auth-api";
import {
  getCategoryDisplayForLocale,
  getMenuItemDisplayForLocale,
  withMenuItemDisplayTranslationsSynced,
} from "@/lib/category-locale-display";
import type { GlobalMenuData, MenuItem, MenuSection } from "@/lib/data/global-menu-types";
import { mapGlobalMenuItemApiToMenuItem } from "@/lib/menu/map-global-menu-response";
import { usePersistedGlobalMenu } from "@/hooks/use-persisted-global-menu";
import {
  appendMenuItemMutation,
  applyMenuItemMutations,
  getPendingMenuItemMutations,
  setPendingMenuItemMutations,
} from "@/lib/pending-mutations";
import {
  consumePendingLocationExportWarning,
  readLocationExportWarning,
  tryReadJson,
} from "@/lib/location-export-warning";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { useSerializedAsyncQueue } from "@/lib/use-serialized-async-queue";
import { useI18n } from "../i18n-provider";
import { AddMenuItemButton } from "./add-menu-item-button";
import {
  EditMenuItemModal,
  type MenuItemCategoryOption,
  type MenuItemEditSavePayload,
} from "./edit-menu-item-modal";
import { GlobalMenuCategorySection } from "./global-menu-category-section";
import { GuestTranslationsBatchModal } from "./guest-translations-batch-modal";
import {
  ToastStack,
  type ToastEntry,
} from "@/app/components/ui/toast-stack";

const EMPTY_ITEM_TRANSLATIONS: TranslationTextApi[] = [];
const ITEM_TRANSLATION_NAME_MAX = 200;
const ITEM_TRANSLATION_DESC_MAX = 2000;

function findItem(
  data: GlobalMenuData,
  categoryId: string,
  itemId: string,
): MenuItem | null {
  const cat = data.categories.find((c) => c.id === categoryId);
  return cat?.items.find((i) => i.id === itemId) ?? null;
}

function findItemInAnyCategory(data: GlobalMenuData, itemId: string): MenuItem | null {
  for (const c of data.categories) {
    const m = c.items.find((i) => i.id === itemId);
    if (m) return m;
  }
  return null;
}

function findCategoryIdForItem(data: GlobalMenuData, itemId: string): string | null {
  for (const c of data.categories) {
    if (c.items.some((i) => i.id === itemId)) return c.id;
  }
  return null;
}

/** Remove `itemId` from every category, then attach `nextItem` under `targetCategoryId`. */
function replaceItemInCatalog(
  prev: GlobalMenuData,
  targetCategoryId: string,
  itemId: string,
  nextItem: MenuItem,
): GlobalMenuData {
  return {
    categories: prev.categories.map((c) => {
      const filtered = c.items.filter((i) => i.id !== itemId);
      if (c.id === targetCategoryId) {
        return { ...c, items: [...filtered, nextItem] };
      }
      return { ...c, items: filtered };
    }),
  };
}

type GlobalMenuPageClientProps = {
  menuSection: MenuSection;
  initialData: GlobalMenuData;
  /** Error code or message from server when menu could not be loaded. */
  loadError?: string | null;
};

function categoryMatchesSection(
  category: GlobalMenuData["categories"][number],
  menuSection: MenuSection,
): boolean {
  return (category.menuSection ?? "dishes") === menuSection;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;
  return payload?.message ?? payload?.error ?? fallback;
}

export function GlobalMenuPageClient({
  menuSection,
  initialData,
  loadError,
}: GlobalMenuPageClientProps) {
  const { t, locale } = useI18n();
  const enqueueToggle = useSerializedAsyncQueue();
  const { data, setData } = usePersistedGlobalMenu(initialData, { persistDraft: false });
  const [editor, setEditor] = useState<{
    categoryId: string;
    itemId: string;
  } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<Record<string, true>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    categoryId: string;
    itemId: string;
    name: string;
  } | null>(null);
  const [translationsTarget, setTranslationsTarget] = useState<{
    categoryId: string;
    itemId: string;
  } | null>(null);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

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

  const withItemLock = useCallback(async (itemId: string, fn: () => Promise<void>) => {
    setPendingItems((prev) => ({ ...prev, [itemId]: true }));
    try {
      await fn();
    } finally {
      setPendingItems((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }, []);

  const isItemBusy = useCallback(
    (itemId: string) => isSavingEdit || pendingItems[itemId] === true,
    [isSavingEdit, pendingItems],
  );

  const editingItem = useMemo(() => {
    if (!editor) return null;
    return findItemInAnyCategory(data, editor.itemId);
  }, [data, editor]);
  const isEditorSaving = editor ? isItemBusy(editor.itemId) : false;

  const visibleCategories = useMemo(
    () => data.categories.filter((c) => categoryMatchesSection(c, menuSection)),
    [data.categories, menuSection],
  );

  const categoryOptions: MenuItemCategoryOption[] = useMemo(
    () =>
      visibleCategories.map((c) => ({
        id: c.id,
        label: getCategoryDisplayForLocale(
          c.name,
          c.description,
          c.translations,
          locale,
        ).name,
      })),
    [visibleCategories, locale],
  );

  const itemTranslationsModalItem = useMemo(() => {
    if (!translationsTarget) return null;
    return findItemInAnyCategory(data, translationsTarget.itemId);
  }, [data, translationsTarget]);

  useEffect(() => {
    if (!editor) return;
    const stillThere = data.categories.some((c) => c.items.some((i) => i.id === editor.itemId));
    if (!stillThere) {
      setEditor(null);
    }
  }, [data, editor]);

  useEffect(() => {
    if (!translationsTarget) return;
    if (!findItemInAnyCategory(data, translationsTarget.itemId)) {
      setTranslationsTarget(null);
    }
  }, [data, translationsTarget]);

  // Overlay any pending create / edit / delete / toggle mutations queued from
  // this client (in sessionStorage) on top of the freshly arrived server
  // snapshot. usePersistedGlobalMenu resets `data` to `initialData` whenever
  // the prop reference changes, so we re-apply the overlay then. Each mutation
  // retires automatically once the server's content matches it.
  useEffect(() => {
    const pending = getPendingMenuItemMutations();
    if (pending.length === 0) return;

    const { data: applied, retained } = applyMenuItemMutations(initialData, pending);
    if (retained.length !== pending.length) {
      setPendingMenuItemMutations(retained);
    }
    if (retained.length > 0) {
      setData(applied);
    }
  }, [initialData, setData]);

  useEffect(() => {
    const pending = consumePendingLocationExportWarning();
    if (pending) setExportWarning(pending);
  }, []);

  const patchItem = useCallback(
    (categoryId: string, itemId: string, updater: (prev: MenuItem) => MenuItem) => {
      setData((prev) => ({
        categories: prev.categories.map((c) =>
          c.id !== categoryId
            ? c
            : {
                ...c,
                items: c.items.map((i) => (i.id !== itemId ? i : updater(i))),
              },
        ),
      }));
    },
    [setData],
  );

  const handleToggleActive = useCallback(
    (categoryId: string, itemId: string) => {
      if (isSavingEdit) return;
      if (isItemBusy(itemId)) return;
      setRequestError(null);
      setExportWarning(null);
      const current = findItem(data, categoryId, itemId);
      if (!current) return;
      const currentlyOn = current.active !== false;
      const nextActive = !currentlyOn;
      const optimistic: MenuItem = { ...current, active: nextActive };
      const itemName = getMenuItemDisplayForLocale(
        current.name,
        current.description,
        current.translations,
        locale,
      ).name;
      const toastId = `toggle-${itemId}`;

      patchItem(categoryId, itemId, () => optimistic);
      upsertToast({
        id: toastId,
        variant: "loading",
        message: nextActive
          ? t("global.itemToggleEnabling", { name: itemName })
          : t("global.itemToggleDisabling", { name: itemName }),
      });

      void enqueueToggle(async () => {
        await withItemLock(itemId, async () => {
        try {
          const response = await fetch(
            `/api/settings/menu-items/${encodeURIComponent(itemId)}/activation`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive: nextActive }),
            },
          );
          if (!response.ok) {
            patchItem(categoryId, itemId, (i) => ({ ...i, active: currentlyOn }));
            const detail = await readErrorMessage(
              response,
              t("global.itemToggleFailed", { name: itemName }),
            );
            upsertToast({
              id: toastId,
              variant: "error",
              message: detail,
              durationMs: 6000,
            });
            return;
          }
          appendMenuItemMutation({ kind: "upsert", categoryId, item: optimistic });
          setExportWarning(readLocationExportWarning(await tryReadJson(response), t));
          upsertToast({
            id: toastId,
            variant: "success",
            message: nextActive
              ? t("global.itemToggleEnabled", { name: itemName })
              : t("global.itemToggleDisabled", { name: itemName }),
            durationMs: 3500,
          });
        } catch {
          patchItem(categoryId, itemId, (i) => ({ ...i, active: currentlyOn }));
          upsertToast({
            id: toastId,
            variant: "error",
            message: t("global.itemToggleFailed", { name: itemName }),
            durationMs: 6000,
          });
        }
        });
      });
    },
    [
      data,
      enqueueToggle,
      isItemBusy,
      isSavingEdit,
      locale,
      patchItem,
      t,
      upsertToast,
      withItemLock,
    ],
  );

  const handleSaveEdit = useCallback(
    (payload: MenuItemEditSavePayload) => {
      if (!editor) return;
      const sourceCategoryId = editor.categoryId;
      const { itemId } = editor;
      if (isSavingEdit) return;
      if (isItemBusy(itemId)) return;
      const previous = findItemInAnyCategory(data, itemId);
      if (!previous) return;
      setRequestError(null);
      setExportWarning(null);

      const textFieldsChanged =
        previous.name !== payload.name.trim() ||
        (previous.description?.trim() || "") !== payload.description.trim();

      const buildOptimistic = (imageValue: string): MenuItem => {
        const first = previous.prices[0];
        const rest = previous.prices.slice(1);
        const newFirst = first
          ? { ...first, price: payload.price, currency: payload.currency }
          : { id: `local-${itemId}`, price: payload.price, currency: payload.currency };
        let next: MenuItem = {
          ...previous,
          name: payload.name,
          description: payload.description,
          prices: [newFirst, ...rest],
          translations: previous.translations,
        };
        const grammVal = payload.gramm.trim();
        if (grammVal) next.gramm = grammVal;
        else delete next.gramm;
        const img = imageValue.trim();
        if (img) next.image = img;
        else delete next.image;
        if (textFieldsChanged) {
          next = withMenuItemDisplayTranslationsSynced(
            next,
            payload.name,
            payload.description,
          );
        }
        return next;
      };

      setIsSavingEdit(true);
      void withItemLock(itemId, async () => {
        let resolvedImage = payload.image.trim();
        let optimistic: MenuItem | null = null;
        try {
          if (payload.imageFile) {
            resolvedImage = await uploadFileToR2(payload.imageFile, "menu-item");
          }

          optimistic = buildOptimistic(resolvedImage);
          if (payload.categoryId === sourceCategoryId) {
            patchItem(sourceCategoryId, itemId, () => optimistic!);
          } else {
            setData((prev) => replaceItemInCatalog(prev, payload.categoryId, itemId, optimistic!));
          }

          const response = await fetch(`/api/settings/menu-items/${encodeURIComponent(itemId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.name,
              description: payload.description,
              gramm: payload.gramm.trim() || null,
              image: resolvedImage || null,
              price: payload.price,
              currency: payload.currency,
              categoryId: payload.categoryId,
            }),
          });
          if (!response.ok) {
            if (payload.categoryId === sourceCategoryId) {
              patchItem(sourceCategoryId, itemId, () => previous);
            } else {
              setData((prev) => replaceItemInCatalog(prev, sourceCategoryId, itemId, previous));
            }
            setRequestError(await readErrorMessage(response, t("global.errSaveItem")));
            return;
          }

          const json = await tryReadJson(response);
          setExportWarning(readLocationExportWarning(json, t));

          const apiTextFieldsChanged =
            json &&
            typeof json === "object" &&
            "meta" in json &&
            typeof (json as { meta?: unknown }).meta === "object" &&
            (json as { meta: { textFieldsChanged?: unknown } }).meta?.textFieldsChanged ===
              true;

          let itemForMutation = optimistic!;
          let categoryForMutation = payload.categoryId;
          const rawItem =
            json && typeof json === "object" && "item" in json
              ? (json as { item: unknown }).item
              : null;
          if (
            rawItem &&
            typeof rawItem === "object" &&
            "id" in rawItem &&
            typeof (rawItem as { id: unknown }).id === "string"
          ) {
            const apiItem = rawItem as CreatedMenuItemApi;
            itemForMutation = mapGlobalMenuItemApiToMenuItem(apiItem);
            if (apiTextFieldsChanged || textFieldsChanged) {
              itemForMutation = withMenuItemDisplayTranslationsSynced(
                itemForMutation,
                payload.name,
                payload.description,
              );
            }
            if (typeof apiItem.categoryId === "string" && apiItem.categoryId.length > 0) {
              categoryForMutation = apiItem.categoryId;
            }
            const inPlaceEdit =
              categoryForMutation === sourceCategoryId &&
              payload.categoryId === sourceCategoryId;
            if (inPlaceEdit) {
              patchItem(sourceCategoryId, itemId, () => itemForMutation);
            } else {
              setData((prev) =>
                replaceItemInCatalog(prev, categoryForMutation, itemId, itemForMutation),
              );
            }
          }

          appendMenuItemMutation({
            kind: "upsert",
            categoryId: categoryForMutation,
            item: itemForMutation,
          });
          setEditor(null);
        } catch {
          if (payload.categoryId === sourceCategoryId) {
            patchItem(sourceCategoryId, itemId, () => previous);
          } else {
            setData((prev) => replaceItemInCatalog(prev, sourceCategoryId, itemId, previous));
          }
          setRequestError(t("global.errSaveItemNetwork"));
        } finally {
          setIsSavingEdit(false);
        }
      });
    },
    [data, editor, isItemBusy, isSavingEdit, patchItem, setData, t, withItemLock],
  );

  const handleOpenItemTranslations = useCallback((categoryId: string, itemId: string) => {
    if (isSavingEdit) return;
    if (isItemBusy(itemId)) return;
    setTranslationsTarget({ categoryId, itemId });
  }, [isItemBusy, isSavingEdit]);

  const handleItemTranslationsSaved = useCallback(
    (payload: Record<string, unknown> | null) => {
      if (!translationsTarget) return;
      const { itemId } = translationsTarget;
      setExportWarning(readLocationExportWarning(payload, t));
      const raw = payload?.item;
      if (
        raw &&
        typeof raw === "object" &&
        "id" in raw &&
        typeof (raw as { id: unknown }).id === "string"
      ) {
        const item = mapGlobalMenuItemApiToMenuItem(raw as CreatedMenuItemApi);
        const categoryId =
          findCategoryIdForItem(data, itemId) ?? translationsTarget.categoryId;
        appendMenuItemMutation({ kind: "upsert", categoryId, item });
        patchItem(categoryId, itemId, () => item);
      }
      setTranslationsTarget(null);
    },
    [data, patchItem, t, translationsTarget],
  );

  const handleRequestDelete = useCallback(
    (categoryId: string, itemId: string) => {
      if (isSavingEdit) return;
      const item = findItem(data, categoryId, itemId);
      if (!item || isItemBusy(itemId)) return;
      const display = getMenuItemDisplayForLocale(
        item.name,
        item.description,
        item.translations,
        locale,
      );
      setDeleteTarget({ categoryId, itemId, name: display.name });
    },
    [data, isItemBusy, isSavingEdit, locale],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (isItemBusy(deleteTarget.itemId)) return;
    setRequestError(null);
    setExportWarning(null);
    const target = deleteTarget;

    void withItemLock(target.itemId, async () => {
      try {
        const response = await fetch(
          `/api/settings/menu-items/${encodeURIComponent(target.itemId)}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          setRequestError(await readErrorMessage(response, t("global.errDeleteItem")));
          return;
        }
        appendMenuItemMutation({
          kind: "delete",
          categoryId: target.categoryId,
          id: target.itemId,
        });
        setExportWarning(readLocationExportWarning(await tryReadJson(response), t));
        setDeleteTarget(null);
        setData((prev) => ({
          categories: prev.categories.map((c) =>
            c.id !== target.categoryId
              ? c
              : {
                  ...c,
                  items: c.items.filter((i) => i.id !== target.itemId),
                },
          ),
        }));
      } catch {
        setRequestError(t("global.errDeleteItemNetwork"));
      }
    });
  }, [deleteTarget, isItemBusy, setData, t, withItemLock]);

  const errorText = requestError ?? loadError;
  const errorBanner =
    errorText != null && errorText.length > 0 ? (
      <div
        role="alert"
        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-foreground"
      >
        <p className="font-medium">
          {requestError ? t("global.requestFailed") : t("global.couldNotLoadMenu")}
        </p>
        <p className="mt-1 text-foreground/80">
          {errorText === "unauthorized" ? t("global.loadErrorUnauthorized") : errorText}
        </p>
      </div>
    ) : null;

  const exportWarningBanner =
    exportWarning != null && exportWarning.length > 0 ? (
      <div
        role="status"
        className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
      >
        <p>{exportWarning}</p>
        <button
          type="button"
          onClick={() => setExportWarning(null)}
          aria-label={t("common.close")}
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-foreground/65 hover:bg-foreground/5"
        >
          ×
        </button>
      </div>
    ) : null;

  const pageTitle =
    menuSection === "beverages" ? t("global.titleBeverages") : t("global.titleDishes");
  const pageSubtitle =
    menuSection === "beverages" ? t("global.subtitleBeverages") : t("global.subtitleDishes");

  const emptyState =
    loadError == null && visibleCategories.length === 0 ? (
      <div className="rounded-2xl border border-foreground/10 bg-background/40 px-5 py-12 text-center text-sm text-foreground/70">
        {t("global.emptyMenu")}
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {errorBanner}
      {exportWarningBanner}
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{pageTitle}</h1>
          <p className="mt-2 text-sm text-foreground/60">{pageSubtitle}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:pt-0.5">
          <Link
            href="/global-menu/categories/dishes"
            className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl border border-foreground/15 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-foreground/5 transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {t("global.manageCategories")}
          </Link>
          <AddMenuItemButton menuSection={menuSection} />
        </div>
      </div>

      <div className="space-y-5">
        {emptyState}
        {visibleCategories.map((category) => (
          <GlobalMenuCategorySection
            key={category.id}
            category={category}
            onEditItem={(categoryId, itemId) => {
              if (isSavingEdit) return;
              setEditor({ categoryId, itemId });
            }}
            onEditItemTranslations={handleOpenItemTranslations}
            onToggleActive={handleToggleActive}
            onDeleteItem={handleRequestDelete}
            isItemBusy={isItemBusy}
            showAddItemButton
          />
        ))}
      </div>

      {editor ? (
        <EditMenuItemModal
          open={editingItem != null}
          item={editingItem}
          initialCategoryId={editor.categoryId}
          categoryOptions={categoryOptions}
          saving={isEditorSaving}
          onClose={() => {
            if (isSavingEdit) return;
            setEditor(null);
          }}
          onSave={handleSaveEdit}
        />
      ) : null}

      {itemTranslationsModalItem != null && translationsTarget != null ? (
        <GuestTranslationsBatchModal
          key={translationsTarget.itemId}
          open
          entityId={translationsTarget.itemId}
          title={t("categories.translationsModal.title", {
            name: getMenuItemDisplayForLocale(
              itemTranslationsModalItem.name,
              itemTranslationsModalItem.description,
              itemTranslationsModalItem.translations,
              locale,
            ).name,
          })}
          saveUrl={`/api/settings/menu-items/${encodeURIComponent(translationsTarget.itemId)}/translations`}
          nameMaxLength={ITEM_TRANSLATION_NAME_MAX}
          descriptionMaxLength={ITEM_TRANSLATION_DESC_MAX}
          initialTranslations={
            itemTranslationsModalItem.translations ?? EMPTY_ITEM_TRANSLATIONS
          }
          onClose={() => setTranslationsTarget(null)}
          onSaved={handleItemTranslationsSaved}
        />
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label={t("common.close")}
            onClick={() => setDeleteTarget(null)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-item-title"
            className="relative z-10 w-full max-w-md rounded-t-2xl border border-foreground/10 bg-background/95 p-5 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
          >
            <h2 id="delete-item-title" className="text-lg font-semibold text-foreground">
              {t("global.deleteItemQuestion")}
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              {t("global.deleteItemBody", { name: deleteTarget.name })}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-11 flex-1 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isItemBusy(deleteTarget.itemId)}
                className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-red-700"
              >
                {isItemBusy(deleteTarget.itemId) ? t("global.deletingItem") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
