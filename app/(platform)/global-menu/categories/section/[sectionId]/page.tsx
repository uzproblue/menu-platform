import type { Metadata } from "next";
import { GlobalMenuCategoriesClient } from "@/app/components/global-menu/global-menu-categories-client";

type PageProps = {
  params: Promise<{ sectionId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sectionId } = await params;
  return {
    title: `Categories · Menu Platform`,
    description: `Manage categories for section ${sectionId}`,
  };
}

export default async function GlobalMenuCategoriesSectionPage({ params }: PageProps) {
  const { sectionId } = await params;
  return <GlobalMenuCategoriesClient sectionId={decodeURIComponent(sectionId)} />;
}
