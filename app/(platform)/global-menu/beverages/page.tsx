import type { Metadata } from "next";
import { GlobalMenuSectionPage } from "@/app/components/global-menu/global-menu-section-page";

export const metadata: Metadata = {
  title: "Beverages · Global Menu · Menu Platform",
  description: "Global menu beverages",
};

export default function GlobalMenuBeveragesPage() {
  return <GlobalMenuSectionPage menuSection="beverages" />;
}
