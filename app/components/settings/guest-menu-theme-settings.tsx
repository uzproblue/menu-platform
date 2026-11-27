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
  restaurantId?: string;
  guestMenuThemeId?: string;
  message?: string;
  options?: Array<{ id: string; label: string }>;
  export?: {
    ok: boolean;
    total: number;
    succeeded: number;
    failed: number;
  };
};

type LocationOption = {
  id: string;
  name: string;
};

type PreviewLinkResponse = {
  url?: string;
  expiresAt?: number;
  message?: string;
  error?: string;
};

export function GuestMenuThemeSettings() {
  const { t } = useI18n();
  const [themeId, setThemeId] = useState<GuestMenuThemeId>("default");
  const [previewThemeId, setPreviewThemeId] = useState<GuestMenuThemeId>("maxcreme");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [previewLocationId, setPreviewLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [previewPending, setPreviewPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [themeRes, locRes] = await Promise.all([
          fetch("/api/settings/guest-menu-theme", {
            method: "GET",
            credentials: "include",
          }),
          fetch("/api/settings/locations", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }),
        ]);
        const data = (await themeRes.json().catch(() => null)) as ThemeResponse | null;
        if (!themeRes.ok) {
          if (!cancelled) {
            setError(
              data && typeof data.message === "string"
                ? data.message
                : t("settings.guestMenuThemeLoadError"),
            );
          }
          return;
        }
        if (!cancelled && data) {
          setThemeId(normalizeGuestMenuThemeId(data.guestMenuThemeId));
        }

        const locPayload = (await locRes.json().catch(() => null)) as {
          locations?: LocationOption[];
        } | null;
        if (!cancelled && locRes.ok && locPayload?.locations) {
          const opts = locPayload.locations
            .filter((l) => typeof l.id === "string" && l.id.trim())
            .map((l) => ({
              id: l.id,
              name: (l.name || l.id).trim() || l.id,
            }));
          setLocations(opts);
          setPreviewLocationId((prev) => prev || opts[0]?.id || "");
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
          data && typeof data.message === "string"
            ? data.message
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

  async function handleCopyPreviewLink() {
    if (!previewLocationId || !isGuestMenuThemeId(previewThemeId)) return;
    setPreviewPending(true);
    setPreviewError(null);
    setPreviewMessage(null);
    try {
      const res = await fetch("/api/settings/guest-menu-theme/preview-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: previewLocationId,
          guestMenuThemeId: previewThemeId,
        }),
      });
      const data = (await res.json().catch(() => null)) as PreviewLinkResponse | null;
      if (!res.ok || !data?.url) {
        setPreviewError(
          data && typeof data.message === "string"
            ? data.message
            : t("settings.guestMenuThemePreviewError"),
        );
        return;
      }
      try {
        await navigator.clipboard.writeText(data.url);
        setPreviewMessage(t("settings.guestMenuThemePreviewCopied"));
      } catch {
        setPreviewMessage(data.url);
      }
    } catch {
      setPreviewError(t("settings.guestMenuThemePreviewError"));
    } finally {
      setPreviewPending(false);
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
        <>
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

          <div className="mt-8 space-y-3 border-t border-foreground/10 pt-6">
            <h3 className="text-sm font-semibold text-foreground">
              {t("settings.guestMenuThemePreviewTitle")}
            </h3>
            <p className="text-xs text-foreground/55">
              {t("settings.guestMenuThemePreviewHelp")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-foreground/80"
                  htmlFor="guest-menu-preview-theme"
                >
                  {t("settings.guestMenuThemePreviewTheme")}
                </label>
                <select
                  id="guest-menu-preview-theme"
                  value={previewThemeId}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (isGuestMenuThemeId(next)) setPreviewThemeId(next);
                    if (previewError) setPreviewError(null);
                    if (previewMessage) setPreviewMessage(null);
                  }}
                  className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20"
                >
                  {GUEST_MENU_THEME_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-foreground/80"
                  htmlFor="guest-menu-preview-location"
                >
                  {t("settings.guestMenuThemePreviewLocation")}
                </label>
                <select
                  id="guest-menu-preview-location"
                  value={previewLocationId}
                  onChange={(e) => {
                    setPreviewLocationId(e.target.value);
                    if (previewError) setPreviewError(null);
                    if (previewMessage) setPreviewMessage(null);
                  }}
                  disabled={locations.length === 0}
                  className="w-full rounded-xl border border-foreground/15 bg-background/80 px-3.5 py-2.5 text-sm text-foreground outline-none ring-offset-background focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
                >
                  {locations.length === 0 ? (
                    <option value="">{t("settings.guestMenuThemePreviewNoLocations")}</option>
                  ) : (
                    locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            {previewError ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                {previewError}
              </p>
            ) : null}
            {previewMessage ? (
              <p className="break-all rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                {previewMessage}
              </p>
            ) : null}
            <button
              type="button"
              disabled={previewPending || !previewLocationId}
              onClick={() => void handleCopyPreviewLink()}
              className="min-h-11 cursor-pointer rounded-xl border border-foreground/20 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {previewPending
                ? t("settings.guestMenuThemePreviewCopying")
                : t("settings.guestMenuThemePreviewCopy")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
