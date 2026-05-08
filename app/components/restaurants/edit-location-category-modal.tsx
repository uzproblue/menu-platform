"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { GlobalMenuItemApi } from "@/lib/auth-api";
import { ItemThumbnail } from "@/app/components/global-menu/global-menu-item-row";
import { useI18n } from "../i18n-provider";
import { getMatchingCatalogPrices } from "./location-wizard/pricing";

export type EditLocationCategoryRow = {
  menuItemId: string;
  price: string;
};

type RowState = {
  checked: boolean;
  price: string;
};

type EditLocationCategoryModalProps = {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
  /** ISO currency for the location (e.g. "UZS"). */
  currency: string;
  /** Catalog items belonging to the edited category (already filtered by parent). */
  catalogItems: GlobalMenuItemApi[];
  /** Map of menu item id -> current per-location price for the items already published in this category. */
  initiallyEnabledByItemId: Record<string, string>;
  /** True while the catalog is being fetched on first open. */
  catalogLoading: boolean;
  /** Non-null when catalog fetch failed. */
  catalogError: string | null;
  /** True while a save request is in-flight. */
  saving: boolean;
  /** Server-side save error, if any. */
  saveError: string | null;
  onClose: () => void;
  onSave: (rows: EditLocationCategoryRow[]) => void;
};

function isValidPrice(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.length) return false;
  const num = Number(trimmed.replace(",", "."));
  return Number.isFinite(num) && num >= 0;
}

export function EditLocationCategoryModal({
  open,
  categoryId,
  categoryName,
  currency,
  catalogItems,
  initiallyEnabledByItemId,
  catalogLoading,
  catalogError,
  saving,
  saveError,
  onClose,
  onSave,
}: EditLocationCategoryModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const hintId = useId();

  const initialRowsKey = useMemo(() => {
    if (!open) return "closed";
    return [
      categoryId ?? "",
      catalogItems.map((i) => i.id).join(","),
      Object.entries(initiallyEnabledByItemId)
        .map(([k, v]) => `${k}:${v}`)
        .sort()
        .join(","),
    ].join("|");
  }, [open, categoryId, catalogItems, initiallyEnabledByItemId]);

  const buildInitialRows = useCallback((): Record<string, RowState> => {
    const next: Record<string, RowState> = {};
    for (const item of catalogItems) {
      const existing = initiallyEnabledByItemId[item.id];
      if (typeof existing === "string") {
        next[item.id] = { checked: true, price: existing };
        continue;
      }
      const matching = getMatchingCatalogPrices(item, currency);
      next[item.id] = {
        checked: false,
        price: matching[0]?.price ?? "",
      };
    }
    return next;
  }, [catalogItems, currency, initiallyEnabledByItemId]);

  const [rowsKey, setRowsKey] = useState<string>(initialRowsKey);
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    buildInitialRows(),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  if (rowsKey !== initialRowsKey) {
    setRowsKey(initialRowsKey);
    setRows(buildInitialRows());
    setValidationError(null);
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
  }, [open, onClose, saving]);

  if (!open) return null;

  const checkedRowEntries = Object.entries(rows).filter(([, r]) => r.checked);
  const allCheckedHaveValidPrice = checkedRowEntries.every(([, r]) =>
    isValidPrice(r.price),
  );
  const canSave =
    !catalogLoading &&
    !catalogError &&
    !saving &&
    checkedRowEntries.length > 0 &&
    allCheckedHaveValidPrice;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (checkedRowEntries.length === 0) {
      setValidationError(t("restaurantDetail.editCategoryItemsRequireAtLeastOne"));
      return;
    }
    if (!allCheckedHaveValidPrice) {
      setValidationError(t("restaurantDetail.editCategoryItemsPriceInvalid"));
      return;
    }
    setValidationError(null);
    const payload: EditLocationCategoryRow[] = checkedRowEntries.map(
      ([menuItemId, r]) => ({
        menuItemId,
        price: r.price.trim(),
      }),
    );
    onSave(payload);
  }

  function toggleRow(itemId: string, item: GlobalMenuItemApi) {
    setRows((prev) => {
      const current = prev[itemId];
      if (current) {
        if (current.checked) {
          return { ...prev, [itemId]: { ...current, checked: false } };
        }
        const fallback =
          current.price.trim().length > 0
            ? current.price
            : (getMatchingCatalogPrices(item, currency)[0]?.price ?? "");
        return { ...prev, [itemId]: { checked: true, price: fallback } };
      }
      const matching = getMatchingCatalogPrices(item, currency);
      return {
        ...prev,
        [itemId]: { checked: true, price: matching[0]?.price ?? "" },
      };
    });
  }

  function setRowPrice(itemId: string, value: string) {
    setRows((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return { ...prev, [itemId]: { ...current, price: value } };
    });
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
        className="relative z-10 flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
            {t("restaurantDetail.editCategoryItemsTitle", { name: categoryName })}
          </h2>
          <p id={hintId} className="mt-1 text-xs text-foreground/55">
            {t("restaurantDetail.editCategoryItemsHint")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
        >
          {catalogLoading ? (
            <p className="py-8 text-center text-sm text-foreground/55">
              {t("restaurantDetail.editCategoryItemsLoadingCatalog")}
            </p>
          ) : catalogError ? (
            <p className="py-8 text-center text-sm text-amber-800 dark:text-amber-200">
              {catalogError}
            </p>
          ) : catalogItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground/55">
              {t("restaurantDetail.editCategoryItemsEmptyCatalog")}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3">
              {catalogItems.map((item) => {
                const row = rows[item.id] ?? { checked: false, price: "" };
                const showPriceInvalid =
                  row.checked && row.price.trim().length > 0 && !isValidPrice(row.price);
                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-foreground/10 bg-background/70 p-3 ring-1 ring-foreground/5"
                  >
                    <div className="flex items-start gap-3">
                      <label className="flex flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1.5 size-4 shrink-0 rounded border-foreground/30"
                          checked={row.checked}
                          disabled={saving}
                          onChange={() => toggleRow(item.id, item)}
                        />
                        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 ring-1 ring-foreground/5">
                          {item.image ? (
                            <ItemThumbnail
                              src={item.image}
                              alt={item.name}
                              sizes="56px"
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center text-[10px] text-foreground/45">
                              {t("global.noImage")}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {item.name}
                          </span>
                          {item.description ? (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-foreground/55">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                      <div className="flex shrink-0 items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={t("restaurants.newWizard.locationPrice")}
                          className="w-24 rounded-lg border border-foreground/15 bg-background/80 px-2.5 py-2 text-right text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
                          value={row.price}
                          onChange={(e) => setRowPrice(item.id, e.target.value)}
                          disabled={!row.checked || saving}
                          placeholder="0"
                        />
                        <span className="rounded-md border border-foreground/15 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/65">
                          {currency}
                        </span>
                      </div>
                    </div>
                    {showPriceInvalid ? (
                      <p className="mt-2 pl-7 text-xs text-rose-700 dark:text-rose-300">
                        {t("restaurantDetail.editCategoryItemsPriceInvalid")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {validationError || saveError ? (
            <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">
              {saveError ?? validationError}
            </p>
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
