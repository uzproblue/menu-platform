import {
  TEMPLATE_BODY_FONT_FAMILY,
  TEMPLATE_TITLE_FONT_FAMILY,
} from "@/lib/seasonal-menu/template-fonts";
import type { SeasonalMenuTemplateMeta, SeasonalMenuTemplateTheme } from "@/lib/seasonal-menu/templates/types";

export const luxuryLightMeta: SeasonalMenuTemplateMeta = {
  id: "luxury-light",
  labelKey: "seasonalMenu.templateLight",
  descriptionKey: "seasonalMenu.templateLightDesc",
};

export const luxuryLightTheme: SeasonalMenuTemplateTheme = {
  id: "luxury-light",
  backgroundGradientStart: "#faf8f5",
  backgroundGradientEnd: "#f3efe8",
  titleFontFamily: TEMPLATE_TITLE_FONT_FAMILY,
  bodyFontFamily: TEMPLATE_BODY_FONT_FAMILY,
  titleColor: "#1c1917",
  nameColor: "#292524",
  priceColor: "#78716c",
  descriptionColor: "#57534e",
  grammColor: "#78716c",
  cardFill: "#fffefb",
  cardStroke: "#e7e0d5",
  accentColor: "#9a7b4f",
  textAlign: "center",
};
