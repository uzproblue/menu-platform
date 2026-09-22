import Image from "next/image";
import { ItemThumbnail } from "@/app/components/global-menu/global-menu-item-row";
import { useI18n } from "@/app/components/i18n-provider";
import { LOCATION_TRANSLATION_OPTIONS } from "@/lib/menu-translation-langs";
import { SUPPORTED_CATALOG_CURRENCIES } from "@/lib/supported-currencies";
import { LocationTypeSelector } from "./location-type-selector";
import { MapboxLocationPicker } from "../mapbox-location-picker";
import type { GeoCoordinates } from "@/lib/address-types";

type WizardStepBasicsProps = {
  name: string;
  setName: (v: string) => void;
  locationType: "dine_in" | "delivery";
  setLocationType: (v: "dine_in" | "delivery") => void;
  address: string;
  setAddress: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
  translationLangs: string[];
  setTranslationLangs: (v: string[]) => void;
  logoUrlInputId: string;
  logoFileInputId: string;
  logoUrlInput: string;
  setLogoUrlInput: (v: string) => void;
  logoPreviewSrc: string;
  logoFile: File | null;
  setLogoFile: (f: File | null) => void;
  setLogoPreviewUrl: (fn: (prev: string | null) => string | null) => void;
  logoImageError: string | null;
  setLogoImageError: (v: string | null) => void;
  maxLogoImageSizeBytes: number;
  coverUrlInputId: string;
  coverFileInputId: string;
  coverUrlInput: string;
  setCoverUrlInput: (v: string) => void;
  coverPreviewSrc: string;
  coverFile: File | null;
  setCoverFile: (f: File | null) => void;
  setCoverPreviewUrl: (fn: (prev: string | null) => string | null) => void;
  coverImageError: string | null;
  setCoverImageError: (v: string | null) => void;
  maxCoverImageSizeBytes: number;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  latitude: number | null;
  longitude: number | null;
  setCoordinates: (coords: GeoCoordinates) => void;
  posOrganizationId: string;
  setPosOrganizationId: (v: string) => void;
  posTerminalGroupId: string;
  setPosTerminalGroupId: (v: string) => void;
  posApiToken: string;
  setPosApiToken: (v: string) => void;
  chefAlertChatId: string;
  setChefAlertChatId: (v: string) => void;
  instagramUrl: string;
  setInstagramUrl: (v: string) => void;
  twoGisUrl: string;
  setTwoGisUrl: (v: string) => void;
  ordersEnabled: boolean;
  setOrdersEnabled: (v: boolean) => void;
  customDomain?: string;
  setCustomDomain?: (v: string) => void;
  existingLocations?: Array<{ id: string; name: string; type?: "dine_in" | "delivery" }>;
  copyMenuFromLocationId?: string;
  setCopyMenuFromLocationId?: (v: string) => void;
  isLoadingLocationEdit: boolean;
  editLoadError: string | null;
  isSavingStep1: boolean;
  createdLocationId: string | null;
  onNext: () => void;
  mapboxToken?: string;
};

