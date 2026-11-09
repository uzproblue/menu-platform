"use client";

import {
  resolveQrLogoUrl,
  styledQrToDataUrl,
} from "@/lib/styled-qr";

/** Preview card width in the restaurants table QR modal. */
export const TABLE_QR_TENT_PREVIEW_WIDTH = 280;

/** High-resolution export for print. */
export const TABLE_QR_TENT_PRINT_WIDTH = 1500;

const CARD_ASPECT = 1.55;
const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export type TableQrTentCardConfig = {
  menuUrl: string;
  locationName: string;
  /** Brand logo shown at the top of the tent card (custom upload or location logo). */
  logoUrl?: string | null;
  sectionName: string;
  tableLabel: string;
  instructionText: string;
  width: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("tent_card_image_load_failed"));
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontWeight: string,
  fontSize: number,
): number {
  let size = fontSize;
  ctx.font = `${fontWeight} ${size}px ${FONT_STACK}`;
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `${fontWeight} ${size}px ${FONT_STACK}`;
  }
  return size;
}

/**
 * Compose a portrait tent-card PNG (logo + name, QR, instruction, hall, table).
 * Preview and print share this path so layout matches; only `width` differs.
 */
export async function composeTableQrTentCard(
  config: TableQrTentCardConfig,
): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const width = Math.max(160, Math.round(config.width));
  const height = Math.round(width * CARD_ASPECT);
  const padX = width * 0.1;
  const contentWidth = width - padX * 2;

  const qrSize = Math.round(contentWidth * 0.88);
  const qrDataUrl = await styledQrToDataUrl({
    url: config.menuUrl,
    width: Math.max(280, qrSize),
  });
  if (!qrDataUrl) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // White card with soft rounded corners
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 0, 0, width, height, width * 0.045);
  ctx.fill();

  let y = height * 0.07;

  // Brand logo
  const brandLogoSrc = resolveQrLogoUrl(config.logoUrl);
  if (brandLogoSrc) {
    try {
      const logo = await loadImage(brandLogoSrc);
      const logoMaxH = height * 0.09;
      const logoMaxW = contentWidth * 0.55;
      const scale = Math.min(logoMaxW / logo.width, logoMaxH / logo.height);
      const logoW = logo.width * scale;
      const logoH = logo.height * scale;
      ctx.drawImage(logo, (width - logoW) / 2, y, logoW, logoH);
      y += logoH + height * 0.018;
    } catch {
      // Continue without logo if load fails.
    }
  }

  // Brand name (uppercase)
  const brandName = config.locationName.trim().toUpperCase();
  if (brandName) {
    const nameSize = fitText(
      ctx,
      brandName,
      contentWidth,
      "600",
      width * 0.038,
    );
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `600 ${nameSize}px ${FONT_STACK}`;
    ctx.fillText(brandName, width / 2, y);
    y += nameSize + height * 0.045;
  } else {
    y += height * 0.02;
  }

  // QR
  try {
    const qrImg = await loadImage(qrDataUrl);
    const qrX = (width - qrSize) / 2;
    ctx.drawImage(qrImg, qrX, y, qrSize, qrSize);
    y += qrSize + height * 0.028;
  } catch {
    return null;
  }

  // Instruction
  const instruction = config.instructionText.trim();
  if (instruction) {
    const instrSize = fitText(
      ctx,
      instruction,
      contentWidth,
      "400",
      width * 0.032,
    );
    ctx.fillStyle = "#6B6B6B";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `400 ${instrSize}px ${FONT_STACK}`;
    ctx.fillText(instruction, width / 2, y);
    y += instrSize + height * 0.04;
  }

  // Divider
  const dividerInset = padX * 0.35;
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1, width * 0.003);
  ctx.beginPath();
  ctx.moveTo(dividerInset, y);
  ctx.lineTo(width - dividerInset, y);
  ctx.stroke();
  y += height * 0.04;

  // Hall / section name
  const section = config.sectionName.trim();
  if (section) {
    const sectionSize = fitText(
      ctx,
      section,
      contentWidth,
      "600",
      width * 0.042,
    );
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `600 ${sectionSize}px ${FONT_STACK}`;
    ctx.fillText(section, width / 2, y);
    y += sectionSize + height * 0.028;
  }

  // Large table label
  const tableLabel = config.tableLabel.trim();
  if (tableLabel) {
    const tableSize = fitText(
      ctx,
      tableLabel,
      contentWidth,
      "700",
      width * 0.095,
    );
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 ${tableSize}px ${FONT_STACK}`;
    ctx.fillText(tableLabel, width / 2, y);
  }

  return canvas.toDataURL("image/png");
}

export async function downloadTableQrTentCardPng(
  config: Omit<TableQrTentCardConfig, "width"> & {
    filename: string;
    width?: number;
  },
): Promise<void> {
  const dataUrl = await composeTableQrTentCard({
    ...config,
    width: config.width ?? TABLE_QR_TENT_PRINT_WIDTH,
  });
  if (!dataUrl) return;

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = config.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
