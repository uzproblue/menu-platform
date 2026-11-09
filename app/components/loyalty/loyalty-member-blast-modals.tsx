"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  GuestBlastChannel,
  GuestBlastPreviewResponse,
} from "@/lib/loyalty-api/guests";
import { useI18n } from "../i18n-provider";

export type BlastSendPayload = {
  channel: GuestBlastChannel;
  message?: string;
  title?: string;
  url?: string;
};

type BlastResult = {
  targeted: number;
  succeeded: number;
  failed: number;
};

const CHANNELS: GuestBlastChannel[] = ["whatsapp", "telegram", "wallet", "webpush"];

function channelTitleKey(channel: GuestBlastChannel): string {
  if (channel === "whatsapp") return "loyalty.whatsappComposeTitle";
  if (channel === "telegram") return "loyalty.telegramComposeTitle";
  if (channel === "wallet") return "loyalty.walletComposeTitle";
  return "loyalty.webpushComposeTitle";
}

export function LoyaltyMemberBlastModals({
  selectedCount,
  pickerOpen,
  composeChannel,
  preview,
  previewLoading,
  previewError,
  sending,
  sendError,
  sendResult,
  onClosePicker,
  onPickChannel,
  onCloseCompose,
  onSend,
}: {
  selectedCount: number;
  pickerOpen: boolean;
  composeChannel: GuestBlastChannel | null;
  preview: GuestBlastPreviewResponse | null;
  previewLoading: boolean;
  previewError: string | null;
  sending: boolean;
  sendError: string | null;
  sendResult: BlastResult | null;
  onClosePicker: () => void;
  onPickChannel: (channel: GuestBlastChannel) => void;
  onCloseCompose: () => void;
  onSend: (payload: BlastSendPayload) => void;
}) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMessage("");
    setTitle("");
    setUrl("");
  }, [composeChannel]);

  if (!mounted) return null;

  const composeReachable = composeChannel
    ? preview?.channels[composeChannel]?.reachable ?? 0
    : 0;

  return (
    <>
      {pickerOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="loyalty-blast-picker-title"
              onClick={onClosePicker}
            >
              <div
                className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-background shadow-xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3 sm:px-5">
                  <div>
                    <h2 id="loyalty-blast-picker-title" className="text-lg font-semibold">
                      {t("loyalty.blastPickerTitle")}
                    </h2>
                    <p className="mt-0.5 text-sm text-foreground/60">
                      {t("loyalty.blastPickerHint", { count: String(selectedCount) })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-sm text-foreground/55 hover:bg-foreground/5"
                    onClick={onClosePicker}
                  >
                    {t("common.close")}
                  </button>
                </div>
                <div className="space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
                  {previewLoading ? (
                    <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
                  ) : null}
                  {previewError ? (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {previewError}
                    </p>
                  ) : null}
                  {CHANNELS.map((channel) => {
                    const info = preview?.channels[channel];
                    const reachable = info?.reachable ?? 0;
                    const ready = info?.restaurantReady ?? false;
                    const disabled = !ready || reachable === 0;
                    return (
                      <button
                        key={channel}
                        type="button"
                        disabled={disabled || previewLoading}
                        onClick={() => onPickChannel(channel)}
                        className="flex w-full items-start justify-between gap-3 rounded-xl border border-foreground/10 px-4 py-3 text-left hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span>
                          <span className="block text-sm font-medium">
                            {t(channelTitleKey(channel))}
                          </span>
                          <span className="mt-0.5 block text-xs text-foreground/60">
                            {t("loyalty.blastReachable", {
                              reachable: String(reachable),
                              selected: String(selectedCount),
                            })}
                          </span>
                          {!ready ? (
                            <span className="mt-1 block text-xs text-amber-800 dark:text-amber-200">
                              {t("loyalty.blastChannelNotReady")}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {composeChannel
        ? createPortal(
            <div
              className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="loyalty-blast-compose-title"
              onClick={onCloseCompose}
            >
              <div
                className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-background shadow-xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3 sm:px-5">
                  <div>
                    <h2 id="loyalty-blast-compose-title" className="text-lg font-semibold">
                      {t(channelTitleKey(composeChannel))}
                    </h2>
                    <p className="mt-0.5 text-sm text-foreground/60">
                      {t("loyalty.blastComposeHint", {
                        count: String(composeReachable),
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-sm text-foreground/55 hover:bg-foreground/5"
                    onClick={onCloseCompose}
                  >
                    {t("common.close")}
                  </button>
                </div>
                <div className="space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
                  {composeChannel === "webpush" ? (
                    <>
                      <label className="flex flex-col gap-1 text-xs text-foreground/70">
                        {t("loyalty.webpushTitle")}
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          maxLength={120}
                          className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                          placeholder={t("loyalty.webpushTitlePlaceholder")}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-foreground/70">
                        {t("loyalty.webpushBody")}
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          maxLength={4096}
                          className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                          placeholder={t("loyalty.webpushBodyPlaceholder")}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-foreground/70">
                        {t("loyalty.webpushUrl")}
                        <input
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                          placeholder="/"
                        />
                      </label>
                    </>
                  ) : (
                    <label className="flex flex-col gap-1 text-xs text-foreground/70">
                      {composeChannel === "wallet"
                        ? t("loyalty.walletMessage")
                        : t("loyalty.whatsappMessage")}
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        maxLength={composeChannel === "wallet" ? 256 : 4096}
                        className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                        placeholder={
                          composeChannel === "telegram"
                            ? t("loyalty.telegramMessagePlaceholder")
                            : composeChannel === "wallet"
                              ? t("loyalty.walletMessagePlaceholder")
                              : t("loyalty.whatsappMessagePlaceholder")
                        }
                      />
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={sending || composeReachable === 0}
                      onClick={() =>
                        onSend({
                          channel: composeChannel,
                          message,
                          ...(composeChannel === "webpush" ? { title, url } : {}),
                        })
                      }
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {sending ? t("loyalty.blastSending") : t("loyalty.blastSend")}
                    </button>
                    <button
                      type="button"
                      onClick={onCloseCompose}
                      className="rounded-lg border border-foreground/15 px-4 py-2 text-sm hover:bg-foreground/5"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                  {sendError ? (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {sendError}
                    </p>
                  ) : null}
                  {sendResult ? (
                    <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                      {t("loyalty.whatsappSendResult", {
                        targeted: String(sendResult.targeted),
                        succeeded: String(sendResult.succeeded),
                        failed: String(sendResult.failed),
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
