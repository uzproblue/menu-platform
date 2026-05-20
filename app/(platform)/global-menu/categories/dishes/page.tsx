import type { Metadata } from "next";
import { GlobalMenuCategoriesClient } from "@/app/components/global-menu/global-menu-categories-client";

export const metadata: Metadata = {
  title: "Dishes · Menu categories · Menu Platform",
  description: "Manage dish categories",
};

export default function GlobalMenuCategoriesDishesPage() {
  return <GlobalMenuCategoriesClient menuSection="dishes" />;
}
