import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { GlobalMenuPageClient } from "../../components/global-menu/global-menu-page-client";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";
import { authOptions } from "@/lib/auth-options";
import { getGlobalMenuWithAuthServer } from "@/lib/auth-api";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";

export const metadata: Metadata = {
  title: "Global Menu · Menu Platform",
  description: "Global menu configuration",
};

export default async function GlobalMenuPage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;

  let initialData: GlobalMenuData = { categories: [] };
  let loadError: string | null = null;

  if (!token) {
    loadError = "unauthorized";
  } else {
    const result = await getGlobalMenuWithAuthServer(token);
    if (result.ok) {
      initialData = mapGlobalMenuResponseToData(result.data);
    } else {
      loadError = result.message ?? result.error;
    }
  }

  return <GlobalMenuPageClient initialData={initialData} loadError={loadError} />;
}
