"use client";

import { useCallback, useEffect, useState } from "react";
import type { Location } from "@/lib/auth-api/types/locations";
import { expandR2AssetToPublicUrl } from "@/lib/r2-object-key";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import type {
  WalletConfigBundle,
  WalletFeaturedAction,
  WalletFeaturedActionSlot,
  WalletPassConfig,
  WalletPassRestaurantConfig,
  WalletPassRestaurantInput,
  WalletPassSystemTemplate,
  WalletPassLocation,
} from "@/lib/loyalty-api";
import { useI18n } from "../i18n-provider";
import {
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

const PRESET_COLOR_HEX: Record<string, string> = {
  dark: "#1a1a1a",
  blue: "#1e3a8a",
  green: "#14532d",
  red: "#7f1d1d",
  purple: "#4c1d95",
  orange: "#9a3412",
};

type EditorTab = "brand" | "links" | "style";
type LogoKind = "square" | "wide";

type Draft = {
  enabled: boolean;
  organizationName: string;
  logoText: string;
  featuredActions: WalletFeaturedAction[];
  colorPreset: WalletPassRestaurantConfig["colorPreset"];
  color: string;
  logoKind: LogoKind;
  logoURL: string;
  stripURL: string;
  iconURL: string;
  wideLogoURL: string;
  thumbnailURL: string;
  backgroundURL: string;
  locations: WalletPassLocation[];
};

function restaurantToDraft(restaurant: WalletPassRestaurantConfig): Draft {
  const wideLogoURL = restaurant.wideLogoURL ?? "";
  const logoURL = restaurant.logoURL ?? "";
  return {
    enabled: restaurant.enabled,
    organizationName: restaurant.organizationName,
    logoText: restaurant.logoText,
    featuredActions: restaurant.featuredActions ?? [],
    colorPreset: restaurant.colorPreset,
    color:
      restaurant.color?.trim() ||
      PRESET_COLOR_HEX[restaurant.colorPreset] ||
      PRESET_COLOR_HEX.dark,
    logoKind: wideLogoURL.trim() ? "wide" : "square",
    logoURL: wideLogoURL.trim() ? "" : logoURL,
    stripURL: restaurant.stripURL ?? "",
    iconURL: restaurant.iconURL ?? "",
    wideLogoURL: wideLogoURL.trim() ? wideLogoURL : "",
    thumbnailURL: restaurant.thumbnailURL ?? "",
    backgroundURL: restaurant.backgroundURL ?? "",
    locations: restaurant.locations ?? [],
  };
}

function alignActionsToSlots(
  slots: WalletFeaturedActionSlot[],
  actions: WalletFeaturedAction[],
): WalletFeaturedAction[] {
  const byId = new Map(actions.map((a) => [a.identifier, a]));
  return slots.map((slot) => {
    const existing = byId.get(slot.identifier);
    if (existing) {
      return { ...existing, type: slot.type, identifier: slot.identifier };
    }
    if (slot.type === "place") {
      return { identifier: slot.identifier, type: "place", placeIdentifier: "" };
    }
    if (slot.type === "call") {
      return { identifier: slot.identifier, type: "call", url: "tel:" };
    }
    return { identifier: slot.identifier, type: slot.type, url: "https://" };
  });
}

function draftToInput(draft: Draft): WalletPassRestaurantInput {
  return {
    enabled: draft.enabled,
    organizationName: draft.organizationName.trim(),
    logoText: draft.logoText.trim(),
    featuredActions: draft.featuredActions.map((action) => {
      if (action.type === "place") {
        const placeIdentifier = action.placeIdentifier?.trim() ?? "";
        const url = action.url?.trim() ?? "";
        return {
          identifier: action.identifier,
          type: "place",
          placeIdentifier,
          ...(url ? { url } : {}),
        };
      }
      return {
        identifier: action.identifier,
        type: action.type,
        url: action.url?.trim() ?? "",
      };
    }),
    colorPreset: draft.colorPreset,
    color: draft.color.trim() || null,
    logoURL:
      draft.logoKind === "square" ? draft.logoURL.trim() || null : null,
    stripURL: draft.stripURL.trim() || null,
    iconURL: draft.iconURL.trim() || null,
    wideLogoURL:
      draft.logoKind === "wide" ? draft.wideLogoURL.trim() || null : null,
    thumbnailURL: draft.thumbnailURL.trim() || null,
    backgroundURL: draft.backgroundURL.trim() || null,
    locations: draft.locations.slice(0, 10),
  };
}

function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() || "").replace(
    /\/+$/,
    "",
  );
}

