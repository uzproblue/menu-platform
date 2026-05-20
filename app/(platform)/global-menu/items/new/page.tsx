import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { NewGlobalMenuItemClient } from "@/app/components/global-menu/new-global-menu-item-client";
import type { MenuSection } from "@/lib/data/global-menu-types";
import { authOptions } from "@/lib/auth-options";
import { getCategoriesWithAuthServer } from "@/lib/auth-api";

export const metadata: Metadata = {
  title: "New menu item · Menu Platform",
  description: "Create a global menu item",
};

type NewGlobalMenuItemPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseMenuSection(raw: string | string[] | undefined): MenuSection {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "beverages" ? "beverages" : "dishes";
}

export default async function NewGlobalMenuItemPage({ searchParams }: NewGlobalMenuItemPageProps) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const menuSection = parseMenuSection(resolvedSearchParams?.section);

  let initialCategories: { id: string; name: string }[] = [];
  let categoriesLoadError: string | null = null;

  if (!token) {
    categoriesLoadError = "unauthorized";
  } else {
    const result = await getCategoriesWithAuthServer(token);
    if (result.ok) {
      initialCategories = result.data.categories
        .filter((c) => c.menuSection === menuSection)
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
      menuSection={menuSection}
    />
  );
}
