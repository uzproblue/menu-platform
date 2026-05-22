import {
  TEMPLATE_BODY_FONT_FAMILY,
  TEMPLATE_TITLE_FONT_FAMILY,
} from "@/lib/seasonal-menu/template-fonts";
import type { SeasonalMenuTemplateMeta, SeasonalMenuTemplateTheme } from "@/lib/seasonal-menu/templates/types";

export const luxuryDarkMeta: SeasonalMenuTemplateMeta = {
  id: "luxury-dark",
  labelKey: "seasonalMenu.templateDark",
  descriptionKey: "seasonalMenu.templateDarkDesc",
};

export const luxuryDarkTheme: SeasonalMenuTemplateTheme = {
  id: "luxury-dark",
  backgroundGradientStart: "#1c1c1e",
  backgroundGradientEnd: "#0a0a0b",
  titleFontFamily: TEMPLATE_TITLE_FONT_FAMILY,
  bodyFontFamily: TEMPLATE_BODY_FONT_FAMILY,
  titleColor: "#f5f0e8",
  nameColor: "#f5f0e8",
  priceColor: "#c9a962",
  descriptionColor: "#a8a29e",
  grammColor: "#a8a29e",
  cardFill: "#252528",
  cardStroke: "#3d3d42",
  accentColor: "#c9a962",
  textAlign: "center",
};
