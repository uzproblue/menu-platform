"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import { buildLocationMenuPublicUrl } from "@/lib/location-menu-url";
import { PlatformEvent, trackClientEvent } from "@/lib/analytics";

export type QrLocationRef = { id: string; name: string };

type QrLocationModalProps = {
  location: QrLocationRef;
  onClose: () => void;
};

export function QrLocationModal({ location, onClose }: QrLocationModalProps) {
  const { t } = useI18n();
  const qrMenuUrl = buildLocationMenuPublicUrl(location.id);
  const [qrForLocation, setQrForLocation] = useState<{
    locationId: string;
    dataUrl: string | null;
  }>({ locationId: "", dataUrl: null });
  const qrDataUrl =
    qrForLocation.locationId === location.id ? qrForLocation.dataUrl : null;
  const [qrLinkCopied, setQrLinkCopied] = useState(false);
  const [qrCopyFailed, setQrCopyFailed] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const locationId = location.id;
    const menuUrl = qrMenuUrl;
    let cancelled = false;
    void import("qrcode")
      .then((QR) =>
        QR.toDataURL(menuUrl, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setQrForLocation({ locationId, dataUrl });
      })
      .catch(() => {
        if (!cancelled) setQrForLocation({ locationId, dataUrl: null });
      });
    return () => {
      cancelled = true;
    };
  }, [location.id, qrMenuUrl]);

  const downloadQrPng = useCallback(() => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-code-${location.id}.png`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    trackClientEvent(PlatformEvent.LOCATION_QR_DOWNLOADED, {
      locationId: location.id,
    });
  }, [qrDataUrl, location.id]);

  async function handleCopyQrMenuLink() {
    if (!qrMenuUrl) return;
    setQrCopyFailed(false);
    try {
      await navigator.clipboard.writeText(qrMenuUrl);
      trackClientEvent(PlatformEvent.LOCATION_QR_LINK_COPIED, {
        locationId: location.id,
      });
      setQrLinkCopied(true);
      window.setTimeout(() => setQrLinkCopied(false), 2000);
    } catch {
      setQrLinkCopied(false);
      setQrCopyFailed(true);
    }
  }

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
        className="relative z-10 w-full max-w-md rounded-t-2xl border border-foreground/10 bg-background/95 p-5 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <h2
          id="qr-modal-title"
          className="text-lg font-semibold text-foreground"
        >
          {t("restaurants.qrModalTitle", { name: location.name })}
        </h2>
        <p className="mt-2 text-sm text-foreground/70">
          {t("restaurants.qrModalBody")}
        </p>
        <div className="mt-5 flex flex-col items-center gap-4">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={t("restaurants.newWizard.qrAlt")}
              className="rounded-xl border border-foreground/10 bg-white p-2"
              width={280}
              height={280}
              unoptimized
              priority
            />
          ) : (
            <div className="flex h-[280px] w-[280px] items-center justify-center rounded-xl border border-dashed border-foreground/20 text-sm text-foreground/50">
              {t("restaurants.newWizard.qrGenerating")}
            </div>
          )}
          <div className="w-full space-y-2">
            <label
              htmlFor="qr-menu-url"
              className="block text-xs font-medium uppercase tracking-wide text-foreground/50"
            >
              {t("restaurants.qrUrlFieldLabel")}
            </label>
            <div className="flex gap-2">
              <input
                id="qr-menu-url"
                readOnly
                value={qrMenuUrl}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-foreground/15 bg-background/80 px-3 font-mono text-xs text-foreground"
              />
              <button
                type="button"
                onClick={() => void handleCopyQrMenuLink()}
                className="shrink-0 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
              >
                {qrLinkCopied
                  ? t("restaurants.qrLinkCopied")
                  : t("restaurants.qrCopyLink")}
              </button>
            </div>
            {qrCopyFailed ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("restaurants.qrCopyFailed")}
              </p>
            ) : null}
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={!qrDataUrl}
              onClick={() => downloadQrPng()}
              className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("restaurants.newWizard.downloadQr")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-foreground/20 px-4 text-sm font-medium text-foreground hover:bg-foreground/5"
            >
              {t("common.close")}
            </button>
          </div>
          {qrMenuUrl ? (
            <p className="max-w-lg text-center text-xs text-foreground/50">
              {t("restaurants.newWizard.qrUrlHint", { url: qrMenuUrl })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
