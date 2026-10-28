"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { RestaurantTelegramConfig } from "@/lib/loyalty-api/telegram";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function LoyaltyTelegramClient() {
  const { t } = useI18n();
  const [config, setConfig] = useState<RestaurantTelegramConfig | null>(null);
  const [username, setUsername] = useState("");
  const [botToken, setBotToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/loyalty/telegram", { cache: "no-store" });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.telegramLoadFailed")));
        return;
      }
      const data = (await res.json()) as RestaurantTelegramConfig;
      setConfig(data);
      setUsername(data.username ?? "");
      setEnabled(Boolean(data.enabled));
      setBotToken("");
      setError(null);
    } catch {
      setError(t("loyalty.telegramLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onContextChanged = () => void load();
    window.addEventListener("restaurant-context-changed", onContextChanged);
    return () => window.removeEventListener("restaurant-context-changed", onContextChanged);
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const body: {
        username: string;
        enabled: boolean;
        botToken?: string;
      } = {
        username: username.trim().replace(/^@+/, ""),
        enabled,
      };
      if (botToken.trim()) {
        body.botToken = botToken.trim();
      }
      const res = await fetch("/api/settings/loyalty/telegram", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.telegramSaveFailed")));
        return;
      }
      const data = (await res.json()) as RestaurantTelegramConfig;
      setConfig(data);
      setUsername(data.username ?? "");
      setEnabled(Boolean(data.enabled));
      setBotToken("");
      setSaved(true);
      if (data.webhookSync && !data.webhookSync.ok) {
        setError(
          data.webhookSync.message ??
            data.webhookSync.error ??
            t("loyalty.telegramWebhookFailed"),
        );
      }
    } catch {
      setError(t("loyalty.telegramSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-7">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("loyalty.telegramTitle")}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
          {t("loyalty.telegramSubtitle")}
        </p>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-foreground/60">{t("loyalty.loading")}</p>
      ) : (
        <form onSubmit={(e) => void save(e)} className="mt-6 max-w-xl space-y-4">
          <label className="block text-sm">
            <span className="block text-foreground/60">{t("loyalty.telegramUsername")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="MyRestaurantBot"
              autoComplete="off"
            />
          </label>

          <label className="block text-sm">
            <span className="block text-foreground/60">{t("loyalty.telegramBotToken")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder={
                config?.hasBotToken
                  ? t("loyalty.telegramTokenPlaceholderKeep")
                  : t("loyalty.telegramTokenPlaceholderNew")
              }
              autoComplete="off"
            />
            {config?.botTokenMasked ? (
              <span className="mt-1 block text-xs text-foreground/50">
                {t("loyalty.telegramTokenMasked").replace(
                  "{masked}",
                  config.botTokenMasked,
                )}
              </span>
            ) : null}
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>{t("loyalty.telegramEnabled")}</span>
          </label>

          {config?.webhookSync?.ok ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {config.webhookSync.action === "disconnect"
                ? t("loyalty.telegramWebhookDisconnected")
                : t("loyalty.telegramWebhookSynced")}
              {config.webhookSync.webhookUrl
                ? ` · ${config.webhookSync.webhookUrl}`
                : null}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              {error}
            </p>
          ) : null}
          {saved && !error ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {t("loyalty.telegramSaved")}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            {saving ? t("loyalty.telegramSaving") : t("loyalty.telegramSave")}
          </button>
        </form>
      )}
    </section>
  );
}
