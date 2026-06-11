"use client";

import QRCodeStyling from "qr-code-styling";
import { toCanvasMenuImageProxyUrl } from "@/lib/menu-image-proxy";

const QR_BACKGROUND = "#FDFBF3";
const QR_FOREGROUND = "#000000";

/** Preview size in the restaurants table QR modal. */
export const STYLED_QR_PREVIEW_WIDTH = 120;

/** High-resolution export for print. */
export const STYLED_QR_PRINT_WIDTH = 1500;

/** Wizard success step preview. */
export const STYLED_QR_WIZARD_PREVIEW_WIDTH = 280;

export type StyledQrConfig = {
  url: string;
  width: number;
  logoUrl?: string | null;
};

export function resolveQrLogoUrl(
  logoUrl: string | undefined | null,
): string | undefined {
  const trimmed = logoUrl?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  return toCanvasMenuImageProxyUrl(trimmed);
}

export function createStyledQrCode(config: StyledQrConfig): QRCodeStyling {
  const logo = resolveQrLogoUrl(config.logoUrl);

  return new QRCodeStyling({
    width: config.width,
    height: config.width,
    type: "canvas",
    data: config.url,
    margin: 16,
    qrOptions: {
      errorCorrectionLevel: "H",
    },
    dotsOptions: {
      type: "rounded",
      color: QR_FOREGROUND,
    },
    cornersSquareOptions: {
      type: "extra-rounded",
      color: QR_FOREGROUND,
    },
    cornersDotOptions: {
      type: "dot",
      color: QR_FOREGROUND,
    },
    backgroundOptions: {
      color: QR_BACKGROUND,
    },
    ...(logo
      ? {
          image: logo,
          imageOptions: {
            crossOrigin: "anonymous",
            margin: 8,
            imageSize: 0.22,
            hideBackgroundDots: true,
          },
        }
      : {}),
  });
}

async function rawPngToDataUrl(raw: Blob | Buffer | null): Promise<string | null> {
  if (!raw) return null;
  if (typeof Blob !== "undefined" && raw instanceof Blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(raw);
    });
  }
  return null;
}

export async function styledQrToDataUrl(
  config: StyledQrConfig,
): Promise<string | null> {
  const qr = createStyledQrCode(config);
  const raw = await qr.getRawData("png");
  return rawPngToDataUrl(raw);
}

export async function downloadStyledQrPng(
  config: StyledQrConfig & { filename: string },
): Promise<void> {
  const qr = createStyledQrCode(config);
  const raw = await qr.getRawData("png");
  if (!raw || !(raw instanceof Blob)) return;

  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(raw);
  a.href = objectUrl;
  a.download = config.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
