import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { SeasonalMenuDesignerClient } from "@/app/components/seasonal-menu/seasonal-menu-designer-client";
import { authOptions } from "@/lib/auth-options";
import { getSelectedRestaurantIdFromCookies } from "@/lib/restaurant-context";
import {
  getGlobalMenuWithAuthServer,
  getLocationMenuWithAuthServer,
  getLocationsWithAuthServer,
  getSeasonalMenuDesignWithAuthServer,
} from "@/lib/auth-api";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";
import { getSeasonalMenuDesignFromR2 } from "@/lib/r2-seasonal-menu-design";
import type { SeasonalMenuDocument } from "@/lib/seasonal-menu/document-types";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Seasonal menu · ${id.slice(0, 8)} · Menu Platform`,
  };
}

export default async function SeasonalMenuEditorPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) {
    notFound();
  }

  const restaurantId = await getSelectedRestaurantIdFromCookies();

  const meta = await getSeasonalMenuDesignWithAuthServer(token, id, restaurantId);
  if (!meta.ok) {
    notFound();
  }

  const locationsRes = await getLocationsWithAuthServer(token, restaurantId);
  const locations =
    locationsRes.ok ?
      locationsRes.data.locations.map((l) => ({ id: l.id, name: l.name }))
    : [];

  let initialDocument: SeasonalMenuDocument | null = null;
  const docRes = await getSeasonalMenuDesignFromR2(meta.data.design.r2ObjectKey);
  if (docRes.ok) {
    initialDocument = docRes.document;
  }

  let initialMenuData: GlobalMenuData = { categories: [] };
  const locId = meta.data.design.locationId;
  const menuRes = locId
    ? await getLocationMenuWithAuthServer(token, locId, restaurantId)
    : await getGlobalMenuWithAuthServer(token, restaurantId);
  if (menuRes.ok) {
    initialMenuData = mapGlobalMenuResponseToData(menuRes.data);
  }

  return (
    <div className="mx-auto max-w-[90rem]">
      <SeasonalMenuDesignerClient
        design={meta.data.design}
        initialDocument={initialDocument}
        initialMenuData={initialMenuData}
        locations={locations}
      />
    </div>
  );
}
