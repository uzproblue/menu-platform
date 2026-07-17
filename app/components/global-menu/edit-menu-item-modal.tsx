"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { MenuItem } from "@/lib/data/global-menu-types";
import { SUPPORTED_CATALOG_CURRENCIES } from "@/lib/supported-currencies";
import { useI18n } from "../i18n-provider";
import {
  CatalogImageField,
  type CatalogImageFieldValue,
} from "./catalog-image-field";

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

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gramm, setGramm] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("UZS");
  const [imageValue, setImageValue] = useState<CatalogImageFieldValue>({
    url: "",
    file: null,
  });

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
    setImageValue({ url: item.image ?? "", file: null });
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
      image: imageValue.url.trim(),
      imageFile: imageValue.file,
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

            <CatalogImageField
              label={t("global.imageUrlOrPath")}
              value={imageValue}
              onChange={setImageValue}
              uploadTarget="menu-item"
              disabled={saving}
            />
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
