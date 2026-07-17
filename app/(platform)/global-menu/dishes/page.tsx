import { redirectLegacyMenuSection } from "@/lib/menu/legacy-section-redirect";

export default async function GlobalMenuDishesRedirectPage() {
  await redirectLegacyMenuSection("dishes", "items");
}
