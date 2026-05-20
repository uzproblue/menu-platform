"use client";

import { useI18n } from "@/app/components/i18n-provider";
import type { MenuCatalogViewMode } from "./menu-catalog-view-mode";

type MenuCatalogViewToggleProps = {
  value: MenuCatalogViewMode;
  onChange: (mode: MenuCatalogViewMode) => void;
};

function GridIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M3 14h18M3 6h18M3 18h18"
      />
    </svg>
  );
}

export function MenuCatalogViewToggle({ value, onChange }: MenuCatalogViewToggleProps) {
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("catalog.viewMode")}
      className="inline-flex rounded-xl border border-foreground/15 bg-background/80 p-1 shadow-sm ring-1 ring-foreground/5"
    >
      <button
        type="button"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
        className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          value === "grid"
            ? "bg-foreground text-background"
            : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        <GridIcon />
        <span>{t("catalog.viewGrid")}</span>
      </button>
      <button
        type="button"
        aria-pressed={value === "table"}
        onClick={() => onChange("table")}
        className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          value === "table"
            ? "bg-foreground text-background"
            : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        <TableIcon />
        <span>{t("catalog.viewTable")}</span>
      </button>
    </div>
  );
}
