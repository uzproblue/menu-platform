"use client";

import type { LocationListRow } from "@/lib/data/restaurant-types";
import { LocationRowActionsMenu } from "@/app/components/restaurants/location-row-actions-menu";
import { useI18n } from "@/app/components/i18n-provider";
import { ActivationSwitch } from "./activation-switch";
import { LocationLogo } from "./location-logo";
import { OpenQrButton } from "./open-qr-button";

type RestaurantsListMobileProps = {
  locations: LocationListRow[];
  currentUserRole: "ADMIN" | "USER";
  updatingLocationId: string | null;
  onOpenLocationPage: (locationId: string) => void;
  onToggleActive: (locationId: string, nextIsActive: boolean) => void;
  onOpenQr: (location: {
    id: string;
    name: string;
    logoUrl: string;
    qrCenterImageUrl: string;
  }) => void;
  onRequestDelete: (location: { id: string; name: string }) => void;
};

export function RestaurantsListMobile({
  locations,
  currentUserRole,
  updatingLocationId,
  onOpenLocationPage,
  onToggleActive,
  onOpenQr,
  onRequestDelete,
}: RestaurantsListMobileProps) {
  const { t } = useI18n();
  const isAdmin = currentUserRole === "ADMIN";

  return (
    <div className="md:hidden">
      <ul className="space-y-3">
        {locations.map((location, index) => (
          <li
            key={location.id}
            className="rounded-2xl border border-foreground/10 bg-background/40 p-4 ring-1 ring-foreground/5"
            onClick={() => onOpenLocationPage(location.id)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-center gap-3">
                  <LocationLogo
                    src={location.logoUrl}
                    name={location.name}
                    priority={index < 8}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold tracking-tight text-foreground">
                      {location.name}
                    </p>
                    <p className="mt-1 text-sm text-foreground/60">
                      {location.address || t("restaurants.addressNotAvailable")}
                    </p>
                  </div>
                </div>
                <div onClick={(event) => event.stopPropagation()}>
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
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {location.isDefault ? (
                  <span className="inline-flex items-center rounded-full border border-foreground/15 px-2 py-0.5 text-xs text-foreground/70">
                    {t("restaurants.defaultLocation")}
                  </span>
                ) : null}
                <div onClick={(event) => event.stopPropagation()}>
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
                <span className="text-xs text-foreground/50">
                  {t("restaurants.itemsSummary", {
                    categories: location.categoryCount,
                    items: location.menuItemCount,
                  })}
                </span>
                <span className="inline-flex items-center rounded-full border border-foreground/15 px-2 py-0.5 text-xs font-medium text-foreground/80">
                  {location.currency}
                </span>
                <span className="text-xs text-foreground/50">
                  {updatingLocationId === location.id
                    ? t("restaurants.updatingLocation")
                    : location.isActive
                      ? t("restaurants.active")
                      : t("restaurants.inactive")}
                </span>
                {!isAdmin ? (
                  <span className="text-xs text-foreground/50">
                    {t("restaurants.adminOnlyToggle")}
                  </span>
                ) : null}
                <OpenQrButton
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenQr({
                      id: location.id,
                      name: location.name,
                      logoUrl: location.logoUrl,
                      qrCenterImageUrl: location.qrCenterImageUrl ?? "",
                    });
                  }}
                  ariaLabel={t("restaurants.openQrModalAria", {
                    name: location.name,
                  })}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
