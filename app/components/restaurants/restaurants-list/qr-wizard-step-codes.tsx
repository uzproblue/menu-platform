"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import type { LocationDiningTablesSection } from "@/lib/auth-api/types/locations";
import { resolveQrCenterImageUrl } from "@/lib/styled-qr";
import { QrTableRow } from "./qr-table-row";

type QrWizardStepCodesProps = {
  locationId: string;
  logoUrl?: string;
  qrCenterImageUrl?: string;
  sections: LocationDiningTablesSection[];
};

export function QrWizardStepCodes({
  locationId,
  logoUrl,
  qrCenterImageUrl,
  sections,
}: QrWizardStepCodesProps) {
  const { t } = useI18n();

  const chosenSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          tables: section.tables.filter((table) => table.chosen),
        }))
        .filter((section) => section.tables.length > 0),
    [sections],
  );

  const [activeSectionName, setActiveSectionName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (chosenSections.length === 0) {
      setActiveSectionName(null);
      return;
    }

    setActiveSectionName((current) => {
      if (
        current &&
        chosenSections.some((section) => section.sectionName === current)
      ) {
        return current;
      }
      return chosenSections[0]!.sectionName;
    });
  }, [chosenSections]);

  const activeSection =
    chosenSections.find((section) => section.sectionName === activeSectionName) ??
    null;

  const totalChosen = chosenSections.reduce(
    (sum, section) => sum + section.tables.length,
    0,
  );

  const centerImageUrl = resolveQrCenterImageUrl(qrCenterImageUrl, logoUrl);

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
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {chosenSections.map((section) => (
              <button
                key={section.sectionName}
                type="button"
                onClick={() => setActiveSectionName(section.sectionName)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  activeSectionName === section.sectionName
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 text-foreground/70"
                }`}
              >
                {section.sectionName}
                <span className="ml-1.5 text-xs opacity-70">
                  ({section.tables.length})
                </span>
              </button>
            ))}
          </div>

          {activeSection ? (
            <div className="space-y-3">
              {activeSection.tables.map((table) => (
                <QrTableRow
                  key={table.id}
                  locationId={locationId}
                  centerImageUrl={centerImageUrl}
                  table={table}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
