import type { Metadata } from "next";
import { GlobalMenuCategoriesClient } from "@/app/components/global-menu/global-menu-categories-client";

export const metadata: Metadata = {
  title: "Menu categories · Menu Platform",
  description: "View and manage global menu categories",
};

export default function GlobalMenuCategoriesPage() {
  return <GlobalMenuCategoriesClient />;
}
