"use client";

import Link from "next/link";
import type { MenuCategory } from "@/lib/data/global-menu-types";
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
};

export function GlobalMenuCategorySection({
  category,
  onEditItem,
  onToggleActive,
  onDeleteItem,
  isItemBusy,
  hideEditButton = false,
  showAddItemButton = false,
}: GlobalMenuCategorySectionProps) {
  const { t } = useI18n();
  const count = category.items.length;
  return (
    <section className="rounded-2xl border border-foreground/10 bg-background/60 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md">
      <div className="border-b border-foreground/10 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {category.name}
            </h2>
            <p className="mt-0.5 text-xs text-foreground/50">
              {count} {count === 1 ? t("categories.itemSingular") : t("categories.itemPlural")}
            </p>
          </div>
          {showAddItemButton ? (
            <Link
              href={`/global-menu/items/new?categoryId=${encodeURIComponent(category.id)}`}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-foreground/20 bg-background/80 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5"
            >
              {t("global.addNewInCategory", { name: category.name })}
            </Link>
          ) : null}
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-5 lg:grid-cols-3">
        {category.items.map((item) => (
          <GlobalMenuItemRow
            key={item.id}
            item={item}
            categoryId={category.id}
            onEdit={onEditItem}
            onToggleActive={onToggleActive}
            onDelete={onDeleteItem}
            isBusy={isItemBusy?.(item.id) ?? false}
            hideEditButton={hideEditButton}
          />
        ))}
      </ul>
    </section>
  );
}
