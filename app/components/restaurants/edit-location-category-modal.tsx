"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { GlobalMenuItemApi } from "@/lib/auth-api";
import { ItemThumbnail } from "@/app/components/global-menu/global-menu-item-row";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { getMaxUploadSizeBytes } from "@/lib/r2-upload-shared";
import { useI18n } from "../i18n-provider";
import { getMatchingCatalogPrices } from "./location-wizard/pricing";

export type EditLocationCategoryRow = {
  menuItemId: string;
  price: string;
  grammUseDefault: boolean;
  gramm?: string;
  imageUseDefault: boolean;
  image?: string;
};

export type PublishedLocationItemState = {
  price: string;
  enabled: boolean;
  grammUseDefault?: boolean;
  gramm?: string;
  imageUseDefault?: boolean;
  image?: string;
};

type RowState = {
  checked: boolean;
  price: string;
  grammUseDefault: boolean;
  gramm: string;
  imageUseDefault: boolean;
  image: string;
};

type EditLocationCategoryModalProps = {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
  /** ISO currency for the location (e.g. "UZS"). */
  currency: string;
  /** Catalog items belonging to the edited category (already filtered by parent). */
  catalogItems: GlobalMenuItemApi[];
  /** Map of menu item id -> current per-location price for enabled items in this category. */
  initiallyEnabledByItemId: Record<string, string>;
  /** All published rows at this location in the category (including disabled), for price + checked state. */
  publishedByItemId?: Record<string, PublishedLocationItemState>;
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

function defaultGrammHint(
  item: GlobalMenuItemApi,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const globalGramm = item.gramm?.trim();
  return globalGramm
    ? t("restaurantDetail.grammDefaultHint", { value: globalGramm })
    : t("restaurantDetail.grammDefaultEmpty");
}

function resolveRowThumbnail(
  item: GlobalMenuItemApi,
  row: RowState,
): string | undefined {
  const src = row.imageUseDefault ? item.image : row.image;
  const trimmed = src?.trim();
  return trimmed?.length ? trimmed : undefined;
}

export function EditLocationCategoryModal({
  open,
  categoryId,
  categoryName,
  currency,
  catalogItems,
  initiallyEnabledByItemId,
  publishedByItemId,
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
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImageUploadItemId, setPendingImageUploadItemId] = useState<string | null>(
    null,
  );
  const [imageUploadingItemId, setImageUploadingItemId] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const maxMenuImageSizeBytes = getMaxUploadSizeBytes("menu-item");

  const initialRowsKey = useMemo(() => {
    if (!open) return "closed";
    return [
      categoryId ?? "",
      catalogItems.map((i) => i.id).join(","),
      Object.entries(initiallyEnabledByItemId)
        .map(([k, v]) => `${k}:${v}`)
        .sort()
        .join(","),
      Object.entries(publishedByItemId ?? {})
        .map(
          ([k, v]) =>
            `${k}:${v.enabled}:${v.price}:${v.grammUseDefault ?? true}:${v.gramm ?? ""}:${v.imageUseDefault ?? true}:${v.image ?? ""}`,
        )
        .sort()
        .join(","),
    ].join("|");
  }, [open, categoryId, catalogItems, initiallyEnabledByItemId, publishedByItemId]);

  const buildInitialRows = useCallback((): Record<string, RowState> => {
    const next: Record<string, RowState> = {};
    for (const item of catalogItems) {
      const published = publishedByItemId?.[item.id];
      if (published) {
        next[item.id] = {
          checked: published.enabled,
          price: published.price,
          grammUseDefault: published.grammUseDefault !== false,
          gramm: published.gramm ?? "",
          imageUseDefault: published.imageUseDefault !== false,
          image: published.image ?? "",
        };
        continue;
      }
      const existing = initiallyEnabledByItemId[item.id];
      if (typeof existing === "string") {
        next[item.id] = {
          checked: true,
          price: existing,
          grammUseDefault: true,
          gramm: "",
          imageUseDefault: true,
          image: "",
        };
        continue;
      }
      const matching = getMatchingCatalogPrices(item, currency);
      next[item.id] = {
        checked: false,
        price: matching[0]?.price ?? "",
        grammUseDefault: true,
        gramm: "",
        imageUseDefault: true,
        image: "",
      };
    }
    return next;
  }, [catalogItems, currency, initiallyEnabledByItemId, publishedByItemId]);

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
        grammUseDefault: r.grammUseDefault,
        ...(r.grammUseDefault ? {} : { gramm: r.gramm.trim() || undefined }),
        imageUseDefault: r.imageUseDefault,
        ...(r.imageUseDefault ? {} : { image: r.image.trim() || undefined }),
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
        return {
          ...prev,
          [itemId]: {
            ...current,
            checked: true,
            price: fallback,
          },
        };
      }
      const matching = getMatchingCatalogPrices(item, currency);
      return {
        ...prev,
        [itemId]: {
          checked: true,
          price: matching[0]?.price ?? "",
          grammUseDefault: true,
          gramm: "",
          imageUseDefault: true,
          image: "",
        },
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

  function setRowGrammUseDefault(itemId: string, useDefault: boolean) {
    setRows((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return { ...prev, [itemId]: { ...current, grammUseDefault: useDefault } };
    });
  }

  function setRowGramm(itemId: string, value: string) {
    setRows((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return { ...prev, [itemId]: { ...current, gramm: value } };
    });
  }

  function setRowImageUseDefault(itemId: string, useDefault: boolean) {
    setRows((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return { ...prev, [itemId]: { ...current, imageUseDefault: useDefault } };
    });
  }

  function setRowImage(itemId: string, value: string) {
    setRows((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return { ...prev, [itemId]: { ...current, image: value } };
    });
  }

  function triggerImageUpload(itemId: string) {
    setPendingImageUploadItemId(itemId);
    setImageUploadError(null);
    imageFileInputRef.current?.click();
  }

  async function handleImageFileSelected(file: File, itemId: string) {
    if (file.size > maxMenuImageSizeBytes) {
      setImageUploadError(
        t("newItem.imageTooLarge", {
          maxMb: String(Math.round(maxMenuImageSizeBytes / (1024 * 1024))),
        }),
      );
      return;
    }
    setImageUploadingItemId(itemId);
    setImageUploadError(null);
    try {
      const url = await uploadFileToR2(file, "menu-item");
      setRows((prev) => {
        const current = prev[itemId];
        if (!current) return prev;
        return {
          ...prev,
          [itemId]: {
            ...current,
            imageUseDefault: false,
            image: url,
          },
        };
      });
    } catch {
      setImageUploadError(t("global.imageUploadFailed"));
    } finally {
      setImageUploadingItemId(null);
    }
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
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              const itemId = pendingImageUploadItemId;
              e.currentTarget.value = "";
              setPendingImageUploadItemId(null);
              if (!file || !itemId) return;
              void handleImageFileSelected(file, itemId);
            }}
          />
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
                const row = rows[item.id] ?? {
                  checked: false,
                  price: "",
                  grammUseDefault: true,
                  gramm: "",
                  imageUseDefault: true,
                  image: "",
                };
                const thumbnailSrc = resolveRowThumbnail(item, row);
                const showPriceInvalid =
                  row.checked && row.price.trim().length > 0 && !isValidPrice(row.price);
                const isImageUploading = imageUploadingItemId === item.id;
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
                          {thumbnailSrc ? (
                            <ItemThumbnail
                              src={thumbnailSrc}
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
                          <span className="mt-1 block text-xs text-foreground/45">
                            {defaultGrammHint(item, t)}
                          </span>
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
                    {row.checked ? (
                      <div className="mt-3 space-y-2 border-t border-foreground/8 pt-3 pl-7">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setRowGrammUseDefault(item.id, true)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                              row.grammUseDefault
                                ? "border-foreground/25 bg-foreground/10 text-foreground"
                                : "border-foreground/15 text-foreground/60 hover:bg-foreground/5"
                            }`}
                          >
                            {t("restaurantDetail.grammUseDefault")}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setRowGrammUseDefault(item.id, false)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                              !row.grammUseDefault
                                ? "border-foreground/25 bg-foreground/10 text-foreground"
                                : "border-foreground/15 text-foreground/60 hover:bg-foreground/5"
                            }`}
                          >
                            {t("restaurantDetail.grammCustom")}
                          </button>
                        </div>
                        {!row.grammUseDefault ? (
                          <input
                            type="text"
                            maxLength={64}
                            disabled={saving}
                            value={row.gramm}
                            onChange={(e) => setRowGramm(item.id, e.target.value)}
                            placeholder={t("restaurantDetail.grammCustomPlaceholder")}
                            className="w-full max-w-xs rounded-lg border border-foreground/15 bg-background/80 px-2.5 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                          />
                        ) : null}
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-medium text-foreground/70">
                            {t("restaurantDetail.imageSectionLabel")}
                          </p>
                          <p className="text-xs text-foreground/45">
                            {item.image?.trim()
                              ? t("restaurantDetail.imageDefaultHasGlobal")
                              : t("restaurantDetail.imageDefaultEmpty")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving || isImageUploading}
                              onClick={() => setRowImageUseDefault(item.id, true)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                                row.imageUseDefault
                                  ? "border-foreground/25 bg-foreground/10 text-foreground"
                                  : "border-foreground/15 text-foreground/60 hover:bg-foreground/5"
                              }`}
                            >
                              {t("restaurantDetail.imageUseDefault")}
                            </button>
                            <button
                              type="button"
                              disabled={saving || isImageUploading}
                              onClick={() => setRowImageUseDefault(item.id, false)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                                !row.imageUseDefault
                                  ? "border-foreground/25 bg-foreground/10 text-foreground"
                                  : "border-foreground/15 text-foreground/60 hover:bg-foreground/5"
                              }`}
                            >
                              {t("restaurantDetail.imageCustom")}
                            </button>
                          </div>
                          {!row.imageUseDefault ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                disabled={saving || isImageUploading}
                                value={row.image}
                                onChange={(e) => setRowImage(item.id, e.target.value)}
                                placeholder={t("restaurantDetail.imageUrlPlaceholder")}
                                className="w-full rounded-lg border border-foreground/15 bg-background/80 px-2.5 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                              />
                              <button
                                type="button"
                                disabled={saving || isImageUploading}
                                onClick={() => triggerImageUpload(item.id)}
                                className="rounded-lg border border-foreground/15 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50"
                              >
                                {isImageUploading
                                  ? t("global.imageUploading")
                                  : t("restaurantDetail.imageUploadFromDevice")}
                              </button>
                              <p className="text-[11px] text-foreground/45">
                                {t("restaurantDetail.imageUploadHint")}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
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

          {imageUploadError ? (
            <p className="mt-3 text-sm text-rose-700 dark:text-rose-300">{imageUploadError}</p>
          ) : null}
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
