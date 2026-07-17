"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { MenuSectionEntity } from "@/lib/data/global-menu-types";
import { useI18n } from "./i18n-provider";

type NavLinkItem = {
  href: string;
  label: string;
  match: (pathname: string, searchParams: URLSearchParams) => boolean;
};

const topLinks: Array<{
  href: string;
  labelKey: string;
  match: (pathname: string, searchParams: URLSearchParams) => boolean;
}> = [
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
  {
    href: "/menu-item-videos",
    labelKey: "nav.menuItemVideos",
    match: (p) => p.startsWith("/menu-item-videos"),
  },
  {
    href: "/loyalty/members",
    labelKey: "nav.loyaltyMembers",
    match: (p) => p.startsWith("/loyalty/members"),
  },
  {
    href: "/loyalty/promotions",
    labelKey: "nav.loyaltyPromotions",
    match: (p) => p.startsWith("/loyalty/promotions"),
  },
];

function isGlobalMenuGroupPath(pathname: string): boolean {
  if (pathname === "/global-menu/sections") return false;
  if (pathname.startsWith("/global-menu/sections/")) return true;
  return (
    pathname.startsWith("/global-menu") &&
    !pathname.startsWith("/global-menu/categories")
  );
}

function isMenuCategoriesGroupPath(pathname: string): boolean {
  return pathname.startsWith("/global-menu/categories");
}

function isSectionsManagePath(pathname: string): boolean {
  return pathname === "/global-menu/sections";
}

const settingsItem = {
  href: "/settings",
  labelKey: "nav.settings",
  match: (p: string) => p.startsWith("/settings"),
} as const;

type NavExpandableGroupProps = {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  groupActive: boolean;
  children: NavLinkItem[];
  pathname: string;
  searchParams: URLSearchParams;
  onNavigate?: () => void;
  navItemBaseClass: string;
  childNavItemClass: string;
};

function NavExpandableGroup({
  label,
  expanded,
  onToggle,
  groupActive,
  children,
  pathname,
  searchParams,
  onNavigate,
  navItemBaseClass,
  childNavItemClass,
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
        <span>{label}</span>
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
          {children.map(({ href, label: childLabel, match }) => {
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
                {childLabel}
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
  const [sections, setSections] = useState<MenuSectionEntity[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/settings/menu-sections", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          sections?: MenuSectionEntity[];
        };
        if (cancelled) return;
        const list = Array.isArray(payload.sections) ? payload.sections : [];
        setSections(
          list
            .filter((s) => s.kind === "standard")
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        );
      } catch {
        /* non-fatal — nav falls back to manage link only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const globalMenuChildren: NavLinkItem[] = useMemo(() => {
    return sections.map((section) => ({
      href: `/global-menu/sections/${encodeURIComponent(section.id)}`,
      label: section.name,
      match: (p) =>
        p === `/global-menu/sections/${encodeURIComponent(section.id)}` ||
        p === `/global-menu/sections/${section.id}` ||
        (p === "/global-menu" && sections[0]?.id === section.id),
    }));
  }, [sections]);

  const menuCategoriesChildren: NavLinkItem[] = useMemo(() => {
    return sections.map((section) => ({
      href: `/global-menu/categories/section/${encodeURIComponent(section.id)}`,
      label: section.name,
      match: (p, sp) =>
        p === `/global-menu/categories/section/${encodeURIComponent(section.id)}` ||
        p === `/global-menu/categories/section/${section.id}` ||
        (p === "/global-menu/categories" && sections[0]?.id === section.id) ||
        (p === "/global-menu/categories/new" && sp.get("section") === section.id),
    }));
  }, [sections]);

  const settingsActive = settingsItem.match(pathname);
  const globalMenuGroupActive = isGlobalMenuGroupPath(pathname);
  const menuCategoriesGroupActive = isMenuCategoriesGroupPath(pathname);
  const sectionsManageActive = isSectionsManagePath(pathname);
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
          label={labelForKey("nav.globalMenu")}
          expanded={globalMenuExpanded}
          onToggle={() => setGlobalMenuExpanded((v) => !v)}
          groupActive={globalMenuGroupActive}
          children={globalMenuChildren}
          pathname={pathname}
          searchParams={searchParams}
          onNavigate={onNavigate}
          navItemBaseClass={navItemBaseClass}
          childNavItemClass={childNavItemClass}
        />

        <NavExpandableGroup
          label={labelForKey("nav.menuCategories")}
          expanded={menuCategoriesExpanded}
          onToggle={() => setMenuCategoriesExpanded((v) => !v)}
          groupActive={menuCategoriesGroupActive}
          children={menuCategoriesChildren}
          pathname={pathname}
          searchParams={searchParams}
          onNavigate={onNavigate}
          navItemBaseClass={navItemBaseClass}
          childNavItemClass={childNavItemClass}
        />

        <Link
          href="/global-menu/sections"
          onClick={() => onNavigate?.()}
          className={`${navItemBaseClass} ${
            sectionsManageActive
              ? "bg-foreground/10 text-foreground"
              : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
          }`}
        >
          {labelForKey("nav.sections")}
        </Link>

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
