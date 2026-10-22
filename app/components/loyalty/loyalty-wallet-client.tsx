"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Location } from "@/lib/auth-api/types/locations";
import { expandR2AssetToPublicUrl } from "@/lib/r2-object-key";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import type {
  LoyaltySegmentKey,
  LoyaltySegmentSummary,
  WalletFeaturedAction,
  WalletPassConfig,
  WalletPassConfigInput,
  WalletPassField,
  WalletPassLocation,
} from "@/lib/loyalty-api";
import { useI18n } from "../i18n-provider";
import {
  ACTION_LABELS,
  WalletPassPreview,
  type PreviewPlatform,
} from "./wallet-pass-preview";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

const COLOR_PRESETS = ["dark", "blue", "green", "red", "purple", "orange"] as const;
const BARCODE_FORMATS = ["QR", "PDF417", "Aztec", "Code128"] as const;
const FEATURED_TYPES = Object.keys(ACTION_LABELS);

type EditorTab = "content" | "barcode" | "style";
type PreviewMode = "preview" | "code";

type Draft = {
  enabled: boolean;
  organizationName: string;
  logoText: string;
  description: string;
  primaryFields: WalletPassField[];
  secondaryFields: WalletPassField[];
  headerFields: WalletPassField[];
  footerFields: WalletPassField[];
  backFields: WalletPassField[];
  featuredActions: WalletFeaturedAction[];
  barcodeFormat: (typeof BARCODE_FORMATS)[number];
  barcodeAltText: string | null;
  colorPreset: (typeof COLOR_PRESETS)[number];
  color: string;
  logoURL: string;
  stripURL: string;
  iconURL: string;
  wideLogoURL: string;
  thumbnailURL: string;
  backgroundURL: string;
  locations: WalletPassLocation[];
};

function configToDraft(config: WalletPassConfig): Draft {
  return {
    enabled: config.enabled,
    organizationName: config.organizationName,
    logoText: config.logoText,
    description: config.description,
    primaryFields:
      config.primaryFields?.length > 0
        ? config.primaryFields
        : [{ label: "CARD", value: config.programTitle || "Loyalty Card" }],
    secondaryFields:
      config.secondaryFields?.length > 0
        ? config.secondaryFields
        : [{ label: config.memberNameLabel || "MEMBER", value: "{{name}}" }],
    headerFields:
      config.headerFields?.length > 0
        ? config.headerFields
        : [{ label: config.pointsLabel || "POINTS", value: "{{balance}}" }],
    footerFields: config.footerFields ?? [],
    backFields: config.backFields ?? [],
    featuredActions: config.featuredActions ?? [],
    barcodeFormat: config.barcodeFormat,
    barcodeAltText: config.barcodeAltText,
    colorPreset: config.colorPreset,
    color: config.color ?? "",
    logoURL: config.logoURL ?? "",
    stripURL: config.stripURL ?? "",
    iconURL: config.iconURL ?? "",
    wideLogoURL: config.wideLogoURL ?? "",
    thumbnailURL: config.thumbnailURL ?? "",
    backgroundURL: config.backgroundURL ?? "",
    locations: config.locations ?? [],
  };
}

function draftToInput(draft: Draft): WalletPassConfigInput {
  return {
    enabled: draft.enabled,
    organizationName: draft.organizationName.trim(),
    logoText: draft.logoText.trim(),
    description: draft.description.trim(),
    programTitle: draft.primaryFields[0]?.value?.trim() || "Loyalty Card",
    pointsLabel: draft.headerFields[0]?.label?.trim() || "POINTS",
    memberNameLabel: draft.secondaryFields[0]?.label?.trim() || "MEMBER",
    primaryFields: draft.primaryFields,
    secondaryFields: draft.secondaryFields,
    headerFields: draft.headerFields,
    footerFields: draft.footerFields,
    backFields: draft.backFields,
    featuredActions: draft.featuredActions,
    barcodeFormat: draft.barcodeFormat,
    barcodeAltText: draft.barcodeAltText,
    colorPreset: draft.colorPreset,
    color: draft.color.trim() || null,
    logoURL: draft.logoURL.trim() || null,
    stripURL: draft.stripURL.trim() || null,
    iconURL: draft.iconURL.trim() || null,
    wideLogoURL: draft.wideLogoURL.trim() || null,
    thumbnailURL: draft.thumbnailURL.trim() || null,
    backgroundURL: draft.backgroundURL.trim() || null,
    locations: draft.locations.slice(0, 10),
  };
}

function publicBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");
}

async function uploadToPublicUrl(file: File): Promise<string> {
  const key = await uploadFileToR2(file, "location-logo");
  const base = publicBaseUrl();
  const expanded = expandR2AssetToPublicUrl(key, base) || key;
  if (!/^https:\/\//i.test(expanded)) {
    throw new Error("Upload needs a public HTTPS CDN URL (set NEXT_PUBLIC_R2_PUBLIC_BASE_URL)");
  }
  return expanded;
}

function FieldListEditor({
  title,
  hint,
  fields,
  onChange,
  max = 10,
}: {
  title: string;
  hint: string;
  fields: WalletPassField[];
  onChange: (next: WalletPassField[]) => void;
  max?: number;
}) {
  return (
    <section className="space-y-2 border-t border-foreground/10 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-foreground/50">{hint}</p>
        </div>
        <button
          type="button"
          disabled={fields.length >= max}
          onClick={() => onChange([...fields, { label: "", value: "" }])}
          className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/5 disabled:opacity-30"
          aria-label="Add field"
        >
          <Plus size={16} />
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/15 px-3 py-4 text-center text-xs text-foreground/40">
          No fields
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, index) => (
            <li key={index} className="flex items-start gap-2">
              <input
                className="w-[38%] rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                placeholder="Label"
                value={field.label ?? ""}
                onChange={(e) => {
                  const next = [...fields];
                  next[index] = { ...field, label: e.target.value };
                  onChange(next);
                }}
              />
              <input
                className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                placeholder="Value"
                value={field.value}
                onChange={(e) => {
                  const next = [...fields];
                  next[index] = { ...field, value: e.target.value };
                  onChange(next);
                }}
              />
              <button
                type="button"
                onClick={() => onChange(fields.filter((_, i) => i !== index))}
                className="rounded-md p-2 text-foreground/45 hover:bg-foreground/5 hover:text-red-600"
                aria-label="Remove field"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ImageSlot({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [showUrl, setShowUrl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="space-y-2 border-t border-foreground/10 pt-4">
      <div>
        <h3 className="text-sm font-semibold">{label}</h3>
        <p className="text-xs text-foreground/50">{hint}</p>
      </div>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-foreground/12 bg-foreground/[0.02] p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="size-14 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-foreground/70">{value}</p>
            <div className="mt-2 flex gap-2">
              <label className="cursor-pointer rounded-md border border-foreground/15 px-2.5 py-1 text-xs">
                Replace
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    setError(null);
                    void uploadToPublicUrl(file)
                      .then(onChange)
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : "Upload failed"),
                      )
                      .finally(() => setUploading(false));
                  }}
                />
              </label>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-red-600"
                onClick={() => onChange("")}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/20 bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/55 hover:bg-foreground/[0.04]">
          <span>{uploading ? "Uploading…" : "Browse or drop an image"}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError(null);
              void uploadToPublicUrl(file)
                .then(onChange)
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Upload failed"),
                )
                .finally(() => setUploading(false));
            }}
          />
        </label>
      )}
      <button
        type="button"
        className="text-xs text-foreground/55 underline-offset-2 hover:underline"
        onClick={() => setShowUrl((v) => !v)}
      >
        or paste an image URL
      </button>
      {showUrl ? (
        <input
          className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
          placeholder="https://"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  );
}

