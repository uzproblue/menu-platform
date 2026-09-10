import type { Metadata } from "next";
import { UnassignedPageClient } from "@/app/components/global-menu/unassigned/unassigned-page-client";

export const metadata: Metadata = {
  title: "Unassigned categories & food · Menu Platform",
  description: "Manage and assign unassigned categories and food items to menu sections",
};

export default function GlobalMenuUnassignedPage() {
  return <UnassignedPageClient />;
}
