import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { MenuMergePageClient } from "@/app/components/settings/menu-merge-page-client";

export const metadata: Metadata = {
  title: "Menu merge · Settings",
  description: "Manually merge iiko external menu with your catalog",
};

export default async function MenuMergePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isOwner) {
    redirect("/settings");
  }

  return <MenuMergePageClient />;
}
