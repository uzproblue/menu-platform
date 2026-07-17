"use client";

import type { TranslationTextApi } from "@/lib/auth-api";
import { useI18n } from "../i18n-provider";
import { GuestTranslationsBatchModal } from "./guest-translations-batch-modal";

const SECTION_NAME_MAX = 120;

export type SectionTranslationsModalProps = {
  open: boolean;
  sectionId: string | null;
  /** Shown in the dialog title (locale-aware label from parent). */
  sectionTitle: string;
  translations: TranslationTextApi[];
  onClose: () => void;
  onSaved: (payload: Record<string, unknown> | null) => void;
};

export function SectionTranslationsModal({
  open,
  sectionId,
  sectionTitle,
  translations,
  onClose,
  onSaved,
}: SectionTranslationsModalProps) {
  const { t } = useI18n();
  const saveUrl =
    sectionId != null
      ? `/api/settings/menu-sections/${encodeURIComponent(sectionId)}/translations`
      : "";

  return (
    <GuestTranslationsBatchModal
      key={sectionId ?? "closed"}
      open={open}
      entityId={sectionId}
      title={t("sections.translationsModal.title", { name: sectionTitle })}
      saveUrl={saveUrl}
      nameMaxLength={SECTION_NAME_MAX}
      nameOnly
      initialTranslations={translations}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
