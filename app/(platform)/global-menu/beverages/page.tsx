import { redirectLegacyMenuSection } from "@/lib/menu/legacy-section-redirect";

export default async function GlobalMenuBeveragesRedirectPage() {
  await redirectLegacyMenuSection("beverages", "items");
}
