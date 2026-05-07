import { ItemThumbnail } from "@/app/components/global-menu/global-menu-item-row";
import { useI18n } from "@/app/components/i18n-provider";
import { LOCATION_TRANSLATION_OPTIONS } from "@/lib/menu-translation-langs";
import { SUPPORTED_CATALOG_CURRENCIES } from "@/lib/supported-currencies";

type WizardStepBasicsProps = {
  name: string;
  setName: (v: string) => void;
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
  isLoadingLocationEdit: boolean;
  editLoadError: string | null;
  isSavingStep1: boolean;
  createdLocationId: string | null;
  onNext: () => void;
};

export function WizardStepBasics({
  name,
  setName,
  address,
  setAddress,
  currency,
  setCurrency,
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
  isLoadingLocationEdit,
  editLoadError,
  isSavingStep1,
  createdLocationId,
  onNext,
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
      <div>
        <p className="text-xs font-medium text-foreground/70">Translation languages</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {LOCATION_TRANSLATION_OPTIONS.map((lang) => {
            const checked = translationLangs.includes(lang);
            return (
              <label key={lang} className="inline-flex items-center gap-2 text-sm text-foreground">
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
        <p className="text-xs text-foreground/50">{t("restaurants.newWizard.logoEmptyHint")}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => void onNext()}
          disabled={isSavingStep1 || formDisabled}
          className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingStep1
            ? createdLocationId
              ? t("restaurants.newWizard.updatingLocation")
              : t("restaurants.newWizard.creatingLocation")
            : t("restaurants.newWizard.next")}
        </button>
      </div>
    </div>
  );
}
