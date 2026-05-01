"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "./i18n-provider";

const items = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  {
    href: "/global-menu",
    label: "Global Menu",
    match: (p: string) =>
      p === "/global-menu" ||
      (p.startsWith("/global-menu/") && !p.startsWith("/global-menu/categories")),
  },
  {
    href: "/global-menu/categories",
    label: "Menu categories",
    match: (p: string) => p.startsWith("/global-menu/categories"),
  },
  {
    href: "/restaurants",
    label: "Restaurants",
    match: (p: string) => p.startsWith("/restaurants"),
  },
] as const;

const settingsItem = {
  href: "/settings",
  label: "Settings",
  match: (p: string) => p.startsWith("/settings"),
} as const;

type AppSidebarNavProps = {
  /** Close mobile drawer after navigation */
  onNavigate?: () => void;
};

export function AppSidebarNav({ onNavigate }: AppSidebarNavProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const settingsActive = settingsItem.match(pathname);
  const navItemBaseClass =
    "block w-full min-h-11 touch-manipulation rounded-xl px-3 py-3 text-sm font-medium leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:min-h-0 sm:py-2.5";

  return (
    <nav className="flex h-full min-h-0 flex-col p-2" aria-label="Main">
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
        {items.map(({ href, label, match }) => {
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
              {label === "Home"
                ? t("nav.home")
                : label === "Global Menu"
                  ? t("nav.globalMenu")
                  : label === "Menu categories"
                    ? t("nav.menuCategories")
                    : t("nav.restaurants")}
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
          {t("nav.settings")}
        </Link>
      </div>
    </nav>
  );
}
