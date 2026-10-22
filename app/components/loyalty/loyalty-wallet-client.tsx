"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { Location } from "@/lib/auth-api/types/locations";
import { expandR2AssetToPublicUrl } from "@/lib/r2-object-key";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import type {
  WalletFeaturedAction,
  WalletPassConfig,
  WalletPassConfigInput,
  WalletPassField,
  WalletPassLocation,
} from "@/lib/loyalty-api";
import { useI18n } from "../i18n-provider";
import {
  FEATURED_ACTION_TYPES,
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

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PRESET_COLOR_HEX: Record<string, string> = {
  dark: "#1a1a1a",
  blue: "#1e3a8a",
  green: "#14532d",
  red: "#7f1d1d",
  purple: "#4c1d95",
  orange: "#9a3412",
};
const BARCODE_FORMATS = ["QR", "PDF417", "Aztec", "Code128"] as const;

type EditorTab = "content" | "barcode" | "style";

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
  colorPreset: WalletPassConfig["colorPreset"];
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
    color:
      config.color?.trim() ||
      PRESET_COLOR_HEX[config.colorPreset] ||
      PRESET_COLOR_HEX.dark,
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
  const { t } = useI18n();
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
          aria-label={t("loyalty.walletAddField")}
        >
          <PlusIcon size={16} />
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/15 px-3 py-4 text-center text-xs text-foreground/40">
          {t("loyalty.walletNoFields")}
        </p>
      ) : (
        <ul className="space-y-2">
          {fields.map((field, index) => (
            <li key={index} className="flex items-start gap-2">
              <input
                className="w-[38%] rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                placeholder={t("loyalty.walletFieldLabel")}
                value={field.label ?? ""}
                onChange={(e) => {
                  const next = [...fields];
                  next[index] = { ...field, label: e.target.value };
                  onChange(next);
                }}
              />
              <input
                className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                placeholder={t("loyalty.walletFieldValue")}
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
                aria-label={t("loyalty.walletRemoveField")}
              >
                <TrashIcon size={15} />
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
  const { t } = useI18n();
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
                {t("loyalty.walletReplaceImage")}
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
                        setError(
                          err instanceof Error
                            ? err.message
                            : t("loyalty.walletUploadFailed"),
                        ),
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
                {t("loyalty.walletRemoveImage")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/20 bg-foreground/[0.02] px-4 py-8 text-center text-sm text-foreground/55 hover:bg-foreground/[0.04]">
          <span>
            {uploading ? t("loyalty.walletUploading") : t("loyalty.walletBrowseImage")}
          </span>
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
                  setError(
                    err instanceof Error
                      ? err.message
                      : t("loyalty.walletUploadFailed"),
                  ),
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
        {t("loyalty.walletPasteImageUrl")}
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
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>("content");
  const [platform, setPlatform] = useState<PreviewPlatform>("apple");

  const load = useCallback(async () => {
    try {
      const [configRes, locRes] = await Promise.all([
        fetch("/api/settings/loyalty/wallet", { cache: "no-store" }),
        fetch("/api/settings/locations", { cache: "no-store" }),
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

  if (!draft) {
    return (
      <p className="text-sm text-foreground/60">
        {error ?? t("loyalty.walletLoading")}
      </p>
    );
  }

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: "content", label: t("loyalty.walletTabContent") },
    { id: "barcode", label: t("loyalty.walletTabBarcode") },
    { id: "style", label: t("loyalty.walletTabStyle") },
  ];

  const actionLabel = (type: string) => {
    const key = `loyalty.walletAction.${type}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("loyalty.walletEditorTitle")}
          </h1>
          <p className="mt-1 text-sm text-foreground/55">
            {t("loyalty.walletEditorHint")}
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
                  <span className="text-sm font-semibold">
                    {t("loyalty.walletLogoText")}
                  </span>
                  <input
                    className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                    value={draft.logoText}
                    onChange={(e) => setDraft({ ...draft, logoText: e.target.value })}
                    maxLength={64}
                  />
                  <span className="block text-xs text-foreground/50">
                    {t("loyalty.walletLogoTextHint")}
                  </span>
                </label>

                <label className="block space-y-1.5 border-t border-foreground/10 py-3">
                  <span className="text-sm font-semibold">
                    {t("loyalty.walletOrgName")}{" "}
                    <span className="font-normal text-foreground/45">
                      {t("loyalty.walletOptional")}
                    </span>
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
                    {t("loyalty.walletOrgNameHint")}
                  </span>
                </label>

                <FieldListEditor
                  title={t("loyalty.walletHeaderFields")}
                  hint={t("loyalty.walletHeaderFieldsHint")}
                  fields={draft.headerFields}
                  onChange={(headerFields) => setDraft({ ...draft, headerFields })}
                />
                <FieldListEditor
                  title={t("loyalty.walletPrimaryFields")}
                  hint={t("loyalty.walletPrimaryFieldsHint")}
                  fields={draft.primaryFields}
                  onChange={(primaryFields) => setDraft({ ...draft, primaryFields })}
                />
                <FieldListEditor
                  title={t("loyalty.walletSecondaryFields")}
                  hint={t("loyalty.walletSecondaryFieldsHint")}
                  fields={draft.secondaryFields}
                  onChange={(secondaryFields) => setDraft({ ...draft, secondaryFields })}
                />
                <FieldListEditor
                  title={t("loyalty.walletFooterFields")}
                  hint={t("loyalty.walletFooterFieldsHint")}
                  fields={draft.footerFields}
                  max={2}
                  onChange={(footerFields) => setDraft({ ...draft, footerFields })}
                />
                <FieldListEditor
                  title={t("loyalty.walletBackFields")}
                  hint={t("loyalty.walletBackFieldsHint")}
                  fields={draft.backFields}
                  onChange={(backFields) => setDraft({ ...draft, backFields })}
                />

                <section className="space-y-2 border-t border-foreground/10 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {t("loyalty.walletLocationsTitle", {
                          count: draft.locations.length,
                        })}
                      </h3>
                      <p className="text-xs text-foreground/50">
                        {t("loyalty.walletLocationsHint")}
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
                        {t("loyalty.walletFeaturedActions", {
                          count: draft.featuredActions.length,
                        })}
                      </h3>
                      <p className="text-xs text-foreground/50">
                        {t("loyalty.walletFeaturedActionsHint")}
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
                      <PlusIcon size={16} />
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
                            {FEATURED_ACTION_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {actionLabel(type)}
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
                            <TrashIcon size={15} />
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
                  <span className="text-sm font-semibold">
                    {t("loyalty.walletBarcode")}
                  </span>
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
                  <span className="text-sm font-semibold">
                    {t("loyalty.walletBarcodeValue")}
                  </span>
                  <div className="rounded-lg border border-foreground/15 bg-foreground/[0.03] px-3 py-3 text-sm text-foreground/70">
                    {t("loyalty.walletBarcodeValueHint")}
                    <p className="mt-1 font-mono text-xs text-foreground/45">
                      {"{{guestId}}"}
                    </p>
                  </div>
                  <p className="text-xs text-foreground/50">
                    {t("loyalty.walletBarcodeValueHelp")}
                  </p>
                </div>
                <div className="mt-4 space-y-3 border-t border-foreground/10 pt-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={draft.barcodeAltText !== null}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          barcodeAltText: e.target.checked ? "" : null,
                        })
                      }
                    />
                    <span>
                      <span className="font-semibold">
                        {t("loyalty.walletBarcodeOverride")}
                      </span>
                      <span className="mt-0.5 block text-xs text-foreground/50">
                        {t("loyalty.walletBarcodeOverrideHint")}
                      </span>
                    </span>
                  </label>
                  {draft.barcodeAltText !== null ? (
                    <label className="block space-y-1.5">
                      <span className="text-sm font-semibold">
                        {t("loyalty.walletBarcodeAltText")}
                      </span>
                      <input
                        className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
                        value={draft.barcodeAltText}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            barcodeAltText: e.target.value.slice(0, 128),
                          })
                        }
                        placeholder={t("loyalty.walletBarcodeAltPlaceholder")}
                        maxLength={128}
                      />
                      <span className="block text-xs text-foreground/50">
                        {t("loyalty.walletBarcodeAltHelp")}
                      </span>
                    </label>
                  ) : null}
                </div>
              </>
            ) : null}

            {tab === "style" ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    {t("loyalty.walletColor")}
                  </span>
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
                    {t("loyalty.walletColorHint")}
                  </span>
                </label>
                <ImageSlot
                  label={t("loyalty.walletImageLogo")}
                  hint={t("loyalty.walletImageLogoHint")}
                  value={draft.logoURL}
                  onChange={(logoURL) => setDraft({ ...draft, logoURL })}
                />
                <ImageSlot
                  label={t("loyalty.walletImageWideLogo")}
                  hint={t("loyalty.walletImageWideLogoHint")}
                  value={draft.wideLogoURL}
                  onChange={(wideLogoURL) => setDraft({ ...draft, wideLogoURL })}
                />
                <ImageSlot
                  label={t("loyalty.walletImageIcon")}
                  hint={t("loyalty.walletImageIconHint")}
                  value={draft.iconURL}
                  onChange={(iconURL) => setDraft({ ...draft, iconURL })}
                />
                <ImageSlot
                  label={t("loyalty.walletImageThumbnail")}
                  hint={t("loyalty.walletImageThumbnailHint")}
                  value={draft.thumbnailURL}
                  onChange={(thumbnailURL) => setDraft({ ...draft, thumbnailURL })}
                />
                <ImageSlot
                  label={t("loyalty.walletImageStrip")}
                  hint={t("loyalty.walletImageStripHint")}
                  value={draft.stripURL}
                  onChange={(stripURL) => setDraft({ ...draft, stripURL })}
                />
                <ImageSlot
                  label={t("loyalty.walletImageBackground")}
                  hint={t("loyalty.walletImageBackgroundHint")}
                  value={draft.backgroundURL}
                  onChange={(backgroundURL) => setDraft({ ...draft, backgroundURL })}
                />
              </>
            ) : null}
          </div>
        </div>

        {/* Preview */}
        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="mb-3 flex justify-end">
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
                  {p === "apple" ? t("loyalty.walletApple") : t("loyalty.walletGoogle")}
                </button>
              ))}
            </div>
          </div>

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
        </aside>
      </div>
    </div>
  );
}
