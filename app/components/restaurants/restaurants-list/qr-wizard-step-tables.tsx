"use client";

import { useI18n } from "@/app/components/i18n-provider";
import type { LocationDiningTable } from "@/lib/auth-api/types/locations";

type QrWizardStepTablesProps = {
  sectionName: string;
  sectionIndex: number;
  sectionCount: number;
  tables: LocationDiningTable[];
  selectedTableIds: Set<string>;
  onToggleTable: (tableId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
};

export function QrWizardStepTables({
  sectionName,
  sectionIndex,
  sectionCount,
  tables,
  selectedTableIds,
  onToggleTable,
  onSelectAll,
  onClearAll,
}: QrWizardStepTablesProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">
          {t("restaurants.qrWizardStepTables")}
        </p>
        <p className="mt-1 text-xs text-foreground/55">
          {t("restaurants.qrWizardTablesProgress", {
            section: sectionName,
            current: sectionIndex + 1,
            total: sectionCount,
          })}
        </p>
        <h3 className="mt-1 text-base font-semibold text-foreground">
          {t("restaurants.qrWizardTablesTitle", { section: sectionName })}
        </h3>
        <p className="mt-1 text-sm text-foreground/60">
          {t("restaurants.qrWizardTablesSubtitle")}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="text-sm font-medium text-foreground/70 hover:text-foreground"
          onClick={onSelectAll}
        >
          {t("seasonalMenu.selectAll")}
        </button>
        <button
          type="button"
          className="text-sm font-medium text-foreground/70 hover:text-foreground"
          onClick={onClearAll}
        >
          {t("seasonalMenu.clearSelection")}
        </button>
      </div>

      <ul className="overflow-hidden rounded-xl border border-foreground/10">
        {tables.map((table) => (
          <li key={table.id} className="border-b border-foreground/5 last:border-0">
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-foreground/5">
              <input
                type="checkbox"
                checked={selectedTableIds.has(table.id)}
                onChange={() => onToggleTable(table.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-foreground">
                  {t("restaurants.qrTableNumber", { number: table.number })}
                </span>
                <span className="mt-0.5 block font-mono text-xs text-foreground/55">
                  {table.id}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
