"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Location } from "@/lib/auth-api/types/locations";
import type {
  LoyaltySegmentKey,
  LoyaltySegmentSummary,
  WalletPassConfig,
  WalletPassConfigInput,
  WalletPassLocation,
} from "@/lib/loyalty-api";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

const COLOR_PRESETS = ["dark", "blue", "green", "red", "purple", "orange"] as const;

type Draft = {
  enabled: boolean;
  organizationName: string;
  logoText: string;
  description: string;
  programTitle: string;
  pointsLabel: string;
  memberNameLabel: string;
  colorPreset: (typeof COLOR_PRESETS)[number];
  color: string;
  logoURL: string;
  stripURL: string;
  iconURL: string;
  locations: WalletPassLocation[];
};

function configToDraft(config: WalletPassConfig): Draft {
  return {
    enabled: config.enabled,
    organizationName: config.organizationName,
    logoText: config.logoText,
    description: config.description,
    programTitle: config.programTitle,
    pointsLabel: config.pointsLabel || "POINTS",
    memberNameLabel: config.memberNameLabel || "MEMBER",
    colorPreset: config.colorPreset,
    color: config.color ?? "",
    logoURL: config.logoURL ?? "",
    stripURL: config.stripURL ?? "",
    iconURL: config.iconURL ?? "",
    locations: config.locations,
  };
}

function draftToInput(draft: Draft): WalletPassConfigInput {
  return {
    enabled: draft.enabled,
    organizationName: draft.organizationName.trim(),
    logoText: draft.logoText.trim(),
    description: draft.description.trim(),
    programTitle: draft.programTitle.trim(),
    pointsLabel: draft.pointsLabel.trim() || "POINTS",
    memberNameLabel: draft.memberNameLabel.trim() || "MEMBER",
    backFields: [],
    barcodeFormat: "QR",
    colorPreset: draft.colorPreset,
    color: draft.color.trim() || null,
    logoURL: draft.logoURL.trim() || null,
    stripURL: draft.stripURL.trim() || null,
    iconURL: draft.iconURL.trim() || null,
    wideLogoURL: null,
    thumbnailURL: null,
    backgroundURL: null,
    locations: draft.locations.slice(0, 10),
  };
}

