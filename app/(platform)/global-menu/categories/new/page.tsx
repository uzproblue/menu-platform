import type { Metadata } from "next";
import { NewCategoryClient } from "@/app/components/global-menu/new-category-client";

export const metadata: Metadata = {
  title: "New category · Menu Platform",
  description: "Create a menu category preview",
};

export default function NewCategoryPage() {
  return <NewCategoryClient />;
}
