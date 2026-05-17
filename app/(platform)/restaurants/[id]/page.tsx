import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { RestaurantDetailClient, type CategoryCatalogEntry } from "@/app/components/restaurants/restaurant-detail-client";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";
import type { RestaurantDisplayInfo } from "@/lib/data/restaurant-detail";
import { authOptions } from "@/lib/auth-options";
import {
  getCategoriesWithAuthServer,
  getGlobalMenuWithAuthServer,
  getLocationMenuItemsWithAuthServer,
  getLocationWithAuthServer,
} from "@/lib/auth-api";
import type { GlobalMenuResponse } from "@/lib/auth-api";
import type { LocationMenuItemRow } from "@/lib/auth-api";
import { getServerT } from "@/lib/i18n/server";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";

type PageProps = {
  params: Promise<{ id: string }>;
};

function locationToDisplayInfo(loc: {
  id: string;
  name: string;
  currency: string;
  address: string;
  logoUrl: string;
  isActive: boolean;
}): RestaurantDisplayInfo {
  return {
    id: loc.id,
    name: loc.name,
    logoUrl: loc.logoUrl?.trim() ?? "",
    address: loc.address?.trim() ?? "",
    currency: loc.currency,
    isActive: loc.isActive,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const { t } = await getServerT();
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    return {
      title: `${t("restaurantDetail.unknownRestaurant")} · Menu Platform`,
      description: t("restaurantDetail.metaDescription"),
    };
  }
  const result = await getLocationWithAuthServer(token, decoded);
  const titleName =
    result.ok && result.data.location.name.trim().length
      ? result.data.location.name
      : t("restaurantDetail.unknownRestaurant");
  return {
    title: `${titleName} · Menu Platform`,
    description: t("restaurantDetail.metaDescription"),
  };
}

export default async function RestaurantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);

  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    redirect("/login");
  }

  const [locResult, manageResult, catalogResult, categoriesResult] = await Promise.all([
    getLocationWithAuthServer(token, decoded),
    getLocationMenuItemsWithAuthServer(token, decoded),
    getGlobalMenuWithAuthServer(token),
    getCategoriesWithAuthServer(token),
  ]);

  if (!locResult.ok) {
    if (locResult.status === 401) redirect("/login");
    if (locResult.status === 404) notFound();
    notFound();
  }

  const restaurant = locationToDisplayInfo(locResult.data.location);
  const enabledCategoryIds = locResult.data.location.enabledCategoryIds ?? [];

  const initialGlobalMenu: GlobalMenuResponse | null = catalogResult.ok
    ? catalogResult.data
    : null;

  const initialCatalog: GlobalMenuData = initialGlobalMenu
    ? mapGlobalMenuResponseToData(initialGlobalMenu)
    : { categories: [] };

  const initialManageItems: LocationMenuItemRow[] = manageResult.ok
    ? manageResult.data.items
    : [];

  const categoriesCatalog: CategoryCatalogEntry[] = categoriesResult.ok
    ? categoriesResult.data.categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        itemsCount: c.itemsCount,
      }))
    : [];

  return (
    <div className="mx-auto max-w-7xl px-0 py-6 sm:py-8">
      <RestaurantDetailClient
        restaurant={restaurant}
        initialCatalog={initialCatalog}
        initialGlobalMenu={initialGlobalMenu}
        initialManageItems={initialManageItems}
        enabledCategoryIds={enabledCategoryIds}
        categoriesCatalog={categoriesCatalog}
      />
    </div>
  );
}
