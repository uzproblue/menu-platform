"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import { buildTableMenuPublicUrl } from "@/lib/location-menu-url";
import type { LocationDiningTable } from "@/lib/auth-api/types/locations";
import {
  TABLE_QR_TENT_PREVIEW_WIDTH,
  TABLE_QR_TENT_PRINT_WIDTH,
  composeTableQrTentCard,
  downloadTableQrTentCardPng,
} from "@/lib/table-qr-tent-card";

type QrTableRowProps = {
  locationId: string;
  locationName: string;
  /** Brand logo for the top of the tent card. */
  logoUrl?: string;
  sectionName: string;
  table: LocationDiningTable;
};

export function QrTableRow({
  locationId,
  locationName,
  logoUrl,
  sectionName,
  table,
}: QrTableRowProps) {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const menuUrl = buildTableMenuPublicUrl(locationId, table.id);
  const tableLabel = t("restaurants.qrTableNumber", { number: table.number });
  const instructionText = t("restaurants.qrPointCamera");

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    void composeTableQrTentCard({
      menuUrl,
      locationName,
      logoUrl,
      sectionName,
      tableLabel,
      instructionText,
      width: TABLE_QR_TENT_PREVIEW_WIDTH,
    })
      .then((dataUrl) => {
        if (!cancelled) setCardDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setCardDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isVisible,
    menuUrl,
    locationName,
    logoUrl,
    sectionName,
    tableLabel,
    instructionText,
  ]);

  const downloadQrPng = useCallback(() => {
    void downloadTableQrTentCardPng({
      menuUrl,
      locationName,
      logoUrl,
      sectionName,
      tableLabel,
      instructionText,
      width: TABLE_QR_TENT_PRINT_WIDTH,
      filename: `qr-table-${table.number}-${table.id.slice(0, 8)}.png`,
    });
  }, [
    menuUrl,
    locationName,
    logoUrl,
    sectionName,
    tableLabel,
    instructionText,
    table.id,
    table.number,
  ]);

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

  const previewHeight = Math.round(TABLE_QR_TENT_PREVIEW_WIDTH * 1.55);

  return (
    <div
      ref={rowRef}
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/2 p-4 sm:flex-row sm:items-start"
    >
      <div className="flex shrink-0 flex-col items-center gap-2">
        {cardDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from canvas export
          <img
            src={cardDataUrl}
            alt={tableLabel}
            className="rounded-lg border border-foreground/10 bg-white shadow-sm"
            style={{
              width: TABLE_QR_TENT_PREVIEW_WIDTH,
              height: previewHeight,
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-lg border border-dashed border-foreground/20 bg-white text-xs text-foreground/50"
            style={{
              width: TABLE_QR_TENT_PREVIEW_WIDTH,
              height: previewHeight,
            }}
          >
            {t("restaurants.newWizard.qrGenerating")}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{tableLabel}</p>
          {sectionName ? (
            <p className="mt-0.5 text-xs text-foreground/60">{sectionName}</p>
          ) : null}
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-foreground/50">
            {t("restaurants.qrTableIdLabel")}
          </p>
          <p className="mt-0.5 break-all font-mono text-xs text-foreground/70">
            {table.id}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="min-h-9 rounded-lg border border-foreground/20 px-3 text-xs font-medium text-foreground hover:bg-foreground/5"
          >
            {linkCopied ? t("restaurants.qrLinkCopied") : t("restaurants.qrCopyLink")}
          </button>
          <button
            type="button"
            onClick={() => downloadQrPng()}
            className="min-h-9 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            {t("restaurants.newWizard.downloadQr")}
          </button>
        </div>

        {copyFailed ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {t("restaurants.qrCopyFailed")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
