"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { MenuCategory, MenuItem } from "@/lib/data/global-menu-types";
import { getCategoryDisplayForLocale } from "@/lib/category-locale-display";
import { useI18n } from "../i18n-provider";
import { GlobalMenuItemRow } from "./global-menu-item-row";

type GlobalMenuCategorySectionProps = {
  category: MenuCategory;
  onEditItem: (categoryId: string, itemId: string) => void;
  onToggleActive: (categoryId: string, itemId: string) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  isItemBusy?: (itemId: string) => boolean;
  hideEditButton?: boolean;
  showAddItemButton?: boolean;
  /** Custom slot rendered on the top-right of the section header. Takes precedence over `showAddItemButton`. */
  headerActions?: ReactNode;
  /** Optional message to render in place of the items grid when the category has no items. */
  emptyMessage?: ReactNode;
  onEditItemTranslations?: (categoryId: string, itemId: string) => void;
};

/** Matches grid: 1 col (≤639px), 2 cols (640–1023px), 3 cols (≥1024px) — one row each when collapsed. */
function getCollapsedItemCap(): number {
  if (typeof window === "undefined") return 3;
  if (window.matchMedia("(max-width: 639px)").matches) return 3;
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  return 2;
}

function subscribeCollapsedItemCap(callback: () => void) {
  const queries = ["(max-width: 639px)", "(min-width: 640px) and (max-width: 1023px)", "(min-width: 1024px)"];
  const mqs = queries.map((q) => window.matchMedia(q));
  const fn = () => callback();
  for (const mq of mqs) mq.addEventListener("change", fn);
  return () => {
    for (const mq of mqs) mq.removeEventListener("change", fn);
  };
}

function getServerCollapsedItemCap(): number {
  return 3;
}

type CategoryItemsBodyProps = {
  categoryId: string;
  items: MenuItem[];
  collapsedCap: number;
  onEditItem: (categoryId: string, itemId: string) => void;
  onToggleActive: (categoryId: string, itemId: string) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  isItemBusy?: (itemId: string) => boolean;
  hideEditButton: boolean;
  onEditItemTranslations?: (categoryId: string, itemId: string) => void;
};

function GlobalMenuCategoryItemsBody({
  categoryId,
  items,
  collapsedCap,
  onEditItem,
  onToggleActive,
  onDeleteItem,
  isItemBusy,
  hideEditButton,
  onEditItemTranslations,
}: CategoryItemsBodyProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const count = items.length;
  const needsToggle = count > collapsedCap;
  const displayItems =
    !mounted || expanded || !needsToggle ? items : items.slice(0, collapsedCap);

  return (
    <div className="flex flex-col">
      <ul className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-5 lg:grid-cols-3">
        {displayItems.map((item, index) => (
          <GlobalMenuItemRow
            key={item.id}
            item={item}
            categoryId={categoryId}
            onEdit={onEditItem}
            onToggleActive={onToggleActive}
            onDelete={onDeleteItem}
            onEditTranslations={onEditItemTranslations}
            isBusy={isItemBusy?.(item.id) ?? false}
            hideEditButton={hideEditButton}
            thumbnailPriority={index < 6}
          />
        ))}
      </ul>
      {mounted && needsToggle ? (
        <div className="flex justify-center border-t border-foreground/10 px-4 pb-4 pt-3 sm:px-5">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-background/80 px-4 py-2.5 text-sm font-semibold text-foreground/80 shadow-sm ring-1 ring-foreground/5 transition-[color,background,box-shadow,transform,border-color] hover:bg-foreground/5 hover:text-foreground hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/25"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <span className="inline-flex shrink-0 text-foreground/70" aria-hidden>
              {expanded ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 15l6-6 6 6" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              )}
            </span>
            {expanded ? t("global.showLessItems") : t("global.showAllItems")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function GlobalMenuCategorySection({
  category,
  onEditItem,
  onToggleActive,
  onDeleteItem,
  isItemBusy,
  hideEditButton = false,
  showAddItemButton = false,
  headerActions,
  emptyMessage,
  onEditItemTranslations,
}: GlobalMenuCategorySectionProps) {
  const { t, locale } = useI18n();
  const count = category.items.length;
  const { name: headerName } = getCategoryDisplayForLocale(
    category.name,
    category.description,
    category.translations,
    locale,
  );

  const collapsedCap = useSyncExternalStore(
    subscribeCollapsedItemCap,
    getCollapsedItemCap,
    getServerCollapsedItemCap,
  );
  const itemIdsKey = category.items.map((i) => i.id).join("|");

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background/60 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md">
      <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {headerName}
            </h2>
            <p className="mt-0.5 text-xs text-foreground/50">
              {count} {count === 1 ? t("categories.itemSingular") : t("categories.itemPlural")}
            </p>
          </div>
          {headerActions ? (
            <div className="flex items-center gap-2">{headerActions}</div>
          ) : showAddItemButton ? (
            <Link
              href={`/global-menu/items/new?categoryId=${encodeURIComponent(category.id)}`}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-foreground/20 bg-background/80 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              {t("global.addNewInCategory", { name: headerName })}
            </Link>
          ) : null}
        </div>
      </div>
      {count === 0 && emptyMessage ? (
        <div className="px-4 py-5 text-sm text-foreground/55 sm:px-5">{emptyMessage}</div>
      ) : (
        <GlobalMenuCategoryItemsBody
          key={`${category.id}|${itemIdsKey}`}
          categoryId={category.id}
          items={category.items}
          collapsedCap={collapsedCap}
          onEditItem={onEditItem}
          onToggleActive={onToggleActive}
          onDeleteItem={onDeleteItem}
          isItemBusy={isItemBusy}
          hideEditButton={hideEditButton}
          onEditItemTranslations={onEditItemTranslations}
        />
      )}
    </section>
  );
}
