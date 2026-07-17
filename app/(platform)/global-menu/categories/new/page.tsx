import type { Metadata } from "next";
import { NewCategoryClient } from "@/app/components/global-menu/new-category-client";

export const metadata: Metadata = {
  title: "New category · Menu Platform",
  description: "Create a menu category preview",
};

type NewCategoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseSectionId(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

export default async function NewCategoryPage({ searchParams }: NewCategoryPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialMenuSectionId = parseSectionId(resolvedSearchParams?.section);

  return <NewCategoryClient initialMenuSectionId={initialMenuSectionId} />;
}
