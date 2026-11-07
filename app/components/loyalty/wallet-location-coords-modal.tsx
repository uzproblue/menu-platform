"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Location } from "@/lib/auth-api/types/locations";
import type { GeoCoordinates } from "@/lib/address-types";
import { useI18n } from "../i18n-provider";
import { GoogleLocationPicker } from "../restaurants/google-location-picker";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

type Props = {
  location: Location;
  onClose: () => void;
  onSaved: (updated: Location) => void;
};

export function WalletLocationCoordsModal({
  location,
  onClose,
  onSaved,
}: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState(
    location.address?.trim() || location.name || "",
  );
  const [latitude, setLatitude] = useState<number | null>(
    typeof location.latitude === "number" && Number.isFinite(location.latitude)
      ? location.latitude
      : null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    typeof location.longitude === "number" && Number.isFinite(location.longitude)
      ? location.longitude
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onChangeCoordinates = ([lng, lat]: GeoCoordinates) => {
    setLongitude(lng);
    setLatitude(lat);
  };

  const canSave =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const save = async () => {
    if (!canSave || latitude === null || longitude === null) {
      setError(t("loyalty.walletCoordsNeedPin"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const trimmedAddress = address.trim();
      const res = await fetch(`/api/settings/locations/${location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(trimmedAddress ? { address: trimmedAddress } : {}),
          latitude,
          longitude,
        }),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.walletCoordsFailed")));
        return;
      }
      const data = (await res.json()) as {
        location?: Partial<Location> & { id?: string };
        address?: string;
        latitude?: number | null;
        longitude?: number | null;
      };
      const saved = data.location ?? data;
      onSaved({
        ...location,
        ...saved,
        id: location.id,
        address: saved.address ?? trimmedAddress,
        latitude:
          typeof saved.latitude === "number" ? saved.latitude : latitude,
        longitude:
          typeof saved.longitude === "number" ? saved.longitude : longitude,
      });
    } catch {
      setError(t("loyalty.walletCoordsFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-coords-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-background shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id="wallet-coords-modal-title"
              className="text-lg font-semibold tracking-tight"
            >
              {t("loyalty.walletCoordsModalTitle")}
            </h2>
            <p className="mt-0.5 truncate text-sm text-foreground/60">
              {location.name}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-foreground/55 hover:bg-foreground/5"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">{t("common.address")}</span>
            <textarea
              className="min-h-[4.5rem] w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("loyalty.walletCoordsAddressPlaceholder")}
            />
          </label>

          <GoogleLocationPicker
            address={address}
            setAddress={setAddress}
            latitude={latitude}
            longitude={longitude}
            onChangeCoordinates={onChangeCoordinates}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-foreground/10 px-4 py-3 sm:px-5">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-foreground/70 hover:bg-foreground/5"
            onClick={onClose}
            disabled={saving}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={saving || !canSave}
            onClick={() => void save()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving
              ? t("loyalty.walletCoordsSaving")
              : t("loyalty.walletCoordsSave")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
