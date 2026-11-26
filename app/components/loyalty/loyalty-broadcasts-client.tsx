"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  MarketingCampaign,
  MarketingCampaignFilters,
  MarketingCampaignPreview,
} from "@/lib/loyalty-api/marketing-campaigns";
import type { WhatsappChannelView } from "@/lib/loyalty-api/whatsapp-channels";
import { useI18n } from "../i18n-provider";

type WizardStep = 1 | 2 | 3 | 4;

type AudienceDraft = {
  q: string;
  marketingConsent: "" | "true" | "false";
  lastVisitedFrom: string;
  lastVisitedTo: string;
  minVisits: string;
  maxVisits: string;
  minBalance: string;
  maxBalance: string;
};

const DEFAULT_AUDIENCE: AudienceDraft = {
  q: "",
  marketingConsent: "true",
  lastVisitedFrom: "",
  lastVisitedTo: "",
  minVisits: "",
  maxVisits: "",
  minBalance: "",
  maxBalance: "",
};

type SessionPayload = {
  status?: string;
  channel?: WhatsappChannelView | null;
  message?: string;
};

type QrPayload = {
  status?: string;
  qr?: string | null;
  channel?: WhatsappChannelView | null;
};

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function parseNonNegInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function draftToFilters(draft: AudienceDraft): MarketingCampaignFilters {
  const filters: MarketingCampaignFilters = { status: "active" };
  if (draft.q.trim()) filters.q = draft.q.trim();
  if (draft.marketingConsent === "true") filters.marketingConsent = true;
  if (draft.marketingConsent === "false") filters.marketingConsent = false;
  if (draft.lastVisitedFrom.trim()) filters.lastVisitedFrom = draft.lastVisitedFrom.trim();
  if (draft.lastVisitedTo.trim()) filters.lastVisitedTo = draft.lastVisitedTo.trim();
  const minVisits = parseNonNegInt(draft.minVisits);
  const maxVisits = parseNonNegInt(draft.maxVisits);
  const minBalance = parseNonNegInt(draft.minBalance);
  const maxBalance = parseNonNegInt(draft.maxBalance);
  if (minVisits != null) filters.minVisits = minVisits;
  if (maxVisits != null) filters.maxVisits = maxVisits;
  if (minBalance != null) filters.minBalance = minBalance;
  if (maxBalance != null) filters.maxBalance = maxBalance;
  return filters;
}

function isActive(channel: WhatsappChannelView | null | undefined): boolean {
  return channel?.status === "active";
}

function needsReauth(channel: WhatsappChannelView): boolean {
  return channel.status === "needs_reauth" || channel.status === "error";
}

function successRate(c: MarketingCampaign): string {
  if (c.targeted <= 0) return "—";
  return `${Math.round((c.succeeded / c.targeted) * 100)}%`;
}

