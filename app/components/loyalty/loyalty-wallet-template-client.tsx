"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  WalletFeaturedActionSlot,
  WalletPassField,
  WalletPassSystemTemplate,
  WalletPassSystemTemplateInput,
} from "@/lib/loyalty-api";
import { useI18n } from "../i18n-provider";
import {
  FEATURED_ACTION_TYPES,
  WalletPassPreview,
  type PreviewPlatform,
} from "./wallet-pass-preview";
import { FieldListEditor, PlusIcon, TrashIcon } from "./wallet-field-list-editor";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

const BARCODE_FORMATS = ["QR", "PDF417", "Aztec", "Code128"] as const;

type EditorTab = "content" | "barcode";

type Draft = {
  description: string;
  primaryFields: WalletPassField[];
  secondaryFields: WalletPassField[];
  headerFields: WalletPassField[];
  footerFields: WalletPassField[];
  backFields: WalletPassField[];
  featuredActionSlots: WalletFeaturedActionSlot[];
  barcodeFormat: (typeof BARCODE_FORMATS)[number];
  barcodeAltText: string | null;
};

function templateToDraft(template: WalletPassSystemTemplate): Draft {
  return {
    description: template.description ?? "",
    primaryFields:
      template.primaryFields?.length > 0
        ? template.primaryFields
        : [{ label: "CARD", value: template.programTitle || "Loyalty Card" }],
    secondaryFields:
      template.secondaryFields?.length > 0
        ? template.secondaryFields
        : [{ label: template.memberNameLabel || "MEMBER", value: "{{name}}" }],
    headerFields:
      template.headerFields?.length > 0
        ? template.headerFields
        : [{ label: template.pointsLabel || "POINTS", value: "{{balance}}" }],
    footerFields: template.footerFields ?? [],
    backFields: template.backFields ?? [],
    featuredActionSlots: template.featuredActionSlots ?? [],
    barcodeFormat: template.barcodeFormat,
    barcodeAltText: template.barcodeAltText,
  };
}

function draftToInput(draft: Draft): WalletPassSystemTemplateInput {
  return {
    description: draft.description.trim(),
    programTitle: draft.primaryFields[0]?.value?.trim() || "Loyalty Card",
    pointsLabel: draft.headerFields[0]?.label?.trim() || "POINTS",
    memberNameLabel: draft.secondaryFields[0]?.label?.trim() || "MEMBER",
    primaryFields: draft.primaryFields,
    secondaryFields: draft.secondaryFields,
    headerFields: draft.headerFields,
    footerFields: draft.footerFields,
    backFields: draft.backFields,
    featuredActionSlots: draft.featuredActionSlots.map((slot) => ({
      identifier: slot.identifier.trim().slice(0, 64),
      type: slot.type,
    })),
    barcodeFormat: draft.barcodeFormat,
    barcodeAltText: draft.barcodeAltText,
  };
}

export function LoyaltyWalletTemplateClient() {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>("content");
  const [platform, setPlatform] = useState<PreviewPlatform>("apple");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/loyalty/wallet/template", {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.walletTemplateLoadFailed")));
        return;
      }
      const data = (await res.json()) as { template: WalletPassSystemTemplate };
      setDraft(templateToDraft(data.template));
      setError(null);
    } catch {
      setError(t("loyalty.walletTemplateLoadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/loyalty/wallet/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToInput(draft)),
      });
      if (!res.ok) {
        setError(await readErrorMessage(res, t("loyalty.walletTemplateSaveFailed")));
        return;
      }
      const data = (await res.json()) as { template: WalletPassSystemTemplate };
      setDraft(templateToDraft(data.template));
      setSaved(true);
    } catch {
      setError(t("loyalty.walletTemplateSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const actionLabel = (type: string) => {
    const key = `loyalty.walletAction.${type}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };

  if (!draft) {
    return (
      <p className="text-sm text-foreground/55">
        {error ?? t("loyalty.walletLoading")}
      </p>
    );
  }

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: "content", label: t("loyalty.walletTabContent") },
    { id: "barcode", label: t("loyalty.walletTabBarcode") },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("loyalty.walletTemplateTitle")}
          </h1>
          <p className="mt-1 text-sm text-foreground/55">
            {t("loyalty.walletTemplateHint")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? t("loyalty.walletSaving") : t("loyalty.walletTemplateSave")}
          </button>
          {saved ? (
            <span className="text-sm text-emerald-600">
              {t("loyalty.walletTemplateSaved")}
            </span>
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
            {tab === "content" ? (
              <>
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
                  onChange={(secondaryFields) =>
                    setDraft({ ...draft, secondaryFields })
                  }
                />
                <FieldListEditor
                  title={t("loyalty.walletFooterFields")}
                  hint={t("loyalty.walletFooterFieldsHint")}
                  fields={draft.footerFields}
                  onChange={(footerFields) => setDraft({ ...draft, footerFields })}
                  max={2}
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
                        {t("loyalty.walletFeaturedActions", {
                          count: draft.featuredActionSlots.length,
                        })}
                      </h3>
                      <p className="text-xs text-foreground/50">
                        {t("loyalty.walletTemplateSlotsHint")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={draft.featuredActionSlots.length >= 2}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          featuredActionSlots: [
                            ...draft.featuredActionSlots,
                            {
                              identifier: `action-${draft.featuredActionSlots.length + 1}`,
                              type: "order",
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
                    {draft.featuredActionSlots.map((slot, index) => (
                      <li
                        key={slot.identifier}
                        className="flex items-center gap-2 rounded-xl border border-foreground/10 p-3"
                      >
                        <select
                          className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-2.5 py-2 text-sm"
                          value={
                            (FEATURED_ACTION_TYPES as readonly string[]).includes(
                              slot.type,
                            )
                              ? slot.type
                              : "order"
                          }
                          onChange={(e) => {
                            const next = [...draft.featuredActionSlots];
                            next[index] = { ...slot, type: e.target.value };
                            setDraft({ ...draft, featuredActionSlots: next });
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
                              featuredActionSlots: draft.featuredActionSlots.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                          className="rounded-md p-2 text-foreground/45 hover:text-red-600"
                        >
                          <TrashIcon size={15} />
                        </button>
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
                        barcodeFormat: e.target
                          .value as (typeof BARCODE_FORMATS)[number],
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
                <div className="mt-4 space-y-2 border-t border-foreground/10 pt-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
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
                          setDraft({ ...draft, barcodeAltText: e.target.value })
                        }
                        placeholder={t("loyalty.walletBarcodeAltPlaceholder")}
                        maxLength={128}
                      />
                    </label>
                  ) : null}
                </div>
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
          <WalletPassPreview
            platform={platform}
            draft={{
              logoText: "Loyalty",
              organizationName: "Restaurant",
              primaryFields: draft.primaryFields,
              secondaryFields: draft.secondaryFields,
              headerFields: draft.headerFields,
              footerFields: draft.footerFields,
              featuredActions: draft.featuredActionSlots.map((slot) => ({
                identifier: slot.identifier,
                type: slot.type,
                url: slot.type === "call" ? "tel:+10000000000" : "https://example.com",
                ...(slot.type === "place"
                  ? { placeIdentifier: "I7C250D2CDCB364A" }
                  : {}),
              })),
              barcodeFormat: draft.barcodeFormat,
              barcodeAltText: draft.barcodeAltText,
              colorPreset: "dark",
              color: "#1a1a1a",
              logoURL: "",
              wideLogoURL: "",
              stripURL: "",
              backgroundURL: "",
            }}
          />
        </aside>
      </div>
    </div>
  );
}
