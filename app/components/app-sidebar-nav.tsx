"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "./i18n-provider";

type NavLinkItem = {
  href: string;
  labelKey: string;
  match: (pathname: string) => boolean;
};

const topLinks: NavLinkItem[] = [
  { href: "/", labelKey: "nav.home", match: (p) => p === "/" },
  {
    href: "/global-menu/categories",
    labelKey: "nav.menuCategories",
    match: (p) => p.startsWith("/global-menu/categories"),
  },
  {
    href: "/restaurants",
    labelKey: "nav.restaurants",
    match: (p) => p.startsWith("/restaurants"),
  },
];

const globalMenuChildren: NavLinkItem[] = [
  {
    href: "/global-menu/dishes",
    labelKey: "nav.globalMenuDishes",
    match: (p) =>
      p === "/global-menu/dishes" ||
      p.startsWith("/global-menu/dishes/") ||
      p === "/global-menu" ||
      (p.startsWith("/global-menu/") &&
        !p.startsWith("/global-menu/beverages") &&
        !p.startsWith("/global-menu/categories")),
  },
  {
    href: "/global-menu/beverages",
    labelKey: "nav.globalMenuBeverages",
    match: (p) =>
      p === "/global-menu/beverages" || p.startsWith("/global-menu/beverages/"),
  },
];

function isGlobalMenuGroupPath(pathname: string): boolean {
  return (
    pathname.startsWith("/global-menu") && !pathname.startsWith("/global-menu/categories")
  );
}

const settingsItem = {
  href: "/settings",
  labelKey: "nav.settings",
  match: (p: string) => p.startsWith("/settings"),
} as const;

type AppSidebarNavProps = {
  onNavigate?: () => void;
};

export function AppSidebarNav({ onNavigate }: AppSidebarNavProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [globalMenuExpanded, setGlobalMenuExpanded] = useState(() =>
    isGlobalMenuGroupPath(pathname),
  );

  useEffect(() => {
    if (isGlobalMenuGroupPath(pathname)) {
      setGlobalMenuExpanded(true);
    }
  }, [pathname]);

  const settingsActive = settingsItem.match(pathname);
  const globalMenuGroupActive = isGlobalMenuGroupPath(pathname);
  const navItemBaseClass =
    "block w-full min-h-11 touch-manipulation rounded-xl px-3 py-3 text-sm font-medium leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:min-h-0 sm:py-2.5";
  const childNavItemClass =
    "block w-full min-h-10 touch-manipulation rounded-lg py-2 pl-6 pr-3 text-sm font-medium leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:min-h-0";

  const labelForKey = (key: string) => t(key as Parameters<typeof t>[0]);

  return (
    <nav className="flex h-full min-h-0 flex-col p-2" aria-label="Main">
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
        <Link
          href="/"
          onClick={() => onNavigate?.()}
          className={`${navItemBaseClass} ${
            pathname === "/"
              ? "bg-foreground/10 text-foreground"
              : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          }`}
        >
          {labelForKey("nav.home")}
        </Link>

        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            aria-expanded={globalMenuExpanded}
            onClick={() => setGlobalMenuExpanded((v) => !v)}
            className={`${navItemBaseClass} flex items-center justify-between gap-2 text-left ${
              globalMenuGroupActive
                ? "bg-foreground/10 text-foreground"
                : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            <span>{labelForKey("nav.globalMenu")}</span>
            <svg
              className={`size-4 shrink-0 transition-transform ${globalMenuExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {globalMenuExpanded ? (
            <div className="flex flex-col gap-0.5 pb-0.5">
              {globalMenuChildren.map(({ href, labelKey, match }) => {
                const active = match(pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => onNavigate?.()}
                    className={`${childNavItemClass} ${
                      active
                        ? "bg-foreground/10 text-foreground"
                        : "text-foreground/65 hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    {labelForKey(labelKey)}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        {topLinks.slice(1).map(({ href, labelKey, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => onNavigate?.()}
              className={`${navItemBaseClass} ${
                active
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              {labelForKey(labelKey)}
            </Link>
          );
        })}
      </div>
      <div className="mt-2 border-t border-foreground/10 pt-2">
        <Link
          href={settingsItem.href}
          onClick={() => onNavigate?.()}
          className={`${navItemBaseClass} ${
            settingsActive
              ? "bg-foreground/10 text-foreground"
              : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          }`}
        >
          {labelForKey(settingsItem.labelKey)}
        </Link>
      </div>
    </nav>
  );
}