function formatWhen(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function LoyaltyBroadcastsClient() {
  const { t, locale } = useI18n();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [mounted, setMounted] = useState(false);

  const [whatsappChannel, setWhatsappChannel] = useState<WhatsappChannelView | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState<string | null>(null);
  const [whatsappPending, setWhatsappPending] = useState(false);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const qrPoll = useRef<number | null>(null);

  const [audience, setAudience] = useState<AudienceDraft>(DEFAULT_AUDIENCE);
  const [preview, setPreview] = useState<MarketingCampaignPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<MarketingCampaign | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopQrPoll = useCallback(() => {
    if (qrPoll.current != null) {
      window.clearInterval(qrPoll.current);
      qrPoll.current = null;
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/settings/loyalty/marketing-campaigns");
      if (!res.ok) {
        setListError(await readErrorMessage(res, t("broadcasts.loadFailed")));
        setCampaigns([]);
        return;
      }
      const data = (await res.json()) as { campaigns?: MarketingCampaign[] };
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
    } catch {
      setListError(t("broadcasts.loadFailed"));
      setCampaigns([]);
    } finally {
      setListLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const loadMarketingWhatsapp = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/loyalty/whatsapp/status?purpose=marketing");
      const payload = (await res.json().catch(() => null)) as SessionPayload | null;
      const channel = payload?.channel ?? null;
      setWhatsappChannel(channel && channel.type === "whatsapp" ? channel : null);
      if (payload?.status === "WORKING" && channel) {
        const previewRes = await fetch("/api/settings/loyalty/marketing-campaigns/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filters: { status: "active" } }),
        });
        const previewData = (await previewRes.json().catch(() => null)) as MarketingCampaignPreview | null;
        setWhatsappPhone(previewData?.senderPhoneE164 ?? channel.displayName);
      } else {
        setWhatsappPhone(null);
      }
    } catch {
      setWhatsappChannel(null);
      setWhatsappPhone(null);
    }
  }, []);

  const refreshQr = useCallback(async () => {
    const res = await fetch("/api/settings/loyalty/whatsapp/qr?purpose=marketing");
    const payload = (await res.json().catch(() => null)) as QrPayload | null;
    if (payload?.status === "WORKING") {
      stopQrPoll();
      setQrOpen(false);
      setQrDataUrl(null);
      setWhatsappPending(false);
      await loadMarketingWhatsapp();
      return;
    }
    if (payload?.qr) {
      setQrDataUrl(
        payload.qr.startsWith("data:") ? payload.qr : `data:image/png;base64,${payload.qr}`,
      );
    }
  }, [loadMarketingWhatsapp, stopQrPoll]);

  const startQrFlow = useCallback(async () => {
    stopQrPoll();
    setQrOpen(true);
    setQrDataUrl(null);
    await refreshQr();
    qrPoll.current = window.setInterval(() => {
      void refreshQr();
      void fetch("/api/settings/loyalty/whatsapp/status?purpose=marketing")
        .then((res) => res.json() as Promise<SessionPayload>)
        .then((payload) => {
          if (payload.status === "WORKING") {
            stopQrPoll();
            setQrOpen(false);
            setQrDataUrl(null);
            setWhatsappPending(false);
            void loadMarketingWhatsapp();
          }
        })
        .catch(() => undefined);
    }, 2500);
  }, [loadMarketingWhatsapp, refreshQr, stopQrPoll]);

  async function connectWhatsapp() {
    setWhatsappPending(true);
    setWhatsappError(null);
    try {
      const url =
        whatsappChannel && needsReauth(whatsappChannel)
          ? `/api/settings/loyalty/whatsapp/connections/${encodeURIComponent(whatsappChannel.id)}/reauth`
          : "/api/settings/loyalty/whatsapp/session";
      const start = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "marketing" }),
      });
      const payload = (await start.json().catch(() => null)) as SessionPayload | null;
      if (!start.ok) {
        setWhatsappError(payload?.message || t("broadcasts.whatsappConnectFailed"));
        setWhatsappPending(false);
        return;
      }
      if (payload?.status === "WORKING") {
        await loadMarketingWhatsapp();
        setWhatsappPending(false);
        return;
      }
      await startQrFlow();
    } catch {
      setWhatsappError(t("broadcasts.whatsappConnectFailed"));
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
        setWhatsappError(await readErrorMessage(res, t("broadcasts.whatsappConnectFailed")));
        return;
      }
      await loadMarketingWhatsapp();
    } catch {
      setWhatsappError(t("broadcasts.whatsappConnectFailed"));
    } finally {
      setWhatsappPending(false);
    }
  }

  function openWizard() {
    setWizardOpen(true);
    setStep(1);
    setAudience(DEFAULT_AUDIENCE);
    setPreview(null);
    setPreviewError(null);
    setMessage("");
    setSendError(null);
    setSendResult(null);
    setWhatsappError(null);
    void loadMarketingWhatsapp();
  }

  function closeWizard() {
    stopQrPoll();
    setQrOpen(false);
    setQrDataUrl(null);
    setWhatsappPending(false);
    setWizardOpen(false);
  }

  async function runPreview(): Promise<MarketingCampaignPreview | null> {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/settings/loyalty/marketing-campaigns/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filters: draftToFilters(audience) }),
      });
      if (!res.ok) {
        setPreviewError(await readErrorMessage(res, t("broadcasts.previewFailed")));
        setPreview(null);
        return null;
      }
      const data = (await res.json()) as MarketingCampaignPreview;
      setPreview(data);
      if (data.senderPhoneE164) setWhatsappPhone(data.senderPhoneE164);
      return data;
    } catch {
      setPreviewError(t("broadcasts.previewFailed"));
      setPreview(null);
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendCampaign() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/settings/loyalty/marketing-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filters: draftToFilters(audience),
          message,
        }),
      });
      if (!res.ok) {
        setSendError(await readErrorMessage(res, t("broadcasts.sendFailed")));
        return;
      }
      const data = (await res.json()) as { campaign: MarketingCampaign };
      setSendResult(data.campaign);
      await loadCampaigns();
    } catch {
      setSendError(t("broadcasts.sendFailed"));
    } finally {
      setSending(false);
    }
  }

  const marketingReady = isActive(whatsappChannel) || Boolean(preview?.marketingReady);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/60">{t("broadcasts.listHint")}</p>
        <button
          type="button"
          onClick={openWizard}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {t("broadcasts.newCampaign")}
        </button>
      </div>

      {listError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {listError}
        </p>
      ) : null}

      {listLoading ? (
        <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 px-4 py-10 text-center">
          <p className="text-sm text-foreground/60">{t("broadcasts.empty")}</p>
          <button
            type="button"
            onClick={openWizard}
            className="mt-4 rounded-lg border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            {t("broadcasts.newCampaign")}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase tracking-wide text-foreground/55">
              <tr>
                <th className="px-3 py-2.5 font-medium">{t("broadcasts.colWhen")}</th>
                <th className="px-3 py-2.5 font-medium">{t("broadcasts.colSender")}</th>
                <th className="px-3 py-2.5 font-medium">{t("broadcasts.colMessage")}</th>
                <th className="px-3 py-2.5 font-medium">{t("broadcasts.colTargeted")}</th>
                <th className="px-3 py-2.5 font-medium">{t("broadcasts.colSucceeded")}</th>
                <th className="px-3 py-2.5 font-medium">{t("broadcasts.colFailed")}</th>
                <th className="px-3 py-2.5 font-medium">{t("broadcasts.colRate")}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-foreground/5 last:border-0">
                  <td className="whitespace-nowrap px-3 py-3 text-foreground/80">
                    {formatWhen(c.createdAt, locale)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-foreground/70">
                    {c.senderPhoneE164 || "—"}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-3" title={c.message}>
                    {c.message}
                  </td>
                  <td className="px-3 py-3">{c.targeted}</td>
                  <td className="px-3 py-3 text-emerald-700 dark:text-emerald-300">{c.succeeded}</td>
                  <td className="px-3 py-3 text-red-700 dark:text-red-300">{c.failed}</td>
                  <td className="px-3 py-3 font-medium">{successRate(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mounted && wizardOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="broadcast-wizard-title"
              onClick={closeWizard}
            >
              <div
                className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-foreground/10 bg-background shadow-xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3 sm:px-5">
                  <div>
                    <h2 id="broadcast-wizard-title" className="text-lg font-semibold">
                      {t("broadcasts.wizardTitle")}
                    </h2>
                    <p className="mt-0.5 text-sm text-foreground/60">
                      {t("broadcasts.stepOf", { step: String(step), total: "4" })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-sm text-foreground/55 hover:bg-foreground/5"
                    onClick={closeWizard}
                  >
                    {t("common.close")}
                  </button>
                </div>

                <div className="flex gap-1 border-b border-foreground/10 px-4 py-2 sm:px-5">
                  {([1, 2, 3, 4] as WizardStep[]).map((s) => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full ${s <= step ? "bg-foreground" : "bg-foreground/10"}`}
                    />
                  ))}
                </div>

                <div className="overflow-y-auto px-4 py-4 sm:px-5">
                  {step === 1 ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium">{t("broadcasts.stepPhoneTitle")}</h3>
                        <p className="mt-1 text-sm text-foreground/60">
                          {t("broadcasts.stepPhoneHint")}
                        </p>
                      </div>
                      {whatsappError ? (
                        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                          {whatsappError}
                        </p>
                      ) : null}
                      {isActive(whatsappChannel) ? (
                        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            {t("broadcasts.phoneConnected")}
                          </p>
                          <p className="mt-1 text-sm text-foreground/70">
                            {whatsappPhone || whatsappChannel?.displayName || "—"}
                          </p>
                          <button
                            type="button"
                            disabled={whatsappPending}
                            onClick={() => void disconnectWhatsapp()}
                            className="mt-3 rounded-lg border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/5 disabled:opacity-40"
                          >
                            {t("loyalty.whatsappLinkDisconnect")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={whatsappPending}
                          onClick={() => void connectWhatsapp()}
                          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
                        >
                          {whatsappPending
                            ? t("loyalty.whatsappLinkConnecting")
                            : t("broadcasts.connectMarketingPhone")}
                        </button>
                      )}
                      {qrOpen ? (
                        <div className="space-y-3 rounded-xl border border-foreground/10 p-4">
                          <p className="text-sm text-foreground/70">{t("loyalty.whatsappLinkQrBody")}</p>
                          {qrDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={qrDataUrl}
                              alt="QR"
                              className="mx-auto h-48 w-48 rounded-lg bg-white p-2"
                            />
                          ) : (
                            <p className="text-sm text-foreground/50">{t("loyalty.loading")}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              stopQrPoll();
                              setQrOpen(false);
                              setQrDataUrl(null);
                              setWhatsappPending(false);
                            }}
                            className="text-sm text-foreground/60 underline"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium">{t("broadcasts.stepAudienceTitle")}</h3>
                        <p className="mt-1 text-sm text-foreground/60">
                          {t("broadcasts.stepAudienceHint")}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-xs text-foreground/70 sm:col-span-2">
                          {t("loyalty.search")}
                          <input
                            value={audience.q}
                            onChange={(e) => setAudience((a) => ({ ...a, q: e.target.value }))}
                            className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-foreground/70">
                          {t("loyalty.marketingFilter")}
                          <select
                            value={audience.marketingConsent}
                            onChange={(e) =>
                              setAudience((a) => ({
                                ...a,
                                marketingConsent: e.target.value as AudienceDraft["marketingConsent"],
                              }))
                            }
                            className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                          >
                            <option value="">{t("loyalty.filterAny")}</option>
                            <option value="true">{t("loyalty.filterYes")}</option>
                            <option value="false">{t("loyalty.filterNo")}</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-foreground/70">
                          {t("loyalty.lastVisitedFrom")}
                          <input
                            type="date"
                            value={audience.lastVisitedFrom}
                            onChange={(e) =>
                              setAudience((a) => ({ ...a, lastVisitedFrom: e.target.value }))
                            }
                            className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-foreground/70">
                          {t("loyalty.lastVisitedTo")}
                          <input
                            type="date"
                            value={audience.lastVisitedTo}
                            onChange={(e) =>
                              setAudience((a) => ({ ...a, lastVisitedTo: e.target.value }))
                            }
                            className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-foreground/70">
                          {t("loyalty.minVisits")}
                          <input
                            type="number"
                            min={0}
                            value={audience.minVisits}
                            onChange={(e) =>
                              setAudience((a) => ({ ...a, minVisits: e.target.value }))
                            }
                            className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-foreground/70">
                          {t("loyalty.maxVisits")}
                          <input
                            type="number"
                            min={0}
                            value={audience.maxVisits}
                            onChange={(e) =>
                              setAudience((a) => ({ ...a, maxVisits: e.target.value }))
                            }
                            className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-foreground/70">
                          {t("loyalty.minBalance")}
                          <input
                            type="number"
                            min={0}
                            value={audience.minBalance}
                            onChange={(e) =>
                              setAudience((a) => ({ ...a, minBalance: e.target.value }))
                            }
                            className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-foreground/70">
                          {t("loyalty.maxBalance")}
                          <input
                            type="number"
                            min={0}
                            value={audience.maxBalance}
                            onChange={(e) =>
                              setAudience((a) => ({ ...a, maxBalance: e.target.value }))
                            }
                            className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        disabled={previewLoading}
                        onClick={() => void runPreview()}
                        className="rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-40"
                      >
                        {previewLoading ? t("loyalty.loading") : t("broadcasts.refreshPreview")}
                      </button>
                      {previewError ? (
                        <p className="text-sm text-red-600 dark:text-red-300">{previewError}</p>
                      ) : null}
                      {preview ? (
                        <p className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-sm">
                          {t("broadcasts.audiencePreview", {
                            matching: String(preview.matching),
                            reachable: String(preview.reachable),
                          })}
                          {preview.capped ? ` ${t("broadcasts.audienceCapped")}` : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium">{t("broadcasts.stepMessageTitle")}</h3>
                        <p className="mt-1 text-sm text-foreground/60">
                          {t("broadcasts.stepMessageHint", {
                            count: String(preview?.reachable ?? 0),
                          })}
                        </p>
                      </div>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={6}
                        maxLength={4096}
                        className="w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                        placeholder={t("broadcasts.messagePlaceholder")}
                      />
                      <p className="text-xs text-foreground/50">{message.length}/4096</p>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium">{t("broadcasts.stepConfirmTitle")}</h3>
                        <p className="mt-1 text-sm text-foreground/60">
                          {t("broadcasts.stepConfirmHint")}
                        </p>
                      </div>
                      <dl className="space-y-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-foreground/55">{t("broadcasts.colSender")}</dt>
                          <dd>{whatsappPhone || "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-foreground/55">{t("broadcasts.colTargeted")}</dt>
                          <dd>{preview?.reachable ?? 0}</dd>
                        </div>
                        <div>
                          <dt className="text-foreground/55">{t("broadcasts.colMessage")}</dt>
                          <dd className="mt-1 whitespace-pre-wrap">{message}</dd>
                        </div>
                      </dl>
                      {sendError ? (
                        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                          {sendError}
                        </p>
                      ) : null}
                      {sendResult ? (
                        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
                          {t("broadcasts.sendSuccess", {
                            succeeded: String(sendResult.succeeded),
                            failed: String(sendResult.failed),
                            targeted: String(sendResult.targeted),
                          })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-foreground/10 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    disabled={step === 1 || sending}
                    onClick={() => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))}
                    className="rounded-lg border border-foreground/15 px-3 py-2 text-sm hover:bg-foreground/5 disabled:opacity-40"
                  >
                    {t("common.back")}
                  </button>
                  <div className="flex gap-2">
                    {step < 4 ? (
                      <button
                        type="button"
                        disabled={
                          (step === 1 && !marketingReady) ||
                          (step === 2 &&
                            (previewLoading ||
                              (preview != null && preview.reachable < 1))) ||
                          (step === 3 && message.trim().length < 1)
                        }
                        onClick={() => {
                          if (step === 1) {
                            setStep(2);
                            void runPreview();
                            return;
                          }
                          if (step === 2) {
                            const go = async () => {
                              const next = preview ?? (await runPreview());
                              if (!next || next.reachable < 1) return;
                              setStep(3);
                            };
                            void go();
                            return;
                          }
                          setStep(4);
                        }}
                        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
                      >
                        {t("common.continue")}
                      </button>
                    ) : sendResult ? (
                      <button
                        type="button"
                        onClick={closeWizard}
                        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
                      >
                        {t("common.done")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={sending || !preview || preview.reachable < 1}
                        onClick={() => void sendCampaign()}
                        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
                      >
                        {sending ? t("broadcasts.sending") : t("broadcasts.send")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
