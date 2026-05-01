"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GlobalMenuData, MenuItem } from "@/lib/data/global-menu-types";
import { usePersistedGlobalMenu } from "@/hooks/use-persisted-global-menu";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { useI18n } from "../i18n-provider";
import { AddMenuItemButton } from "./add-menu-item-button";
import { EditMenuItemModal, type MenuItemEditSavePayload } from "./edit-menu-item-modal";
import { GlobalMenuCategorySection } from "./global-menu-category-section";

function findItem(
  data: GlobalMenuData,
  categoryId: string,
  itemId: string,
): MenuItem | null {
  const cat = data.categories.find((c) => c.id === categoryId);
  return cat?.items.find((i) => i.id === itemId) ?? null;
}

type GlobalMenuPageClientProps = {
  initialData: GlobalMenuData;
  /** Error code or message from server when menu could not be loaded. */
  loadError?: string | null;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;
  return payload?.message ?? payload?.error ?? fallback;
}

export function GlobalMenuPageClient({ initialData, loadError }: GlobalMenuPageClientProps) {
  const { t } = useI18n();
  const { data, setData } = usePersistedGlobalMenu(initialData, { persistDraft: false });
  const [editor, setEditor] = useState<{
    categoryId: string;
    itemId: string;
  } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<Record<string, true>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    categoryId: string;
    itemId: string;
    name: string;
  } | null>(null);

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
    return findItem(data, editor.categoryId, editor.itemId);
  }, [data, editor]);
  const isEditorSaving = editor ? isItemBusy(editor.itemId) : false;

  useEffect(() => {
    if (!editor) return;
    if (!findItem(data, editor.categoryId, editor.itemId)) {
      setEditor(null);
    }
  }, [data, editor]);

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
      const current = findItem(data, categoryId, itemId);
      if (!current) return;
      const currentlyOn = current.active !== false;
      const nextActive = !currentlyOn;

      patchItem(categoryId, itemId, (i) => ({ ...i, active: nextActive }));

      void withItemLock(itemId, async () => {
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
            setRequestError(
              await readErrorMessage(response, t("global.errUpdateItemActivation")),
            );
          }
        } catch {
          patchItem(categoryId, itemId, (i) => ({ ...i, active: currentlyOn }));
          setRequestError(t("global.errUpdateItemActivationNetwork"));
        }
      });
    },
    [data, isItemBusy, isSavingEdit, patchItem, t, withItemLock],
  );

  const handleSaveEdit = useCallback(
    (payload: MenuItemEditSavePayload) => {
      if (!editor) return;
      const { categoryId, itemId } = editor;
      if (isSavingEdit) return;
      if (isItemBusy(itemId)) return;
      const previous = findItem(data, categoryId, itemId);
      if (!previous) return;
      setRequestError(null);

      const applyLocalPatch = (imageValue: string) =>
        patchItem(categoryId, itemId, (i) => {
        const first = i.prices[0];
        const rest = i.prices.slice(1);
        const newFirst = first
          ? {
              ...first,
              price: payload.price,
              currency: payload.currency,
            }
          : {
              id: `local-${itemId}`,
              price: payload.price,
              currency: payload.currency,
            };
        const next: MenuItem = {
          ...i,
          name: payload.name,
          description: payload.description,
          prices: [newFirst, ...rest],
        };
          const img = imageValue.trim();
          if (img) next.image = img;
          else delete next.image;
          return next;
        });

      setIsSavingEdit(true);
      void withItemLock(itemId, async () => {
        let resolvedImage = payload.image.trim();
        try {
          if (payload.imageFile) {
            resolvedImage = await uploadFileToR2(payload.imageFile, "menu-item");
          }

          applyLocalPatch(resolvedImage);

          const response = await fetch(`/api/settings/menu-items/${encodeURIComponent(itemId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.name,
              description: payload.description,
              image: resolvedImage || null,
              price: payload.price,
              currency: payload.currency,
            }),
          });
          if (!response.ok) {
            patchItem(categoryId, itemId, () => previous);
            setRequestError(await readErrorMessage(response, t("global.errSaveItem")));
            return;
          }
          setEditor(null);
        } catch {
          patchItem(categoryId, itemId, () => previous);
          setRequestError(t("global.errSaveItemNetwork"));
        } finally {
          setIsSavingEdit(false);
        }
      });
    },
    [data, editor, isItemBusy, isSavingEdit, patchItem, t, withItemLock],
  );

  const handleRequestDelete = useCallback(
    (categoryId: string, itemId: string) => {
      if (isSavingEdit) return;
      const item = findItem(data, categoryId, itemId);
      if (!item || isItemBusy(itemId)) return;
      setDeleteTarget({ categoryId, itemId, name: item.name });
    },
    [data, isItemBusy, isSavingEdit],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (isItemBusy(deleteTarget.itemId)) return;
    setRequestError(null);
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

  const emptyState =
    loadError == null && data.categories.length === 0 ? (
      <div className="rounded-2xl border border-foreground/10 bg-background/40 px-5 py-12 text-center text-sm text-foreground/70">
        {t("global.emptyMenu")}
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {errorBanner}
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("global.title")}
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            {t("global.subtitle")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:pt-0.5">
          <Link
            href="/global-menu/categories"
            className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl border border-foreground/15 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm ring-1 ring-foreground/5 transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {t("global.manageCategories")}
          </Link>
          <AddMenuItemButton />
        </div>
      </div>

      <div className="space-y-5">
        {emptyState}
        {data.categories.map((category) => (
          <GlobalMenuCategorySection
            key={category.id}
            category={category}
            onEditItem={(categoryId, itemId) => {
              if (isSavingEdit) return;
              setEditor({ categoryId, itemId });
            }}
            onToggleActive={handleToggleActive}
            onDeleteItem={handleRequestDelete}
            isItemBusy={isItemBusy}
            showAddItemButton
          />
        ))}
      </div>

      <EditMenuItemModal
        open={editingItem != null}
        item={editingItem}
        saving={isEditorSaving}
        onClose={() => {
          if (isSavingEdit) return;
          setEditor(null);
        }}
        onSave={handleSaveEdit}
      />

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
    </div>
  );
}
