"use client";

import type { Locale } from "@/lib/i18n/types";
import { useI18n } from "@/app/components/i18n-provider";
import {
  GlobalMenuItemTableRow,
  type GlobalMenuItemTableRowData,
} from "./global-menu-item-table-row";

type GlobalMenuItemsTableProps = {
  rows: GlobalMenuItemTableRowData[];
  locale: Locale;
  isItemBusy: (categoryId: string, itemId: string) => boolean;
  onEditItem: (categoryId: string, itemId: string) => void;
  onToggleActive: (categoryId: string, itemId: string) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  onEditItemTranslations?: (categoryId: string, itemId: string) => void;
};

export function GlobalMenuItemsTable({
  rows,
  locale,
  isItemBusy,
  onEditItem,
  onToggleActive,
  onDeleteItem,
  onEditItemTranslations,
}: GlobalMenuItemsTableProps) {
  const { t } = useI18n();

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-background/40 ring-1 ring-foreground/5">
      <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-xs font-medium uppercase tracking-wider text-foreground/50">
            <th className="w-16 px-4 py-3 pl-5" scope="col">
              <span className="sr-only">{t("global.noImage")}</span>
            </th>
            <th className="px-4 py-3" scope="col">
              {t("catalog.category")}
            </th>
            <th className="px-4 py-3" scope="col">
              {t("common.name")}
            </th>
            <th className="px-4 py-3" scope="col">
              {t("global.description")}
            </th>
            <th className="px-4 py-3" scope="col">
              {t("global.price")}
            </th>
            <th className="px-4 py-3" scope="col">
              {t("common.status")}
            </th>
            <th className="w-32 px-3 py-3 pr-5 text-right" scope="col">
              <span className="sr-only">{t("common.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <GlobalMenuItemTableRow
              key={`${row.categoryId}:${row.item.id}`}
              row={row}
              locale={locale}
              rowIndex={index}
              isBusy={isItemBusy(row.categoryId, row.item.id)}
              onEditItem={onEditItem}
              onToggleActive={onToggleActive}
              onDeleteItem={onDeleteItem}
              onEditItemTranslations={onEditItemTranslations}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
