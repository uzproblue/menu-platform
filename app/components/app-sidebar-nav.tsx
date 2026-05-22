"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "./i18n-provider";

type NavLinkItem = {
  href: string;
  labelKey: string;
  match: (pathname: string, searchParams: URLSearchParams) => boolean;
};

const topLinks: NavLinkItem[] = [
  { href: "/", labelKey: "nav.home", match: (p) => p === "/" },
  {
    href: "/restaurants",
    labelKey: "nav.restaurants",
    match: (p) => p.startsWith("/restaurants"),
  },
  {
    href: "/seasonal-menus",
    labelKey: "nav.seasonalMenus",
    match: (p) => p.startsWith("/seasonal-menus"),
  },
];

const globalMenuChildren: NavLinkItem[] = [
  {
    href: "/global-menu/dishes",
    labelKey: "nav.globalMenuDishes",
    match: (p, _sp) =>
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
    match: (p, _sp) =>
      p === "/global-menu/beverages" || p.startsWith("/global-menu/beverages/"),
  },
];

const menuCategoriesChildren: NavLinkItem[] = [
  {
    href: "/global-menu/categories/dishes",
    labelKey: "nav.globalMenuDishes",
    match: (p, sp) =>
      p === "/global-menu/categories/dishes" ||
      p.startsWith("/global-menu/categories/dishes/") ||
      p === "/global-menu/categories" ||
      (p === "/global-menu/categories/new" && sp.get("section") !== "beverages"),
  },
  {
    href: "/global-menu/categories/beverages",
    labelKey: "nav.globalMenuBeverages",
    match: (p, sp) =>
      p === "/global-menu/categories/beverages" ||
      p.startsWith("/global-menu/categories/beverages/") ||
      (p === "/global-menu/categories/new" && sp.get("section") === "beverages"),
  },
];

function isGlobalMenuGroupPath(pathname: string): boolean {
  return (
    pathname.startsWith("/global-menu") && !pathname.startsWith("/global-menu/categories")
  );
}

function isMenuCategoriesGroupPath(pathname: string): boolean {
  return pathname.startsWith("/global-menu/categories");
}

const settingsItem = {
  href: "/settings",
  labelKey: "nav.settings",
  match: (p: string) => p.startsWith("/settings"),
} as const;

type NavExpandableGroupProps = {
  labelKey: string;
  expanded: boolean;
  onToggle: () => void;
  groupActive: boolean;
  children: NavLinkItem[];
  pathname: string;
  searchParams: URLSearchParams;
  onNavigate?: () => void;
  navItemBaseClass: string;
  childNavItemClass: string;
  labelForKey: (key: string) => string;
};

function NavExpandableGroup({
  labelKey,
  expanded,
  onToggle,
  groupActive,
  children,
  pathname,
  searchParams,
  onNavigate,
  navItemBaseClass,
  childNavItemClass,
  labelForKey,
}: NavExpandableGroupProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={`${navItemBaseClass} flex items-center justify-between gap-2 text-left ${
          groupActive
            ? "bg-foreground/10 text-foreground"
            : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        <span>{labelForKey(labelKey)}</span>
        <svg
          className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded ? (
        <div className="flex flex-col gap-0.5 pb-0.5">
          {children.map(({ href, labelKey: childKey, match }) => {
            const active = match(pathname, searchParams);
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
                {labelForKey(childKey)}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type AppSidebarNavProps = {
  onNavigate?: () => void;
};

export function AppSidebarNav({ onNavigate }: AppSidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [globalMenuExpanded, setGlobalMenuExpanded] = useState(() =>
    isGlobalMenuGroupPath(pathname),
  );
  const [menuCategoriesExpanded, setMenuCategoriesExpanded] = useState(() =>
    isMenuCategoriesGroupPath(pathname),
  );

  useEffect(() => {
    if (isGlobalMenuGroupPath(pathname)) {
      setGlobalMenuExpanded(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (isMenuCategoriesGroupPath(pathname)) {
      setMenuCategoriesExpanded(true);
    }
  }, [pathname]);

  const settingsActive = settingsItem.match(pathname);
  const globalMenuGroupActive = isGlobalMenuGroupPath(pathname);
  const menuCategoriesGroupActive = isMenuCategoriesGroupPath(pathname);
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

        <NavExpandableGroup
          labelKey="nav.globalMenu"
          expanded={globalMenuExpanded}
          onToggle={() => setGlobalMenuExpanded((v) => !v)}
          groupActive={globalMenuGroupActive}
          children={globalMenuChildren}
          pathname={pathname}
          searchParams={searchParams}
          onNavigate={onNavigate}
          navItemBaseClass={navItemBaseClass}
          childNavItemClass={childNavItemClass}
          labelForKey={labelForKey}
        />

        <NavExpandableGroup
          labelKey="nav.menuCategories"
          expanded={menuCategoriesExpanded}
          onToggle={() => setMenuCategoriesExpanded((v) => !v)}
          groupActive={menuCategoriesGroupActive}
          children={menuCategoriesChildren}
          pathname={pathname}
          searchParams={searchParams}
          onNavigate={onNavigate}
          navItemBaseClass={navItemBaseClass}
          childNavItemClass={childNavItemClass}
          labelForKey={labelForKey}
        />

        {topLinks.slice(1).map(({ href, labelKey, match }) => {
          const active = match(pathname, searchParams);
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
