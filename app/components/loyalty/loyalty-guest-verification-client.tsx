"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { RestaurantTelegramConfig } from "@/lib/loyalty-api/telegram";
import type { WhatsappChannelView } from "@/lib/loyalty-api/whatsapp-channels";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

type SessionPayload = {
  status?: string;
  session?: string;
  channel?: WhatsappChannelView;
  message?: string;
};

type QrPayload = {
  status?: string;
  qr?: string | null;
  message?: string;
};

function isActive(channel: WhatsappChannelView | undefined): boolean {
  return channel?.status === "active";
}

function needsReauth(channel: WhatsappChannelView | undefined): boolean {
  return channel?.status === "needs_reauth" || channel?.status === "error";
}

function whatsappStatusLabel(
  channel: WhatsappChannelView | undefined,
  t: (key: string) => string,
): string {
  if (!channel || channel.status === "disconnected") {
    return t("loyalty.whatsappLinkStatusDisconnected");
  }
  if (channel.status === "active") return t("loyalty.whatsappLinkStatusActive");
  if (channel.status === "needs_reauth") return t("loyalty.whatsappLinkStatusNeedsReauth");
  if (channel.status === "error") return t("loyalty.whatsappLinkStatusError");
  return t("loyalty.whatsappLinkStatusDisconnected");
}

