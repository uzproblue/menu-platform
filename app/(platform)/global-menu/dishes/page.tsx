import type { Metadata } from "next";
import { GlobalMenuSectionPage } from "@/app/components/global-menu/global-menu-section-page";

export const metadata: Metadata = {
  title: "Dishes · Global Menu · Menu Platform",
  description: "Global menu dishes",
};

export default function GlobalMenuDishesPage() {
  return <GlobalMenuSectionPage menuSection="dishes" />;
}
