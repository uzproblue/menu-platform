"use client";

import { AppSidebarNav } from "./app-sidebar-nav";
import { useI18n } from "./i18n-provider";

export function AppSidebar() {
  const { t } = useI18n();
  return (
    <aside className="hidden h-full min-h-0 w-56 shrink-0 flex-col p-3 sm:w-60 sm:p-4 md:flex md:p-5 lg:w-64">
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-foreground/10 bg-background/60 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md">
        <div className="border-b border-foreground/10 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
            {t("common.navigation")}
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <AppSidebarNav />
        </div>
      </div>
    </aside>
  );
}
