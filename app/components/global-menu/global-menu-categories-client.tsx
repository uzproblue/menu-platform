"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TranslationTextApi } from "@/lib/auth-api";
import { getCategoryDisplayForLocale } from "@/lib/category-locale-display";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import {
  appendCategoryMutation,
  applyCategoryMutations,
  getPendingCategoryMutations,
  setPendingCategoryMutations,
  type CategoryShape,
} from "@/lib/pending-mutations";
import {
  consumePendingLocationExportWarning,
  readLocationExportWarning,
} from "@/lib/location-export-warning";
import { useI18n } from "../i18n-provider";
import { CategoryNameModal } from "./category-name-modal";
import { CategoryTranslationsModal } from "./category-translations-modal";

type Category = CategoryShape;

const EMPTY_CATEGORY_TRANSLATIONS: TranslationTextApi[] = [];

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;
  return payload?.message ?? fallback;
}

export function GlobalMenuCategoriesClient() {
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const pending = consumePendingLocationExportWarning();
    if (pending) setExportWarning(pending);
  }, []);

  const [nameModal, setNameModal] = useState<{ mode: "edit"; categoryId: string } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [translationsModalCategory, setTranslationsModalCategory] = useState<Category | null>(
    null,
  );

  const editingCategory = useMemo(() => {
    if (!nameModal || nameModal.mode !== "edit") return null;
    return categories.find((c) => c.id === nameModal.categoryId) ?? null;
  }, [categories, nameModal]);

  const loadCategories = useCallback(async () => {
    setLoadError(null);
    const response = await fetch("/api/settings/categories", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, t("categories.errLoad")));
    }

    const payload = (await response.json()) as {
      categories?: Array<{
        id: string;
        name: string;
        sortOrder: number;
        itemsCount: number;
        description?: string | null;
        coverPhoto?: string | null;
        translations?: TranslationTextApi[];
      }>;
    };
    const server: Category[] = (
      Array.isArray(payload.categories) ? payload.categories : []
    ).map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      itemsCount: c.itemsCount,
      description: c.description ?? null,
      coverPhoto: c.coverPhoto ?? null,
      translations: Array.isArray(c.translations) ? c.translations : [],
    }));

    // Overlay pending create/edit/delete mutations queued from this client so the
    // UI stays correct even if an intermediate cache (e.g. Hyperdrive's read
    // cache during its TTL window) returns a stale snapshot. Each mutation
    // retires automatically once the server's content matches it.
    const pending = getPendingCategoryMutations();
    const { list: applied, retained } = applyCategoryMutations(server, pending);
    if (retained.length !== pending.length) {
      setPendingCategoryMutations(retained);
    }

    setCategories(
      applied.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    );
  }, [t]);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        await loadCategories();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : t("categories.errLoadNetwork"));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadCategories, t]);

  const handleSaveName = useCallback(
    async (payload: { name: string; description?: string; coverPhoto?: string }) => {
      if (!nameModal) return;
      setRequestError(null);
      setExportWarning(null);
      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/settings/categories/${encodeURIComponent(nameModal.categoryId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("categories.errEdit")));
        }

        // Persist an optimistic upsert so a stale re-fetch (Hyperdrive read
        // cache) cannot visually undo the edit before the cache expires.
        const successPayload = (await response.json().catch(() => null)) as
          | ({
              category?: {
                id?: unknown;
                name?: unknown;
                description?: unknown;
                coverPhoto?: unknown;
                sortOrder?: unknown;
                itemsCount?: unknown;
                translations?: unknown;
              };
            } & Record<string, unknown>)
          | null;
        setExportWarning(readLocationExportWarning(successPayload, t));
        const updated = successPayload?.category;
        if (
          updated &&
          typeof updated.id === "string" &&
          typeof updated.name === "string" &&
          typeof updated.sortOrder === "number" &&
          typeof updated.itemsCount === "number"
        ) {
          const translations = Array.isArray(updated.translations)
            ? (updated.translations as TranslationTextApi[])
            : undefined;
          appendCategoryMutation({
            kind: "upsert",
            value: {
              id: updated.id,
              name: updated.name,
              description:
                typeof updated.description === "string" ? updated.description : null,
              coverPhoto:
                typeof updated.coverPhoto === "string" ? updated.coverPhoto : null,
              sortOrder: updated.sortOrder,
              itemsCount: updated.itemsCount,
              ...(translations !== undefined ? { translations } : {}),
            },
          });
        }

        setNameModal(null);
        await loadCategories();
      } catch (error) {
        const message = error instanceof Error ? error.message : t("categories.errSave");
        setRequestError(message);
        throw new Error(message);
      } finally {
        setIsSaving(false);
      }
    },
    [loadCategories, nameModal, t],
  );

  const handleTranslationsSaved = useCallback(
    (successPayload: Record<string, unknown> | null) => {
      setExportWarning(readLocationExportWarning(successPayload, t));
      const updated = successPayload?.category as
        | {
            id?: unknown;
            name?: unknown;
            description?: unknown;
            coverPhoto?: unknown;
            sortOrder?: unknown;
            itemsCount?: unknown;
            translations?: unknown;
          }
        | undefined;
      if (
        updated &&
        typeof updated.id === "string" &&
        typeof updated.name === "string" &&
        typeof updated.sortOrder === "number" &&
        typeof updated.itemsCount === "number"
      ) {
        const translationsList = Array.isArray(updated.translations)
          ? (updated.translations as TranslationTextApi[])
          : undefined;
        appendCategoryMutation({
          kind: "upsert",
          value: {
            id: updated.id,
            name: updated.name,
            description:
              typeof updated.description === "string" ? updated.description : null,
            coverPhoto:
              typeof updated.coverPhoto === "string" ? updated.coverPhoto : null,
            sortOrder: updated.sortOrder,
            itemsCount: updated.itemsCount,
            ...(translationsList !== undefined ? { translations: translationsList } : {}),
          },
        });
      }
      setTranslationsModalCategory(null);
      void loadCategories();
    },
    [loadCategories, t],
  );

  const handleConfirmDelete = useCallback(() => {
    void (async () => {
      if (!deleteTarget) return;
      setRequestError(null);
      setExportWarning(null);
      setDeletingCategoryId(deleteTarget.id);
      try {
        const response = await fetch(
          `/api/settings/categories/${encodeURIComponent(deleteTarget.id)}`,
          {
            method: "DELETE",
          },
        );
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, t("categories.errDelete")));
        }
        const successPayload = (await response.json().catch(() => null)) as
          | Record<string, unknown>
          | null;
        setExportWarning(readLocationExportWarning(successPayload, t));
        // Persist an optimistic delete so a stale re-fetch cannot resurrect the
        // row visually before the read cache expires.
        appendCategoryMutation({ kind: "delete", id: deleteTarget.id });
        setDeleteTarget(null);
        await loadCategories();
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : t("categories.errDelete"));
      } finally {
        setDeletingCategoryId(null);
      }
    })();
  }, [deleteTarget, loadCategories, t]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("categories.title")}
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            {t("categories.subtitle")}{" "}
            <Link
              href="/global-menu"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {t("categories.globalMenuLink")}
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            href="/global-menu/categories/new"
            aria-disabled={isLoading}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <svg
              className="size-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("categories.addCategory")}
          </Link>
        </div>
      </div>

      {requestError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {requestError}
        </div>
      ) : null}

      {exportWarning ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
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
      ) : null}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">{t("categories.loading")}</p>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">{t("categories.couldNotLoad")}</p>
          <p className="max-w-md text-sm text-foreground/60">{loadError}</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">{t("categories.emptyTitle")}</p>
          <p className="max-w-md text-sm text-foreground/60">{t("categories.emptyHelp")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {categories.map((cat, index) => {
            const display = getCategoryDisplayForLocale(
              cat.name,
              cat.description,
              cat.translations,
              locale,
            );
            return (
            <li
              key={cat.id}
              className="group relative overflow-hidden rounded-2xl border border-foreground/10 ring-1 ring-foreground/5"
            >
              {cat.coverPhoto ? (
                <Image
                  src={cat.coverPhoto}
                  alt={`${display.name} cover`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 672px, 624px"
                  priority={index < 4}
                  {...(index >= 4 ? { loading: "lazy" as const } : {})}
                  unoptimized={imageSrcIsNonOptimizable(cat.coverPhoto)}
                />
              ) : (
                <div className="absolute inset-0 size-full bg-gradient-to-br from-foreground/15 to-foreground/5" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25" />

              <div className="relative flex min-h-44 flex-col justify-between gap-3 p-4 sm:min-h-48 sm:p-5">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setTranslationsModalCategory(cat)}
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-white/20 bg-black/25 text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-black/40"
                    aria-label={t("categories.translationsModal.openAria", { name: display.name })}
                  >
                    <svg className="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNameModal({ mode: "edit", categoryId: cat.id })}
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-white/20 bg-black/25 text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-black/40"
                    aria-label={t("categories.editCategoryAria", { name: display.name })}
                  >
                    <svg className="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(cat)}
                    className="inline-flex size-10 items-center justify-center rounded-xl border border-red-300/45 bg-black/25 text-red-200 backdrop-blur-sm transition-colors hover:border-red-300/70 hover:bg-red-500/20 hover:text-red-100"
                    aria-label={t("categories.deleteCategoryAria", { name: display.name })}
                  >
                    <svg className="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold tracking-tight text-white">{display.name}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-white/80">
                    {display.description?.trim() ||
                      t("categories.translationsModal.noDescription")}
                  </p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-white/75">
                    {cat.itemsCount} {t("common.items")}
                  </p>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <CategoryTranslationsModal
        key={translationsModalCategory?.id ?? "closed"}
        open={translationsModalCategory != null}
        categoryId={translationsModalCategory?.id ?? null}
        categoryTitle={
          translationsModalCategory
            ? getCategoryDisplayForLocale(
                translationsModalCategory.name,
                translationsModalCategory.description,
                translationsModalCategory.translations,
                locale,
              ).name
            : ""
        }
        translations={
          translationsModalCategory?.translations ?? EMPTY_CATEGORY_TRANSLATIONS
        }
        onClose={() => setTranslationsModalCategory(null)}
        onSaved={handleTranslationsSaved}
      />

      <CategoryNameModal
        open={nameModal != null}
        mode="edit"
        categoryId={nameModal?.categoryId}
        initialName={editingCategory?.name ?? ""}
        initialDescription={editingCategory?.description ?? ""}
        initialCoverPhoto={editingCategory?.coverPhoto ?? ""}
        isSaving={isSaving}
        onClose={() => setNameModal(null)}
        onSave={handleSaveName}
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
            aria-labelledby="delete-cat-title"
            className="relative z-10 w-full max-w-md rounded-t-2xl border border-foreground/10 bg-background/95 p-5 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
          >
            <h2 id="delete-cat-title" className="text-lg font-semibold text-foreground">
              {t("categories.deleteCategoryQuestion")}
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              {t("categories.deleteCategoryBody", {
                name: getCategoryDisplayForLocale(
                  deleteTarget.name,
                  deleteTarget.description,
                  deleteTarget.translations,
                  locale,
                ).name,
                id: deleteTarget.id,
                count: deleteTarget.itemsCount,
                suffix:
                  deleteTarget.itemsCount === 1
                    ? t("categories.itemSingular")
                    : t("categories.itemPlural"),
              })}
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
                disabled={deletingCategoryId === deleteTarget.id}
                className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-medium text-white hover:opacity-90 dark:bg-red-700"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
