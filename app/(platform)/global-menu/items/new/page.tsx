import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { NewGlobalMenuItemClient } from "@/app/components/global-menu/new-global-menu-item-client";
import { authOptions } from "@/lib/auth-options";
import { getCategoriesWithAuthServer } from "@/lib/auth-api";

export const metadata: Metadata = {
  title: "New menu item · Menu Platform",
  description: "Create a global menu item",
};

type NewGlobalMenuItemPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewGlobalMenuItemPage({ searchParams }: NewGlobalMenuItemPageProps) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;

  let initialCategories: { id: string; name: string }[] = [];
  let categoriesLoadError: string | null = null;

  if (!token) {
    categoriesLoadError = "unauthorized";
  } else {
    const result = await getCategoriesWithAuthServer(token);
    if (result.ok) {
      initialCategories = result.data.categories.map((c) => ({
        id: c.id,
        name: c.name,
      }));
    } else {
      categoriesLoadError = result.message ?? result.error;
    }
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const rawPreselected = resolvedSearchParams?.categoryId;
  const preselectedCategoryId = Array.isArray(rawPreselected)
    ? (rawPreselected[0] ?? "")
    : (rawPreselected ?? "");

  return (
    <NewGlobalMenuItemClient
      initialCategories={initialCategories}
      categoriesLoadError={categoriesLoadError}
      preselectedCategoryId={preselectedCategoryId}
    />
  );
}
