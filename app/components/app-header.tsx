"use client";

import { Suspense, useCallback, useEffect, useId, useState } from "react";
import { AppLogo } from "./app-logo";
import { AppSidebarNav } from "./app-sidebar-nav";
import { LanguageSwitcher } from "./language-switcher";
import { RestaurantSwitcher } from "./restaurant-switcher";
import { SignOutButton } from "./sign-out-button";
import { useI18n } from "./i18n-provider";

type AppHeaderProps = {
  email: string | null;
};

export function AppHeader({ email }: AppHeaderProps) {
  const { t } = useI18n();
  const [navOpen, setNavOpen] = useState(false);
  const panelId = useId();
  const close = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen, close]);

  return (
    <>
      <header className="relative z-20 flex min-h-14 shrink-0 items-center gap-2 border-b border-foreground/10 bg-background/40 px-3 py-2.5 backdrop-blur-md sm:min-h-16 sm:gap-3 sm:px-4 sm:py-3 md:px-6">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-foreground/15 bg-background/80 text-foreground shadow-sm ring-1 ring-foreground/5 backdrop-blur-sm md:hidden"
          aria-expanded={navOpen}
          aria-controls={panelId}
          onClick={() => setNavOpen(true)}
        >
          <span className="sr-only">{t("common.navigation")}</span>
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <AppLogo href="/" />
          <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
            {t("common.appName")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <RestaurantSwitcher />
          {email ? (
            <span
              className="hidden max-w-56 truncate text-sm text-foreground/70 md:inline md:max-w-72"
              title={email}
            >
              {email}
            </span>
          ) : null}
          <LanguageSwitcher />

          <SignOutButton />
        </div>
      </header>

      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label={t("common.close")}
            onClick={close}
          />
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={t("common.navigation")}
            className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2.5rem))] max-w-[min(20rem,calc(100vw-2.5rem))] flex-col border-r border-foreground/10 bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] shadow-xl shadow-foreground/10 ring-1 ring-foreground/5 backdrop-blur-md"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-foreground/10 px-3 py-3 sm:px-4">
              <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
                {t("common.navigation")}
              </p>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl border border-foreground/15 text-foreground hover:bg-foreground/5"
                onClick={close}
                aria-label={t("common.close")}
              >
                <svg
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <Suspense fallback={null}>
                <AppSidebarNav onNavigate={close} />
              </Suspense>
            </div>
            {email ? (
              <div className="shrink-0 border-t border-foreground/10 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-widest text-foreground/50">
                  {t("settings.signedInAs")}
                </p>
                <p className="mt-1 break-all text-sm text-foreground/80">
                  {email}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
