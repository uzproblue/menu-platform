import type { TranslationTextApi } from "@/lib/auth-api";
import type { MenuItem } from "@/lib/data/global-menu-types";
import type { Locale } from "@/lib/i18n/types";

const LOCALE_TO_MENU_LANG: Record<Locale, string> = {
  en: "EN",
  ru: "RU",
  uz: "UZ",
};

/** Maps UI locale to menu translation row codes (see `LOCATION_TRANSLATION_OPTIONS`). */
export function localeToMenuTranslationLang(locale: Locale): string {
  return LOCALE_TO_MENU_LANG[locale];
}

/**
 * Pick guest-facing category title/description for the current UI language:
 * 1) translation row for that language when it has a non-empty name;
 * 2) else the only translation row with a non-empty name (if there is exactly one);
 * 3) else catalog `name` / `description`.
 */
export function getCategoryDisplayForLocale(
  catalogName: string,
  catalogDescription: string | null | undefined,
  translations: TranslationTextApi[] | undefined,
  locale: Locale,
): { name: string; description: string | null } {
  const list = translations ?? [];
  const catalogDesc =
    catalogDescription == null || typeof catalogDescription !== "string"
      ? null
      : catalogDescription.trim() || null;
  const catalogNm = catalogName.trim() || catalogName;

  const byLang = new Map(list.map((t) => [t.lang.trim().toUpperCase(), t] as const));
  const preferred = byLang.get(localeToMenuTranslationLang(locale));
  if (preferred?.name?.trim()) {
    return {
      name: preferred.name.trim(),
      description: preferred.description?.trim() ? preferred.description.trim() : null,
    };
  }

  const withNames = list.filter((t) => t.name.trim().length > 0);
  if (withNames.length === 1) {
    const row = withNames[0];
    return {
      name: row.name.trim(),
      description: row.description?.trim() ? row.description.trim() : null,
    };
  }

  return {
    name: catalogNm,
    description: catalogDesc,
  };
}

/** Same resolution rules as categories; catalog fields are menu item defaults. */
export const getMenuItemDisplayForLocale = getCategoryDisplayForLocale;

function normalizeCatalogDescription(
  description: string | null | undefined,
): string | null {
  if (description == null || typeof description !== "string") return null;
  const trimmed = description.trim();
  return trimmed.length ? trimmed : null;
}

function syncTranslationRowsForDisplay(
  translations: TranslationTextApi[] | undefined,
  name: string,
  description: string | null,
): TranslationTextApi[] {
  const catalogName = name.trim() || name;
  return (translations ?? []).map((row) => ({
    ...row,
    name: catalogName,
    description,
  }));
}

/** Align translation rows with catalog text so locale-based list titles update before Gemini finishes. */
export function withMenuItemDisplayTranslationsSynced(
  item: MenuItem,
  name: string,
  description: string | null | undefined,
): MenuItem {
  const catalogName = name.trim() || name;
  const catalogDesc = normalizeCatalogDescription(description);
  return {
    ...item,
    name: catalogName,
    ...(catalogDesc !== null ? { description: catalogDesc } : {}),
    translations: syncTranslationRowsForDisplay(item.translations, catalogName, catalogDesc),
  };
}

export type CategoryDisplaySyncShape = {
  name: string;
  description: string | null;
  coverPhoto?: string | null;
  translations?: TranslationTextApi[];
};

/** Same as menu items; for global category cards that use `getCategoryDisplayForLocale`. */
export function withCategoryDisplayTranslationsSynced<T extends CategoryDisplaySyncShape>(
  category: T,
  name: string,
  description: string | null | undefined,
): T {
  const catalogName = name.trim() || name;
  const catalogDesc = normalizeCatalogDescription(description);
  return {
    ...category,
    name: catalogName,
    description: catalogDesc,
    translations: syncTranslationRowsForDisplay(category.translations, catalogName, catalogDesc),
  };
}
