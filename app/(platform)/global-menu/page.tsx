import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { getMenuSectionsWithAuthServer } from "@/lib/auth-api";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";

export default async function GlobalMenuPage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    redirect("/login");
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();
  const result = await getMenuSectionsWithAuthServer(token, restaurantId);
  if (result.ok) {
    const first = [...result.data.sections]
      .filter((s) => s.kind === "standard")
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];
    if (first) {
      redirect(`/global-menu/sections/${encodeURIComponent(first.id)}`);
    }
  }

  redirect("/global-menu/sections");
}
