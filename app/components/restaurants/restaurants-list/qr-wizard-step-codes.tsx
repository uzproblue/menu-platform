"use client";

import { useI18n } from "@/app/components/i18n-provider";
import type { LocationDiningTablesSection } from "@/lib/auth-api/types/locations";
import { QrTableRow } from "./qr-table-row";

type QrWizardStepCodesProps = {
  locationId: string;
  logoUrl?: string;
  sections: LocationDiningTablesSection[];
};

export function QrWizardStepCodes({
  locationId,
  logoUrl,
  sections,
}: QrWizardStepCodesProps) {
  const { t } = useI18n();

  const chosenSections = sections
    .map((section) => ({
      ...section,
      tables: section.tables.filter((table) => table.chosen),
    }))
    .filter((section) => section.tables.length > 0);

  const totalChosen = chosenSections.reduce(
    (sum, section) => sum + section.tables.length,
    0,
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">
          {t("restaurants.qrWizardStepCodes")}
        </p>
        <h3 className="mt-1 text-base font-semibold text-foreground">
          {t("restaurants.qrWizardCodesTitle")}
        </h3>
        <p className="mt-1 text-sm text-foreground/60">
          {t("restaurants.qrWizardCodesSubtitle")}
        </p>
      </div>

      {totalChosen === 0 ? (
        <p className="py-8 text-center text-sm text-foreground/60">
          {t("restaurants.qrWizardCodesEmpty")}
        </p>
      ) : (
        <div className="space-y-6">
          {chosenSections.map((section) => (
            <div key={section.sectionName} className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                {section.sectionName}
              </h4>
              <div className="space-y-3">
                {section.tables.map((table) => (
                  <QrTableRow
                    key={table.id}
                    locationId={locationId}
                    logoUrl={logoUrl}
                    table={table}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
