"use client";

import { useI18n } from "@/app/components/i18n-provider";
import type { LocationDiningTablesSection } from "@/lib/auth-api/types/locations";

type QrWizardStepSectionsProps = {
  sections: LocationDiningTablesSection[];
  selectedSectionNames: Set<string>;
  onToggleSection: (sectionName: string) => void;
};

export function QrWizardStepSections({
  sections,
  selectedSectionNames,
  onToggleSection,
}: QrWizardStepSectionsProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">
          {t("restaurants.qrWizardStepSections")}
        </p>
        <h3 className="mt-1 text-base font-semibold text-foreground">
          {t("restaurants.qrWizardSectionsTitle")}
        </h3>
        <p className="mt-1 text-sm text-foreground/60">
          {t("restaurants.qrWizardSectionsSubtitle")}
        </p>
      </div>

      <ul className="overflow-hidden rounded-xl border border-foreground/10">
        {sections.map((section) => (
          <li
            key={section.sectionName}
            className="border-b border-foreground/5 last:border-0"
          >
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-foreground/5">
              <input
                type="checkbox"
                checked={selectedSectionNames.has(section.sectionName)}
                onChange={() => onToggleSection(section.sectionName)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-foreground">
                  {section.sectionName}
                </span>
                <span className="mt-0.5 block text-xs text-foreground/55">
                  {t("restaurants.qrWizardSectionTableCount", {
                    count: section.tables.length,
                  })}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