async function uploadToPublicUrl(file: File): Promise<string> {
  const key = await uploadFileToR2(file, "location-logo");
  const base = publicBaseUrl();
  const expanded = expandR2AssetToPublicUrl(key, base) || key;
  if (!/^https:\/\//i.test(expanded)) {
    throw new Error(
      "Upload needs a public HTTPS CDN URL (set NEXT_PUBLIC_R2_PUBLIC_BASE_URL)",
    );
  }
  return expanded;
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
        />
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </section>
  );
}

export function LoyaltyWalletClient() {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [template, setTemplate] = useState<WalletPassSystemTemplate | null>(null);
  const [effective, setEffective] = useState<WalletPassConfig | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>("brand");
  const [platform, setPlatform] = useState<PreviewPlatform>("apple");

  const applyBundle = useCallback((bundle: WalletConfigBundle) => {
    const aligned = {
      ...bundle.restaurant,
      featuredActions: alignActionsToSlots(
        bundle.template.featuredActionSlots,
        bundle.restaurant.featuredActions,
      ),
    };
    setDraft(restaurantToDraft(aligned));
    setTemplate(bundle.template);
    setEffective(bundle.effective);
  }, []);

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
      const bundle = (await configRes.json()) as WalletConfigBundle;
      applyBundle(bundle);
      if (locRes.ok) {
        const locData = (await locRes.json()) as { locations?: Location[] };
        setLocations(Array.isArray(locData.locations) ? locData.locations : []);
      }
      setError(null);
    } catch {
      setError(t("loyalty.walletLoadFailed"));
    }
  }, [applyBundle, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
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
      const bundle = (await res.json()) as WalletConfigBundle;
      applyBundle(bundle);
      setSaved(true);
    } catch {
      setError(t("loyalty.walletSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const actionLabel = (type: string) => {
    const key = `loyalty.walletAction.${type}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };

  if (!draft || !template || !effective) {
    return (
      <p className="text-sm text-foreground/55">
        {error ?? t("loyalty.walletLoading")}
      </p>
    );
  }

  const geoLocations = locations.filter(
    (loc) =>
      typeof loc.latitude === "number" &&
      typeof loc.longitude === "number" &&
      Number.isFinite(loc.latitude) &&
      Number.isFinite(loc.longitude),
  );

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: "brand", label: t("loyalty.walletTabBrand") },
    { id: "links", label: t("loyalty.walletTabLinks") },
    { id: "style", label: t("loyalty.walletTabStyle") },
  ];

  const previewDraft = {
    logoText: draft.logoText || effective.logoText,
    organizationName: draft.organizationName || effective.organizationName,
    primaryFields: effective.primaryFields,
    secondaryFields: effective.secondaryFields,
    headerFields: effective.headerFields,
    footerFields: effective.footerFields,
    featuredActions: draft.featuredActions,
    barcodeFormat: effective.barcodeFormat,
    barcodeAltText: effective.barcodeAltText,
    colorPreset: draft.colorPreset,
    color: draft.color,
    logoURL: draft.logoKind === "square" ? draft.logoURL : "",
    wideLogoURL: draft.logoKind === "wide" ? draft.wideLogoURL : "",
    stripURL: draft.stripURL,
    backgroundURL: draft.backgroundURL,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("loyalty.walletEditorTitle")}
          </h1>
          <p className="mt-1 text-sm text-foreground/55">
            {t("loyalty.walletRestaurantHint")}
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
            {tab === "brand" ? (
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
              </>
            ) : null}

            {tab === "links" ? (
              <>
                <section className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t("loyalty.walletFeaturedActions", {
                        count: draft.featuredActions.length,
                      })}
                    </h3>
                    <p className="text-xs text-foreground/50">
                      {t("loyalty.walletRestaurantActionsHint")}
                    </p>
                  </div>
                  {template.featuredActionSlots.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-foreground/15 px-3 py-4 text-center text-xs text-foreground/40">
                      {t("loyalty.walletNoActionSlots")}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {draft.featuredActions.map((action, index) => (
                        <li
                          key={action.identifier}
                          className="space-y-2 rounded-xl border border-foreground/10 p-3"
                        >
                          <p className="text-sm font-medium">
                            {actionLabel(action.type)}
                          </p>
                          {action.type === "place" ? (
                            <div className="space-y-2">
                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-foreground/70">
                                  {t("loyalty.walletActionPlaceId")}
                                </span>
                                <input
                                  className="w-full rounded-lg border border-foreground/15 bg-background px-2.5 py-2 font-mono text-sm"
                                  placeholder={t(
                                    "loyalty.walletActionPlaceIdPlaceholder",
                                  )}
                                  value={action.placeIdentifier ?? ""}
                                  onChange={(e) => {
                                    const next = [...draft.featuredActions];
                                    next[index] = {
                                      ...action,
                                      placeIdentifier: e.target.value,
                                    };
                                    setDraft({ ...draft, featuredActions: next });
                                  }}
                                  maxLength={128}
                                />
                                <span className="block text-[11px] text-foreground/45">
                                  {t("loyalty.walletActionPlaceIdHint")}
                                </span>
                              </label>
                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-foreground/70">
                                  {t("loyalty.walletActionGoogleMaps")}
                                </span>
                                <input
                                  className="w-full rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                                  placeholder="https://maps.google.com/..."
                                  value={action.url ?? ""}
                                  onChange={(e) => {
                                    const next = [...draft.featuredActions];
                                    next[index] = {
                                      ...action,
                                      url: e.target.value,
                                    };
                                    setDraft({ ...draft, featuredActions: next });
                                  }}
                                />
                                <span className="block text-[11px] text-foreground/45">
                                  {t("loyalty.walletActionGoogleMapsHint")}
                                </span>
                              </label>
                            </div>
                          ) : (
                            <label className="block space-y-1">
                              <span className="text-xs font-medium text-foreground/70">
                                {action.type === "call"
                                  ? t("loyalty.walletActionCallUrl")
                                  : t("loyalty.walletActionUrl")}
                              </span>
                              <input
                                className="w-full rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                                placeholder={
                                  action.type === "call" ? "tel:+998..." : "https://"
                                }
                                value={action.url ?? ""}
                                onChange={(e) => {
                                  const next = [...draft.featuredActions];
                                  next[index] = {
                                    ...action,
                                    url: e.target.value,
                                  };
                                  setDraft({ ...draft, featuredActions: next });
                                }}
                              />
                            </label>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="mt-4 space-y-2 border-t border-foreground/10 pt-4">
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
                  {geoLocations.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-foreground/15 px-3 py-4 text-center text-xs text-foreground/40">
                      {t("loyalty.walletNoGeoLocations")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {geoLocations.map((loc) => {
                        const selected = draft.locations.some(
                          (l) => l.locationId === loc.id,
                        );
                        const row = draft.locations.find(
                          (l) => l.locationId === loc.id,
                        );
                        return (
                          <li
                            key={loc.id}
                            className="rounded-xl border border-foreground/10 p-3"
                          >
                            <label className="flex items-start gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={selected}
                                onChange={(e) => {
                                  if (e.target.checked) {
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
                                        },
                                      ],
                                    });
                                  } else {
                                    setDraft({
                                      ...draft,
                                      locations: draft.locations.filter(
                                        (l) => l.locationId !== loc.id,
                                      ),
                                    });
                                  }
                                }}
                              />
                              <span className="min-w-0">
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
                <section className="space-y-2 border-t border-foreground/10 pt-4">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t("loyalty.walletLogoKind")}
                    </h3>
                    <p className="text-xs text-foreground/50">
                      {t("loyalty.walletLogoKindHint")}
                    </p>
                  </div>
                  <div className="inline-flex rounded-full border border-foreground/15 p-0.5">
                    {(
                      [
                        {
                          id: "square" as const,
                          label: t("loyalty.walletLogoKindSquare"),
                        },
                        {
                          id: "wide" as const,
                          label: t("loyalty.walletLogoKindWide"),
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, logoKind: opt.id })
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          draft.logoKind === opt.id
                            ? "bg-foreground text-background"
                            : "text-foreground/55"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </section>
                {draft.logoKind === "square" ? (
                  <ImageSlot
                    label={t("loyalty.walletImageLogo")}
                    hint={t("loyalty.walletImageLogoHint")}
                    value={draft.logoURL}
                    onChange={(logoURL) => setDraft({ ...draft, logoURL })}
                  />
                ) : (
                  <ImageSlot
                    label={t("loyalty.walletImageWideLogo")}
                    hint={t("loyalty.walletImageWideLogoHint")}
                    value={draft.wideLogoURL}
                    onChange={(wideLogoURL) =>
                      setDraft({ ...draft, wideLogoURL })
                    }
                  />
                )}
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
                  onChange={(backgroundURL) =>
                    setDraft({ ...draft, backgroundURL })
                  }
                />
              </>
            ) : null}
          </div>
        </div>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <div className="mb-3 flex justify-center">
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
          <WalletPassPreview platform={platform} draft={previewDraft} />
        </aside>
      </div>
    </div>
  );
}
