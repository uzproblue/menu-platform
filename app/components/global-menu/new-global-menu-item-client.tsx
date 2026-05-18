"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, type ClipboardEvent, type FormEvent } from "react";
import type { TranslationTextApi } from "@/lib/auth-api";
import { getImageFileFromClipboardEvent } from "@/lib/clipboard-paste-image";
import { appendMenuItemMutation } from "@/lib/pending-mutations";
import {
  persistPendingLocationExportWarning,
  readLocationExportWarning,
} from "@/lib/location-export-warning";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { getMaxUploadSizeBytes } from "@/lib/r2-upload-shared";
import { SUPPORTED_CATALOG_CURRENCIES } from "@/lib/supported-currencies";
import { useI18n } from "../i18n-provider";
import { ItemThumbnail } from "./global-menu-item-row";

type CatalogPriceFormRow = { price: string; currency: string };

export type NewItemCategoryOption = { id: string; name: string };

type NewGlobalMenuItemClientProps = {
  initialCategories: NewItemCategoryOption[];
  categoriesLoadError: string | null;
  preselectedCategoryId?: string;
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | null;
  return payload?.message ?? payload?.error ?? fallback;
}

export function NewGlobalMenuItemClient({
  initialCategories,
  categoriesLoadError,
  preselectedCategoryId,
}: NewGlobalMenuItemClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const categoryIdField = useId();
  const nameId = useId();
  const descId = useId();
  const grammId = useId();
  const imageId = useId();
  const activeId = useId();

  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState(() => {
    const preselected = preselectedCategoryId?.trim() ?? "";
    if (!preselected) return "";
    return initialCategories.some((c) => c.id === preselected) ? preselected : "";
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gramm, setGramm] = useState("");
  const [catalogPrices, setCatalogPrices] = useState<CatalogPriceFormRow[]>([
    { price: "", currency: "UZS" },
  ]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);

  const [reloadError, setReloadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const maxMenuImageSizeBytes = getMaxUploadSizeBytes("menu-item");

  const listError = categoriesLoadError ?? reloadError;

  const reloadCategories = useCallback(async () => {
    setReloadError(null);
    const res = await fetch("/api/settings/categories", { method: "GET", cache: "no-store" });
    if (!res.ok) {
      setReloadError(await readErrorMessage(res, t("newItem.reloadCategoriesFailed")));
      return;
    }
    const data = (await res.json()) as {
      categories?: Array<{ id: string; name: string }>;
    };
    const next = Array.isArray(data.categories) ? data.categories : [];
    setCategories(next.map((c) => ({ id: c.id, name: c.name })));
    setCategoryId((prev) => {
      if (next.some((c) => c.id === prev)) return prev;
      return next[0]?.id ?? "";
    });
  }, [t]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const previewSrc = imagePreviewUrl ?? imageUrlInput.trim();

  useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const pricesValid = useMemo(() => {
    const seen = new Set<string>();
    for (const row of catalogPrices) {
      if (!row.price.trim().length) continue;
      const c = row.currency.trim().toUpperCase();
      if (!c || seen.has(c)) return false;
      seen.add(c);
    }
    return true;
  }, [catalogPrices]);

  const canSubmit =
    sortedCategories.length > 0 &&
    categoryId.length > 0 &&
    name.trim().length > 0 &&
    pricesValid &&
    !submitting;
  const controlsDisabled = sortedCategories.length === 0 || submitting;
  const hasCategorySelected = categoryId.length > 0;

  const applyImageFile = useCallback(
    (file: File) => {
      if (file.size > maxMenuImageSizeBytes) {
        setImageFile(null);
        setImagePreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setImageError(
          t("newItem.imageTooLarge", {
            maxMb: String(Math.round(maxMenuImageSizeBytes / (1024 * 1024))),
          }),
        );
        return;
      }
      setImageFile(file);
      setImageError(null);
      setSubmitError(null);
      setImageUrlInput("");
      setImagePreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    [maxMenuImageSizeBytes, t],
  );

  const onImagePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement | HTMLInputElement>) => {
      if (controlsDisabled) return;
      const file = getImageFileFromClipboardEvent(e.nativeEvent);
      if (!file) return;
      e.preventDefault();
      applyImageFile(file);
    },
    [applyImageFile, controlsDisabled],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    setImageError(null);
    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        if (imageFile.size > maxMenuImageSizeBytes) {
          setImageError(
            t("newItem.imageTooLarge", {
              maxMb: String(Math.round(maxMenuImageSizeBytes / (1024 * 1024))),
            }),
          );
          return;
        }
        try {
          imageUrl = await uploadFileToR2(imageFile, "menu-item");
        } catch (uploadErr) {
          setSubmitError(
            uploadErr instanceof Error && uploadErr.message.trim().length
              ? uploadErr.message
              : t("newItem.imageUploadFailed"),
          );
          return;
        }
      } else if (imageUrlInput.trim()) {
        imageUrl = imageUrlInput.trim();
      }

      const res = await fetch("/api/settings/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          name: name.trim(),
          description: description.trim() || undefined,
          gramm: gramm.trim() || undefined,
          image: imageUrl,
          prices: catalogPrices
            .filter((r) => r.price.trim().length > 0)
            .map((r) => ({
              price: r.price.trim(),
              currency: r.currency.trim().toUpperCase(),
            })),
          active,
        }),
      });
      if (!res.ok) {
        setSubmitError(await readErrorMessage(res, t("newItem.createFailed")));
        return;
      }

      const successPayload = (await res.json().catch(() => null)) as
        | ({
            item?: {
              id?: unknown;
              name?: unknown;
              active?: unknown;
              image?: unknown;
              description?: unknown;
              gramm?: unknown;
              tags?: unknown;
              prices?: unknown;
              translations?: unknown;
            };
          } & Record<string, unknown>)
        | null;
      const created = successPayload?.item;
      if (
        created &&
        typeof created.id === "string" &&
        typeof created.name === "string" &&
        Array.isArray(created.prices)
      ) {
        const prices = created.prices.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const r = row as Record<string, unknown>;
          if (
            typeof r.id !== "string" ||
            typeof r.price !== "string" ||
            typeof r.currency !== "string"
          ) {
            return [];
          }
          return [{ id: r.id, price: r.price, currency: r.currency }];
        });
        const tags = Array.isArray(created.tags)
          ? created.tags.filter((t): t is string => typeof t === "string")
          : undefined;
        const translations = Array.isArray(created.translations)
          ? (created.translations as TranslationTextApi[])
          : undefined;
        appendMenuItemMutation({
          kind: "upsert",
          categoryId,
          item: {
            id: created.id,
            name: created.name,
            active: typeof created.active === "boolean" ? created.active : undefined,
            image: typeof created.image === "string" ? created.image : undefined,
            description:
              typeof created.description === "string" ? created.description : undefined,
            gramm: typeof created.gramm === "string" ? created.gramm : undefined,
            tags,
            prices,
            ...(translations !== undefined ? { translations } : {}),
          },
        });
      }

      persistPendingLocationExportWarning(
        readLocationExportWarning(successPayload, t),
      );
      router.push("/global-menu");
    } catch {
      setSubmitError(t("newItem.createFailedNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <nav aria-label={t("newItem.breadcrumbNav")}>
        <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
          {t("nav.globalMenu")}
        </p>
        <Link
          href="/global-menu"
          className="mt-2 inline-block text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
        >
          {`← ${t("newItem.back")}`}
        </Link>
      </nav>

      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-6 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("newItem.title")}
        </h1>
        <p className="mt-2 text-sm text-foreground/60">{t("newItem.subtitle")}</p>

        {listError != null ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
          >
            <p className="font-medium">{t("newItem.categoriesUnavailable")}</p>
            <p className="mt-1 text-foreground/80">
              {listError === "unauthorized"
                ? t("newItem.loadErrorUnauthorized")
                : listError}
            </p>
            {listError !== "unauthorized" ? (
              <button
                type="button"
                onClick={() => void reloadCategories()}
                className="mt-3 min-h-10 rounded-lg border border-foreground/20 px-3 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("newItem.retryLoadCategories")}
              </button>
            ) : null}
          </div>
        ) : null}

        {!listError && sortedCategories.length === 0 ? (
          <div className="mt-5 rounded-xl border border-foreground/15 bg-foreground/5 px-4 py-4 text-sm text-foreground/80">
            <p>{t("newItem.noCategories")}</p>
            <Link
              href="/global-menu/categories"
              className="mt-2 inline-block font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
            >
              {t("newItem.manageCategoriesLink")}
            </Link>
          </div>
        ) : null}

        {submitError ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-foreground"
          >
            {submitError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <label htmlFor={categoryIdField} className="text-sm font-medium text-foreground">
              {t("newItem.category")}
            </label>
            <select
              id={categoryIdField}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              disabled={controlsDisabled}
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{t("newItem.selectCategoryPlaceholder")}</option>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {!hasCategorySelected ? (
            <p className="rounded-xl border border-foreground/10 bg-foreground/5 px-3.5 py-3 text-sm text-foreground/70">
              {t("newItem.selectCategoryFirst")}
            </p>
          ) : null}

          {hasCategorySelected ? (
            <>
              <div className="space-y-2">
                <label htmlFor={nameId} className="text-sm font-medium text-foreground">
                  {t("common.name")}
                </label>
                <input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                  disabled={controlsDisabled}
                  className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
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
                  maxLength={2000}
                  disabled={controlsDisabled}
                  className="w-full resize-y rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
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
                  disabled={controlsDisabled}
                  className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
                  placeholder={t("global.grammPlaceholder")}
                />
                <p className="text-xs text-foreground/50">{t("global.grammOptionalHint")}</p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("newItem.catalogPrices")}
                  </label>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() =>
                      setCatalogPrices((rows) => [
                        ...rows,
                        { price: "", currency: "USD" },
                      ])
                    }
                    className="min-h-9 rounded-lg border border-foreground/20 px-3 text-xs font-medium text-foreground hover:bg-foreground/5 disabled:opacity-50"
                  >
                    {t("newItem.addCurrencyPrice")}
                  </button>
                </div>
                <p className="text-xs text-foreground/50">{t("newItem.catalogPricesHint")}</p>
                <ul className="space-y-3">
                  {catalogPrices.map((row, index) => (
                    <li
                      key={index}
                      className="grid gap-3 rounded-xl border border-foreground/10 bg-foreground/3 p-3 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto] sm:items-end"
                    >
                      <div className="space-y-1">
                        <span className="text-xs text-foreground/55">{t("global.price")}</span>
                        <input
                          value={row.price}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCatalogPrices((prev) =>
                              prev.map((r, i) => (i === index ? { ...r, price: v } : r)),
                            );
                          }}
                          inputMode="decimal"
                          disabled={controlsDisabled}
                          className="h-10 w-full rounded-lg border border-foreground/15 bg-background/80 px-3 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
                          placeholder="45000.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-foreground/55">{t("global.currency")}</span>
                        <select
                          value={row.currency}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCatalogPrices((prev) =>
                              prev.map((r, i) => (i === index ? { ...r, currency: v } : r)),
                            );
                          }}
                          disabled={controlsDisabled}
                          className="h-10 w-full rounded-lg border border-foreground/15 bg-background/80 px-3 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
                        >
                          {SUPPORTED_CATALOG_CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          type="button"
                          disabled={controlsDisabled || catalogPrices.length <= 1}
                          onClick={() =>
                            setCatalogPrices((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="h-10 rounded-lg border border-red-500/30 px-3 text-xs font-medium text-red-700 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300"
                        >
                          {t("newItem.removePriceRow")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <label htmlFor={imageId} className="text-sm font-medium text-foreground">
                  {t("global.imageUrlOrPath")}
                </label>
                <div
                  className="rounded-2xl border border-foreground/12 bg-foreground/[0.03] p-3 ring-1 ring-foreground/5 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                  tabIndex={controlsDisabled ? -1 : 0}
                  onPaste={onImagePaste}
                >
                  <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                        {t("global.imagePreviewAlt")}
                      </p>
                      <div className="relative size-28 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 ring-1 ring-foreground/5">
                        {previewSrc ? (
                          <ItemThumbnail
                            src={previewSrc}
                            alt={t("global.imagePreviewAlt")}
                            sizes="112px"
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
                        value={imageUrlInput}
                        onChange={(e) => {
                          setImageUrlInput(e.target.value);
                          if (imageFile) {
                            setImageFile(null);
                            setImagePreviewUrl((prev) => {
                              if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                              return null;
                            });
                          }
                        }}
                        onPaste={onImagePaste}
                        disabled={controlsDisabled}
                        className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
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
                        id={imageId}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (!file) {
                            setImageFile(null);
                            setImageError(null);
                            setSubmitError(null);
                            setImagePreviewUrl((prev) => {
                              if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                              return null;
                            });
                            e.currentTarget.value = "";
                            return;
                          }
                          applyImageFile(file);
                          e.currentTarget.value = "";
                        }}
                        disabled={controlsDisabled}
                        className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15 disabled:opacity-60"
                      />
                      {imageError ? (
                        <p className="text-xs text-red-600 dark:text-red-300">{imageError}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-foreground/50">{t("global.leaveEmptyNoPhoto")}</p>
                <p className="text-xs text-foreground/50">{t("global.imagePasteHint")}</p>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-foreground/3 px-4 py-3">
                <input
                  id={activeId}
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={controlsDisabled}
                  className="mt-1 size-4 shrink-0 rounded border-foreground/25 text-foreground focus:ring-foreground/30"
                />
                <label htmlFor={activeId} className="text-sm text-foreground/90">
                  <span className="font-medium text-foreground">{t("newItem.activeLabel")}</span>
                  <span className="mt-0.5 block text-xs text-foreground/55">
                    {t("newItem.activeHint")}
                  </span>
                </label>
              </div>
            </>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-foreground/10 pt-5 sm:flex-row sm:justify-end">
            <Link
              href={submitting ? "#" : "/global-menu"}
              onClick={(e) => {
                if (submitting) e.preventDefault();
              }}
              aria-disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              {t("common.cancel")}
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t("newItem.creating") : t("newItem.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
