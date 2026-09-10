"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MenuCategory, MenuItem, MenuSectionEntity } from "@/lib/data/global-menu-types";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import { useI18n } from "../../i18n-provider";
import { useGlobalMenuCatalogLayout } from "../global-menu-catalog-layout-context";
import { CategoryNameModal } from "../category-name-modal";
import {
  EditMenuItemModal,
  type MenuItemCategoryOption,
  type MenuItemEditSavePayload,
} from "../edit-menu-item-modal";
import { MoveItemCategoryModal } from "./move-item-category-modal";
import { ToastStack, type ToastEntry } from "@/app/components/ui/toast-stack";

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;
  return payload?.message ?? payload?.error ?? fallback;
}

export function UnassignedPageClient() {
  const { t, locale } = useI18n();
  const { initialData, loadError: initialLoadError } = useGlobalMenuCatalogLayout();

  const [categories, setCategories] = useState<MenuCategory[]>(() => initialData.categories ?? []);
  const [sections, setSections] = useState<MenuSectionEntity[]>(() => initialData.sections ?? []);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError ?? null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"byCategory" | "foodItems">("byCategory");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());

  const [isSaving, setIsSaving] = useState(false);
  const [movingCategoryId, setMovingCategoryId] = useState<string | null>(null);
  const [bulkTargetSectionId, setBulkTargetSectionId] = useState<string>("");

  // Modals
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<{ categoryId: string; item: MenuItem } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ categoryId: string; itemId: string; name: string } | null>(null);
  const [moveModal, setMoveModal] = useState<{ itemIds: string[]; itemNames: string[] } | null>(null);

  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((entry: Omit<ToastEntry, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...entry, id }]);
  }, []);

  // Sync initialData if layout re-fetches
  useEffect(() => {
    if (initialData.categories) setCategories(initialData.categories);
    if (initialData.sections) setSections(initialData.sections);
    if (initialLoadError !== undefined) setLoadError(initialLoadError);
  }, [initialData, initialLoadError]);

  // Load sections and categories explicitly to ensure latest server state
  const refreshCatalog = useCallback(async () => {
    try {
      const [secRes, globRes] = await Promise.all([
        fetch("/api/settings/menu-sections", { method: "GET", cache: "no-store" }),
        fetch("/api/settings/global-menu", { method: "GET", cache: "no-store" }),
      ]);
      if (secRes.ok) {
        const secPayload = (await secRes.json()) as { sections?: MenuSectionEntity[] };
        if (Array.isArray(secPayload.sections)) {
          setSections(secPayload.sections);
        }
      }
      if (globRes.ok) {
        const globPayload = (await globRes.json()) as { categories?: MenuCategory[] };
        if (Array.isArray(globPayload.categories)) {
          setCategories(globPayload.categories);
        }
      }
    } catch {
      // Non-fatal background refresh
    }
  }, []);

  const unassignedSection = useMemo(() => {
    return sections.find((s) => s.kind === "unassigned") ?? null;
  }, [sections]);

  const standardSections = useMemo(() => {
    return sections
      .filter((s) => s.kind === "standard")
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [sections]);

  // All categories currently in Unassigned
  const unassignedCategories = useMemo(() => {
    if (!unassignedSection) return [];
    return categories.filter((c) => c.menuSectionId === unassignedSection.id);
  }, [categories, unassignedSection]);

  // Categories in standard sections (for move target options)
  const standardCategories = useMemo(() => {
    if (!unassignedSection) return categories;
    return categories.filter((c) => c.menuSectionId !== unassignedSection.id);
  }, [categories, unassignedSection]);

  // Default bulk target section to first standard section
  useEffect(() => {
    if (standardSections.length > 0 && !bulkTargetSectionId) {
      setBulkTargetSectionId(standardSections[0].id);
    }
  }, [standardSections, bulkTargetSectionId]);

  // Auto-expand all unassigned categories initially
  useEffect(() => {
    if (unassignedCategories.length > 0 && expandedCategoryIds.size === 0) {
      setExpandedCategoryIds(new Set(unassignedCategories.map((c) => c.id)));
    }
  }, [unassignedCategories, expandedCategoryIds.size]);

  // Flat array of all unassigned food items
  const allUnassignedItems = useMemo(() => {
    return unassignedCategories.flatMap((cat) =>
      cat.items.map((item) => ({
        item,
        categoryId: cat.id,
        categoryName: cat.name,
      })),
    );
  }, [unassignedCategories]);

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return unassignedCategories;
    return unassignedCategories
      .map((cat) => {
        const catNameMatches = cat.name.toLowerCase().includes(q);
        const matchedItems = cat.items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description && i.description.toLowerCase().includes(q)),
        );
        if (catNameMatches || matchedItems.length > 0) {
          return {
            ...cat,
            items: catNameMatches ? cat.items : matchedItems,
          };
        }
        return null;
      })
      .filter((c): c is MenuCategory => c !== null);
  }, [unassignedCategories, searchQuery]);

  // Filtered flat food items based on search
  const filteredFoodItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allUnassignedItems;
    return allUnassignedItems.filter(
      ({ item, categoryName }) =>
        item.name.toLowerCase().includes(q) ||
        categoryName.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)),
    );
  }, [allUnassignedItems, searchQuery]);

  // Category Options for EditMenuItemModal
  const editItemCategoryOptions: MenuItemCategoryOption[] = useMemo(() => {
    return categories.map((c) => ({
      id: c.id,
      label: c.name,
    }));
  }, [categories]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  // Toggle category expand/collapse
  const toggleCategoryExpanded = useCallback((categoryId: string) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Move Single Category to Section
  const handleAssignCategoryToSection = useCallback(
    async (categoryId: string, targetSectionId: string) => {
      const cat = categories.find((c) => c.id === categoryId);
      const sec = sections.find((s) => s.id === targetSectionId);
      if (!cat || !sec) return;

      setMovingCategoryId(categoryId);
      setRequestError(null);

      // Optimistic update
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, menuSectionId: targetSectionId } : c)),
      );

      try {
        const response = await fetch(
          `/api/settings/categories/${encodeURIComponent(categoryId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ menuSectionId: targetSectionId }),
          },
        );
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("unassigned.errMoveCategory")));
        }
        addToast({
          variant: "success",
          message: t("unassigned.movedCategorySuccess", {
            name: cat.name,
            section: sec.name,
          }),
        });
        setSelectedCategoryIds((prev) => {
          const next = new Set(prev);
          next.delete(categoryId);
          return next;
        });
        void refreshCatalog();
      } catch (err) {
        // Rollback
        setCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? { ...c, menuSectionId: cat.menuSectionId } : c)),
        );
        const msg = err instanceof Error ? err.message : t("unassigned.errMoveCategory");
        setRequestError(msg);
        addToast({ variant: "error", message: msg });
      } finally {
        setMovingCategoryId(null);
      }
    },
    [addToast, categories, refreshCatalog, sections, t],
  );

  // Bulk Assign Categories to Section
  const handleBulkAssignCategories = useCallback(async () => {
    const ids = Array.from(selectedCategoryIds);
    if (ids.length === 0 || !bulkTargetSectionId) return;
    const targetSec = sections.find((s) => s.id === bulkTargetSectionId);
    if (!targetSec) return;

    setIsSaving(true);
    setRequestError(null);

    // Optimistic update
    const previousCategories = categories;
    setCategories((prev) =>
      prev.map((c) => (ids.includes(c.id) ? { ...c, menuSectionId: bulkTargetSectionId } : c)),
    );

    try {
      const response = await fetch("/api/settings/categories/batch-reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryIds: ids,
          targetSectionId: bulkTargetSectionId,
        }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, t("unassigned.errMoveCategory")));
      }
      addToast({
        variant: "success",
        message: t("unassigned.bulkMoveCategoriesSuccess", {
          count: ids.length,
          section: targetSec.name,
        }),
      });
      setSelectedCategoryIds(new Set());
      void refreshCatalog();
    } catch (err) {
      setCategories(previousCategories);
      const msg = err instanceof Error ? err.message : t("unassigned.errMoveCategory");
      setRequestError(msg);
      addToast({ variant: "error", message: msg });
    } finally {
      setIsSaving(false);
    }
  }, [addToast, bulkTargetSectionId, categories, refreshCatalog, sections, selectedCategoryIds, t]);

  // Move Items to Target Category (handles both single and multiple items)
  const handleMoveItemsToCategory = useCallback(
    async (itemIds: string[], targetCategoryId: string) => {
      const targetCat = categories.find((c) => c.id === targetCategoryId);
      if (!targetCat) return;

      setIsSaving(true);
      setRequestError(null);

      // Collect items to move
      const itemsToMove: MenuItem[] = [];
      for (const cat of categories) {
        for (const item of cat.items) {
          if (itemIds.includes(item.id)) {
            itemsToMove.push(item);
          }
        }
      }

      const previousCategories = categories;
      // Optimistic update
      setCategories((prev) =>
        prev.map((c) => {
          if (c.id === targetCategoryId) {
            const existingIds = new Set(c.items.map((i) => i.id));
            const freshItems = itemsToMove.filter((i) => !existingIds.has(i.id));
            return { ...c, items: [...c.items, ...freshItems] };
          }
          return {
            ...c,
            items: c.items.filter((i) => !itemIds.includes(i.id)),
          };
        }),
      );

      try {
        const response = await fetch("/api/settings/menu-items/batch-reassign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemIds,
            targetCategoryId,
          }),
        });
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("unassigned.errMoveItem")));
        }
        if (itemIds.length === 1 && itemsToMove[0]) {
          addToast({
            variant: "success",
            message: t("unassigned.movedItemSuccess", {
              name: itemsToMove[0].name,
              category: targetCat.name,
            }),
          });
        } else {
          addToast({
            variant: "success",
            message: t("unassigned.bulkMoveItemsSuccess", {
              count: itemIds.length,
              category: targetCat.name,
            }),
          });
        }
        setSelectedItemIds((prev) => {
          const next = new Set(prev);
          for (const id of itemIds) next.delete(id);
          return next;
        });
        setMoveModal(null);
        void refreshCatalog();
      } catch (err) {
        setCategories(previousCategories);
        const msg = err instanceof Error ? err.message : t("unassigned.errMoveItem");
        setRequestError(msg);
        addToast({ variant: "error", message: msg });
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [addToast, categories, refreshCatalog, t],
  );

  // Create new category and move items into it
  const handleCreateCategoryAndMove = useCallback(
    async (newCategoryName: string, targetSectionId: string) => {
      if (!moveModal) return;
      setIsSaving(true);
      try {
        const catRes = await fetch("/api/settings/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newCategoryName,
            menuSectionId: targetSectionId,
          }),
        });
        if (!catRes.ok) {
          throw new Error(await readErrorMessage(catRes, t("newCategory.createFailed")));
        }
        const catData = (await catRes.json()) as { category: MenuCategory };
        const newCat = catData.category;
        setCategories((prev) => [...prev, { ...newCat, items: [] }]);

        await handleMoveItemsToCategory(moveModal.itemIds, newCat.id);
      } finally {
        setIsSaving(false);
      }
    },
    [handleMoveItemsToCategory, moveModal, t],
  );

  // Delete Category
  const handleConfirmDeleteCategory = useCallback(async () => {
    if (!deletingCategory) return;
    const cat = deletingCategory;
    setIsSaving(true);
    setRequestError(null);

    try {
      const response = await fetch(
        `/api/settings/categories/${encodeURIComponent(cat.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, t("categories.errDelete")));
      }
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setSelectedCategoryIds((prev) => {
        const next = new Set(prev);
        next.delete(cat.id);
        return next;
      });
      setDeletingCategory(null);
      void refreshCatalog();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("categories.errDelete");
      setRequestError(msg);
      addToast({ variant: "error", message: msg });
    } finally {
      setIsSaving(false);
    }
  }, [addToast, deletingCategory, refreshCatalog, t]);

  // Delete Food Item
  const handleConfirmDeleteItem = useCallback(async () => {
    if (!deletingItem) return;
    const { categoryId, itemId } = deletingItem;
    setIsSaving(true);
    setRequestError(null);

    try {
      const response = await fetch(
        `/api/settings/menu-items/${encodeURIComponent(itemId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, t("global.errDeleteItem")));
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c,
        ),
      );
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      setDeletingItem(null);
      void refreshCatalog();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("global.errDeleteItem");
      setRequestError(msg);
      addToast({ variant: "error", message: msg });
    } finally {
      setIsSaving(false);
    }
  }, [addToast, deletingItem, refreshCatalog, t]);

  // Save Item Edit from modal
  const handleSaveItemEdit = useCallback(
    async (payload: MenuItemEditSavePayload) => {
      if (!editingItem) return;
      const { itemId } = { itemId: editingItem.item.id };
      const sourceCategoryId = editingItem.categoryId;
      setIsSaving(true);
      setRequestError(null);

      try {
        let image = payload.image;
        if (payload.imageFile) {
          const { uploadFileToR2 } = await import("@/lib/r2-upload-client");
          image = await uploadFileToR2(payload.imageFile, "menu-item");
        }

        const body = {
          categoryId: payload.categoryId,
          name: payload.name,
          description: payload.description || null,
          gramm: payload.gramm || null,
          price: payload.price,
          currency: payload.currency,
          image: image || null,
        };

        const response = await fetch(
          `/api/settings/menu-items/${encodeURIComponent(itemId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("global.errSaveItem")));
        }

        // Apply to local state
        setCategories((prev) => {
          const updatedItem: MenuItem = {
            ...editingItem.item,
            name: payload.name,
            description: payload.description || undefined,
            gramm: payload.gramm || undefined,
            prices: [{ id: "p1", price: payload.price, currency: payload.currency }],
            image: image || undefined,
          };

          if (payload.categoryId === sourceCategoryId) {
            return prev.map((c) =>
              c.id === sourceCategoryId
                ? {
                    ...c,
                    items: c.items.map((i) => (i.id === itemId ? updatedItem : i)),
                  }
                : c,
            );
          } else {
            return prev.map((c) => {
              if (c.id === sourceCategoryId) {
                return { ...c, items: c.items.filter((i) => i.id !== itemId) };
              }
              if (c.id === payload.categoryId) {
                return { ...c, items: [...c.items, updatedItem] };
              }
              return c;
            });
          }
        });

        setEditingItem(null);
        void refreshCatalog();
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("global.errSaveItem");
        setRequestError(msg);
        addToast({ variant: "error", message: msg });
      } finally {
        setIsSaving(false);
      }
    },
    [addToast, editingItem, refreshCatalog, t],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground/60">
            <Link href="/global-menu/sections" className="hover:text-foreground">
              {t("nav.sections")}
            </Link>
            <span>/</span>
            <span className="text-foreground">{t("sections.unassigned")}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {t("unassigned.title")}
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-foreground/60">
            {t("unassigned.subtitle")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/global-menu/sections"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-foreground/15 bg-background/80 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("unassigned.backToSections")}
          </Link>
        </div>
      </div>

      {/* Error Banners */}
      {requestError || loadError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {requestError ?? loadError}
        </div>
      ) : null}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-foreground/10 bg-background/60 p-4 shadow-sm ring-1 ring-foreground/5 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/55">
            {t("unassigned.tabCategories")}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {unassignedCategories.length}
            </span>
            <span className="text-xs text-foreground/50">{t("sections.categoryPlural")}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-background/60 p-4 shadow-sm ring-1 ring-foreground/5 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground/55">
            {t("unassigned.tabFoodItems")}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-foreground">
              {allUnassignedItems.length}
            </span>
            <span className="text-xs text-foreground/50">{t("common.menuItems")}</span>
          </div>
        </div>
      </div>

      {/* Empty State when zero unassigned items */}
      {unassignedCategories.length === 0 ? (
        <div className="rounded-2xl border border-foreground/10 bg-background/60 p-12 text-center ring-1 ring-foreground/5">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {t("unassigned.emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground/60">
            {t("unassigned.emptyHelp")}
          </p>
          <div className="mt-6">
            <Link
              href="/global-menu/sections"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-foreground px-5 py-2 text-sm font-medium text-background shadow-sm hover:opacity-90"
            >
              {t("unassigned.backToSections")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar: Search & Tab Switcher */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex rounded-xl border border-foreground/15 bg-foreground/5 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("byCategory")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "byCategory"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/65 hover:text-foreground"
                }`}
              >
                <span>{t("unassigned.tabCategories")}</span>
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                  {unassignedCategories.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("foodItems")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "foodItems"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/65 hover:text-foreground"
                }`}
              >
                <span>{t("unassigned.tabFoodItems")}</span>
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                  {allUnassignedItems.length}
                </span>
              </button>
            </div>

            <div className="relative min-w-[280px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("unassigned.searchPlaceholder")}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 py-2 pr-4 pl-9 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
              />
              <svg
                className="absolute top-2.5 left-3 size-4 text-foreground/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Sticky Bulk Action Bar for Categories */}
          {activeTab === "byCategory" && selectedCategoryIds.size > 0 ? (
            <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/20 bg-background/95 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                  {selectedCategoryIds.size}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {t("unassigned.bulkCategoriesSelected", { count: selectedCategoryIds.size })}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryIds(new Set())}
                  className="ml-2 text-xs text-foreground/60 underline hover:text-foreground"
                >
                  {t("seasonalMenu.clearSelection")}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-foreground/60">{t("unassigned.bulkAssignToSection")}:</span>
                <select
                  value={bulkTargetSectionId}
                  onChange={(e) => setBulkTargetSectionId(e.target.value)}
                  disabled={isSaving || standardSections.length === 0}
                  className="rounded-xl border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground outline-none"
                >
                  {standardSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleBulkAssignCategories()}
                  disabled={isSaving || !bulkTargetSectionId}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-1.5 text-sm font-medium text-background shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {isSaving ? t("unassigned.bulkMoving") : t("unassigned.bulkApply")}
                </button>
              </div>
            </div>
          ) : null}

          {/* Sticky Bulk Action Bar for Food Items */}
          {activeTab === "foodItems" && selectedItemIds.size > 0 ? (
            <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-foreground/20 bg-background/95 p-4 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                  {selectedItemIds.size}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {t("unassigned.bulkItemsSelected", { count: selectedItemIds.size })}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedItemIds(new Set())}
                  className="ml-2 text-xs text-foreground/60 underline hover:text-foreground"
                >
                  {t("seasonalMenu.clearSelection")}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMoveModal({
                      itemIds: Array.from(selectedItemIds),
                      itemNames: [],
                    })
                  }
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-1.5 text-sm font-medium text-background shadow-sm hover:opacity-90"
                >
                  {t("unassigned.bulkMoveToCategory")}
                </button>
              </div>
            </div>
          ) : null}

          {/* ============================================================= */}
          {/* TAB 1: BY CATEGORY VIEW                                      */}
          {/* ============================================================= */}
          {activeTab === "byCategory" ? (
            <div className="space-y-4">
              {filteredCategories.length === 0 ? (
                <div className="rounded-2xl border border-foreground/10 bg-background/40 py-12 text-center text-sm text-foreground/60">
                  {t("categories.couldNotLoad")}
                </div>
              ) : (
                filteredCategories.map((cat) => {
                  const isChecked = selectedCategoryIds.has(cat.id);
                  const isExpanded = expandedCategoryIds.has(cat.id);
                  const isCategoryBusy = movingCategoryId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className="overflow-hidden rounded-2xl border border-foreground/10 bg-background/60 shadow-sm ring-1 ring-foreground/5"
                    >
                      {/* Category Header Row */}
                      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedCategoryIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(cat.id)) next.delete(cat.id);
                                else next.add(cat.id);
                                return next;
                              });
                            }}
                            className="size-4.5 rounded border-foreground/20 text-foreground accent-foreground"
                            aria-label={`Select category ${cat.name}`}
                          />
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5">
                            {cat.coverPhoto ? (
                              <Image
                                src={cat.coverPhoto}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="48px"
                                unoptimized={imageSrcIsNonOptimizable(cat.coverPhoto)}
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-[10px] text-foreground/40">
                                {t("global.noImage")}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-foreground">{cat.name}</p>
                            <p className="text-xs text-foreground/55">
                              {cat.items.length}{" "}
                              {cat.items.length === 1
                                ? t("sections.categorySingular")
                                : t("unassigned.itemsCount", { count: cat.items.length })}
                              {cat.description ? ` · ${cat.description}` : ""}
                            </p>
                          </div>
                        </div>

                        {/* Category Quick Assign & Actions */}
                        <div className="flex flex-wrap items-center gap-2 sm:self-center">
                          {/* Assign to Section dropdown */}
                          <div className="flex items-center gap-1.5 rounded-xl border border-foreground/15 bg-background/80 px-2.5 py-1">
                            <span className="text-xs font-medium text-foreground/60">
                              {t("unassigned.assignCategoryToSection")}:
                            </span>
                            <select
                              defaultValue=""
                              disabled={isCategoryBusy || standardSections.length === 0}
                              onChange={(e) => {
                                const targetId = e.target.value;
                                if (targetId) {
                                  void handleAssignCategoryToSection(cat.id, targetId);
                                  e.target.value = "";
                                }
                              }}
                              className="rounded-lg bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer"
                            >
                              <option value="" disabled>
                                {t("unassigned.selectTargetSection")}
                              </option>
                              {standardSections.map((sec) => (
                                <option key={sec.id} value={sec.id}>
                                  {sec.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingCategory(cat)}
                            className="inline-flex min-h-9 items-center rounded-xl border border-foreground/15 px-3 text-xs font-medium text-foreground hover:bg-foreground/5"
                          >
                            {t("common.edit")}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingCategory(cat)}
                            className="inline-flex min-h-9 items-center rounded-xl border border-red-500/30 px-3 text-xs font-medium text-red-700 hover:bg-red-500/10 dark:text-red-300"
                          >
                            {t("common.delete")}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleCategoryExpanded(cat.id)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-foreground/15 px-2.5 text-xs font-medium text-foreground/70 hover:bg-foreground/5"
                            aria-expanded={isExpanded}
                          >
                            <span>{isExpanded ? t("unassigned.collapseItems") : t("unassigned.expandItems")}</span>
                            <svg
                              className={`size-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Nested Food Items */}
                      {isExpanded ? (
                        <div className="border-t border-foreground/10 bg-foreground/[0.02] p-4">
                          {cat.items.length === 0 ? (
                            <p className="py-4 text-center text-xs text-foreground/45">
                              {t("unassigned.noItemsInCategory")}
                            </p>
                          ) : (
                            <div className="divide-y divide-foreground/5">
                              {cat.items.map((item) => {
                                const isItemChecked = selectedItemIds.has(item.id);
                                return (
                                  <div
                                    key={item.id}
                                    className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={isItemChecked}
                                        onChange={() => {
                                          setSelectedItemIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(item.id)) next.delete(item.id);
                                            else next.add(item.id);
                                            return next;
                                          });
                                        }}
                                        className="size-4 rounded border-foreground/20 text-foreground accent-foreground"
                                        aria-label={`Select item ${item.name}`}
                                      />
                                      <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-foreground/10 bg-foreground/5">
                                        {item.image ? (
                                          <Image
                                            src={item.image}
                                            alt=""
                                            fill
                                            className="object-cover"
                                            sizes="40px"
                                            unoptimized={imageSrcIsNonOptimizable(item.image)}
                                          />
                                        ) : (
                                          <div className="flex size-full items-center justify-center text-[9px] text-foreground/35">
                                            {t("global.noImage")}
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-foreground/50">
                                          {item.gramm ? <span>{item.gramm}</span> : null}
                                          {item.prices?.[0] ? (
                                            <span>
                                              {item.prices[0].price} {item.prices[0].currency}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Item Actions */}
                                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMoveModal({
                                            itemIds: [item.id],
                                            itemNames: [item.name],
                                          })
                                        }
                                        className="inline-flex min-h-8 items-center rounded-lg border border-foreground/15 px-2.5 text-xs font-medium text-foreground hover:bg-foreground/5"
                                      >
                                        {t("unassigned.moveItemToCategory")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingItem({ categoryId: cat.id, item })}
                                        className="inline-flex min-h-8 items-center rounded-lg border border-foreground/15 px-2.5 text-xs font-medium text-foreground hover:bg-foreground/5"
                                      >
                                        {t("common.edit")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDeletingItem({
                                            categoryId: cat.id,
                                            itemId: item.id,
                                            name: item.name,
                                          })
                                        }
                                        className="inline-flex min-h-8 items-center rounded-lg border border-red-500/30 px-2.5 text-xs font-medium text-red-700 hover:bg-red-500/10 dark:text-red-300"
                                      >
                                        {t("common.delete")}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* ============================================================= */
            /* TAB 2: ALL FOOD ITEMS VIEW                                   */
            /* ============================================================= */
            <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-background/60 shadow-sm ring-1 ring-foreground/5">
              <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3 bg-foreground/[0.02]">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      filteredFoodItems.length > 0 &&
                      filteredFoodItems.every(({ item }) => selectedItemIds.has(item.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItemIds(new Set(filteredFoodItems.map(({ item }) => item.id)));
                      } else {
                        setSelectedItemIds(new Set());
                      }
                    }}
                    className="size-4 rounded border-foreground/20 text-foreground accent-foreground"
                    aria-label="Select all food items"
                  />
                  <span className="text-xs font-medium text-foreground/60">
                    {t("seasonalMenu.selectAll")} ({filteredFoodItems.length})
                  </span>
                </div>
              </div>

              {filteredFoodItems.length === 0 ? (
                <p className="py-12 text-center text-sm text-foreground/60">
                  {t("categories.couldNotLoad")}
                </p>
              ) : (
                <div className="divide-y divide-foreground/5">
                  {filteredFoodItems.map(({ item, categoryId, categoryName }) => {
                    const isItemChecked = selectedItemIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 p-4 transition-colors hover:bg-foreground/[0.02] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3.5">
                          <input
                            type="checkbox"
                            checked={isItemChecked}
                            onChange={() => {
                              setSelectedItemIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            }}
                            className="size-4.5 rounded border-foreground/20 text-foreground accent-foreground"
                            aria-label={`Select item ${item.name}`}
                          />
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="48px"
                                unoptimized={imageSrcIsNonOptimizable(item.image)}
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-[10px] text-foreground/35">
                                {t("global.noImage")}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{item.name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-foreground/55">
                              <span className="rounded-md bg-foreground/5 px-2 py-0.5 font-medium text-foreground/70">
                                {categoryName}
                              </span>
                              {item.gramm ? <span>{item.gramm}</span> : null}
                              {item.prices?.[0] ? (
                                <span className="font-semibold text-foreground">
                                  {item.prices[0].price} {item.prices[0].currency}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        {/* Flat Row Actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() =>
                              setMoveModal({
                                itemIds: [item.id],
                                itemNames: [item.name],
                              })
                            }
                            className="inline-flex min-h-9 items-center rounded-xl border border-foreground/15 px-3 text-xs font-medium text-foreground hover:bg-foreground/5"
                          >
                            {t("unassigned.moveItemToCategory")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItem({ categoryId, item })}
                            className="inline-flex min-h-9 items-center rounded-xl border border-foreground/15 px-3 text-xs font-medium text-foreground hover:bg-foreground/5"
                          >
                            {t("common.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeletingItem({
                                categoryId,
                                itemId: item.id,
                                name: item.name,
                              })
                            }
                            className="inline-flex min-h-9 items-center rounded-xl border border-red-500/30 px-3 text-xs font-medium text-red-700 hover:bg-red-500/10 dark:text-red-300"
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* MODALS                                                        */}
      {/* ============================================================= */}

      {/* Move Item(s) to Target Category Modal */}
      <MoveItemCategoryModal
        open={moveModal !== null}
        itemCount={moveModal?.itemIds.length ?? 0}
        itemNames={moveModal?.itemNames ?? []}
        sections={standardSections}
        categories={standardCategories}
        isSaving={isSaving}
        onClose={() => setMoveModal(null)}
        onMove={async (targetCatId) => {
          if (!moveModal) return;
          await handleMoveItemsToCategory(moveModal.itemIds, targetCatId);
        }}
        onCreateCategoryAndMove={handleCreateCategoryAndMove}
      />

      {/* Edit Category Modal */}
      {editingCategory ? (
        <CategoryNameModal
          open
          mode="edit"
          categoryId={editingCategory.id}
          initialName={editingCategory.name}
          initialDescription={editingCategory.description}
          initialCoverPhoto={editingCategory.coverPhoto}
          initialMenuSectionId={editingCategory.menuSectionId}
          sections={sections}
          isSaving={isSaving}
          onClose={() => setEditingCategory(null)}
          onSave={async (payload) => {
            setIsSaving(true);
            try {
              const res = await fetch(
                `/api/settings/categories/${encodeURIComponent(editingCategory.id)}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                },
              );
              if (!res.ok) {
                throw new Error(await readErrorMessage(res, t("categories.errEdit")));
              }
              setCategories((prev) =>
                prev.map((c) => (c.id === editingCategory.id ? { ...c, ...payload } : c)),
              );
              setEditingCategory(null);
              void refreshCatalog();
            } finally {
              setIsSaving(false);
            }
          }}
        />
      ) : null}

      {/* Edit Menu Item Modal */}
      {editingItem ? (
        <EditMenuItemModal
          open
          item={editingItem.item}
          initialCategoryId={editingItem.categoryId}
          categoryOptions={editItemCategoryOptions}
          saving={isSaving}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveItemEdit}
        />
      ) : null}

      {/* Confirm Delete Category Modal */}
      {deletingCategory ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setDeletingCategory(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-foreground/10 bg-background/95 p-6 shadow-2xl backdrop-blur-md sm:rounded-2xl">
            <h3 className="text-lg font-semibold text-foreground">
              {t("categories.deleteCategoryQuestion")}
            </h3>
            <p className="mt-2 text-sm text-foreground/60">
              «{deletingCategory.name}» {t("sections.deleteBody", { name: deletingCategory.name })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                disabled={isSaving}
                className="rounded-xl border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteCategory()}
                disabled={isSaving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {isSaving ? t("common.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm Delete Food Item Modal */}
      {deletingItem ? (
        <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setDeletingItem(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-foreground/10 bg-background/95 p-6 shadow-2xl backdrop-blur-md sm:rounded-2xl">
            <h3 className="text-lg font-semibold text-foreground">
              {t("global.deleteItemQuestion")}
            </h3>
            <p className="mt-2 text-sm text-foreground/60">
              «{deletingItem.name}»
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isSaving}
                className="rounded-xl border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeleteItem()}
                disabled={isSaving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {isSaving ? t("common.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
