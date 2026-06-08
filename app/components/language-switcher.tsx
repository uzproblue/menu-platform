"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./i18n-provider";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/types";
import { PlatformEvent, trackClientEvent } from "@/lib/analytics";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="cursor-pointer items-center justify-center rounded-xl border border-foreground/15 bg-background/80 text-foreground shadow-sm ring-1 ring-foreground/5 transition-colors hover:bg-foreground/5"
        aria-label={t("locale.switcherLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12h18M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9zm0 0a9 9 0 100 18 9 9 0 000-18z"
          />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t("locale.switcherLabel")}
          className="absolute right-0 top-full z-30 mt-2 min-w-40 rounded-xl border border-foreground/10 bg-background/95 p-1.5 shadow-xl ring-1 ring-foreground/10 backdrop-blur-md"
        >
          {SUPPORTED_LOCALES.map((value) => {
            const label =
              value === "en"
                ? t("locale.english")
                : value === "ru"
                  ? t("locale.russian")
                  : t("locale.uzbek");
            const active = locale === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  if (locale !== value) {
                    trackClientEvent(PlatformEvent.LOCALE_CHANGED, { locale: value });
                  }
                  setLocale(value as Locale);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                <span>{label}</span>
                {active ? <span className="text-xs">●</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
