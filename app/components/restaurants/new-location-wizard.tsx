"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { getMaxUploadSizeBytes } from "@/lib/r2-upload-shared";
import type {
  GetLocationResponse,
  UpdateLocationDetailsResponse,
} from "@/lib/auth-api";
import { useI18n } from "../i18n-provider";
import { LocationWizardMenuPreview } from "./location-wizard-menu-preview";
import { DEFAULT_LOCATION_TRANSLATION_SELECTION } from "@/lib/menu-translation-langs";
import type { NewLocationWizardProps } from "./location-wizard/types";
import { WizardStepBasics } from "./location-wizard/wizard-step-basics";

export type { NewLocationWizardProps };

export function NewLocationWizard({
  initialLocationId = null,
  mapboxToken,
}: NewLocationWizardProps) {
  const { t } = useI18n();
  const router = useRouter();

  const [locationType, setLocationType] = useState<"dine_in" | "delivery">("dine_in");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("UZS");
  const [translationLangs, setTranslationLangs] = useState<string[]>([
    ...DEFAULT_LOCATION_TRANSLATION_SELECTION,
  ]);
  const logoUrlInputId = useId();
  const logoFileInputId = useId();
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImageError, setLogoImageError] = useState<string | null>(null);

  const coverUrlInputId = useId();
  const coverFileInputId = useId();
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverImageError, setCoverImageError] = useState<string | null>(null);
  const maxCoverImageSizeBytes = useMemo(
    () => getMaxUploadSizeBytes("location-cover"),
    [],
  );
  const coverPreviewSrc = coverPreviewUrl ?? coverUrlInput.trim();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [posOrganizationId, setPosOrganizationId] = useState("");
  const [posTerminalGroupId, setPosTerminalGroupId] = useState("");
  const [chefAlertChatId, setChefAlertChatId] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [twoGisUrl, setTwoGisUrl] = useState("");
  const [ordersEnabled, setOrdersEnabled] = useState(false);
  const maxLogoImageSizeBytes = useMemo(
    () => getMaxUploadSizeBytes("location-logo"),
    [],
  );
  const logoPreviewSrc = logoPreviewUrl ?? logoUrlInput.trim();

  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSavingStep1, setIsSavingStep1] = useState(false);
  const [isLoadingLocationEdit, setIsLoadingLocationEdit] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);

  const trimmedInitialLocationId = initialLocationId?.trim() ?? "";
  const isEditRouteMode = Boolean(trimmedInitialLocationId);
  const wizardBackHref = isEditRouteMode
    ? `/restaurants/${encodeURIComponent(trimmedInitialLocationId)}`
    : "/restaurants";
  const wizardBackLabel = isEditRouteMode
    ? t("common.back")
    : t("restaurants.newWizard.backToList");

  useEffect(() => {
    const id = initialLocationId?.trim();
    if (!id) return;
    let cancelled = false;
    (async () => {
      setIsLoadingLocationEdit(true);
      setEditLoadError(null);
      try {
        const res = await fetch(
          `/api/settings/locations/${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (res.status === 401) {
          setEditLoadError(t("restaurants.newWizard.errLoadLocationUnauthorized"));
          return;
        }
        if (res.status === 404) {
          setEditLoadError(t("restaurants.newWizard.errLoadLocationNotFound"));
          return;
        }
        if (!res.ok) {
          setEditLoadError(t("restaurants.newWizard.errLoadLocationEdit"));
          return;
        }
        const data = (await res.json()) as GetLocationResponse;
        const loc = data.location;
        if (cancelled) return;
        setName(loc.name);
        if (loc.type === "delivery") setLocationType("delivery");
        setAddress(loc.address ?? "");
        setCurrency(loc.currency);
        setTranslationLangs(
          Array.isArray(loc.translationLangs) && loc.translationLangs.length > 0
            ? loc.translationLangs
            : [...DEFAULT_LOCATION_TRANSLATION_SELECTION],
        );
        setLogoUrlInput(loc.logoUrl ?? "");
        if (loc.coverImageUrl) setCoverUrlInput(loc.coverImageUrl);
        if (loc.phoneNumber) setPhoneNumber(loc.phoneNumber);
        if (loc.latitude != null) setLatitude(Number(loc.latitude));
        if (loc.longitude != null) setLongitude(Number(loc.longitude));
        setPosOrganizationId(loc.posOrganizationId ?? "");
        setPosTerminalGroupId(loc.posTerminalGroupId ?? "");
        setChefAlertChatId(loc.chefAlertChatId ?? "");
        setInstagramUrl(loc.instagramUrl ?? "");
        setTwoGisUrl(loc.twoGisUrl ?? "");
        setOrdersEnabled(loc.ordersEnabled ?? false);
        setLogoFile(null);
        setLogoPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setCoverFile(null);
        setCoverPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setLogoImageError(null);
        setCoverImageError(null);
        setCreatedLocationId(loc.id);
      } catch {
        if (!cancelled) {
          setEditLoadError(t("restaurants.newWizard.errLoadLocationEdit"));
        }
      } finally {
        if (!cancelled) setIsLoadingLocationEdit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialLocationId, t]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      if (coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl, logoPreviewUrl]);

  const handleSave = async () => {
    setStepError(null);
    if (!name.trim()) {
      setStepError(t("restaurants.newWizard.errNameRequired"));
      return;
    }
    if (createdLocationId) {
      setIsSavingStep1(true);
      try {
        let uploadedLogoUrl: string | undefined;
        if (logoFile) {
          uploadedLogoUrl = await uploadFileToR2(logoFile, "location-logo");
        }
        let uploadedCoverUrl: string | undefined;
        if (coverFile) {
          uploadedCoverUrl = await uploadFileToR2(coverFile, "location-cover");
        }
        const trimmedAddress = address.trim();
        const logoForPatch = uploadedLogoUrl ?? logoUrlInput.trim();
        const coverForPatch = uploadedCoverUrl ?? coverUrlInput.trim();
        const res = await fetch(
          `/api/settings/locations/${encodeURIComponent(createdLocationId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              type: locationType,
              currency: currency.trim().toUpperCase(),
              address: trimmedAddress.length ? trimmedAddress : null,
              logoUrl: logoForPatch || null,
              coverImageUrl: coverForPatch || null,
              phoneNumber: phoneNumber.trim() || null,
              latitude: latitude != null ? latitude : null,
              longitude: longitude != null ? longitude : null,
              translationLangs,
              posOrganizationId: posOrganizationId.trim() || null,
              posTerminalGroupId: posTerminalGroupId.trim() || null,
              chefAlertChatId: chefAlertChatId.trim() || null,
              instagramUrl: instagramUrl.trim() || null,
              twoGisUrl: twoGisUrl.trim() || null,
              ordersEnabled,
            }),
          },
        );
        if (!res.ok) {
          setStepError(t("restaurants.newWizard.errUpdateLocation"));
          return;
        }
        const payload = (await res.json()) as UpdateLocationDetailsResponse;
        const loc = payload.location;
        setName(loc.name);
        if (loc.type === "delivery") setLocationType("delivery");
        setAddress(loc.address ?? "");
        setCurrency(loc.currency);
        setTranslationLangs(
          Array.isArray(loc.translationLangs) && loc.translationLangs.length > 0
            ? loc.translationLangs
            : [...DEFAULT_LOCATION_TRANSLATION_SELECTION],
        );
        setLogoUrlInput(loc.logoUrl ?? "");
        if (loc.coverImageUrl) setCoverUrlInput(loc.coverImageUrl);
        if (loc.phoneNumber) setPhoneNumber(loc.phoneNumber);
        if (loc.latitude != null) setLatitude(Number(loc.latitude));
        if (loc.longitude != null) setLongitude(Number(loc.longitude));
        setPosOrganizationId(loc.posOrganizationId ?? "");
        setPosTerminalGroupId(loc.posTerminalGroupId ?? "");
        setChefAlertChatId(loc.chefAlertChatId ?? "");
        setInstagramUrl(loc.instagramUrl ?? "");
        setTwoGisUrl(loc.twoGisUrl ?? "");
        setOrdersEnabled(loc.ordersEnabled ?? false);
        setLogoFile(null);
        setCoverFile(null);
        setLogoPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
        setCoverPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });

        router.push(wizardBackHref);
        router.refresh();
      } catch {
        setStepError(t("restaurants.newWizard.errUpdateLocation"));
      } finally {
        setIsSavingStep1(false);
      }
      return;
    }

    setIsSavingStep1(true);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        logoUrl = await uploadFileToR2(logoFile, "location-logo");
      } else {
        const trimmedLogo = logoUrlInput.trim();
        if (trimmedLogo) logoUrl = trimmedLogo;
      }
      let coverImageUrl: string | undefined;
      if (coverFile) {
        coverImageUrl = await uploadFileToR2(coverFile, "location-cover");
      } else {
        const trimmedCover = coverUrlInput.trim();
        if (trimmedCover) coverImageUrl = trimmedCover;
      }
      const trimmedAddress = address.trim();
      const bodyWithLangs: Record<string, unknown> = {
        name: name.trim(),
        type: locationType,
        currency: currency.trim().toUpperCase(),
        translationLangs,
      };
      if (logoUrl) bodyWithLangs.logoUrl = logoUrl;
      if (coverImageUrl) bodyWithLangs.coverImageUrl = coverImageUrl;
      if (trimmedAddress) bodyWithLangs.address = trimmedAddress;
      if (phoneNumber.trim()) bodyWithLangs.phoneNumber = phoneNumber.trim();
      if (latitude != null) bodyWithLangs.latitude = latitude;
      if (longitude != null) bodyWithLangs.longitude = longitude;

      const res = await fetch("/api/settings/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyWithLangs),
      });
      if (!res.ok) {
        setStepError(t("restaurants.newWizard.errCreateLocation"));
        return;
      }
      const payload = (await res.json()) as { location?: { id?: string } };
      const id = payload.location?.id;
      if (!id) {
        setStepError(t("restaurants.newWizard.errCreateLocation"));
        return;
      }
      router.push(`/restaurants/${encodeURIComponent(id)}`);
      router.refresh();
    } catch {
      setStepError(t("restaurants.newWizard.errCreateLocation"));
    } finally {
      setIsSavingStep1(false);
    }
  };

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:items-start lg:gap-10 xl:gap-12">
      <div className="min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isEditRouteMode
                ? t("restaurants.newWizard.editPageTitle")
                : t("restaurants.newWizard.pageTitle")}
            </h1>
            <p className="mt-2 text-sm text-foreground/60">
              {isEditRouteMode
                ? t("restaurants.newWizard.editPageSubtitle")
                : t("restaurants.newWizard.pageSubtitle")}
            </p>
          </div>
          <Link
            href={wizardBackHref}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-foreground/15 bg-background/80 px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-foreground/25 hover:bg-foreground/5"
          >
            {wizardBackLabel}
          </Link>
        </div>

        {stepError && (
          <p
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
            role="alert"
          >
            {stepError}
          </p>
        )}

        <div className="mt-6">
          <WizardStepBasics
            name={name}
            setName={setName}
            locationType={locationType}
            setLocationType={setLocationType}
            address={address}
            setAddress={setAddress}
            currency={currency}
            setCurrency={setCurrency}
            translationLangs={translationLangs}
            setTranslationLangs={setTranslationLangs}
            logoUrlInputId={logoUrlInputId}
            logoFileInputId={logoFileInputId}
            logoUrlInput={logoUrlInput}
            setLogoUrlInput={setLogoUrlInput}
            logoPreviewSrc={logoPreviewSrc}
            logoFile={logoFile}
            setLogoFile={setLogoFile}
            setLogoPreviewUrl={setLogoPreviewUrl}
            logoImageError={logoImageError}
            setLogoImageError={setLogoImageError}
            maxLogoImageSizeBytes={maxLogoImageSizeBytes}
            coverUrlInputId={coverUrlInputId}
            coverFileInputId={coverFileInputId}
            coverUrlInput={coverUrlInput}
            setCoverUrlInput={setCoverUrlInput}
            coverPreviewSrc={coverPreviewSrc}
            coverFile={coverFile}
            setCoverFile={setCoverFile}
            setCoverPreviewUrl={setCoverPreviewUrl}
            coverImageError={coverImageError}
            setCoverImageError={setCoverImageError}
            maxCoverImageSizeBytes={maxCoverImageSizeBytes}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            latitude={latitude}
            longitude={longitude}
            setCoordinates={([lng, lat]) => {
              setLongitude(lng);
              setLatitude(lat);
            }}
            posOrganizationId={posOrganizationId}
            setPosOrganizationId={setPosOrganizationId}
            posTerminalGroupId={posTerminalGroupId}
            setPosTerminalGroupId={setPosTerminalGroupId}
            chefAlertChatId={chefAlertChatId}
            setChefAlertChatId={setChefAlertChatId}
            instagramUrl={instagramUrl}
            setInstagramUrl={setInstagramUrl}
            twoGisUrl={twoGisUrl}
            setTwoGisUrl={setTwoGisUrl}
            ordersEnabled={ordersEnabled}
            setOrdersEnabled={setOrdersEnabled}
            isLoadingLocationEdit={isLoadingLocationEdit}
            editLoadError={editLoadError}
            isSavingStep1={isSavingStep1}
            createdLocationId={createdLocationId}
            onNext={handleSave}
            mapboxToken={mapboxToken}
          />
        </div>
      </div>

      <aside className="mt-10 hidden lg:mt-0 lg:flex lg:justify-center xl:sticky xl:top-24 xl:justify-end xl:self-start">
        <LocationWizardMenuPreview
          locationName={name}
          locationType={locationType}
          address={address}
          currency={currency}
          logoSrc={logoPreviewSrc || undefined}
          coverSrc={coverPreviewSrc || undefined}
          sections={[]}
          placeholderLocationName={t("restaurants.newWizard.previewPlaceholderName")}
          caption={
            locationType === "delivery"
              ? t("restaurants.newWizard.deliveryPreviewCaption")
              : t("restaurants.newWizard.menuPreviewCaption")
          }
        />
      </aside>
    </div>
  );
}