export function WizardStepBasics({
  name,
  setName,
  locationType,
  setLocationType,
  address,
  setAddress,
  currency,
  setCurrency,
  customDomain = "",
  setCustomDomain,
  existingLocations,
  copyMenuFromLocationId,
  setCopyMenuFromLocationId,
  translationLangs,
  setTranslationLangs,
  logoUrlInputId,
  logoFileInputId,
  logoUrlInput,
  setLogoUrlInput,
  logoPreviewSrc,
  logoFile,
  setLogoFile,
  setLogoPreviewUrl,
  logoImageError,
  setLogoImageError,
  maxLogoImageSizeBytes,
  coverUrlInputId,
  coverFileInputId,
  coverUrlInput,
  setCoverUrlInput,
  coverPreviewSrc,
  coverFile,
  setCoverFile,
  setCoverPreviewUrl,
  coverImageError,
  setCoverImageError,
  maxCoverImageSizeBytes,
  phoneNumber,
  setPhoneNumber,
  latitude,
  longitude,
  setCoordinates,
  posOrganizationId,
  setPosOrganizationId,
  posTerminalGroupId,
  setPosTerminalGroupId,
  posApiToken,
  setPosApiToken,
  chefAlertChatId,
  setChefAlertChatId,
  instagramUrl,
  setInstagramUrl,
  twoGisUrl,
  setTwoGisUrl,
  ordersEnabled,
  setOrdersEnabled,
  isLoadingLocationEdit,
  editLoadError,
  isSavingStep1,
  createdLocationId,
  onNext,
  mapboxToken,
}: WizardStepBasicsProps) {
  const { t } = useI18n();
  const formDisabled = isLoadingLocationEdit || Boolean(editLoadError);

  return (
    <div className="mt-8 space-y-6">
      {isLoadingLocationEdit && (
        <p className="text-sm text-foreground/60">{t("restaurants.newWizard.loadingLocationEdit")}</p>
      )}
      {editLoadError && (
        <p
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          {editLoadError}
        </p>
      )}

      {/* 1. Location Type Choice */}
      <LocationTypeSelector
        value={locationType}
        onChange={setLocationType}
        disabled={formDisabled || Boolean(createdLocationId)}
      />

      {/* Custom Domain (Only for Delivery) */}
      {locationType === "delivery" && setCustomDomain && (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-2">
          <div>
            <label className="text-xs font-semibold text-foreground" htmlFor="nw-custom-domain">
              {t("restaurants.customDomainTitle")}
            </label>
            <p className="mt-0.5 text-xs text-foreground/60">
              {t("restaurants.customDomainHint")}
            </p>
          </div>
          <input
            id="nw-custom-domain"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value.toLowerCase().trim())}
            disabled={formDisabled}
            placeholder="order.woodly.uz"
            className="w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 font-mono"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      )}

      {/* Initial Menu Selection (Only on Creation) */}
      {!createdLocationId && setCopyMenuFromLocationId && (
        <div className="rounded-2xl border border-foreground/12 bg-foreground/[0.02] p-4 space-y-2">
          <div>
            <label className="text-xs font-semibold text-foreground" htmlFor="nw-copy-menu">
              {t("restaurants.initialMenuTitle")}
            </label>
            <p className="mt-0.5 text-xs text-foreground/60">
              {t("restaurants.initialMenuHint")}
            </p>
          </div>
          <select
            id="nw-copy-menu"
            value={copyMenuFromLocationId ?? "catalog"}
            onChange={(e) => setCopyMenuFromLocationId(e.target.value)}
            disabled={formDisabled}
            className="w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="catalog">
              {t("restaurants.initialMenuCatalog")}
            </option>
            {existingLocations && existingLocations.length > 0 && (
              <optgroup label={t("restaurants.copyFromExisting")}>
                {existingLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.type === "delivery" ? "Delivery" : "Dine-In"})
                  </option>
                ))}
              </optgroup>
            )}
            <option value="none">
              {t("restaurants.initialMenuEmpty")}
            </option>
          </select>
        </div>
      )}

      {/* 2. Basic Info: Name & Currency */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-foreground/70" htmlFor="nw-name">
            {t("common.name")}
          </label>
          <input
            id="nw-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={formDisabled}
            placeholder={locationType === "delivery" ? "e.g. Woodly Delivery" : "e.g. Woodly Downtown"}
            className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            autoComplete="organization"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground/70" htmlFor="nw-currency">
            {t("global.currency")}
          </label>
          <select
            id="nw-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={formDisabled}
            className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {SUPPORTED_CATALOG_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Translation Languages */}
      <div>
        <p className="text-xs font-medium text-foreground/70">{t("restaurants.translationLangsHeading")}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {LOCATION_TRANSLATION_OPTIONS.map((lang) => {
            const checked = translationLangs.includes(lang);
            return (
              <label key={lang} className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTranslationLangs(Array.from(new Set([...translationLangs, lang])));
                    } else {
                      setTranslationLangs(translationLangs.filter((x) => x !== lang));
                    }
                  }}
                  disabled={formDisabled}
                />
                {lang}
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. Address Section */}
      {locationType === "delivery" ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/70">
            {t("restaurants.deliveryAddressTitle")}
          </label>
          <p className="text-xs text-foreground/50">
            {t("restaurants.deliveryAddressHint")}
          </p>
          <MapboxLocationPicker
            address={address}
            setAddress={setAddress}
            latitude={latitude}
            longitude={longitude}
            onChangeCoordinates={setCoordinates}
            disabled={formDisabled}
            mapboxToken={mapboxToken}
          />
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium text-foreground/70" htmlFor="nw-address">
            {t("common.address")} {t("newCategory.optionalSuffix")}
          </label>
          <textarea
            id="nw-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            disabled={formDisabled}
            className="mt-1 w-full resize-y rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      )}

      {/* 5. Contact & Socials */}
      <div className="rounded-2xl border border-foreground/12 bg-foreground/[0.02] p-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("restaurants.contactAndSocialTitle")}
          </p>
          <p className="mt-1 text-xs text-foreground/55">
            {t("restaurants.contactAndSocialHint")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-foreground/70" htmlFor="nw-phone">
              {t("restaurants.phoneNumber")}
            </label>
            <input
              id="nw-phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={formDisabled}
              placeholder="+998 (90) 123-45-67"
              className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground/70" htmlFor="nw-instagram">
              {t("restaurants.newWizard.instagramUrl")}
            </label>
            <input
              id="nw-instagram"
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              disabled={formDisabled}
              placeholder={t("restaurants.newWizard.instagramUrlPlaceholder")}
              className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          {locationType === "dine_in" && (
            <>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground/70" htmlFor="nw-2gis">
                  {t("restaurants.newWizard.twoGisUrl")}
                </label>
                <input
                  id="nw-2gis"
                  type="url"
                  value={twoGisUrl}
                  onChange={(e) => setTwoGisUrl(e.target.value)}
                  disabled={formDisabled}
                  placeholder={t("restaurants.newWizard.twoGisUrlPlaceholder")}
                  className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ordersEnabled}
                    onChange={(e) => setOrdersEnabled(e.target.checked)}
                    disabled={formDisabled}
                  />
                  {t("restaurants.newWizard.ordersEnabled")}
                </label>
                <p className="mt-1 text-xs text-foreground/55">
                  {t("restaurants.newWizard.ordersEnabledHint")}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 6. Logo Image */}
      <div className="space-y-3">
        <label htmlFor={logoUrlInputId} className="text-sm font-medium text-foreground">
          {t("restaurants.newWizard.logoUrlOrPath")}
        </label>
        <div className="rounded-2xl border border-foreground/12 bg-foreground/[0.03] p-3 ring-1 ring-foreground/5 sm:p-4">
          <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                {t("global.imagePreviewAlt")}
              </p>
              <div className="relative size-28 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 ring-1 ring-foreground/5">
                {logoPreviewSrc ? (
                  <ItemThumbnail
                    src={logoPreviewSrc}
                    alt={t("restaurants.newWizard.logoPreviewAlt")}
                    sizes="112px"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-center text-xs text-foreground/45">
                    {t("global.noImage")}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <input
                id={logoUrlInputId}
                value={logoUrlInput}
                onChange={(e) => {
                  setLogoUrlInput(e.target.value);
                  if (logoFile) {
                    setLogoFile(null);
                    setLogoPreviewUrl((prev) => {
                      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                      return null;
                    });
                  }
                  setLogoImageError(null);
                }}
                disabled={formDisabled}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder={t("global.imagePlaceholder")}
              />
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-foreground/15" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/45">
                  or
                </span>
                <div className="h-px flex-1 bg-foreground/15" />
              </div>
              <input
                id={logoFileInputId}
                type="file"
                accept="image/*"
                disabled={formDisabled}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > maxLogoImageSizeBytes) {
                    setLogoFile(null);
                    setLogoPreviewUrl((prev) => {
                      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                      return null;
                    });
                    setLogoImageError(
                      t("newItem.imageTooLarge", {
                        maxMb: String(Math.round(maxLogoImageSizeBytes / (1024 * 1024))),
                      }),
                    );
                    e.currentTarget.value = "";
                    return;
                  }
                  setLogoFile(file);
                  setLogoImageError(null);
                  if (file) setLogoUrlInput("");
                  setLogoPreviewUrl((prev) => {
                    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                    if (!file) return null;
                    return URL.createObjectURL(file);
                  });
                }}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {logoImageError ? (
                <p className="text-xs text-red-600 dark:text-red-300">{logoImageError}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 7. Background / Cover Image (especially prominent for Delivery) */}
      <div className="space-y-3">
        <div>
          <label htmlFor={coverUrlInputId} className="text-sm font-medium text-foreground">
            {t("restaurants.coverImageTitle")}
          </label>
          <p className="text-xs text-foreground/50 mt-0.5">
            {t("restaurants.coverImageHint")}
          </p>
        </div>
        <div className="rounded-2xl border border-foreground/12 bg-foreground/[0.03] p-3 ring-1 ring-foreground/5 sm:p-4">
          <div className="space-y-3">
            {coverPreviewSrc ? (
              <div className="relative h-36 w-full overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 ring-1 ring-foreground/5">
                <Image
                  src={coverPreviewSrc}
                  alt={t("restaurants.coverPreviewAlt")}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}
            <input
              id={coverUrlInputId}
              value={coverUrlInput}
              onChange={(e) => {
                setCoverUrlInput(e.target.value);
                if (coverFile) {
                  setCoverFile(null);
                  setCoverPreviewUrl((prev) => {
                    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                    return null;
                  });
                }
                setCoverImageError(null);
              }}
              disabled={formDisabled}
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder={t("restaurants.coverUrlPlaceholder")}
            />
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-foreground/15" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/45">
                {t("restaurants.orDivider")}
              </span>
              <div className="h-px flex-1 bg-foreground/15" />
            </div>
            <input
              id={coverFileInputId}
              type="file"
              accept="image/*"
              disabled={formDisabled}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && file.size > maxCoverImageSizeBytes) {
                  setCoverFile(null);
                  setCoverPreviewUrl((prev) => {
                    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                    return null;
                  });
                  setCoverImageError(
                    `File is too large (max ${Math.round(maxCoverImageSizeBytes / (1024 * 1024))}MB)`,
                  );
                  e.currentTarget.value = "";
                  return;
                }
                setCoverFile(file);
                setCoverImageError(null);
                if (file) setCoverUrlInput("");
                setCoverPreviewUrl((prev) => {
                  if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                  if (!file) return null;
                  return URL.createObjectURL(file);
                });
              }}
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {coverImageError ? (
              <p className="text-xs text-red-600 dark:text-red-300">{coverImageError}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* 8. POS integration (only for Dine-In) */}
      {locationType === "dine_in" && (
        <div className="rounded-2xl border border-foreground/12 bg-foreground/[0.02] p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("restaurants.newWizard.iikoIntegrationTitle")}
            </p>
            <p className="mt-1 text-xs text-foreground/55">
              {t("restaurants.newWizard.iikoIntegrationHint")}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-foreground/70" htmlFor="nw-pos-org">
                {t("restaurants.newWizard.posOrganizationId")}
              </label>
              <input
                id="nw-pos-org"
                value={posOrganizationId}
                onChange={(e) => setPosOrganizationId(e.target.value)}
                disabled={formDisabled}
                placeholder={t("restaurants.newWizard.posOrganizationIdPlaceholder")}
                className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-foreground/70" htmlFor="nw-pos-token">
                {t("restaurants.newWizard.posApiToken")}
              </label>
              <input
                id="nw-pos-token"
                type="password"
                value={posApiToken}
                onChange={(e) => setPosApiToken(e.target.value)}
                disabled={formDisabled}
                placeholder={t("restaurants.newWizard.posApiTokenPlaceholder")}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/70" htmlFor="nw-pos-tg">
                {t("restaurants.newWizard.posTerminalGroupId")}
              </label>
              <input
                id="nw-pos-tg"
                value={posTerminalGroupId}
                onChange={(e) => setPosTerminalGroupId(e.target.value)}
                disabled={formDisabled}
                className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground/70" htmlFor="nw-chef-chat">
                {t("restaurants.newWizard.chefAlertChatId")}
              </label>
              <input
                id="nw-chef-chat"
                value={chefAlertChatId}
                onChange={(e) => setChefAlertChatId(e.target.value)}
                disabled={formDisabled}
                className="mt-1 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-foreground/20 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      )}

      {/* 9. Next Step Action Button */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => void onNext()}
          disabled={isSavingStep1 || formDisabled}
          className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {isSavingStep1
            ? createdLocationId
              ? t("restaurants.newWizard.updatingLocation")
              : t("restaurants.newWizard.creatingLocation")
            : createdLocationId
              ? t("restaurants.newWizard.submitSave")
              : t("restaurants.newWizard.submitCreate")}
        </button>
      </div>
    </div>
  );
}
