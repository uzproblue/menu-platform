import type { Metadata } from "next";
import { GlobalMenuSectionPage } from "@/app/components/global-menu/global-menu-section-page";

type PageProps = {
  params: Promise<{ sectionId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sectionId } = await params;
  return {
    title: `Menu section · Global Menu · Menu Platform`,
    description: `Global menu section ${sectionId}`,
  };
}

export default async function GlobalMenuSectionByIdPage({ params }: PageProps) {
  const { sectionId } = await params;
  return <GlobalMenuSectionPage sectionId={decodeURIComponent(sectionId)} />;
}
