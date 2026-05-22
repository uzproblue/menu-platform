import { luxuryDarkMeta, luxuryDarkTheme } from "@/lib/seasonal-menu/templates/luxury-dark";
import { luxuryLightMeta, luxuryLightTheme } from "@/lib/seasonal-menu/templates/luxury-light";
import type {
  SeasonalMenuTemplateId,
  SeasonalMenuTemplateMeta,
  SeasonalMenuTemplateTheme,
} from "@/lib/seasonal-menu/templates/types";

export const SEASONAL_MENU_TEMPLATES: SeasonalMenuTemplateMeta[] = [
  luxuryLightMeta,
  luxuryDarkMeta,
];

export function getTemplateTheme(id: SeasonalMenuTemplateId): SeasonalMenuTemplateTheme {
  switch (id) {
    case "luxury-dark":
      return luxuryDarkTheme;
    case "luxury-light":
    default:
      return luxuryLightTheme;
  }
}

export function isSeasonalMenuTemplateId(value: string): value is SeasonalMenuTemplateId {
  return value === "luxury-light" || value === "luxury-dark";
}
