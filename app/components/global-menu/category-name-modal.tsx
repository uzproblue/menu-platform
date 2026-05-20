"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import type { MenuSection } from "@/lib/data/global-menu-types";
import { useI18n } from "../i18n-provider";
import { ItemThumbnail } from "./global-menu-item-row";

type CategoryNameModalProps = {
  open: boolean;
  mode: "create" | "edit";
  categoryId?: string;
  initialName: string;
  initialDescription?: string | null;
  initialCoverPhoto?: string | null;
  initialMenuSection?: MenuSection;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description?: string;
    coverPhoto?: string;
    menuSection: MenuSection;
  }) => Promise<void>;
};

export function CategoryNameModal({
  open,
  mode,
  categoryId: _categoryId,
  initialName,
  initialDescription,
  initialCoverPhoto,
  initialMenuSection = "dishes",
  isSaving,
  onClose,
  onSave,
}: CategoryNameModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const nameId = useId();
  const menuSectionId = useId();
  const descriptionId = useId();
  const coverPhotoUrlId = useId();
  const coverPhotoUploadId = useId();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [menuSection, setMenuSection] = useState<MenuSection>("dishes");
  const [description, setDescription] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [localCoverPreviewUrl, setLocalCoverPreviewUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setMenuSection(initialMenuSection);
    setDescription(initialDescription ?? "");
    setCoverPhotoUrl(initialCoverPhoto ?? "");
    setSelectedCoverFile(null);
    setLocalCoverPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setSubmitError(null);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  }, [initialCoverPhoto, initialDescription, initialMenuSection, initialName, mode, open]);

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

  useEffect(() => {
    return () => {
      if (localCoverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localCoverPreviewUrl);
      }
    };
  }, [localCoverPreviewUrl]);

  if (!open) return null;

  const title = mode === "create" ? t("newCategory.title") : t("categoryModal.editTitle");
  const help = mode === "create" ? t("newCategory.subtitle") : t("categoryModal.editHelp");
  const canSave = name.trim().length > 0;
  const previewPhoto = localCoverPreviewUrl || coverPhotoUrl.trim();
  const controlsDisabled = isSaving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    if (controlsDisabled) return;
    setSubmitError(null);
    try {
      let coverPhoto = coverPhotoUrl.trim() || undefined;
      if (selectedCoverFile) {
        coverPhoto = await uploadFileToR2(selectedCoverFile, "category-cover");
      }
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        coverPhoto,
        menuSection,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("newCategory.createFailed"));
    }
  }

  function clearCoverPhoto() {
    setCoverPhotoUrl("");
    setSelectedCoverFile(null);
    setLocalCoverPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    if (uploadInputRef.current) uploadInputRef.current.value = "";
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
          className="pointer-events-auto max-h-[min(92vh,calc(100dvh-1rem))] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl sm:max-h-[min(92vh,calc(100dvh-2rem))]"
        >
          <div className="sticky top-0 z-10 border-b border-foreground/10 bg-background/95 px-4 py-4 backdrop-blur-md sm:px-5">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-xs text-foreground/55">{help}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col px-4 py-4 sm:px-5"
          >
            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
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
          <div className="mt-4 space-y-2">
            <label htmlFor={menuSectionId} className="text-sm font-medium text-foreground">
              {t("categories.menuSection")}
            </label>
            <select
              id={menuSectionId}
              value={menuSection}
              onChange={(e) => setMenuSection(e.target.value as MenuSection)}
              disabled={controlsDisabled}
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
            >
              <option value="dishes">{t("categories.menuSectionDishes")}</option>
              <option value="beverages">{t("categories.menuSectionBeverages")}</option>
            </select>
          </div>
          <div className="mt-4 space-y-2">
            <label htmlFor={descriptionId} className="text-sm font-medium text-foreground">
              {t("global.description")} <span className="text-foreground/50">{t("newCategory.optionalSuffix")}</span>
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

          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("newCategory.coverPhoto")} <span className="text-foreground/50">{t("newCategory.optionalSuffix")}</span>
            </label>
            <div className="rounded-2xl border border-foreground/12 bg-foreground/[0.03] p-3 ring-1 ring-foreground/5 sm:p-4">
              <div className="grid gap-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-start">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
                    {t("global.imagePreviewAlt")}
                  </p>
                  <div className="relative size-26 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 ring-1 ring-foreground/5">
                    {previewPhoto ? (
                      <ItemThumbnail
                        src={previewPhoto}
                        alt={t("newCategory.coverPhoto")}
                        sizes="104px"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-center text-xs text-foreground/45">
                        {t("global.noImage")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    id={coverPhotoUrlId}
                    type="url"
                    value={coverPhotoUrl}
                    onChange={(e) => setCoverPhotoUrl(e.target.value)}
                    disabled={controlsDisabled}
                    className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                    placeholder={t("newCategory.coverPhotoUrlPlaceholder")}
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-foreground/15" />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/45">
                      {t("newCategory.or")}
                    </span>
                    <div className="h-px flex-1 bg-foreground/15" />
                  </div>
                  <input
                    ref={uploadInputRef}
                    id={coverPhotoUploadId}
                    type="file"
                    accept="image/*"
                    disabled={controlsDisabled}
                    onChange={(e) => {
                      const nextFile = e.target.files?.[0];
                      if (!nextFile) return;
                      setSelectedCoverFile(nextFile);
                      setLocalCoverPreviewUrl((prev) => {
                        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                        return URL.createObjectURL(nextFile);
                      });
                      e.currentTarget.value = "";
                    }}
                    className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15 disabled:opacity-60"
                  />
                  <div className="flex items-center justify-between gap-2">
                    {selectedCoverFile ? (
                      <p className="text-xs text-foreground/60">{selectedCoverFile.name}</p>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={clearCoverPhoto}
                      disabled={controlsDisabled || (!coverPhotoUrl.trim() && !selectedCoverFile)}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-foreground/20 px-3 text-xs font-medium text-foreground hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("newCategory.clearPhoto")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-2 border-t border-foreground/10 pt-4">
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
