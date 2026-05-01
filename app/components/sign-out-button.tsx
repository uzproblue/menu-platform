"use client";

import { signOut } from "next-auth/react";
import { useI18n } from "./i18n-provider";

export function SignOutButton() {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="min-h-11 touch-manipulation rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 sm:min-h-0 sm:py-1.5"
    >
      {t("auth.signOut")}
    </button>
  );
}
