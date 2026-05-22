import { A4_HEIGHT_PX, A4_WIDTH_PX } from "@/lib/seasonal-menu/a4-dimensions";
import type { SeasonalMenuDocument } from "@/lib/seasonal-menu/document-types";
import { SEASONAL_MENU_DOCUMENT_VERSION } from "@/lib/seasonal-menu/document-types";

/** Minimal Konva stage JSON: white background + empty content layer. */
export function createEmptyStageJson(): Record<string, unknown> {
  return {
    attrs: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
    className: "Stage",
    children: [
      {
        attrs: {},
        className: "Layer",
        children: [
          {
            attrs: {
              x: 0,
              y: 0,
              width: A4_WIDTH_PX,
              height: A4_HEIGHT_PX,
              fill: "#ffffff",
              listening: false,
              name: "background",
            },
            className: "Rect",
          },
        ],
      },
      {
        attrs: { name: "content" },
        className: "Layer",
        children: [],
      },
    ],
  };
}

export function createEmptySeasonalMenuDocument(): SeasonalMenuDocument {
  return {
    version: SEASONAL_MENU_DOCUMENT_VERSION,
    pageSize: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
    pages: [{ stageJson: createEmptyStageJson() }],
  };
}
