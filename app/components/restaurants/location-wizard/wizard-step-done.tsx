import Link from "next/link";
import { useI18n } from "@/app/components/i18n-provider";

type WizardStepDoneProps = {
  publishedLocationId: string;
  qrDataUrl: string | null;
  publicMenuUrl: string;
  onDownloadQr: () => void;
};

export function WizardStepDone({
  publishedLocationId,
  qrDataUrl,
  publicMenuUrl,
  onDownloadQr,
}: WizardStepDoneProps) {
  const { t } = useI18n();

  return (
    <div className="mt-8 space-y-6 text-center">
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
          <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground">{t("restaurants.newWizard.successTitle")}</h2>
        <p className="mt-2 text-sm text-foreground/70">{t("restaurants.newWizard.successBody")}</p>
        <p className="mt-3 font-mono text-sm text-foreground/80">
          {t("restaurants.locationId")}: {publishedLocationId}
        </p>
      </div>
      <div className="flex flex-col items-center gap-4">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode
          <img
            src={qrDataUrl}
            alt={t("restaurants.newWizard.qrAlt")}
            className="rounded-xl border border-foreground/10 bg-white p-2"
            width={280}
            height={280}
          />
        ) : (
          <div className="flex h-[280px] w-[280px] items-center justify-center rounded-xl border border-dashed border-foreground/20 text-sm text-foreground/50">
            {t("restaurants.newWizard.qrGenerating")}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={!qrDataUrl}
            onClick={onDownloadQr}
            className="inline-flex items-center justify-center rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("restaurants.newWizard.downloadQr")}
          </button>
          <Link
            href="/restaurants"
            className="inline-flex items-center justify-center rounded-xl border border-foreground/15 px-4 py-2.5 text-sm font-medium"
          >
            {t("restaurants.newWizard.doneBack")}
          </Link>
        </div>
        <p className="max-w-lg text-xs text-foreground/50">
          {t("restaurants.newWizard.qrUrlHint", { url: publicMenuUrl })}
        </p>
      </div>
    </div>
  );
}
