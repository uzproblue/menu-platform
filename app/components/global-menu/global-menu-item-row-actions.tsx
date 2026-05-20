"use client";

import { useI18n } from "@/app/components/i18n-provider";

type GlobalMenuItemRowActionsProps = {
  itemName: string;
  categoryId: string;
  itemId: string;
  isBusy?: boolean;
  onEdit: (categoryId: string, itemId: string) => void;
  onDelete: (categoryId: string, itemId: string) => void;
  onEditTranslations?: (categoryId: string, itemId: string) => void;
  /** Card overlay uses larger buttons; table uses compact. */
  variant?: "card" | "table";
};

const cardButtonClass =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border border-foreground/15 bg-background/90 text-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-md transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-55";

const tableButtonClass =
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-foreground/15 bg-background text-foreground transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-55";

const cardDeleteClass =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border border-red-400/40 bg-background/90 text-red-700 shadow-md ring-1 ring-red-400/25 backdrop-blur-md transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-55 dark:text-red-300";

const tableDeleteClass =
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-red-400/40 text-red-700 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-55 dark:text-red-300";

export function GlobalMenuItemRowActions({
  itemName,
  categoryId,
  itemId,
  isBusy = false,
  onEdit,
  onDelete,
  onEditTranslations,
  variant = "card",
}: GlobalMenuItemRowActionsProps) {
  const { t } = useI18n();
  const btn = variant === "table" ? tableButtonClass : cardButtonClass;
  const delBtn = variant === "table" ? tableDeleteClass : cardDeleteClass;
  const iconClass = variant === "table" ? "size-4" : "size-5";

  return (
    <div className="flex items-center justify-end gap-1.5">
      {onEditTranslations ? (
        <button
          type="button"
          onClick={() => onEditTranslations(categoryId, itemId)}
          disabled={isBusy}
          className={btn}
          aria-label={t("global.editItemTranslationsAria", { name: itemName })}
        >
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onEdit(categoryId, itemId)}
        disabled={isBusy}
        className={btn}
        aria-label={t("global.editItemAria", { name: itemName })}
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
        onClick={() => onDelete(categoryId, itemId)}
        disabled={isBusy}
        className={delBtn}
        aria-label={t("global.deleteItemAria", { name: itemName })}
      >
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}
