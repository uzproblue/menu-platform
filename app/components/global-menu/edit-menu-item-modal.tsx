"use client";

import { useCallback, useEffect, useId, useState, type ClipboardEvent, type FormEvent } from "react";
import type { MenuItem } from "@/lib/data/global-menu-types";
import { getImageFileFromClipboardEvent } from "@/lib/clipboard-paste-image";
import { getMaxUploadSizeBytes } from "@/lib/r2-upload-shared";
import { SUPPORTED_CATALOG_CURRENCIES } from "@/lib/supported-currencies";
import { useI18n } from "../i18n-provider";
import { ItemThumbnail } from "./global-menu-item-row";

export type MenuItemCategoryOption = { id: string; label: string };

export type MenuItemEditSavePayload = {
  categoryId: string;
  name: string;
  description: string;
  gramm: string;
  price: string;
  currency: string;
  /** Trimmed URL/path, or empty string to remove image */
  image: string;
  imageFile: File | null;
};

type EditMenuItemModalProps = {
  open: boolean;
  item: MenuItem | null;
  /** Category where the row was opened from (initial select value). */
  initialCategoryId: string;
  categoryOptions: MenuItemCategoryOption[];
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: MenuItemEditSavePayload) => void;
};

export function EditMenuItemModal({
  open,
  item,
  initialCategoryId,
  categoryOptions,
  saving = false,
  onClose,
  onSave,
}: EditMenuItemModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const categoryIdField = useId();
  const nameId = useId();
  const descId = useId();
  const grammId = useId();
  const priceId = useId();
  const currencyId = useId();
  const imageId = useId();

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gramm, setGramm] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("UZS");
  const [image, setImage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageFileError, setImageFileError] = useState<string | null>(null);

  const maxMenuImageSizeBytes = getMaxUploadSizeBytes("menu-item");

  useEffect(() => {
    if (!open || !item) return;
    const ids = new Set(categoryOptions.map((o) => o.id));
    setCategoryId(
      ids.has(initialCategoryId) ? initialCategoryId : (categoryOptions[0]?.id ?? initialCategoryId),
    );
    setName(item.name);
    setDescription(item.description ?? "");
    setGramm(item.gramm ?? "");
    const p0 = item.prices[0];
    setPrice(p0?.price ?? "");
    setCurrency(p0?.currency ?? "UZS");
    setImage(item.image ?? "");
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageFileError(null);
  }, [
    open,
    item?.id,
    item?.name,
    item?.description,
    item?.gramm,
    item?.image,
    item?.prices,
    initialCategoryId,
    categoryOptions,
  ]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const applyImageFile = useCallback(
    (file: File) => {
      if (file.size > maxMenuImageSizeBytes) {
        setImageFileError(
          t("newItem.imageTooLarge", {
            maxMb: String(Math.round(maxMenuImageSizeBytes / (1024 * 1024))),
          }),
        );
        return;
      }
      setImageFileError(null);
      setImage("");
      setImageFile(file);
      setImagePreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    [maxMenuImageSizeBytes, t],
  );

  const onImageSectionPaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement | HTMLInputElement>) => {
      if (saving) return;
      const file = getImageFileFromClipboardEvent(e.nativeEvent);
      if (!file) return;
      e.preventDefault();
      applyImageFile(file);
    },
    [applyImageFile, saving],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (!item) return null;

  const previewSrc = imagePreviewUrl ?? image.trim();
  const categoryOk =
    categoryId.length > 0 && categoryOptions.some((o) => o.id === categoryId);
  const canSave = name.trim().length > 0 && price.trim().length > 0 && categoryOk && !saving;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      categoryId,
      name: name.trim(),
      description: description.trim(),
      gramm: gramm.trim(),
      price: price.trim(),
      currency: currency.trim().toUpperCase() || "UZS",
      image: image.trim(),
      imageFile,
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
        className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
            {t("global.editMenuItem")}
          </h2>
          <p className="mt-1 text-xs text-foreground/55">
            {t("global.sessionOnlyChanges")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
        >
          <div className="grid flex-1 gap-4 pb-4">
            <div className="space-y-2">
              <label htmlFor={categoryIdField} className="text-sm font-medium text-foreground">
                {t("newItem.category")}
              </label>
              <select
                id={categoryIdField}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={saving || categoryOptions.length === 0}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
              >
                {categoryOptions.length === 0 ? (
                  <option value="">{t("newItem.selectCategoryPlaceholder")}</option>
                ) : null}
                {categoryOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor={nameId} className="text-sm font-medium text-foreground">
                {t("common.name")}
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={saving}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                placeholder={t("global.itemNamePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor={descId} className="text-sm font-medium text-foreground">
                {t("global.description")}
              </label>
              <textarea
                id={descId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={saving}
                className="w-full resize-y rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                placeholder={t("global.shortDescriptionPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor={grammId} className="text-sm font-medium text-foreground">
                {t("global.gramm")}{" "}
                <span className="text-foreground/50">{t("newCategory.optionalSuffix")}</span>
              </label>
              <input
                id={grammId}
                value={gramm}
                onChange={(e) => setGramm(e.target.value)}
                maxLength={64}
                disabled={saving}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                placeholder={t("global.grammPlaceholder")}
              />
              <p className="text-xs text-foreground/50">{t("global.grammOptionalHint")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor={priceId} className="text-sm font-medium text-foreground">
                  {t("global.price")}
                </label>
                <input
                  id={priceId}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  disabled={saving}
                  className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                  placeholder="12.00"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={currencyId} className="text-sm font-medium text-foreground">
                  {t("global.currency")}
                </label>
                <select
                  id={currencyId}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                >
                  {SUPPORTED_CATALOG_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-foreground/50">{t("global.editFirstCatalogPriceHint")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor={imageId} className="text-sm font-medium text-foreground">
                {t("global.imageUrlOrPath")}
              </label>
              <div
                className="rounded-2xl border border-foreground/12 bg-foreground/[0.03] p-3 ring-1 ring-foreground/5 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                tabIndex={saving ? -1 : 0}
                onPaste={onImageSectionPaste}
              >
                <div className="grid gap-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-start">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                      {t("global.imagePreviewAlt")}
                    </p>
                    <div className="relative size-26 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 ring-1 ring-foreground/5">
                      {previewSrc ? (
                        <ItemThumbnail
                          src={previewSrc}
                          alt={t("global.imagePreviewAlt")}
                          sizes="104px"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-center text-xs text-foreground/45">
                          {t("global.noImage")}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      id={imageId}
                      value={image}
                      onChange={(e) => {
                        setImage(e.target.value);
                        setImageFileError(null);
                      }}
                      onPaste={onImageSectionPaste}
                      disabled={saving}
                      className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                      placeholder={t("global.imagePlaceholder")}
                    />
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-foreground/15" />
                      <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/45">
                        or
                      </span>
                      <div className="h-px flex-1 bg-foreground/15" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        applyImageFile(file);
                        e.currentTarget.value = "";
                      }}
                      className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15 disabled:opacity-60"
                    />
                    {imageFile ? (
                      <p className="text-xs text-foreground/60">
                        {t("global.imageSelected", { name: imageFile.name })}
                      </p>
                    ) : null}
                    {imageFileError ? (
                      <p className="text-xs text-red-600 dark:text-red-300">{imageFileError}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className="text-xs text-foreground/50">{t("global.leaveEmptyNoPhoto")}</p>
              <p className="text-xs text-foreground/50">{t("global.imagePasteHint")}</p>
            </div>
          </div>

          <div className="sticky bottom-0 flex gap-2 border-t border-foreground/10 bg-background/95 py-4 pt-3">
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
              {saving ? t("global.savingItem") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
