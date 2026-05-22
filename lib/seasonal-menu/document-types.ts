/** Persisted Konva canvas document (versioned wrapper). */
export type SeasonalMenuDocument = {
  version: 1;
  pageSize: { width: number; height: number };
  pages: Array<{ stageJson: Record<string, unknown> }>;
};

export const SEASONAL_MENU_DOCUMENT_VERSION = 1 as const;
