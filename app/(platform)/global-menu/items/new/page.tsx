import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { NewGlobalMenuItemClient } from "@/app/components/global-menu/new-global-menu-item-client";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import { getCategoriesWithAuthServer } from "@/lib/auth-api";

export const metadata: Metadata = {
  title: "New menu item · Menu Platform",
  description: "Create a global menu item",
};

type NewGlobalMenuItemPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseSectionId(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

export default async function NewGlobalMenuItemPage({ searchParams }: NewGlobalMenuItemPageProps) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sectionId = parseSectionId(resolvedSearchParams?.section);

  let initialCategories: { id: string; name: string }[] = [];
  let categoriesLoadError: string | null = null;

  if (!token) {
    categoriesLoadError = "unauthorized";
  } else {
    const restaurantId = await getSelectedRestaurantIdFromCookies();
    const result = await getCategoriesWithAuthServer(token, restaurantId);
    if (result.ok) {
      initialCategories = result.data.categories
        .filter((c) => !sectionId || c.menuSectionId === sectionId)
        .map((c) => ({
          id: c.id,
          name: c.name,
        }));
    } else {
      categoriesLoadError = result.message ?? result.error;
    }
  }

  const rawPreselected = resolvedSearchParams?.categoryId;
  const preselectedCategoryId = Array.isArray(rawPreselected)
    ? (rawPreselected[0] ?? "")
    : (rawPreselected ?? "");

  return (
    <NewGlobalMenuItemClient
      initialCategories={initialCategories}
      categoriesLoadError={categoriesLoadError}
      preselectedCategoryId={preselectedCategoryId}
      sectionId={sectionId}
    />
  );
}
