import type Konva from "konva";
import { jsPDF } from "jspdf";
import { A4_EXPORT_PIXEL_RATIO, A4_HEIGHT_PX, A4_WIDTH_PX } from "@/lib/seasonal-menu/a4-dimensions";

export function downloadStageAsA4Pdf(stage: Konva.Stage, fileName: string): void {
  const dataUrl = stage.toDataURL({
    pixelRatio: A4_EXPORT_PIXEL_RATIO,
    mimeType: "image/png",
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, pageHeight);

  const safeName = fileName.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "seasonal-menu";
  pdf.save(`${safeName}.pdf`);
}

export function getStageDimensionsForExport(): { width: number; height: number } {
  return { width: A4_WIDTH_PX, height: A4_HEIGHT_PX };
}
