import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { GlobalMenuPageClient } from "../../../components/global-menu/global-menu-page-client";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { getGlobalMenuWithAuthServer } from "@/lib/auth-api";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";

export const metadata: Metadata = {
  title: "Dishes · Global Menu · Menu Platform",
  description: "Global menu dishes",
};

export default async function GlobalMenuDishesPage() {
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
    <GlobalMenuPageClient
      menuSection="dishes"
      initialData={initialData}
      loadError={loadError}
    />
  );
}
