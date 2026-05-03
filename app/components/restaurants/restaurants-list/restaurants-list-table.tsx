"use client";

import type { LocationListRow } from "@/lib/data/restaurant-types";
import { LocationRowActionsMenu } from "@/app/components/restaurants/location-row-actions-menu";
import { useI18n } from "@/app/components/i18n-provider";
import { ActivationSwitch } from "./activation-switch";
import { LocationLogo } from "./location-logo";
import { OpenQrButton } from "./open-qr-button";

type RestaurantsListTableProps = {
  locations: LocationListRow[];
  currentUserRole: "ADMIN" | "USER";
  updatingLocationId: string | null;
  onOpenLocationPage: (locationId: string) => void;
  onToggleActive: (locationId: string, nextIsActive: boolean) => void;
  onOpenQr: (location: { id: string; name: string }) => void;
  onRequestDelete: (location: { id: string; name: string }) => void;
};

export function RestaurantsListTable({
  locations,
  currentUserRole,
  updatingLocationId,
  onOpenLocationPage,
  onToggleActive,
  onOpenQr,
  onRequestDelete,
}: RestaurantsListTableProps) {
  const { t } = useI18n();
  const isAdmin = currentUserRole === "ADMIN";

  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-foreground/10 bg-background/40 ring-1 ring-foreground/5 md:block">
      <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-xs font-medium uppercase tracking-wider text-foreground/50">
            <th className="w-16 px-4 py-3 pl-5" scope="col">
              {t("restaurants.logo")}
            </th>
            <th className="px-4 py-3 pl-5" scope="col">
              {t("common.name")}
            </th>
            <th className="w-20 px-4 py-3" scope="col">
              {t("global.currency")}
            </th>
            <th className="px-4 py-3" scope="col">
              {t("common.address")}
            </th>
            <th className="px-4 py-3" scope="col">
              {t("common.status")}
            </th>
            <th className="px-4 py-3 text-right tabular-nums" scope="col">
              {t("common.categories")}
            </th>
            <th className="px-4 py-3 text-right tabular-nums" scope="col">
              {t("common.menuItems")}
            </th>
            
            <th className="w-14 px-3 py-3 pr-5 text-center" scope="col">
              <span className="sr-only">{t("common.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {locations.map((location, index) => (
            <tr
              key={location.id}
              className="border-b border-foreground/5 last:border-0 transition-colors hover:bg-foreground/3"
              onClick={() => onOpenLocationPage(location.id)}
            >
              <td className="px-4 py-3.5 pl-5">
                <LocationLogo
                  src={location.logoUrl}
                  name={location.name}
                  priority={index < 12}
                />
              </td>
              <td className="px-4 py-3.5 pl-5">
                <div className="space-y-1">
                  <span className="font-medium text-foreground">
                    {location.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 font-mono text-sm text-foreground/80">
                {location.currency}
              </td>
              <td className="max-w-xs px-4 py-3.5 text-foreground/70">
                <span className="line-clamp-2">
                  {location.address || t("restaurants.addressNotAvailable")}
                </span>
              </td>
              <td className="px-4 py-3.5">
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="flex items-center gap-3"
                >
                  <ActivationSwitch
                    isActive={location.isActive}
                    disabled={!isAdmin || updatingLocationId === location.id}
                    onToggle={() =>
                      onToggleActive(location.id, !location.isActive)
                    }
                    label={
                      location.isActive
                        ? t("restaurants.deactivateLocationAria", {
                            name: location.name,
                          })
                        : t("restaurants.activateLocationAria", {
                            name: location.name,
                          })
                    }
                  />
                </div>
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-foreground/80">
                {location.categoryCount}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-foreground/80">
                {location.menuItemCount}
              </td>
              <td
                className="px-3 py-3.5 text-center"
                onClick={(event) => event.stopPropagation()}
              >
               
                <div className="flex items-center gap-1">
                 <OpenQrButton
                  onClick={() =>
                    onOpenQr({ id: location.id, name: location.name })
                  }
                  ariaLabel={t("restaurants.openQrModalAria", {
                    name: location.name,
                  })}
                />
                  <LocationRowActionsMenu
                    locationId={location.id}
                    locationName={location.name}
                    isAdmin={isAdmin}
                    isDefault={location.isDefault}
                    onRequestDelete={() =>
                      onRequestDelete({ id: location.id, name: location.name })
                    }
                  />
                </div>
              </td>
              
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
