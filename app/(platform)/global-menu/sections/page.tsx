import type { Metadata } from "next";
import { MenuSectionsClient } from "@/app/components/global-menu/menu-sections-client";

export const metadata: Metadata = {
  title: "Menu sections · Menu Platform",
  description: "Manage restaurant menu sections",
};

export default function GlobalMenuSectionsPage() {
  return <MenuSectionsClient />;
}
