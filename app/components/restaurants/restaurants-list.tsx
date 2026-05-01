"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { RestaurantsListData } from "@/lib/data/restaurant-types";
import { useI18n } from "../i18n-provider";
import { DeleteLocationModal } from "./restaurants-list/delete-location-modal";
import { QrLocationModal } from "./restaurants-list/qr-location-modal";
import { readErrorMessage } from "./restaurants-list/read-error-message";
import { RequestErrorBanner } from "./restaurants-list/request-error-banner";
import { RestaurantsListMobile } from "./restaurants-list/restaurants-list-mobile";
import { RestaurantsListTable } from "./restaurants-list/restaurants-list-table";

export function RestaurantsList() {
  const router = useRouter();
  const { t } = useI18n();
  const [data, setData] = useState<RestaurantsListData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [updatingLocationId, setUpdatingLocationId] = useState<string | null>(
    null,
  );
  const [qrLocation, setQrLocation] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteLocationTarget, setDeleteLocationTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteLocationPending, setDeleteLocationPending] = useState(false);
  const [deleteLocationError, setDeleteLocationError] = useState<string | null>(
    null,
  );

  const closeQrModal = useCallback(() => {
    setQrLocation(null);
  }, []);

  const loadLocations = useCallback(async () => {
    setLoadError(null);
    const response = await fetch("/api/settings/locations", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, t("restaurants.errLoadLocations")),
      );
    }
    setData((await response.json()) as RestaurantsListData);
  }, [t]);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        await loadLocations();
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : t("restaurants.errLoadLocationsNetwork"),
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadLocations, t]);

  async function handleToggle(locationId: string, nextIsActive: boolean) {
    setRequestError(null);
    setUpdatingLocationId(locationId);
    try {
      const response = await fetch(
        `/api/settings/locations/${encodeURIComponent(locationId)}/activation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextIsActive }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, t("restaurants.errUpdateLocation")),
        );
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          locations: prev.locations.map((location) =>
            location.id === locationId
              ? { ...location, isActive: nextIsActive }
              : location,
          ),
        };
      });
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : t("restaurants.errUpdateLocationNetwork"),
      );
    } finally {
      setUpdatingLocationId(null);
    }
  }

  async function handleConfirmDeleteLocation() {
    if (!deleteLocationTarget) return;
    setDeleteLocationPending(true);
    setDeleteLocationError(null);
    try {
      const response = await fetch(
        `/api/settings/locations/${encodeURIComponent(deleteLocationTarget.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setDeleteLocationError(
          await readErrorMessage(
            response,
            t("restaurants.deleteLocationFailed"),
          ),
        );
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          locations: prev.locations.filter(
            (loc) => loc.id !== deleteLocationTarget.id,
          ),
        };
      });
      setDeleteLocationTarget(null);
    } catch {
      setDeleteLocationError(t("restaurants.deleteLocationFailedNetwork"));
    } finally {
      setDeleteLocationPending(false);
    }
  }

  function openLocationPage(locationId: string) {
    router.push(`/restaurants/${encodeURIComponent(locationId)}`);
  }

  const closeDeleteModal = useCallback(() => {
    setDeleteLocationTarget(null);
    setDeleteLocationError(null);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          {t("restaurants.loadingLocations")}
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          {t("restaurants.couldNotLoadLocations")}
        </p>
        <p className="max-w-md text-sm text-foreground/60">{loadError}</p>
      </div>
    );
  }

  const locations = data?.locations ?? [];
  const currentUserRole = data?.currentUserRole;

  if (locations.length === 0) {
    return (
      <div className="space-y-4">
        {requestError ? <RequestErrorBanner message={requestError} /> : null}

        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            {t("restaurants.noLocations")}
          </p>
          <p className="max-w-md text-sm text-foreground/60">
            {t("restaurants.noLocationsHelp")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requestError ? <RequestErrorBanner message={requestError} /> : null}

      <RestaurantsListMobile
        locations={locations}
        currentUserRole={currentUserRole ?? "USER"}
        updatingLocationId={updatingLocationId}
        onOpenLocationPage={openLocationPage}
        onToggleActive={handleToggle}
        onOpenQr={setQrLocation}
        onRequestDelete={setDeleteLocationTarget}
      />

      <RestaurantsListTable
        locations={locations}
        currentUserRole={currentUserRole ?? "USER"}
        updatingLocationId={updatingLocationId}
        onOpenLocationPage={openLocationPage}
        onToggleActive={handleToggle}
        onOpenQr={setQrLocation}
        onRequestDelete={setDeleteLocationTarget}
      />

      {deleteLocationTarget ? (
        <DeleteLocationModal
          target={deleteLocationTarget}
          pending={deleteLocationPending}
          error={deleteLocationError}
          onClose={closeDeleteModal}
          onConfirm={handleConfirmDeleteLocation}
        />
      ) : null}

      {qrLocation ? (
        <QrLocationModal location={qrLocation} onClose={closeQrModal} />
      ) : null}
    </div>
  );
}
