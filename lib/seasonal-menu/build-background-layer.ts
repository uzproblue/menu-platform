import { A4_HEIGHT_PX, A4_WIDTH_PX } from "@/lib/seasonal-menu/a4-dimensions";
import type { SeasonalMenuTemplateTheme } from "@/lib/seasonal-menu/templates/types";
import { LAYOUT } from "@/lib/seasonal-menu/templates/types";

export function buildBackgroundLayer(theme: SeasonalMenuTemplateTheme): Record<string, unknown> {
  const w = A4_WIDTH_PX;
  const h = A4_HEIGHT_PX;
  const inset = 28;

  return {
    attrs: { name: "background" },
    className: "Layer",
    children: [
      {
        attrs: {
          x: 0,
          y: 0,
          width: w,
          height: h,
          listening: false,
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: 0, y: h },
          fillLinearGradientColorStops: [
            0,
            theme.backgroundGradientStart,
            1,
            theme.backgroundGradientEnd,
          ],
        },
        className: "Rect",
      },
      {
        attrs: {
          x: inset,
          y: inset,
          width: w - inset * 2,
          height: h - inset * 2,
          stroke: theme.accentColor,
          strokeWidth: 1,
          listening: false,
          name: "template-deco",
        },
        className: "Rect",
      },
      {
        attrs: {
          x: LAYOUT.marginX,
          y: LAYOUT.ruleY,
          width: LAYOUT.contentWidth,
          height: 2,
          fill: theme.accentColor,
          listening: false,
          name: "template-deco",
        },
        className: "Rect",
      },
      {
        attrs: {
          x: LAYOUT.marginX,
          y: h - 80,
          width: LAYOUT.contentWidth,
          height: 1,
          fill: theme.accentColor,
          opacity: 0.5,
          listening: false,
          name: "template-deco",
        },
        className: "Rect",
      },
    ],
  };
}
