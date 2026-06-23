"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ItemThumbnail } from "@/app/components/global-menu/global-menu-item-row";
import { useI18n } from "@/app/components/i18n-provider";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { getMaxUploadSizeBytes } from "@/lib/r2-upload-shared";
import { readErrorMessage } from "./read-error-message";

type QrCenterImageUploadProps = {
  locationId: string;
  qrCenterImageUrl: string;
  logoUrl: string;
  onQrCenterImageUrlChange: (qrCenterImageUrl: string) => void;
};

export function QrCenterImageUpload({
  locationId,
  qrCenterImageUrl,
  logoUrl,
  onQrCenterImageUrlChange,
}: QrCenterImageUploadProps) {
  const { t } = useI18n();
  const fileInputId = useId();
  const [blobPreviewUrl, setBlobPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxSizeBytes = getMaxUploadSizeBytes("qr-center-image");
  const savedPreviewSrc = qrCenterImageUrl.trim() || null;
  const previewSrc = blobPreviewUrl ?? savedPreviewSrc;
  const hasCustomImage = Boolean(savedPreviewSrc);
  const usingLogoFallback = !hasCustomImage && Boolean(logoUrl.trim());

  useEffect(() => {
    return () => {
      if (blobPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(blobPreviewUrl);
      }
    };
  }, [blobPreviewUrl]);

  const patchQrCenterImageUrl = useCallback(
    async (nextValue: string) => {
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/settings/locations/${encodeURIComponent(locationId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrCenterImageUrl: nextValue }),
          },
        );
        if (!response.ok) {
          throw new Error(
            await readErrorMessage(response, t("restaurants.qrCenterImageSaveError")),
          );
        }
        onQrCenterImageUrlChange(nextValue);
        setBlobPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return null;
        });
      } catch (patchError) {
        setError(
          patchError instanceof Error
            ? patchError.message
            : t("restaurants.qrCenterImageSaveError"),
        );
      } finally {
        setSaving(false);
      }
    },
    [locationId, onQrCenterImageUrlChange, t],
  );

  async function handleFileChange(file: File | null) {
    setError(null);
    if (!file) return;

    if (file.size > maxSizeBytes) {
      setError(
        t("newItem.imageTooLarge", {
          maxMb: String(Math.round(maxSizeBytes / (1024 * 1024))),
        }),
      );
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setBlobPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return blobUrl;
    });

    setSaving(true);
    try {
      const objectKey = await uploadFileToR2(file, "qr-center-image");
      await patchQrCenterImageUrl(objectKey);
    } catch (uploadError) {
      setBlobPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t("restaurants.qrCenterImageSaveError"),
      );
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!hasCustomImage || saving) return;
    await patchQrCenterImageUrl("");
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/2 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">
          {t("restaurants.qrCenterImageTitle")}
        </p>
        <p className="mt-1 text-xs text-foreground/60">
          {t("restaurants.qrCenterImageHint")}
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">
            {t("global.imagePreviewAlt")}
          </p>
          <div className="relative size-28 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/5 ring-1 ring-foreground/5">
            {previewSrc ? (
              <ItemThumbnail
                src={previewSrc}
                alt={t("restaurants.qrCenterImagePreviewAlt")}
                sizes="112px"
              />
            ) : usingLogoFallback ? (
              <ItemThumbnail
                src={logoUrl}
                alt={t("restaurants.newWizard.logoPreviewAlt")}
                sizes="112px"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-center text-xs text-foreground/45">
                {t("global.noImage")}
              </div>
            )}
          </div>
          {usingLogoFallback && !previewSrc ? (
            <p className="text-[11px] text-foreground/50">
              {t("restaurants.qrCenterImageUsingLogo")}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <input
            id={fileInputId}
            type="file"
            accept="image/*"
            disabled={saving}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void handleFileChange(file);
              event.currentTarget.value = "";
            }}
          />
          <label
            htmlFor={fileInputId}
            className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5 ${
              saving ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {saving
              ? t("restaurants.qrCenterImageSaving")
              : hasCustomImage
                ? t("restaurants.qrCenterImageReplace")
                : t("restaurants.qrCenterImageUpload")}
          </label>

          {hasCustomImage ? (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={saving}
              className="block text-sm text-foreground/70 hover:text-foreground disabled:opacity-50"
            >
              {t("restaurants.qrCenterImageRemove")}
            </button>
          ) : null}

          {error ? (
            <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
