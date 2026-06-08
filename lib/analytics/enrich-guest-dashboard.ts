import "server-only";
import { getGlobalMenuWithAuthServer } from "@/lib/auth-api/catalog-read";
import type { GuestDashboardData } from "./types";

export async function enrichGuestDashboardWithCatalogNames(
  data: GuestDashboardData,
  accessToken: string,
  restaurantId: string | null,
): Promise<GuestDashboardData> {
  if (!restaurantId) return data;

  const menuResult = await getGlobalMenuWithAuthServer(accessToken, restaurantId);
  if (!menuResult.ok) return data;

  const categoryNames = new Map<string, string>();
  const itemNames = new Map<string, string>();

  for (const category of menuResult.data.categories) {
    categoryNames.set(category.id, category.name);
    for (const item of category.items) {
      itemNames.set(item.id, item.name);
    }
  }

  const resolveCategoryName = (categoryId: string) =>
    categoryNames.get(categoryId) ?? categoryId;

  const resolveItemName = (itemId: string) => itemNames.get(itemId) ?? itemId;

  return {
    ...data,
    topCategories: data.topCategories.map((row) => ({
      ...row,
      name: resolveCategoryName(row.categoryId),
    })),
    topItemsViewed: data.topItemsViewed.map((row) => ({
      ...row,
      name: resolveItemName(row.itemId),
    })),
    topItemsCarted: data.topItemsCarted.map((row) => ({
      ...row,
      name: resolveItemName(row.itemId),
    })),
  };
}
