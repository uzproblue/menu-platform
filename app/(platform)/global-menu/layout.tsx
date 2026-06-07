import { getServerSession } from "next-auth/next";
import { GlobalMenuCatalogLayoutProvider } from "@/app/components/global-menu/global-menu-catalog-layout-context";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";
import { authOptions } from "@/lib/auth-options";
import { getGlobalMenuWithAuthServer } from "@/lib/auth-api";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";

export default async function GlobalMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;

  let initialData: GlobalMenuData = { categories: [] };
  let loadError: string | null = null;

  if (!token) {
    loadError = "unauthorized";
  } else {
    const restaurantId = await getSelectedRestaurantIdFromCookies();
    const result = await getGlobalMenuWithAuthServer(token, restaurantId);
    if (result.ok) {
      initialData = mapGlobalMenuResponseToData(result.data);
    } else {
      loadError = result.message ?? result.error;
    }
  }

  return (
    <GlobalMenuCatalogLayoutProvider value={{ initialData, loadError }}>
      {children}
    </GlobalMenuCatalogLayoutProvider>
  );
}
