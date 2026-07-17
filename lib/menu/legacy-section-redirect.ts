import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { getMenuSectionsWithAuthServer } from "@/lib/auth-api";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

/** Resolve legacy dishes/beverages routes to dynamic section ids when possible. */
export async function redirectLegacyMenuSection(
  legacyKey: "dishes" | "beverages",
  kind: "items" | "categories",
): Promise<never> {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    redirect("/login");
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getMenuSectionsWithAuthServer(token, restaurantId);
  if (result.ok) {
    const suffix = `_sec_${legacyKey}`;
    const byId = result.data.sections.find(
      (s) => s.kind === "standard" && s.id.endsWith(suffix),
    );
    const byName = result.data.sections.find(
      (s) =>
        s.kind === "standard" &&
        s.name.trim().toLowerCase() ===
          (legacyKey === "beverages" ? "beverages" : "dishes"),
    );
    const section = byId ?? byName ?? result.data.sections.find((s) => s.kind === "standard");
    if (section) {
      if (kind === "categories") {
        redirect(`/global-menu/categories/section/${encodeURIComponent(section.id)}`);
      }
      redirect(`/global-menu/sections/${encodeURIComponent(section.id)}`);
    }
  }

  redirect(kind === "categories" ? "/global-menu/categories" : "/global-menu");
}
