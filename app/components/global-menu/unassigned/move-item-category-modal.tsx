"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import type { MenuCategory, MenuSectionEntity } from "@/lib/data/global-menu-types";
import { useI18n } from "../../i18n-provider";

type MoveItemCategoryModalProps = {
  open: boolean;
  itemCount: number;
  itemNames?: string[];
  sections: MenuSectionEntity[];
  categories: MenuCategory[];
  isSaving: boolean;
  onClose: () => void;
  onMove: (targetCategoryId: string) => Promise<void>;
  onCreateCategoryAndMove: (categoryName: string, sectionId: string) => Promise<void>;
};

export function MoveItemCategoryModal({
  open,
  itemCount,
  itemNames = [],
  sections,
  categories,
  isSaving,
  onClose,
  onMove,
  onCreateCategoryAndMove,
}: MoveItemCategoryModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySectionId, setNewCategorySectionId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const standardSections = useMemo(
    () => sections.filter((s) => s.kind === "standard"),
    [sections],
  );

  // Group categories by section
  const categoriesBySection = useMemo(() => {
    const map = new Map<string, MenuCategory[]>();
    for (const cat of categories) {
      if (!map.has(cat.menuSectionId)) {
        map.set(cat.menuSectionId, []);
      }
      map.get(cat.menuSectionId)!.push(cat);
    }
    return map;
  }, [categories]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIsCreatingNew(false);
    setNewCategoryName("");
    setSearchQuery("");
    // Default to first category in first standard section if available
    const firstStandard = standardSections[0];
    if (firstStandard) {
      setNewCategorySectionId(firstStandard.id);
      const inSec = categoriesBySection.get(firstStandard.id);
      if (inSec && inSec.length > 0) {
        setSelectedCategoryId(inSec[0].id);
      } else {
        setSelectedCategoryId("");
      }
    }
  }, [open, standardSections, categoriesBySection]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, isSaving]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setError(null);

    try {
      if (isCreatingNew) {
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) {
          setError(t("categoryModal.displayNamePlaceholder"));
          return;
        }
        if (!newCategorySectionId) {
          setError(t("unassigned.selectTargetSection"));
          return;
        }
        await onCreateCategoryAndMove(trimmedName, newCategorySectionId);
      } else {
        if (!selectedCategoryId) {
          setError(t("unassigned.selectTargetCategory"));
          return;
        }
        await onMove(selectedCategoryId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unassigned.errMoveItem"));
    }
  }

  const filteredSectionsWithCategories = standardSections
    .map((sec) => {
      const allInSec = categoriesBySection.get(sec.id) ?? [];
      const filtered = searchQuery.trim()
        ? allInSec.filter((c) =>
            c.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
          )
        : allInSec;
      return { section: sec, categories: filtered };
    })
    .filter((g) => g.categories.length > 0);

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={isSaving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(92vh,680px)] w-full max-w-lg flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
            {itemCount === 1 && itemNames[0]
              ? t("unassigned.moveItemPrompt", { name: itemNames[0] })
              : t("unassigned.bulkMoveToCategory")}
          </h2>
          <p className="mt-1 text-xs text-foreground/55">
            {itemCount > 1
              ? t("unassigned.bulkItemsSelected", { count: itemCount })
              : t("unassigned.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5">
          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {/* Switch: Existing Category vs Create New Category */}
          <div className="mb-4 flex rounded-xl border border-foreground/15 bg-foreground/5 p-1">
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                !isCreatingNew
                  ? "bg-background text-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {t("unassigned.targetCategory")}
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                isCreatingNew
                  ? "bg-background text-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              + {t("categories.addCategory")}
            </button>
          </div>

          {!isCreatingNew ? (
            <div className="space-y-3">
              {categories.length > 6 ? (
                <div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("common.search")}
                    className="w-full rounded-xl border border-foreground/15 bg-background px-3.5 py-2 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              ) : null}

              <div className="max-h-60 space-y-4 overflow-y-auto pr-1">
                {filteredSectionsWithCategories.length === 0 ? (
                  <p className="py-6 text-center text-sm text-foreground/50">
                    {t("categories.couldNotLoad")}
                  </p>
                ) : (
                  filteredSectionsWithCategories.map(({ section, categories: secCats }) => (
                    <div key={section.id} className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                        {section.name}
                      </p>
                      <div className="grid gap-1">
                        {secCats.map((cat) => {
                          const isSelected = selectedCategoryId === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setSelectedCategoryId(cat.id)}
                              className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                                isSelected
                                  ? "border-foreground bg-foreground/10 font-medium text-foreground ring-1 ring-foreground/20"
                                  : "border-foreground/10 bg-background/60 text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                              }`}
                            >
                              <span>{cat.name}</span>
                              {isSelected ? (
                                <svg className="size-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t("categoryModal.displayName")}
                </label>
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("categoryModal.displayNamePlaceholder")}
                  className="w-full rounded-xl border border-foreground/15 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t("unassigned.targetSection")}
                </label>
                <select
                  value={newCategorySectionId}
                  onChange={(e) => setNewCategorySectionId(e.target.value)}
                  className="w-full rounded-xl border border-foreground/15 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                >
                  {standardSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-foreground/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving || (!isCreatingNew && !selectedCategoryId)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {t("unassigned.movingItem")}
                </>
              ) : (
                t("unassigned.bulkApply")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
