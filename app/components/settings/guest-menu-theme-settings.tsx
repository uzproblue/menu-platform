"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import {
  GUEST_MENU_THEME_OPTIONS,
  type GuestMenuThemeId,
  isGuestMenuThemeId,
  normalizeGuestMenuThemeId,
} from "@/lib/guest-menu-theme";

type ThemeResponse = {
  restaurantId: string;
  guestMenuThemeId: string;
  options?: Array<{ id: string; label: string }>;
  export?: {
    ok: boolean;
    total: number;
    succeeded: number;
    failed: number;
  };
};

export function GuestMenuThemeSettings() {
  const { t } = useI18n();
  const [themeId, setThemeId] = useState<GuestMenuThemeId>("default");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/settings/guest-menu-theme", {
          method: "GET",
          credentials: "include",
        });
        const data = (await res.json().catch(() => null)) as ThemeResponse | null;
        if (!res.ok) {
          if (!cancelled) {
            setError(data && "message" in (data as object)
              ? String((data as { message?: string }).message || t("settings.guestMenuThemeLoadError"))
              : t("settings.guestMenuThemeLoadError"));
          }
          return;
        }
        if (!cancelled && data) {
          setThemeId(normalizeGuestMenuThemeId(data.guestMenuThemeId));
        }
      } catch {
        if (!cancelled) setError(t("settings.guestMenuThemeLoadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/settings/guest-menu-theme", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestMenuThemeId: themeId }),
      });
      const data = (await res.json().catch(() => null)) as ThemeResponse | null;
      if (!res.ok) {
        setError(
          data && typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : t("settings.guestMenuThemeSaveError"),
        );
        return;
      }
      if (data?.guestMenuThemeId && isGuestMenuThemeId(data.guestMenuThemeId)) {
        setThemeId(data.guestMenuThemeId);
      }
      if (data?.export && !data.export.ok) {
        setSaved(
          t("settings.guestMenuThemeSavedExportPartial", {
            succeeded: String(data.export.succeeded),
            total: String(data.export.total),
          }),
        );
      } else {
        setSaved(t("settings.guestMenuThemeSaved"));
      }
    } catch {
      setError(t("settings.guestMenuThemeSaveError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {t("settings.guestMenuTheme")}
      </h2>
      <p className="mt-1 text-sm text-foreground/60">
        {t("settings.guestMenuThemeHelp")}
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-foreground/50">{t("settings.loading")}</p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="guest-menu-theme"
            >
              {t("settings.guestMenuThemeLabel")}
            </label>
            <select
              id="guest-menu-theme"
              value={themeId}
              onChange={(e) => {
                const next = e.target.value;
                if (isGuestMenuThemeId(next)) setThemeId(next);
                if (error) setError(null);
                if (saved) setSaved(null);
              }}
              className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
            >
              {GUEST_MENU_THEME_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <p className="text-xs text-foreground/50">
              {t("settings.guestMenuThemeNote")}
            </p>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              {saved}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="min-h-11 cursor-pointer rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t("settings.saving") : t("settings.guestMenuThemeSave")}
          </button>
        </form>
      )}
    </section>
  );
}