export function LoyaltyGuestVerificationClient() {
  const { t } = useI18n();

  const [config, setConfig] = useState<RestaurantTelegramConfig | null>(null);
  const [username, setUsername] = useState("");
  const [botToken, setBotToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(true);

  const [whatsappChannel, setWhatsappChannel] = useState<WhatsappChannelView | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(true);
  const [whatsappPending, setWhatsappPending] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const qrPoll = useRef(0);

  const loadTelegram = useCallback(async () => {
    setTelegramLoading(true);
    try {
      const res = await fetch("/api/settings/loyalty/telegram", { cache: "no-store" });
      if (!res.ok) {
        setTelegramError(await readErrorMessage(res, t("loyalty.telegramLoadFailed")));
        return;
      }
      const data = (await res.json()) as RestaurantTelegramConfig;
      setConfig(data);
      setUsername(data.username ?? "");
      setEnabled(Boolean(data.enabled));
      setBotToken("");
      setTelegramError(null);
    } catch {
      setTelegramError(t("loyalty.telegramLoadFailed"));
    } finally {
      setTelegramLoading(false);
    }
  }, [t]);

  const stopQrPoll = useCallback(() => {
    if (qrPoll.current) {
      window.clearInterval(qrPoll.current);
      qrPoll.current = 0;
    }
  }, []);

  const loadWhatsapp = useCallback(async () => {
    setWhatsappLoading(true);
    try {
      const res = await fetch("/api/settings/loyalty/whatsapp/connections", {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as
        | { channels?: WhatsappChannelView[]; message?: string }
        | null;
      if (!res.ok) {
        setWhatsappError(payload?.message || t("loyalty.whatsappLinkLoadFailed"));
        setWhatsappChannel(null);
        return;
      }
      const channel = payload?.channels?.find((item) => item.type === "whatsapp") ?? null;
      setWhatsappChannel(channel);
      setWhatsappError(null);
    } catch {
      setWhatsappError(t("loyalty.whatsappLinkNetworkError"));
      setWhatsappChannel(null);
    } finally {
      setWhatsappLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTelegram();
    void loadWhatsapp();
  }, [loadTelegram, loadWhatsapp]);

  useEffect(() => {
    const onContextChanged = () => {
      stopQrPoll();
      setQrOpen(false);
      setQrDataUrl(null);
      setWhatsappPending(false);
      void loadTelegram();
      void loadWhatsapp();
    };
    window.addEventListener("restaurant-context-changed", onContextChanged);
    return () => window.removeEventListener("restaurant-context-changed", onContextChanged);
  }, [loadTelegram, loadWhatsapp, stopQrPoll]);

  useEffect(() => () => stopQrPoll(), [stopQrPoll]);

  async function saveTelegram(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setTelegramError(null);
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
        setTelegramError(await readErrorMessage(res, t("loyalty.telegramSaveFailed")));
        return;
      }
      const data = (await res.json()) as RestaurantTelegramConfig;
      setConfig(data);
      setUsername(data.username ?? "");
      setEnabled(Boolean(data.enabled));
      setBotToken("");
      setSaved(true);
      if (data.webhookSync && !data.webhookSync.ok) {
        setTelegramError(
          data.webhookSync.message ??
            data.webhookSync.error ??
            t("loyalty.telegramWebhookFailed"),
        );
      }
    } catch {
      setTelegramError(t("loyalty.telegramSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const refreshQr = useCallback(async () => {
    const res = await fetch("/api/settings/loyalty/whatsapp/qr");
    const payload = (await res.json().catch(() => null)) as QrPayload | null;
    if (payload?.status === "WORKING") {
      stopQrPoll();
      setQrOpen(false);
      setQrDataUrl(null);
      setWhatsappPending(false);
      await loadWhatsapp();
      return;
    }
    if (payload?.qr) {
      setQrDataUrl(
        payload.qr.startsWith("data:") ? payload.qr : `data:image/png;base64,${payload.qr}`,
      );
    }
  }, [loadWhatsapp, stopQrPoll]);

  const startQrFlow = useCallback(async () => {
    stopQrPoll();
    setQrOpen(true);
    setQrDataUrl(null);
    await refreshQr();
    qrPoll.current = window.setInterval(() => {
      void refreshQr();
      void fetch("/api/settings/loyalty/whatsapp/status")
        .then((res) => res.json() as Promise<SessionPayload>)
        .then((payload) => {
          if (payload.status === "WORKING") {
            stopQrPoll();
            setQrOpen(false);
            setQrDataUrl(null);
            setWhatsappPending(false);
            void loadWhatsapp();
          }
        })
        .catch(() => undefined);
    }, 2500);
  }, [loadWhatsapp, refreshQr, stopQrPoll]);

  async function connectWhatsapp() {
    setWhatsappPending(true);
    setWhatsappError(null);
    try {
      const url =
        whatsappChannel && needsReauth(whatsappChannel)
          ? `/api/settings/loyalty/whatsapp/connections/${encodeURIComponent(whatsappChannel.id)}/reauth`
          : "/api/settings/loyalty/whatsapp/session";
      const start = await fetch(url, { method: "POST" });
      const payload = (await start.json().catch(() => null)) as SessionPayload | null;
      if (!start.ok) {
        setWhatsappError(payload?.message || t("loyalty.whatsappLinkLoadFailed"));
        setWhatsappPending(false);
        return;
      }
      if (payload?.status === "WORKING") {
        await loadWhatsapp();
        setWhatsappPending(false);
        return;
      }
      await startQrFlow();
    } catch {
      setWhatsappError(t("loyalty.whatsappLinkNetworkError"));
      setWhatsappPending(false);
      setQrOpen(false);
    }
  }

  async function disconnectWhatsapp() {
    if (!whatsappChannel) return;
    setWhatsappPending(true);
    setWhatsappError(null);
    stopQrPoll();
    setQrOpen(false);
    setQrDataUrl(null);
    try {
      const res = await fetch(
        `/api/settings/loyalty/whatsapp/connections/${encodeURIComponent(whatsappChannel.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setWhatsappError(await readErrorMessage(res, t("loyalty.whatsappLinkLoadFailed")));
        return;
      }
      await loadWhatsapp();
    } catch {
      setWhatsappError(t("loyalty.whatsappLinkNetworkError"));
    } finally {
      setWhatsappPending(false);
    }
  }

  function cancelQr() {
    stopQrPoll();
    setQrOpen(false);
    setQrDataUrl(null);
    setWhatsappPending(false);
    void loadWhatsapp();
  }

  const connectLabel = whatsappPending
    ? t("loyalty.whatsappLinkConnecting")
    : whatsappChannel && needsReauth(whatsappChannel)
      ? t("loyalty.whatsappLinkRetry")
      : isActive(whatsappChannel ?? undefined)
        ? t("loyalty.whatsappLinkReconnect")
        : t("loyalty.whatsappLinkConnect");

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("loyalty.guestVerificationTitle")}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
          {t("loyalty.guestVerificationSubtitle")}
        </p>
      </header>

      <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-7">
        <header className="max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight">
            {t("loyalty.telegramTitle")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/60">
            {t("loyalty.telegramSubtitle")}
          </p>
        </header>

        {telegramLoading ? (
          <p className="mt-6 text-sm text-foreground/60">{t("loyalty.loading")}</p>
        ) : (
          <form
            onSubmit={(e) => void saveTelegram(e)}
            className="mt-6 max-w-xl space-y-4"
          >
            <label className="block text-sm">
              <span className="block text-foreground/60">
                {t("loyalty.telegramUsername")}
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="MyRestaurantBot"
                autoComplete="off"
              />
            </label>

            <label className="block text-sm">
              <span className="block text-foreground/60">
                {t("loyalty.telegramBotToken")}
              </span>
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

            {telegramError ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
                {telegramError}
              </p>
            ) : null}
            {saved && !telegramError ? (
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

      <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-7">
        <header className="max-w-2xl">
          <h2 className="text-lg font-semibold tracking-tight">
            {t("loyalty.whatsappLinkTitle")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground/60">
            {t("loyalty.whatsappLinkSubtitle")}
          </p>
        </header>

        <div className="mt-6 max-w-xl space-y-4">
          {whatsappLoading && !qrOpen ? (
            <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
          ) : (
            <>
              <p
                className="text-sm font-medium"
                data-status={whatsappChannel?.status ?? "disconnected"}
              >
                {whatsappStatusLabel(whatsappChannel ?? undefined, t)}
                {whatsappChannel?.displayName
                  ? ` · ${whatsappChannel.displayName}`
                  : null}
              </p>

              {whatsappError ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
                  {whatsappError}
                </p>
              ) : null}

              {qrOpen ? (
                <div className="space-y-3 rounded-xl border border-foreground/10 bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">
                        {t("loyalty.whatsappLinkQrTitle")}
                      </h3>
                      <p className="mt-1 text-sm text-foreground/60">
                        {t("loyalty.whatsappLinkQrBody")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm"
                      onClick={cancelQr}
                    >
                      {t("loyalty.whatsappLinkQrCancel")}
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-2 py-2">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt={t("loyalty.whatsappLinkQrAlt")}
                        width={280}
                        height={280}
                        className="rounded-lg bg-white p-2"
                      />
                    ) : (
                      <p className="text-sm text-foreground/60">
                        {t("loyalty.whatsappLinkQrWaiting")}
                      </p>
                    )}
                    <p className="text-sm text-foreground/60">
                      {t("loyalty.whatsappLinkQrHint")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={whatsappPending}
                    onClick={() => void connectWhatsapp()}
                    className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
                  >
                    {connectLabel}
                  </button>
                  {whatsappChannel && whatsappChannel.status !== "disconnected" ? (
                    <button
                      type="button"
                      disabled={whatsappPending}
                      onClick={() => void disconnectWhatsapp()}
                      className="rounded-lg border border-foreground/15 px-4 py-2 text-sm disabled:opacity-60"
                    >
                      {t("loyalty.whatsappLinkDisconnect")}
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
