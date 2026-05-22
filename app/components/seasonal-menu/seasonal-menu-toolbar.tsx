"use client";

import { useI18n } from "@/app/components/i18n-provider";

type SeasonalMenuToolbarProps = {
  title: string;
  onTitleChange: (title: string) => void;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onAddText: () => void;
  onDeleteSelected: () => void;
  onExportPdf: () => void;
  onEditSelection?: () => void;
  hasSelection: boolean;
};

export function SeasonalMenuToolbar({
  title,
  onTitleChange,
  saving,
  saveError,
  onSave,
  onAddText,
  onDeleteSelected,
  onExportPdf,
  onEditSelection,
  hasSelection,
}: SeasonalMenuToolbarProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-foreground/10 bg-background/90 px-3 py-2">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="min-w-[12rem] flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm font-medium"
        aria-label={t("seasonalMenu.designTitle")}
      />
      {onEditSelection ? (
        <button
          type="button"
          onClick={onEditSelection}
          className="rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5"
        >
          {t("seasonalMenu.editSelection")}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onAddText}
        className="rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5"
      >
        {t("seasonalMenu.addText")}
      </button>
      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        className="rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-40"
      >
        {t("common.delete")}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
      >
        {saving ? t("seasonalMenu.saving") : t("common.save")}
      </button>
      <button
        type="button"
        onClick={onExportPdf}
        className="rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5"
      >
        {t("seasonalMenu.downloadPdf")}
      </button>
      {saveError ? (
        <span className="w-full text-xs text-red-600 sm:w-auto">{saveError}</span>
      ) : null}
    </div>
  );
}