export function LoyaltyWalletClient() {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [segments, setSegments] = useState<LoyaltySegmentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>("content");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("preview");
  const [platform, setPlatform] = useState<PreviewPlatform>("apple");

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

  async function save(event?: FormEvent) {
    event?.preventDefault();
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
      if (selectedSegments.length) params.set("segments", selectedSegments.join(","));
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

  if (!draft) {
    return (
      <p className="text-sm text-foreground/60">
        {error ?? t("loyalty.walletLoading")}
      </p>
    );
  }

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: "content", label: "Content" },
    { id: "barcode", label: "Barcode" },
    { id: "style", label: "Style" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            What each field does
          </h1>
          <p className="mt-1 text-sm text-foreground/55">
            Edit any field and see the pass update live
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            {t("loyalty.walletEnabled")}
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? t("loyalty.walletSaving") : t("loyalty.walletSave")}
          </button>
          {saved ? (
            <span className="text-sm text-emerald-600">{t("loyalty.walletSaved")}</span>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Editor */}
        <div className="rounded-2xl border border-foreground/10 bg-background/80 shadow-sm ring-1 ring-foreground/5">
          <div className="flex gap-5 border-b border-foreground/10 px-5">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`border-b-2 py-3 text-sm font-medium transition ${
                  tab === item.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-foreground/45 hover:text-foreground/70"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="max-h-[calc(100dvh-12rem)] space-y-1 overflow-y-auto px-5 py-4">
            {tab === "content" ? (
              <>
                <label className="block space-y-1.5 pb-3">
                  <span className="text-sm font-semibold">Logo Text</span>
                  <input
                    className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                    value={draft.logoText}
                    onChange={(e) => setDraft({ ...draft, logoText: e.target.value })}
                    maxLength={64}
                  />
                  <span className="block text-xs text-foreground/50">
                    Text next to the logo (top-left)
                  </span>
                </label>

                <label className="block space-y-1.5 border-t border-foreground/10 py-3">
                  <span className="text-sm font-semibold">
                    Organization Name <span className="font-normal text-foreground/45">(optional)</span>
                  </span>
                  <input
                    className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                    value={draft.organizationName}
                    onChange={(e) =>
                      setDraft({ ...draft, organizationName: e.target.value })
                    }
                    maxLength={64}
                  />
                  <span className="block text-xs text-foreground/50">
                    Notification title on pass updates. Defaults to your account name.
                  </span>
                </label>

                <FieldListEditor
                  title="Header Fields (top-right)"
                  hint="Visible when the pass is stacked. Use {{balance}} for live points."
                  fields={draft.headerFields}
                  onChange={(headerFields) => setDraft({ ...draft, headerFields })}
                />
                <FieldListEditor
                  title="Primary Fields (main content)"
                  hint="Main content on the pass face."
                  fields={draft.primaryFields}
                  onChange={(primaryFields) => setDraft({ ...draft, primaryFields })}
                />
                <FieldListEditor
                  title="Secondary Fields (below primary)"
                  hint="Use {{name}} for the member’s name."
                  fields={draft.secondaryFields}
                  onChange={(secondaryFields) => setDraft({ ...draft, secondaryFields })}
                />
                <FieldListEditor
                  title="Footer Fields (poster layout)"
                  hint="Up to two short lines along the bottom of the poster layout."
                  fields={draft.footerFields}
                  max={2}
                  onChange={(footerFields) => setDraft({ ...draft, footerFields })}
                />
                <FieldListEditor
                  title="Back Fields (back of pass)"
                  hint="Shown when the guest taps ⓘ."
                  fields={draft.backFields}
                  onChange={(backFields) => setDraft({ ...draft, backFields })}
                />

                <section className="space-y-2 border-t border-foreground/10 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Lock-Screen Locations ({draft.locations.length}/10)
                      </h3>
                      <p className="text-xs text-foreground/50">
                        Wallet shows the pass on the lock screen within ~100m of a
                        coordinate.
                      </p>
                    </div>
                  </div>
                  {geoLocations.length === 0 ? (
                    <p className="text-xs text-foreground/45">
                      {t("loyalty.walletNoGeoLocations")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
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
                                <span className="mt-0.5 block text-xs text-foreground/45">
                                  {loc.latitude!.toFixed(5)}, {loc.longitude!.toFixed(5)}
                                </span>
                              </span>
                            </label>
                            {selected && row ? (
                              <input
                                className="mt-2 w-full rounded-lg border border-foreground/15 bg-background px-3 py-1.5 text-sm"
                                value={row.relevantText ?? ""}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    locations: draft.locations.map((l) =>
                                      l.locationId === loc.id
                                        ? { ...l, relevantText: e.target.value }
                                        : l,
                                    ),
                                  })
                                }
                                placeholder={t("loyalty.walletRelevantText")}
                                maxLength={128}
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="space-y-2 border-t border-foreground/10 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        Featured Actions ({draft.featuredActions.length}/2)
                      </h3>
                      <p className="text-xs text-foreground/50">
                        Up to two buttons under the pass. Apple sets the icon and wording.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={draft.featuredActions.length >= 2}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          featuredActions: [
                            ...draft.featuredActions,
                            {
                              identifier: `action-${draft.featuredActions.length + 1}`,
                              type: "order",
                              url: "https://",
                            },
                          ],
                        })
                      }
                      className="rounded-md p-1.5 text-foreground/60 hover:bg-foreground/5 disabled:opacity-30"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <ul className="space-y-3">
                    {draft.featuredActions.map((action, index) => (
                      <li
                        key={action.identifier}
                        className="space-y-2 rounded-xl border border-foreground/10 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <select
                            className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                            value={action.type}
                            onChange={(e) => {
                              const next = [...draft.featuredActions];
                              next[index] = { ...action, type: e.target.value };
                              setDraft({ ...draft, featuredActions: next });
                            }}
                          >
                            {FEATURED_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {ACTION_LABELS[type] ?? type}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                featuredActions: draft.featuredActions.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                            className="rounded-md p-2 text-foreground/45 hover:text-red-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <input
                          className="w-full rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                          placeholder="https://"
                          value={action.url}
                          onChange={(e) => {
                            const next = [...draft.featuredActions];
                            next[index] = { ...action, url: e.target.value };
                            setDraft({ ...draft, featuredActions: next });
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}

            {tab === "barcode" ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Barcode</span>
                  <select
                    className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                    value={draft.barcodeFormat}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        barcodeFormat: e.target.value as Draft["barcodeFormat"],
                      })
                    }
                  >
                    {BARCODE_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-4 space-y-1.5 border-t border-foreground/10 pt-4">
                  <span className="text-sm font-semibold">Barcode Value</span>
                  <div className="rounded-lg border border-foreground/15 bg-foreground/[0.03] px-3 py-3 text-sm text-foreground/70">
                    Issued per guest as their loyalty member id.
                    <p className="mt-1 font-mono text-xs text-foreground/45">
                      {"{{guestId}}"}
                    </p>
                  </div>
                  <p className="text-xs text-foreground/50">
                    Line breaks are kept. Up to 1024 characters.
                  </p>
                </div>
                <label className="mt-4 flex items-start gap-3 border-t border-foreground/10 pt-4 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={draft.barcodeAltText === ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        barcodeAltText: e.target.checked ? "" : null,
                      })
                    }
                  />
                  <span>
                    <span className="font-semibold">Override text under barcode</span>
                    <span className="mt-0.5 block text-xs text-foreground/50">
                      By default Google prints the value under the code and Apple prints
                      nothing. Enable to hide text on both.
                    </span>
                  </span>
                </label>
              </>
            ) : null}

            {tab === "style" ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Color Preset</span>
                  <select
                    className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
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
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block space-y-1.5 border-t border-foreground/10 pt-4">
                  <span className="text-sm font-semibold">Custom Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-10 cursor-pointer rounded-full border border-foreground/15 bg-transparent p-0"
                      value={draft.color || "#1a1a1a"}
                      onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    />
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
                      value={draft.color}
                      onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                      placeholder="#FF5733"
                      maxLength={7}
                    />
                  </div>
                  <span className="block text-xs text-foreground/50">
                    Overrides color preset.
                  </span>
                </label>
                <ImageSlot
                  label="Logo (160×160)"
                  hint="Brand mark on the pass face (top-left)."
                  value={draft.logoURL}
                  onChange={(logoURL) => setDraft({ ...draft, logoURL })}
                />
                <ImageSlot
                  label="Wide Logo (1280×400)"
                  hint="Transparent PNG wordmark for Google Wallet."
                  value={draft.wideLogoURL}
                  onChange={(wideLogoURL) => setDraft({ ...draft, wideLogoURL })}
                />
                <ImageSlot
                  label="Icon (120×120)"
                  hint="Lock-screen notification icon."
                  value={draft.iconURL}
                  onChange={(iconURL) => setDraft({ ...draft, iconURL })}
                />
                <ImageSlot
                  label="Thumbnail (180×180)"
                  hint="Small image, top-right of the pass face."
                  value={draft.thumbnailURL}
                  onChange={(thumbnailURL) => setDraft({ ...draft, thumbnailURL })}
                />
                <ImageSlot
                  label="Strip Image (1080×360)"
                  hint="Wide banner behind the primary field (store card layout)."
                  value={draft.stripURL}
                  onChange={(stripURL) => setDraft({ ...draft, stripURL })}
                />
                <ImageSlot
                  label="Background (690×1010)"
                  hint="Full-bleed poster artwork (iOS 17+ poster layout)."
                  value={draft.backgroundURL}
                  onChange={(backgroundURL) => setDraft({ ...draft, backgroundURL })}
                />
              </>
            ) : null}
          </div>
        </div>

        {/* Preview */}
        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex gap-4">
              {(["preview", "code"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`border-b-2 pb-1 text-sm font-medium capitalize ${
                    previewMode === mode
                      ? "border-foreground text-foreground"
                      : "border-transparent text-foreground/45"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-full border border-foreground/15 p-0.5">
              {(["apple", "google"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                    platform === p
                      ? "bg-foreground text-background"
                      : "text-foreground/55"
                  }`}
                >
                  {p === "apple" ? "Apple" : "Google"}
                </button>
              ))}
            </div>
          </div>

          {previewMode === "preview" ? (
            <WalletPassPreview
              platform={platform}
              draft={{
                logoText: draft.logoText,
                organizationName: draft.organizationName,
                primaryFields: draft.primaryFields,
                secondaryFields: draft.secondaryFields,
                headerFields: draft.headerFields,
                footerFields: draft.footerFields,
                featuredActions: draft.featuredActions,
                barcodeFormat: draft.barcodeFormat,
                barcodeAltText: draft.barcodeAltText,
                colorPreset: draft.colorPreset,
                color: draft.color,
                logoURL: draft.logoURL,
                stripURL: draft.stripURL,
                backgroundURL: draft.backgroundURL,
              }}
            />
          ) : (
            <pre className="max-h-[560px] overflow-auto rounded-2xl border border-foreground/10 bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-100">
              {JSON.stringify(draftToInput(draft), null, 2)}
            </pre>
          )}
        </aside>
      </div>

      {/* Marketing */}
      <section className="rounded-2xl border border-foreground/10 bg-background/80 p-5 shadow-sm ring-1 ring-foreground/5">
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
                    onClick={() => {
                      setSelectedSegments((prev) =>
                        prev.includes(key)
                          ? prev.filter((k) => k !== key)
                          : [...prev, key],
                      );
                      setPreviewCount(null);
                    }}
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
            <p className="text-sm text-emerald-600">{sendResult}</p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
