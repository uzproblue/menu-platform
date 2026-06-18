"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import type { LocationDiningTablesSection } from "@/lib/auth-api/types/locations";
import { readErrorMessage } from "./read-error-message";
import { QrWizardStepCodes } from "./qr-wizard-step-codes";
import { QrWizardStepSections } from "./qr-wizard-step-sections";
import { QrWizardStepTables } from "./qr-wizard-step-tables";

export type QrLocationRef = { id: string; name: string; logoUrl: string };

type QrLocationModalProps = {
  location: QrLocationRef;
  onClose: () => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; sections: LocationDiningTablesSection[] };

type WizardPhase =
  | { kind: "sections" }
  | { kind: "tables"; sectionIndex: number }
  | { kind: "qrs" };

function collectChosenTableIds(sections: LocationDiningTablesSection[]): Set<string> {
  const ids = new Set<string>();
  for (const section of sections) {
    for (const table of section.tables) {
      if (table.chosen) ids.add(table.id);
    }
  }
  return ids;
}

function collectSectionsWithChosen(
  sections: LocationDiningTablesSection[],
): Set<string> {
  const names = new Set<string>();
  for (const section of sections) {
    if (section.tables.some((table) => table.chosen)) {
      names.add(section.sectionName);
    }
  }
  return names;
}

function hasAnyChosenTables(sections: LocationDiningTablesSection[]): boolean {
  return sections.some((section) => section.tables.some((table) => table.chosen));
}

