"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { MenuSectionEntity } from "@/lib/data/global-menu-types";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { useI18n } from "../i18n-provider";
import {
  CatalogImageField,
  type CatalogImageFieldValue,
} from "./catalog-image-field";

type CategoryNameModalProps = {
  open: boolean;
  mode: "create" | "edit";
  categoryId?: string;
  initialName: string;
  initialDescription?: string | null;
  initialCoverPhoto?: string | null;
  initialMenuSectionId?: string;
  sections: MenuSectionEntity[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description?: string;
    coverPhoto?: string;
    menuSectionId: string;
  }) => Promise<void>;
};

export function CategoryNameModal({
  open,
  mode,
  categoryId: _categoryId,
  initialName,
  initialDescription,
  initialCoverPhoto,
  initialMenuSectionId = "",
  sections,
  isSaving,
  onClose,
  onSave,
}: CategoryNameModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const nameId = useId();
  const menuSectionFieldId = useId();
  const descriptionId = useId();
  const [name, setName] = useState("");
  const [menuSectionId, setMenuSectionId] = useState("");
  const [description, setDescription] = useState("");
  const [imageValue, setImageValue] = useState<CatalogImageFieldValue>({
    url: "",
    file: null,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    const fallback =
      initialMenuSectionId ||
      sections.find((s) => s.kind === "standard")?.id ||
      sections[0]?.id ||
      "";
    setMenuSectionId(fallback);
    setDescription(initialDescription ?? "");
    setImageValue({ url: initialCoverPhoto ?? "", file: null });
    setSubmitError(null);
  }, [initialCoverPhoto, initialDescription, initialMenuSectionId, initialName, mode, open, sections]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const title = mode === "create" ? t("newCategory.title") : t("categoryModal.editTitle");
  const help = mode === "create" ? t("newCategory.subtitle") : t("categoryModal.editHelp");
  const canSave = name.trim().length > 0 && menuSectionId.trim().length > 0;
  const controlsDisabled = isSaving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    if (controlsDisabled) return;
    setSubmitError(null);
    try {
      let coverPhoto = imageValue.url.trim() || undefined;
      if (imageValue.file) {
        coverPhoto = await uploadFileToR2(imageValue.file, "category-cover");
      }
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        coverPhoto,
        menuSectionId,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("newCategory.createFailed"));
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed top-0 left-0 z-[60] min-h-dvh w-full bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={() => {
          if (controlsDisabled) return;
          onClose();
        }}
      />
      <div className="fixed top-0 left-0 z-[70] flex h-[unset] min-h-[unset] w-full items-end justify-center p-0 pointer-events-none sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="pointer-events-auto max-h-[min(92vh,calc(100dvh-1rem))] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl sm:max-h-[min(92vh,calc(100dvh-2rem))]"
        >
          <div className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 px-4 py-4 backdrop-blur-md sm:px-5">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-xs text-foreground/55">{help}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 px-4 py-4 sm:px-5"
          >
            {submitError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {submitError}
              </div>
            ) : null}

            <div className="space-y-2">
              <label htmlFor={nameId} className="text-sm font-medium text-foreground">
                {t("categoryModal.displayName")}
              </label>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={controlsDisabled}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                placeholder={t("categoryModal.displayNamePlaceholder")}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={menuSectionFieldId} className="text-sm font-medium text-foreground">
                {t("categories.menuSection")}
              </label>
              <select
                id={menuSectionFieldId}
                value={menuSectionId}
                onChange={(e) => setMenuSectionId(e.target.value)}
                disabled={controlsDisabled || sections.length === 0}
                className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.kind === "unassigned"
                      ? t("sections.unassigned")
                      : section.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor={descriptionId} className="text-sm font-medium text-foreground">
                {t("global.description")}{" "}
                <span className="text-foreground/50">{t("newCategory.optionalSuffix")}</span>
              </label>
              <textarea
                id={descriptionId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={controlsDisabled}
                rows={3}
                className="w-full resize-y rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                placeholder={t("newCategory.descriptionPlaceholder")}
              />
            </div>

            <CatalogImageField
              label={`${t("newCategory.coverPhoto")} ${t("newCategory.optionalSuffix")}`}
              value={imageValue}
              onChange={setImageValue}
              uploadTarget="category-cover"
              disabled={controlsDisabled}
            />

            <div className="flex gap-2 border-t border-foreground/10 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={controlsDisabled}
                className="min-h-11 flex-1 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={!canSave || controlsDisabled}
                className="min-h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {controlsDisabled
                  ? t("newCategory.saving")
                  : mode === "create"
                    ? t("categories.addCategory")
                    : t("common.save")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
