"use client";

import type { MenuItem } from "@/lib/data/global-menu-types";
import { getMenuItemDisplayForLocale } from "@/lib/category-locale-display";
import type { Locale } from "@/lib/i18n/types";
import { useI18n } from "@/app/components/i18n-provider";
import {
  formatCatalogPrices,
  ItemActiveToggle,
  ItemThumbnail,
} from "../global-menu-item-row";
import { GlobalMenuItemRowActions } from "../global-menu-item-row-actions";

export type GlobalMenuItemTableRowData = {
  item: MenuItem;
  categoryId: string;
  categoryName: string;
};

type GlobalMenuItemTableRowProps = {
  row: GlobalMenuItemTableRowData;
  locale: Locale;
  rowIndex: number;
  isBusy: boolean;
  onEditItem: (categoryId: string, itemId: string) => void;
  onToggleActive: (categoryId: string, itemId: string) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  onEditItemTranslations?: (categoryId: string, itemId: string) => void;
};

function isActive(item: MenuItem) {
  return item.active !== false;
}

function TableThumbnail({ item, alt, priority }: { item: MenuItem; alt: string; priority: boolean }) {
  const displayImage = (item.resolvedImage ?? item.image)?.trim();
  if (!displayImage) {
    return (
      <div className="flex size-10 items-center justify-center rounded-lg bg-foreground/8 text-foreground/35">
        <svg className="size-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.25}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }
  return (
    <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-foreground/5 ring-1 ring-foreground/10">
      <ItemThumbnail
        src={displayImage}
        alt={alt}
        sizes="40px"
        priority={priority}
      />
    </div>
  );
}

export function GlobalMenuItemTableRow({
  row,
  locale,
  rowIndex,
  isBusy,
  onEditItem,
  onToggleActive,
  onDeleteItem,
  onEditItemTranslations,
}: GlobalMenuItemTableRowProps) {
  const { t } = useI18n();
  const { item, categoryId, categoryName } = row;
  const active = isActive(item);
  const disabledUi = !active;
  const display = getMenuItemDisplayForLocale(
    item.name,
    item.description,
    item.translations,
    locale,
  );
  const busyUpdatingLabel = t("global.itemToggleUpdating");

  return (
    <tr
      className={`border-b border-foreground/5 last:border-0 transition-colors hover:bg-foreground/3 ${
        disabledUi ? "bg-red-500/3" : ""
      }`}
    >
      <td className="px-4 py-3 pl-5">
        <TableThumbnail item={item} alt={display.name} priority={rowIndex < 12} />
      </td>
      <td className="max-w-[10rem] px-4 py-3 text-sm text-foreground/75">
        <span className="line-clamp-2">{categoryName}</span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`font-medium ${
            disabledUi
              ? "text-red-700 line-through decoration-red-500/80 dark:text-red-300"
              : "text-foreground"
          }`}
        >
          {display.name}
        </span>
      </td>
      <td className="max-w-xs px-4 py-3 text-sm text-foreground/65">
        <span className="line-clamp-2">
          {display.description?.trim() || t("global.noDescription")}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-foreground">
        {item.prices.length > 0 ? formatCatalogPrices(item.prices) : "—"}
      </td>
      <td className="px-4 py-3">
        <ItemActiveToggle
          active={active}
          onToggle={() => onToggleActive(categoryId, item.id)}
          disabled={isBusy}
          busy={isBusy}
          prominentOff={disabledUi}
          disableLabel={isBusy ? busyUpdatingLabel : t("global.disableItem")}
          enableLabel={t("global.enableItem")}
        />
      </td>
      <td className="px-3 py-3 pr-5">
        <GlobalMenuItemRowActions
          itemName={display.name}
          categoryId={categoryId}
          itemId={item.id}
          isBusy={isBusy}
          onEdit={onEditItem}
          onDelete={onDeleteItem}
          onEditTranslations={onEditItemTranslations}
          variant="table"
        />
      </td>
    </tr>
  );
}
