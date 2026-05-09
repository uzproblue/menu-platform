import type { TranslationTextApi } from "@/lib/auth-api";
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
