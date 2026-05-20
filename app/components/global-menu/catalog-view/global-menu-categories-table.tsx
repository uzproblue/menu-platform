"use client";

import Image from "next/image";
import type { CategoryShape } from "@/lib/pending-mutations";
import { getCategoryDisplayForLocale } from "@/lib/category-locale-display";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import type { Locale } from "@/lib/i18n/types";
import { useI18n } from "@/app/components/i18n-provider";

type GlobalMenuCategoriesTableProps = {
  categories: CategoryShape[];
  locale: Locale;
  onOpenTranslations: (category: CategoryShape) => void;
  onEdit: (categoryId: string) => void;
  onDelete: (category: CategoryShape) => void;
};

function CategoryTableThumbnail({
  coverPhoto,
  name,
  priority,
}: {
  coverPhoto: string | null | undefined;
  name: string;
  priority: boolean;
}) {
  if (coverPhoto?.trim()) {
    return (
      <div className="relative size-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Image
          src={coverPhoto}
          alt={`${name} cover`}
          fill
          className="object-cover"
          sizes="40px"
          priority={priority}
          {...(!priority ? { loading: "lazy" as const } : {})}
          unoptimized={imageSrcIsNonOptimizable(coverPhoto)}
        />
      </div>
    );
  }
  return (
    <div className="size-10 shrink-0 rounded-lg bg-gradient-to-br from-foreground/15 to-foreground/5 ring-1 ring-foreground/10" />
  );
}

export function GlobalMenuCategoriesTable({
  categories,
  locale,
  onOpenTranslations,
  onEdit,
  onDelete,
}: GlobalMenuCategoriesTableProps) {
  const { t } = useI18n();

  if (categories.length === 0) {
    return null;
  }

  const actionBtn =
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-foreground/15 bg-background text-foreground transition-colors hover:bg-foreground/5";
  const deleteBtn =
    "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-red-400/40 text-red-700 transition-colors hover:bg-red-500/10 dark:text-red-300";

  return (
    <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-background/40 ring-1 ring-foreground/5">
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-xs font-medium uppercase tracking-wider text-foreground/50">
            <th className="w-16 px-4 py-3 pl-5" scope="col">
              <span className="sr-only">{t("global.noImage")}</span>
            </th>
            <th className="px-4 py-3" scope="col">
              {t("common.name")}
            </th>
            <th className="px-4 py-3" scope="col">
              {t("global.description")}
            </th>
            <th className="px-4 py-3" scope="col">
              {t("catalog.section")}
            </th>
            <th className="px-4 py-3 text-right tabular-nums" scope="col">
              {t("common.items")}
            </th>
            <th className="w-32 px-3 py-3 pr-5 text-right" scope="col">
              <span className="sr-only">{t("common.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat, index) => {
            const display = getCategoryDisplayForLocale(
              cat.name,
              cat.description,
              cat.translations,
              locale,
            );
            const sectionLabel =
              cat.menuSection === "beverages"
                ? t("categories.sectionBadgeBeverages")
                : t("categories.sectionBadgeDishes");

            return (
              <tr
                key={cat.id}
                className="border-b border-foreground/5 last:border-0 transition-colors hover:bg-foreground/3"
              >
                <td className="px-4 py-3 pl-5">
                  <CategoryTableThumbnail
                    coverPhoto={cat.coverPhoto}
                    name={display.name}
                    priority={index < 8}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{display.name}</td>
                <td className="max-w-md px-4 py-3 text-foreground/65">
                  <span className="line-clamp-2">
                    {display.description?.trim() ||
                      t("categories.translationsModal.noDescription")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-foreground/8 px-2.5 py-0.5 text-xs font-medium text-foreground/75">
                    {sectionLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
                  {cat.itemsCount}
                </td>
                <td className="px-3 py-3 pr-5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenTranslations(cat)}
                      className={actionBtn}
                      aria-label={t("categories.translationsModal.openAria", {
                        name: display.name,
                      })}
                    >
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
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
                      onClick={() => onEdit(cat.id)}
                      className={actionBtn}
                      aria-label={t("categories.editCategoryAria", { name: display.name })}
                    >
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(cat)}
                      className={deleteBtn}
                      aria-label={t("categories.deleteCategoryAria", { name: display.name })}
                    >
                      <svg
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
