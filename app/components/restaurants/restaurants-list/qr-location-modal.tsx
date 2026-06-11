"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import type { LocationDiningTablesSection } from "@/lib/auth-api/types/locations";
import { readErrorMessage } from "./read-error-message";
import { QrTableRow } from "./qr-table-row";

export type QrLocationRef = { id: string; name: string };

type QrLocationModalProps = {
  location: QrLocationRef;
  onClose: () => void;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "empty" }
  | { status: "ready"; sections: LocationDiningTablesSection[] };

export function QrLocationModal({ location, onClose }: QrLocationModalProps) {
  const { t } = useI18n();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [activeSectionName, setActiveSectionName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const loadTables = useCallback(async () => {
    setLoadState({ status: "loading" });
    setActiveSectionName(null);
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
      setLoadState({ status: "ready", sections });
      setActiveSectionName(sections[0]!.sectionName);
    } catch (error) {
      setLoadState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : t("restaurants.qrTablesLoadError"),
      });
    }
  }, [location.id, t]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const activeSection =
    loadState.status === "ready"
      ? loadState.sections.find((s) => s.sectionName === activeSectionName)
      : null;

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-baseline sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={onClose}
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

          {loadState.status === "ready" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1">
                {loadState.sections.map((section) => (
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
                      locationId={location.id}
                      table={table}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-foreground/10 p-5 pt-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
