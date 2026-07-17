"use client";

import Link from "next/link";
import { useI18n } from "../i18n-provider";

type AddMenuItemButtonProps = {
  sectionId: string;
};

export function AddMenuItemButton({ sectionId }: AddMenuItemButtonProps) {
  const { t } = useI18n();
  return (
    <Link
      href={`/global-menu/items/new?section=${encodeURIComponent(sectionId)}`}
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
      {t("global.addNewItem")}
    </Link>
  );
}