export function LoyaltyWalletClient() {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [segments, setSegments] = useState<LoyaltySegmentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [selectedSegments, setSelectedSegments] = useState<LoyaltySegmentKey[]>([]);
  const [requireConsent, setRequireConsent] = useState(true);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [configRes, locRes, segRes] = await Promise.all([
        fetch("/api/settings/loyalty/wallet", { cache: "no-store" }),
        fetch("/api/settings/locations", { cache: "no-store" }),
        fetch("/api/settings/loyalty/segments", { cache: "no-store" }),
      ]);
      if (!configRes.ok) {
        setError(await readErrorMessage(configRes, t("loyalty.walletLoadFailed")));
        return;
      }
      const configData = (await configRes.json()) as { config: WalletPassConfig };
      setDraft(configToDraft(configData.config));
      setError(null);
      setSaved(false);

      if (locRes.ok) {
        const locData = (await locRes.json()) as { locations?: Location[] };
        setLocations(locData.locations ?? []);
      }
      if (segRes.ok) {
        const segData = (await segRes.json()) as { segments?: LoyaltySegmentSummary[] };
        setSegments(segData.segments ?? []);
      }
    } catch {
      setError(t("loyalty.walletLoadFailed"));
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

  const geoLocations = useMemo(
    () =>
      locations.filter(
        (l) =>
          typeof l.latitude === "number" &&
          typeof l.longitude === "number" &&
          Number.isFinite(l.latitude) &&
          Number.isFinite(l.longitude),
      ),
    [locations],
  );

  const selectedLocationIds = useMemo(
    () => new Set((draft?.locations ?? []).map((l) => l.locationId)),
    [draft?.locations],
  );

  function toggleLocation(loc: Location) {
    if (!draft) return;
    if (selectedLocationIds.has(loc.id)) {
      setDraft({
        ...draft,
        locations: draft.locations.filter((l) => l.locationId !== loc.id),
      });
      return;
    }
    if (draft.locations.length >= 10) {
      setError(t("loyalty.walletMaxLocations"));
      return;
    }
    setDraft({
      ...draft,
      locations: [
        ...draft.locations,
        {
          locationId: loc.id,
          latitude: loc.latitude!,
          longitude: loc.longitude!,
          relevantText: loc.name,
        },
      ],
    });
  }

  function updateRelevantText(locationId: string, relevantText: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      locations: draft.locations.map((l) =>
        l.locationId === locationId ? { ...l, relevantText } : l,
      ),
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/loyalty/wallet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToInput(draft)),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.walletSaveFailed")));
        return;
      }
      const data = (await res.json()) as { config: WalletPassConfig };
      setDraft(configToDraft(data.config));
      setSaved(true);
    } catch {
      setError(t("loyalty.walletSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function refreshPreview() {
    setSendResult(null);
    try {
      const params = new URLSearchParams();
      if (selectedSegments.length) {
        params.set("segments", selectedSegments.join(","));
      }
      if (!requireConsent) params.set("requireMarketingConsent", "false");
      const res = await fetch(
        `/api/settings/loyalty/wallet/messages?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.walletPreviewFailed")));
        return;
      }
      const data = (await res.json()) as { count: number };
      setPreviewCount(data.count);
    } catch {
      setError(t("loyalty.walletPreviewFailed"));
    }
  }

  async function sendMarketing(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (!text) {
      setError(t("loyalty.walletMessageRequired"));
      return;
    }
    if (!window.confirm(t("loyalty.walletSendConfirm"))) return;
    setSending(true);
    setSendResult(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/loyalty/wallet/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          segmentKeys: selectedSegments,
          requireMarketingConsent: requireConsent,
        }),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.walletSendFailed")));
        return;
      }
      const data = (await res.json()) as {
        targeted: number;
        succeeded: number;
        failed: number;
      };
      setSendResult(
        t("loyalty.walletSendResult")
          .replace("{targeted}", String(data.targeted))
          .replace("{succeeded}", String(data.succeeded))
          .replace("{failed}", String(data.failed)),
      );
      setMessage("");
      await refreshPreview();
    } catch {
      setError(t("loyalty.walletSendFailed"));
    } finally {
      setSending(false);
    }
  }

  function toggleSegment(key: LoyaltySegmentKey) {
    setSelectedSegments((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
    setPreviewCount(null);
  }

  if (!draft) {
    return (
      <p className="text-sm text-foreground/60">
        {error ?? t("loyalty.walletLoading")}
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <form onSubmit={(e) => void save(e)} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("loyalty.walletDesignTitle")}</h2>
            <p className="mt-1 text-sm text-foreground/60">{t("loyalty.walletDesignHint")}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            {t("loyalty.walletEnabled")}
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletOrgName")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.organizationName}
              onChange={(e) => setDraft({ ...draft, organizationName: e.target.value })}
              maxLength={64}
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletLogoText")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.logoText}
              onChange={(e) => setDraft({ ...draft, logoText: e.target.value })}
              maxLength={64}
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletProgramTitle")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.programTitle}
              onChange={(e) => setDraft({ ...draft, programTitle: e.target.value })}
              maxLength={64}
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletColorPreset")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.colorPreset}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  colorPreset: e.target.value as Draft["colorPreset"],
                })
              }
            >
              {COLOR_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletColor")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              placeholder="#1e40af"
              maxLength={7}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-foreground/60">{t("loyalty.walletDescription")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              maxLength={128}
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletPointsLabel")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.pointsLabel}
              onChange={(e) => setDraft({ ...draft, pointsLabel: e.target.value })}
              maxLength={64}
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletMemberLabel")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.memberNameLabel}
              onChange={(e) => setDraft({ ...draft, memberNameLabel: e.target.value })}
              maxLength={64}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-foreground/60">{t("loyalty.walletLogoUrl")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.logoURL}
              onChange={(e) => setDraft({ ...draft, logoURL: e.target.value })}
              placeholder="https://"
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletStripUrl")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.stripURL}
              onChange={(e) => setDraft({ ...draft, stripURL: e.target.value })}
              placeholder="https://"
            />
          </label>
          <label className="text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletIconUrl")}</span>
            <input
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              value={draft.iconURL}
              onChange={(e) => setDraft({ ...draft, iconURL: e.target.value })}
              placeholder="https://"
            />
          </label>
        </div>

        <div>
          <h3 className="text-base font-medium">{t("loyalty.walletLocationsTitle")}</h3>
          <p className="mt-1 text-sm text-foreground/60">{t("loyalty.walletLocationsHint")}</p>
          {geoLocations.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/50">{t("loyalty.walletNoGeoLocations")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {geoLocations.map((loc) => {
                const selected = selectedLocationIds.has(loc.id);
                const row = draft.locations.find((l) => l.locationId === loc.id);
                return (
                  <li
                    key={loc.id}
                    className="rounded-lg border border-foreground/10 px-3 py-2"
                  >
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected}
                        onChange={() => toggleLocation(loc)}
                      />
                      <span className="flex-1">
                        <span className="font-medium">{loc.name}</span>
                        <span className="mt-0.5 block text-foreground/50">
                          {loc.latitude!.toFixed(5)}, {loc.longitude!.toFixed(5)}
                        </span>
                      </span>
                    </label>
                    {selected && row ? (
                      <input
                        className="mt-2 w-full rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-sm"
                        value={row.relevantText ?? ""}
                        onChange={(e) => updateRelevantText(loc.id, e.target.value)}
                        placeholder={t("loyalty.walletRelevantText")}
                        maxLength={128}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? t("loyalty.walletSaving") : t("loyalty.walletSave")}
          </button>
          {saved ? (
            <span className="text-sm text-emerald-600 dark:text-emerald-300">
              {t("loyalty.walletSaved")}
            </span>
          ) : null}
        </div>
      </form>

      <section className="border-t border-foreground/10 pt-8">
        <h2 className="text-lg font-semibold">{t("loyalty.walletMarketingTitle")}</h2>
        <p className="mt-1 text-sm text-foreground/60">{t("loyalty.walletMarketingHint")}</p>

        <form onSubmit={(e) => void sendMarketing(e)} className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="block text-foreground/60">{t("loyalty.walletMessage")}</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2"
              rows={3}
              maxLength={256}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <span className="mt-1 block text-xs text-foreground/45">
              {message.length}/256
            </span>
          </label>

          <div>
            <p className="text-sm text-foreground/60">{t("loyalty.walletSegments")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {segments.map((seg) => {
                const key = seg.key as LoyaltySegmentKey;
                const active = selectedSegments.includes(key);
                return (
                  <button
                    key={seg.key}
                    type="button"
                    onClick={() => toggleSegment(key)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/20 text-foreground/70"
                    }`}
                  >
                    {seg.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={requireConsent}
              onChange={(e) => {
                setRequireConsent(e.target.checked);
                setPreviewCount(null);
              }}
            />
            {t("loyalty.walletRequireConsent")}
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshPreview()}
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm"
            >
              {t("loyalty.walletPreview")}
            </button>
            {previewCount !== null ? (
              <span className="text-sm text-foreground/60">
                {t("loyalty.walletPreviewCount").replace("{count}", String(previewCount))}
              </span>
            ) : null}
            <button
              type="submit"
              disabled={sending || !draft.enabled}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {sending ? t("loyalty.walletSending") : t("loyalty.walletSend")}
            </button>
          </div>
          {sendResult ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-300">{sendResult}</p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
