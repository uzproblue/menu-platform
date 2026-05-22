import type { MenuItem } from "@/lib/data/global-menu-types";

export type SeasonalMenuTemplateId = "luxury-light" | "luxury-dark";

export type EditorNodeStyle = {
  titleFontFamily: string;
  bodyFontFamily: string;
  titleColor: string;
  nameColor: string;
  priceColor: string;
  descriptionColor: string;
  grammColor: string;
  cardFill: string;
  cardStroke: string;
  accentColor: string;
  textAlign?: "left" | "center" | "right";
};

export type SeasonalMenuTemplateTheme = EditorNodeStyle & {
  id: SeasonalMenuTemplateId;
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
};

export type SeasonalMenuTemplateMeta = {
  id: SeasonalMenuTemplateId;
  labelKey: string;
  descriptionKey: string;
};

export const LAYOUT = {
  pageWidth: 794,
  pageHeight: 1123,
  marginX: 48,
  contentWidth: 698,
  headerY: 72,
  ruleY: 168,
  itemsStartY: 200,
  itemRowHeight: 128,
  itemWidth: 698,
  titleFontSize: 42,
  titleWidth: 698,
} as const;

export type BuildLayoutInput = {
  templateId: SeasonalMenuTemplateId;
  menuTitle: string;
  items: MenuItem[];
};

export type BuildLayoutResult = {
  templateId: SeasonalMenuTemplateId;
  theme: SeasonalMenuTemplateTheme;
  menuTitle: string;
  nodes: import("@/lib/seasonal-menu/stage-json").EditorNode[];
  backgroundLayer: Record<string, unknown>;
  stageJson: Record<string, unknown>;
};
