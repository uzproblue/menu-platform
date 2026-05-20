import type { Metadata } from "next";
import { GlobalMenuCategoriesClient } from "@/app/components/global-menu/global-menu-categories-client";

export const metadata: Metadata = {
  title: "Beverages · Menu categories · Menu Platform",
  description: "Manage beverage categories",
};

export default function GlobalMenuCategoriesBeveragesPage() {
  return <GlobalMenuCategoriesClient menuSection="beverages" />;
}
