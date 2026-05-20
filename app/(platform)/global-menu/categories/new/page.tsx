import type { Metadata } from "next";
import { NewCategoryClient } from "@/app/components/global-menu/new-category-client";
import type { MenuSection } from "@/lib/data/global-menu-types";

export const metadata: Metadata = {
  title: "New category · Menu Platform",
  description: "Create a menu category preview",
};

type NewCategoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseMenuSection(raw: string | string[] | undefined): MenuSection {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "beverages" ? "beverages" : "dishes";
}

export default async function NewCategoryPage({ searchParams }: NewCategoryPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialMenuSection = parseMenuSection(resolvedSearchParams?.section);

  return <NewCategoryClient initialMenuSection={initialMenuSection} />;
}
