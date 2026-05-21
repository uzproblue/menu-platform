export const SUPPORTED_LOCALES = ["en", "ru", "uz"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ru";

export const LOCALE_COOKIE_NAME = "menu_locale";

export type Messages = Record<string, string>;
