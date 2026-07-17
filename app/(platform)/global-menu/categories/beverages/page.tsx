import { redirectLegacyMenuSection } from "@/lib/menu/legacy-section-redirect";

export default async function GlobalMenuCategoriesBeveragesRedirectPage() {
  await redirectLegacyMenuSection("beverages", "categories");
}
