"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import { buildTableMenuPublicUrl } from "@/lib/location-menu-url";
import type { LocationDiningTable } from "@/lib/auth-api/types/locations";

type QrTableRowProps = {
  locationId: string;
  table: LocationDiningTable;
};

export function QrTableRow({ locationId, table }: QrTableRowProps) {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const menuUrl = buildTableMenuPublicUrl(locationId, table.id);

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
    void import("qrcode")
      .then((QR) =>
        QR.toDataURL(menuUrl, {
          width: 120,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isVisible, menuUrl]);

  const downloadQrPng = useCallback(() => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-table-${table.number}-${table.id.slice(0, 8)}.png`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [qrDataUrl, table.id, table.number]);

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
    <div
      ref={rowRef}
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-foreground/2 p-4 sm:flex-row sm:items-start"
    >
      <div className="flex shrink-0 flex-col items-center gap-2">
        {qrDataUrl ? (
          <Image
            src={qrDataUrl}
            alt={t("restaurants.qrTableNumber", { number: table.number })}
            className="rounded-lg border border-foreground/10 bg-white p-1.5"
            width={120}
            height={120}
            unoptimized
          />
        ) : (
          <div className="flex size-[120px] items-center justify-center rounded-lg border border-dashed border-foreground/20 text-xs text-foreground/50">
            {t("restaurants.newWizard.qrGenerating")}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t("restaurants.qrTableNumber", { number: table.number })}
          </p>
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
            disabled={!qrDataUrl}
            onClick={() => downloadQrPng()}
            className="min-h-9 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
