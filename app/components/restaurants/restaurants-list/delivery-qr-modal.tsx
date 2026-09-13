"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/app/components/i18n-provider";
import { buildDeliveryMenuPublicUrl } from "@/lib/location-menu-url";
import {
  STYLED_QR_PREVIEW_RENDER_WIDTH,
  STYLED_QR_PREVIEW_WIDTH,
  STYLED_QR_PRINT_WIDTH,
  downloadStyledQrPng,
  resolveQrCenterImageUrl,
  styledQrToDataUrl,
} from "@/lib/styled-qr";
import { QrCenterImageUpload } from "./qr-center-image-upload";

export type DeliveryQrLocationRef = {
  id: string;
  name: string;
  logoUrl: string;
  qrCenterImageUrl?: string;
};

type DeliveryQrModalProps = {
  location: DeliveryQrLocationRef;
  onClose: () => void;
};

export function DeliveryQrModal({ location, onClose }: DeliveryQrModalProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [qrCenterImageUrl, setQrCenterImageUrl] = useState(
    () => location.qrCenterImageUrl?.trim() ?? "",
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const menuUrl = buildDeliveryMenuPublicUrl(location.id);
  const centerImageUrl = resolveQrCenterImageUrl(qrCenterImageUrl, location.logoUrl);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setIsGeneratingQr(true);

    void styledQrToDataUrl({
      url: menuUrl,
      width: STYLED_QR_PREVIEW_RENDER_WIDTH,
      logoUrl: centerImageUrl,
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setIsGeneratingQr(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          setIsGeneratingQr(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [centerImageUrl, menuUrl]);

  const handleDownloadPng = useCallback(() => {
    const safeName = location.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    void downloadStyledQrPng({
      url: menuUrl,
      width: STYLED_QR_PRINT_WIDTH,
      logoUrl: centerImageUrl,
      filename: `delivery-qr-${safeName || location.id}.png`,
    });
  }, [centerImageUrl, location.id, location.name, menuUrl]);

  const handleDownloadPdf = useCallback(async () => {
    setPdfGenerating(true);
    try {
      // Generate high-res QR for crisp PDF rendering
      const highResQrUrl = await styledQrToDataUrl({
        url: menuUrl,
        width: 800,
        logoUrl: centerImageUrl,
      });
      if (!highResQrUrl) return;

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm

      // Header Brand
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(26);
      pdf.setTextColor(24, 24, 27);
      pdf.text(location.name || "Delivery Menu", pageWidth / 2, 40, {
        align: "center",
      });

      // Subtitle
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(14);
      pdf.setTextColor(113, 113, 122);
      pdf.text("Scan the QR code to browse our menu and order online", pageWidth / 2, 52, {
        align: "center",
      });

      // QR Code (110mm x 110mm centered)
      const qrSize = 110;
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = 70;

      // Decorative rounded border card
      pdf.setDrawColor(228, 228, 231);
      pdf.setFillColor(253, 251, 243);
      pdf.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 6, 6, "FD");

      pdf.addImage(highResQrUrl, "PNG", qrX, qrY, qrSize, qrSize);

      // Call-to-action banner
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(24, 24, 27);
      pdf.text("SCAN & ORDER", pageWidth / 2, 215, { align: "center" });

      // Direct URL
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(161, 161, 170);
      pdf.text(menuUrl, pageWidth / 2, 225, { align: "center" });

      const safeName = location.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      pdf.save(`delivery-flyer-${safeName || location.id}.pdf`);
    } catch {
      /* ignore */
    } finally {
      setPdfGenerating(false);
    }
  }, [centerImageUrl, location.id, location.name, menuUrl]);

  async function handleCopyLink() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(menuUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-foreground/10 bg-background/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-foreground/10 p-5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id={titleId} className="text-lg font-semibold text-foreground">
                {t("restaurants.deliveryQrModalTitle", { name: location.name })}
              </h2>
              <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
                {t("restaurants.deliveryBadge")}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-foreground/70">
              {t("restaurants.deliveryQrModalBody")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground/60 transition hover:bg-foreground/5 hover:text-foreground"
            aria-label={t("common.close")}
          >
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6">
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-foreground/10 bg-foreground/2 p-6">
            <div className="relative">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={t("restaurants.qrCode")}
                  className="rounded-2xl border border-foreground/10 shadow-sm transition"
                  style={{
                    backgroundColor: "#FDFBF3",
                    width: STYLED_QR_PREVIEW_WIDTH,
                    height: STYLED_QR_PREVIEW_WIDTH,
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-2xl border border-dashed border-foreground/20 text-xs text-foreground/50"
                  style={{
                    width: STYLED_QR_PREVIEW_WIDTH,
                    height: STYLED_QR_PREVIEW_WIDTH,
                    backgroundColor: "#FDFBF3",
                  }}
                >
                  {isGeneratingQr
                    ? t("restaurants.newWizard.qrGenerating")
                    : t("restaurants.qrTablesRetry")}
                </div>
              )}
            </div>

            <div className="w-full space-y-2 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                {t("restaurants.qrUrlFieldLabel")}
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-left font-mono text-foreground/80">
                  {menuUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 rounded-md bg-foreground/10 px-2 py-1 font-medium text-foreground transition hover:bg-foreground/15"
                >
                  {linkCopied
                    ? t("restaurants.qrLinkCopied")
                    : t("restaurants.qrCopyLink")}
                </button>
              </div>
              {copyFailed ? (
                <p className="text-xs text-red-500">{t("restaurants.qrCopyFailed")}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={!qrDataUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background shadow transition hover:opacity-90 disabled:opacity-50"
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {t("restaurants.downloadPng")}
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={!qrDataUrl || pdfGenerating}
                className="inline-flex items-center gap-2 rounded-xl border border-foreground/20 bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-foreground/5 disabled:opacity-50"
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                {pdfGenerating
                  ? t("restaurants.newWizard.qrGenerating")
                  : t("restaurants.downloadPdf")}
              </button>

              <Link
                href={menuUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-foreground/15 px-3 py-2 text-xs font-medium text-foreground/70 transition hover:border-foreground/30 hover:text-foreground"
              >
                <svg
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                {t("restaurants.openStorefront")}
              </Link>
            </div>
          </div>

          <div className="pt-2">
            <QrCenterImageUpload
              locationId={location.id}
              qrCenterImageUrl={qrCenterImageUrl}
              logoUrl={location.logoUrl}
              onQrCenterImageUrlChange={setQrCenterImageUrl}
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-foreground/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
