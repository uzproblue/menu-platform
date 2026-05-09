"use client";

import type { TranslationTextApi } from "@/lib/auth-api";
import { useI18n } from "../i18n-provider";
import { GuestTranslationsBatchModal } from "./guest-translations-batch-modal";

const CATEGORY_NAME_MAX = 120;
const CATEGORY_DESC_MAX = 1000;

export type CategoryTranslationsModalProps = {
  open: boolean;
  categoryId: string | null;
  /** Shown in the dialog title (locale-aware label from parent). */
  categoryTitle: string;
  translations: TranslationTextApi[];
  onClose: () => void;
  onSaved: (payload: Record<string, unknown> | null) => void;
};

export function CategoryTranslationsModal({
  open,
  categoryId,
  categoryTitle,
  translations,
  onClose,
  onSaved,
}: CategoryTranslationsModalProps) {
  const { t } = useI18n();
  const saveUrl =
    categoryId != null
      ? `/api/settings/categories/${encodeURIComponent(categoryId)}/translations`
      : "";

  return (
    <GuestTranslationsBatchModal
      key={categoryId ?? "closed"}
      open={open}
      entityId={categoryId}
      title={t("categories.translationsModal.title", { name: categoryTitle })}
      saveUrl={saveUrl}
      nameMaxLength={CATEGORY_NAME_MAX}
      descriptionMaxLength={CATEGORY_DESC_MAX}
      initialTranslations={translations}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
