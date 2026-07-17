import { redirectLegacyMenuSection } from "@/lib/menu/legacy-section-redirect";

export default async function GlobalMenuCategoriesDishesRedirectPage() {
  await redirectLegacyMenuSection("dishes", "categories");
}