export function QrLocationModal({ location, onClose }: QrLocationModalProps) {
  const { t } = useI18n();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [phase, setPhase] = useState<WizardPhase>({ kind: "sections" });
  const [selectedSectionNames, setSelectedSectionNames] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const applyLoadedSections = useCallback(
    (sections: LocationDiningTablesSection[]) => {
      const chosenTableIds = collectChosenTableIds(sections);
      const chosenSections = collectSectionsWithChosen(sections);
      setSelectedTableIds(chosenTableIds);
      setSelectedSectionNames(chosenSections);
      setPhase(
        hasAnyChosenTables(sections) ? { kind: "qrs" } : { kind: "sections" },
      );
      setLoadState({ status: "ready", sections });
    },
    [],
  );

  const loadTables = useCallback(async () => {
    setLoadState({ status: "loading" });
    setSaveError(null);
    try {
      const response = await fetch(
        `/api/settings/locations/${encodeURIComponent(location.id)}/dining-tables`,
        { method: "GET", cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, t("restaurants.qrTablesLoadError")),
        );
      }
      const data = (await response.json()) as {
        sections?: LocationDiningTablesSection[];
      };
      const sections = Array.isArray(data.sections) ? data.sections : [];
      if (sections.length === 0) {
        setLoadState({ status: "empty" });
        return;
      }
      applyLoadedSections(sections);
    } catch (error) {
      setLoadState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : t("restaurants.qrTablesLoadError"),
      });
    }
  }, [applyLoadedSections, location.id, t]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const sections =
    loadState.status === "ready" ? loadState.sections : [];

  const orderedSelectedSections = useMemo(
    () =>
      sections.filter((section) =>
        selectedSectionNames.has(section.sectionName),
      ),
    [sections, selectedSectionNames],
  );

  const toggleSection = useCallback((sectionName: string) => {
    setSelectedSectionNames((prev) => {
      const next = new Set(prev);
      if (next.has(sectionName)) next.delete(sectionName);
      else next.add(sectionName);
      return next;
    });
  }, []);

  const toggleTable = useCallback((tableId: string) => {
    setSelectedTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  }, []);

  const pruneDeselectedSections = useCallback(() => {
    const allowedSectionNames = selectedSectionNames;
    setSelectedTableIds((prev) => {
      const next = new Set<string>();
      for (const section of sections) {
        if (!allowedSectionNames.has(section.sectionName)) continue;
        for (const table of section.tables) {
          if (prev.has(table.id)) next.add(table.id);
        }
      }
      return next;
    });
  }, [sections, selectedSectionNames]);

  const buildFinalChosenTableIds = useCallback((): string[] => {
    const ids: string[] = [];
    for (const section of sections) {
      if (!selectedSectionNames.has(section.sectionName)) continue;
      for (const table of section.tables) {
        if (selectedTableIds.has(table.id)) ids.push(table.id);
      }
    }
    return ids;
  }, [sections, selectedSectionNames, selectedTableIds]);

  const saveChoices = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(
        `/api/settings/locations/${encodeURIComponent(location.id)}/dining-tables/choices`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chosenTableIds: buildFinalChosenTableIds() }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, t("restaurants.qrWizardSaveError")),
        );
      }
      const data = (await response.json()) as {
        sections?: LocationDiningTablesSection[];
      };
      const updatedSections = Array.isArray(data.sections) ? data.sections : [];
      setLoadState({ status: "ready", sections: updatedSections });
      setSelectedTableIds(collectChosenTableIds(updatedSections));
      setSelectedSectionNames(collectSectionsWithChosen(updatedSections));
      return true;
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : t("restaurants.qrWizardSaveError"),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [buildFinalChosenTableIds, location.id, t]);

  const goToSections = useCallback(() => {
    setSaveError(null);
    setPhase({ kind: "sections" });
  }, []);

  const handleSectionsNext = useCallback(() => {
    if (selectedSectionNames.size === 0) return;
    pruneDeselectedSections();
    setSaveError(null);
    setPhase({ kind: "tables", sectionIndex: 0 });
  }, [pruneDeselectedSections, selectedSectionNames.size]);

  const currentTableSection =
    phase.kind === "tables"
      ? orderedSelectedSections[phase.sectionIndex]
      : null;

  const currentSectionHasSelection =
    currentTableSection?.tables.some((table) => selectedTableIds.has(table.id)) ??
    false;

  const handleTablesBack = useCallback(() => {
    if (phase.kind !== "tables") return;
    setSaveError(null);
    if (phase.sectionIndex === 0) {
      setPhase({ kind: "sections" });
      return;
    }
    setPhase({ kind: "tables", sectionIndex: phase.sectionIndex - 1 });
  }, [phase]);

  const handleTablesNext = useCallback(async () => {
    if (phase.kind !== "tables" || !currentTableSection) return;
    if (!currentSectionHasSelection) return;

    const isLastSection =
      phase.sectionIndex >= orderedSelectedSections.length - 1;
    if (!isLastSection) {
      setSaveError(null);
      setPhase({ kind: "tables", sectionIndex: phase.sectionIndex + 1 });
      return;
    }

    const ok = await saveChoices();
    if (ok) setPhase({ kind: "qrs" });
  }, [
    currentSectionHasSelection,
    currentTableSection,
    orderedSelectedSections.length,
    phase,
    saveChoices,
  ]);

  const handleSelectAllInSection = useCallback(() => {
    if (!currentTableSection) return;
    setSelectedTableIds((prev) => {
      const next = new Set(prev);
      for (const table of currentTableSection.tables) {
        next.add(table.id);
      }
      return next;
    });
  }, [currentTableSection]);

  const handleClearAllInSection = useCallback(() => {
    if (!currentTableSection) return;
    setSelectedTableIds((prev) => {
      const next = new Set(prev);
      for (const table of currentTableSection.tables) {
        next.delete(table.id);
      }
      return next;
    });
  }, [currentTableSection]);

  const showWizardFooter =
    loadState.status === "ready" && phase.kind !== "qrs";

  const showCodesFooter = loadState.status === "ready" && phase.kind === "qrs";

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-baseline sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={onClose}
        disabled={saving}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-foreground/10 p-5 pb-4">
          <h2
            id="qr-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            {t("restaurants.qrModalTitle", { name: location.name })}
          </h2>
          <p className="mt-2 text-sm text-foreground/70">
            {t("restaurants.qrModalBody")}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 pt-4">
          {loadState.status === "loading" ? (
            <p className="py-8 text-center text-sm text-foreground/60">
              {t("restaurants.qrTablesLoading")}
            </p>
          ) : null}

          {loadState.status === "error" ? (
            <div className="space-y-4 py-4 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">
                {loadState.message}
              </p>
              <button
                type="button"
                onClick={() => void loadTables()}
                className="min-h-10 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("restaurants.qrTablesRetry")}
              </button>
            </div>
          ) : null}

          {loadState.status === "empty" ? (
            <p className="py-8 text-center text-sm text-foreground/60">
              {t("restaurants.qrTablesEmpty")}
            </p>
          ) : null}

          {loadState.status === "ready" && phase.kind === "sections" ? (
            <QrWizardStepSections
              sections={sections}
              selectedSectionNames={selectedSectionNames}
              onToggleSection={toggleSection}
            />
          ) : null}

          {loadState.status === "ready" &&
          phase.kind === "tables" &&
          currentTableSection ? (
            <QrWizardStepTables
              sectionName={currentTableSection.sectionName}
              sectionIndex={phase.sectionIndex}
              sectionCount={orderedSelectedSections.length}
              tables={currentTableSection.tables}
              selectedTableIds={selectedTableIds}
              onToggleTable={toggleTable}
              onSelectAll={handleSelectAllInSection}
              onClearAll={handleClearAllInSection}
            />
          ) : null}

          {loadState.status === "ready" && phase.kind === "qrs" ? (
            <QrWizardStepCodes
              locationId={location.id}
              logoUrl={location.logoUrl}
              sections={sections}
            />
          ) : null}
        </div>

        {showWizardFooter ? (
          <div className="shrink-0 border-t border-foreground/10 p-5 pt-4">
            {saveError ? (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                {saveError}
              </p>
            ) : null}
            {phase.kind === "sections" && selectedSectionNames.size === 0 ? (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
                {t("restaurants.qrWizardPickSection")}
              </p>
            ) : null}
            {phase.kind === "tables" && !currentSectionHasSelection ? (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
                {t("restaurants.qrWizardPickTable")}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="text-sm text-foreground/70 hover:text-foreground disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <div className="flex gap-2">
                {phase.kind === "tables" ? (
                  <button
                    type="button"
                    onClick={handleTablesBack}
                    disabled={saving}
                    className="min-h-11 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5 disabled:opacity-50"
                  >
                    {t("common.back")}
                  </button>
                ) : null}
                {phase.kind === "sections" ? (
                  <button
                    type="button"
                    onClick={handleSectionsNext}
                    disabled={selectedSectionNames.size === 0}
                    className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {t("restaurants.qrWizardNext")}
                  </button>
                ) : null}
                {phase.kind === "tables" ? (
                  <button
                    type="button"
                    onClick={() => void handleTablesNext()}
                    disabled={saving || !currentSectionHasSelection}
                    className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {saving
                      ? t("restaurants.qrWizardSaving")
                      : phase.sectionIndex >= orderedSelectedSections.length - 1
                        ? t("restaurants.qrWizardFinish")
                        : t("restaurants.qrWizardNext")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {showCodesFooter ? (
          <div className="shrink-0 border-t border-foreground/10 p-5 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={goToSections}
                className="min-h-11 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {t("restaurants.qrWizardEditSelection")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
