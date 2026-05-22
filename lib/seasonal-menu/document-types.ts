import type { SeasonalMenuTemplateId, SeasonalMenuTemplateTheme } from "@/lib/seasonal-menu/templates/types";

/** Persisted Konva canvas document (versioned wrapper). */
export type SeasonalMenuDocument = {
  version: 1;
  pageSize: { width: number; height: number };
  templateId?: SeasonalMenuTemplateId;
  menuTitle?: string;
  theme?: SeasonalMenuTemplateTheme;
  pages: Array<{ stageJson: Record<string, unknown> }>;
};

export const SEASONAL_MENU_DOCUMENT_VERSION = 1 as const;
