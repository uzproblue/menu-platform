"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";
import type { RestaurantDisplayInfo } from "@/lib/data/restaurant-detail";
import { GlobalMenuCategorySection } from "@/app/components/global-menu/global-menu-category-section";
import { useI18n } from "../i18n-provider";

type RestaurantDetailClientProps = {
  restaurant: RestaurantDisplayInfo;
  initialMenu: GlobalMenuData;
};

export function RestaurantDetailClient({
  restaurant,
  initialMenu,
}: RestaurantDetailClientProps) {
  const { t } = useI18n();
  const [menu, setMenu] = useState<GlobalMenuData>(() =>
    structuredClone(initialMenu),
  );

  const displayName = restaurant.name.trim().length
    ? restaurant.name
    : t("restaurantDetail.unknownRestaurant");

  const hasLogo = restaurant.logoUrl.trim().length > 0;
  const currency = restaurant.currency?.trim();
  const isActive = restaurant.isActive;
  const hasPublishedMenu = menu.categories.some((c) => c.items.length > 0);

  const handleToggleActive = useCallback((categoryId: string, itemId: string) => {
    setMenu((prev) => ({
      categories: prev.categories.map((c) =>
        c.id !== categoryId
          ? c
          : {
              ...c,
              items: c.items.map((i) => {
                if (i.id !== itemId) return i;
                const on = i.active !== false;
                return { ...i, active: !on };
              }),
            },
      ),
    }));
  }, []);

  const noopEdit = useCallback((categoryId: string, itemId: string) => {
    void categoryId;
    void itemId;
  }, []);
  const noopDelete = useCallback((categoryId: string, itemId: string) => {
    void categoryId;
    void itemId;
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/restaurants"
            className="text-sm font-medium text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
          >
            {`← ${t("restaurantDetail.backToList")}`}
          </Link>
          <Link
            href={`/restaurants/${encodeURIComponent(restaurant.id)}/edit`}
            className="text-sm font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("restaurantDetail.editLocation")}
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-foreground/10 bg-background/80 ring-1 ring-foreground/5">
            {hasLogo ? (
              <Image
                src={restaurant.logoUrl}
                alt={t("restaurants.logoAlt", { name: displayName })}
                width={80}
                height={80}
                className="size-full object-cover"
                sizes="80px"
                priority
                unoptimized={imageSrcIsNonOptimizable(restaurant.logoUrl)}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-lg font-semibold text-foreground/40">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 font-mono text-xs text-foreground/45">{restaurant.id}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {currency ? (
                <span className="inline-flex items-center rounded-full border border-foreground/15 px-2 py-0.5 text-xs font-medium text-foreground/80">
                  {currency}
                </span>
              ) : null}
              {typeof isActive === "boolean" ? (
                <span
                  className={
                    isActive
                      ? "inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200"
                      : "inline-flex items-center rounded-full border border-foreground/15 px-2 py-0.5 text-xs text-foreground/60"
                  }
                >
                  {isActive
                    ? t("restaurantDetail.statusActive")
                    : t("restaurantDetail.statusInactive")}
                </span>
              ) : null}
            </div>
            {restaurant.address.trim().length ? (
              <p className="mt-3 text-sm text-foreground/65">{restaurant.address}</p>
            ) : (
              <p className="mt-3 text-sm text-foreground/45">
                {t("restaurantDetail.noAddress")}
              </p>
            )}
            <p className="mt-3 text-sm text-foreground/50">
              {hasPublishedMenu
                ? t("restaurantDetail.savedMenuNote")
                : t("restaurantDetail.noPublishedMenu")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t("restaurantDetail.menuHeading")}
        </h2>
        {hasPublishedMenu ? (
          menu.categories
            .filter((c) => c.items.length > 0)
            .map((category) => (
              <GlobalMenuCategorySection
                key={category.id}
                category={category}
                onEditItem={noopEdit}
                onToggleActive={handleToggleActive}
                onDeleteItem={noopDelete}
                hideEditButton
              />
            ))
        ) : (
          <p className="text-sm text-foreground/55">{t("restaurantDetail.menuEmptyHint")}</p>
        )}
      </div>
    </div>
  );
}
