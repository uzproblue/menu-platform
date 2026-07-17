"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import type { TranslationTextApi } from "@/lib/auth-api";
import { LOCATION_TRANSLATION_OPTIONS } from "@/lib/menu-translation-langs";
import { useI18n } from "../i18n-provider";

type Lang = (typeof LOCATION_TRANSLATION_OPTIONS)[number];

type DraftRow = { name: string; description: string };

export type GuestTranslationsBatchModalProps = {
  open: boolean;
  entityId: string | null;
  title: string;
  /** Full URL path, e.g. `/api/settings/categories/…/translations` */
  saveUrl: string;
  nameMaxLength: number;
  descriptionMaxLength?: number;
  /** When true, hide description fields and always send `description: null`. */
  nameOnly?: boolean;
  initialTranslations: TranslationTextApi[];
  onClose: () => void;
  onSaved: (payload: Record<string, unknown> | null) => void;
};

function emptyDraft(): Record<Lang, DraftRow> {
  return Object.fromEntries(
    LOCATION_TRANSLATION_OPTIONS.map((lang) => [lang, { name: "", description: "" }]),
  ) as Record<Lang, DraftRow>;
}

function draftFromTranslations(translations: TranslationTextApi[]): Record<Lang, DraftRow> {
  const map = new Map(
    translations.map((t) => [t.lang.trim().toUpperCase(), t] as const),
  );
  const draft = emptyDraft();
  for (const lang of LOCATION_TRANSLATION_OPTIONS) {
    const tr = map.get(lang);
    draft[lang] = {
      name: tr?.name ?? "",
      description: tr?.description != null && tr.description !== "" ? String(tr.description) : "",
    };
  }
  return draft;
}

export function GuestTranslationsBatchModal({
  open,
  entityId,
  title,
  saveUrl,
  nameMaxLength,
  descriptionMaxLength = 1000,
  nameOnly = false,
  initialTranslations,
  onClose,
  onSaved,
}: GuestTranslationsBatchModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [draft, setDraft] = useState<Record<Lang, DraftRow>>(() =>
    draftFromTranslations(initialTranslations),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, isSaving]);

  const setRow = useCallback((lang: Lang, field: keyof DraftRow, value: string) => {
    setDraft((d) => ({
      ...d,
      [lang]: { ...d[lang], [field]: value },
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!entityId || isSaving) return;
      setSubmitError(null);
      setIsSaving(true);
      try {
        const body = {
          translations: LOCATION_TRANSLATION_OPTIONS.map((lang) => {
            const row = draft[lang];
            return {
              lang,
              name: row.name,
              description: nameOnly
                ? null
                : row.description.trim() === ""
                  ? null
                  : row.description.trim(),
            };
          }),
        };
        const res = await fetch(saveUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok) {
          const message =
            typeof payload?.message === "string"
              ? payload.message
              : t("categories.translationsModal.errSave");
          throw new Error(message);
        }
        onSaved(payload);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : t("categories.translationsModal.errSave"));
      } finally {
        setIsSaving(false);
      }
    },
    [draft, entityId, isSaving, nameOnly, onSaved, saveUrl, t],
  );

  if (!open || !entityId) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={() => {
          if (!isSaving) onClose();
        }}
        disabled={isSaving}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <div className="shrink-0 border-b border-foreground/10 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold leading-snug text-foreground">
            {title}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {submitError}
              </div>
            ) : null}

            <div className="space-y-6">
              {LOCATION_TRANSLATION_OPTIONS.map((lang) => {
                const row = draft[lang];
                const nameId = `${titleId}-name-${lang}`;
                const descId = `${titleId}-desc-${lang}`;
                return (
                  <fieldset key={lang} className="space-y-2 rounded-xl border border-foreground/10 bg-foreground/2 p-3">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                      {lang}
                    </legend>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor={nameId} className="block text-xs font-medium text-foreground/65">
                          {t("categories.translationsModal.nameLabel")}
                        </label>
                        <input
                          id={nameId}
                          type="text"
                          value={row.name}
                          onChange={(e) => setRow(lang, "name", e.target.value)}
                          disabled={isSaving}
                          maxLength={nameMaxLength}
                          className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
                        />
                      </div>
                      {!nameOnly ? (
                        <div>
                          <label htmlFor={descId} className="block text-xs font-medium text-foreground/65">
                            {t("categories.translationsModal.descriptionLabel")}
                          </label>
                          <textarea
                            id={descId}
                            value={row.description}
                            onChange={(e) => setRow(lang, "description", e.target.value)}
                            disabled={isSaving}
                            rows={3}
                            maxLength={descriptionMaxLength}
                            className="mt-1 w-full resize-y rounded-lg border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
                          />
                        </div>
                      ) : null}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-foreground/10 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="min-h-11 flex-1 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? t("categories.translationsModal.saving") : t("categories.translationsModal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
