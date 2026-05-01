"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { MESSAGES_BY_LOCALE } from "@/lib/i18n/messages";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  type Locale,
  type Messages,
} from "@/lib/i18n/types";

type TranslateValues = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, values?: TranslateValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function applyTemplate(input: string, values?: TranslateValues): string {
  if (!values) return input;
  return input.replace(/\{(\w+)\}/g, (_, token) => {
    const next = values[token];
    return next == null ? `{${token}}` : String(next);
  });
}

export function I18nProvider({
  initialLocale,
  initialMessages,
  children,
}: {
  initialLocale: Locale;
  initialMessages: Messages;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<Messages>(initialMessages);
  const fallback = MESSAGES_BY_LOCALE[DEFAULT_LOCALE];

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      setMessages(MESSAGES_BY_LOCALE[next] ?? fallback);
      document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; samesite=lax`;
      try {
        window.localStorage.setItem(LOCALE_COOKIE_NAME, next);
      } catch {
        // Ignore localStorage errors in private mode.
      }
      router.refresh();
    },
    [fallback, router],
  );

  const t = useCallback(
    (key: string, values?: TranslateValues) => {
      const template = messages[key] ?? fallback[key] ?? key;
      return applyTemplate(template, values);
    },
    [fallback, messages],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return ctx;
}
