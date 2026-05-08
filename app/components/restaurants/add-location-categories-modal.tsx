"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useI18n } from "../i18n-provider";

export type AvailableCategory = {
  id: string;
  name: string;
  itemsCount: number;
};

type AddLocationCategoriesModalProps = {
  open: boolean;
  availableCategories: AvailableCategory[];
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSave: (addedIds: string[]) => void;
};

export function AddLocationCategoriesModal({
  open,
  availableCategories,
  saving,
  saveError,
  onClose,
  onSave,
}: AddLocationCategoriesModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const hintId = useId();

  const sessionKey = useMemo(() => {
    if (!open) return "closed";
    return availableCategories.map((c) => c.id).join("|");
  }, [open, availableCategories]);

  const [keySnapshot, setKeySnapshot] = useState<string>(sessionKey);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  if (keySnapshot !== sessionKey) {
    setKeySnapshot(sessionKey);
    setSelected(new Set());
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const canSave = !saving && selected.size > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave(Array.from(selected));
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={saving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
            {t("restaurantDetail.addCategoryTitle")}
          </h2>
          <p id={hintId} className="mt-1 text-xs text-foreground/55">
            {t("restaurantDetail.addCategoryHint")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
        >
          {availableCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground/55">
              {t("restaurantDetail.addCategoryEmptyCatalog")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {availableCategories.map((cat) => {
                const checked = selected.has(cat.id);
                const itemsLabel =
                  cat.itemsCount === 1
                    ? t("categories.itemSingular")
                    : t("categories.itemPlural");
                return (
                  <li key={cat.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ring-1 transition-colors ${
                        checked
                          ? "border-foreground/35 bg-foreground/5 ring-foreground/15"
                          : "border-foreground/10 bg-background/70 ring-foreground/5 hover:bg-foreground/5"
                      }`}
                      aria-label={t("restaurantDetail.addCategoryAria", {
                        name: cat.name,
                      })}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 rounded border-foreground/30"
                        checked={checked}
                        disabled={saving}
                        onChange={() => toggle(cat.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">
                          {cat.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-foreground/55">
                          {cat.itemsCount} {itemsLabel}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {saveError ? (
            <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{saveError}</p>
          ) : null}

          <div className="sticky bottom-0 mt-4 flex gap-2 border-t border-foreground/10 bg-background/95 py-4 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-11 flex-1 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="min-h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? t("restaurantDetail.editCategoryItemsSaving")
                : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
