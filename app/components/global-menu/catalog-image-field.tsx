"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ClipboardEvent,
} from "react";
import { getImageFileFromClipboardEvent } from "@/lib/clipboard-paste-image";
import {
  getMaxUploadSizeBytes,
  type UploadTarget,
} from "@/lib/r2-upload-shared";
import { useI18n } from "../i18n-provider";
import { ItemThumbnail } from "./global-menu-item-row";

export type CatalogImageFieldValue = {
  url: string;
  file: File | null;
};

type CatalogImageFieldProps = {
  label: string;
  value: CatalogImageFieldValue;
  onChange: (next: CatalogImageFieldValue) => void;
  uploadTarget: UploadTarget;
  disabled?: boolean;
  /** Extra hint under the field (defaults to leave-empty + paste hints). */
  leaveEmptyHint?: string;
  showPasteHint?: boolean;
};

/**
 * Shared image URL / file upload control used by menu item, category, and section editors.
 * Matches the add/edit menu item image section layout and paste-to-upload UX.
 */
export function CatalogImageField({
  label,
  value,
  onChange,
  uploadTarget,
  disabled = false,
  leaveEmptyHint,
  showPasteHint = true,
}: CatalogImageFieldProps) {
  const { t } = useI18n();
  const fieldId = useId();
  const maxBytes = getMaxUploadSizeBytes(uploadTarget);
  const [blobPreviewUrl, setBlobPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(blobPreviewUrl);
      }
    };
  }, [blobPreviewUrl]);

  // When parent clears the file (e.g. modal reset), drop the blob preview.
  useEffect(() => {
    if (value.file) return;
    setBlobPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
  }, [value.file]);

  const applyImageFile = useCallback(
    (file: File) => {
      if (file.size > maxBytes) {
        setFileError(
          t("newItem.imageTooLarge", {
            maxMb: String(Math.round(maxBytes / (1024 * 1024))),
          }),
        );
        return;
      }
      setFileError(null);
      setBlobPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      onChange({ url: "", file });
    },
    [maxBytes, onChange, t],
  );

  const onImageSectionPaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement | HTMLInputElement>) => {
      if (disabled) return;
      const file = getImageFileFromClipboardEvent(e.nativeEvent);
      if (!file) return;
      e.preventDefault();
      applyImageFile(file);
    },
    [applyImageFile, disabled],
  );

  const previewSrc = blobPreviewUrl ?? value.url.trim();

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div
        className="rounded-2xl border border-foreground/12 bg-foreground/3 p-3 ring-1 ring-foreground/5 sm:p-4 outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
        tabIndex={disabled ? -1 : 0}
        onPaste={onImageSectionPaste}
      >
        <div className="grid gap-4 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-start">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
              {t("global.imagePreviewAlt")}
            </p>
            <div className="relative size-26 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 ring-1 ring-foreground/5">
              {previewSrc ? (
                <ItemThumbnail
                  src={previewSrc}
                  alt={t("global.imagePreviewAlt")}
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
              id={fieldId}
              value={value.url}
              onChange={(e) => {
                setFileError(null);
                const nextUrl = e.target.value;
                if (value.file) {
                  setBlobPreviewUrl((prev) => {
                    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
                    return null;
                  });
                }
                onChange({ url: nextUrl, file: null });
              }}
              onPaste={onImageSectionPaste}
              disabled={disabled}
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background placeholder:text-foreground/40 focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
              placeholder={t("global.imagePlaceholder")}
            />
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-foreground/15" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/45">
                {t("newCategory.or")}
              </span>
              <div className="h-px flex-1 bg-foreground/15" />
            </div>
            <input
              type="file"
              accept="image/*"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                applyImageFile(file);
                e.currentTarget.value = "";
              }}
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-foreground/15 disabled:opacity-60"
            />
            {value.file ? (
              <p className="text-xs text-foreground/60">
                {t("global.imageSelected", { name: value.file.name })}
              </p>
            ) : null}
            {fileError ? (
              <p className="text-xs text-red-600 dark:text-red-300">{fileError}</p>
            ) : null}
          </div>
        </div>
      </div>
      <p className="text-xs text-foreground/50">
        {leaveEmptyHint ?? t("global.leaveEmptyNoPhoto")}
      </p>
      {showPasteHint ? (
        <p className="text-xs text-foreground/50">{t("global.imagePasteHint")}</p>
      ) : null}
    </div>
  );
}
