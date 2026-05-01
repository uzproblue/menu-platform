import { MESSAGES_BY_LOCALE } from "./messages";
import { DEFAULT_LOCALE, type Locale, type Messages } from "./types";
import { isSupportedLocale } from "./detect-locale";

export function getMessagesForLocale(locale: Locale): Messages {
  return MESSAGES_BY_LOCALE[locale] ?? MESSAGES_BY_LOCALE[DEFAULT_LOCALE];
}

export function normalizeLocale(raw: string | null | undefined): Locale {
  return isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;
}
