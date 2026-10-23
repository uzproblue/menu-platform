"use client";

import { useMemo } from "react";
import type {
  WalletFeaturedAction,
  WalletPassField,
} from "@/lib/loyalty-api";
import { useI18n } from "../i18n-provider";

export type PreviewPlatform = "apple" | "google";

export type WalletPassPreviewDraft = {
  logoText: string;
  organizationName: string;
  primaryFields: WalletPassField[];
  secondaryFields: WalletPassField[];
  headerFields: WalletPassField[];
  footerFields: WalletPassField[];
  featuredActions: WalletFeaturedAction[];
  barcodeFormat: string;
  barcodeAltText: string | null;
  colorPreset: string;
  color: string;
  logoURL: string;
  stripURL: string;
  backgroundURL: string;
};

const PRESET_COLORS: Record<string, string> = {
  dark: "#1a1a1a",
  blue: "#1e3a8a",
  green: "#14532d",
  red: "#7f1d1d",
  purple: "#4c1d95",
  orange: "#9a3412",
};

export const FEATURED_ACTION_TYPES = [
  "call",
  "place",
  "order",
  "membershipBenefits",
] as const;

function substitutePreview(value: string): string {
  return value
    .replaceAll("{{balance}}", "120")
    .replaceAll("{{name}}", "Alex")
    .replaceAll("{{guestId}}", "guest-demo");
}

function FieldBlock({ field }: { field: WalletPassField }) {
  const label = field.label?.trim();
  const value = substitutePreview(field.value);
  return (
    <div>
      {label ? (
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/55">
          {label}
        </p>
      ) : null}
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function seededRng(seedText: string) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };
}

function BarcodePlaceholder({
  value,
  format,
}: {
  value: string;
  format: string;
}) {
  const graphic = useMemo(() => {
    const next = seededRng(`${format}:${value}`);
    const fmt = format.toUpperCase();

    if (fmt === "CODE128") {
      const bars: number[] = [];
      for (let i = 0; i < 48; i++) {
        bars.push((next() % 3) + 1);
      }
      return { kind: "linear" as const, bars };
    }

    if (fmt === "PDF417") {
      const rows = 8;
      const cols = 40;
      const bits: boolean[] = [];
      for (let i = 0; i < rows * cols; i++) {
        bits.push(next() % 3 !== 0);
      }
      return { kind: "pdf417" as const, rows, cols, bits };
    }

    // QR / Aztec — square matrix
    const size = fmt === "AZTEC" ? 19 : 21;
    const bits: boolean[] = [];
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = Math.floor(i / size);
      const finder =
        fmt === "QR" &&
        ((x < 7 && y < 7) ||
          (x >= size - 7 && y < 7) ||
          (x < 7 && y >= size - 7));
      bits.push(
        finder
          ? x === 0 ||
              y === 0 ||
              x === 6 ||
              y === 6 ||
              (x > 1 && x < 5 && y > 1 && y < 5)
          : next() % 3 !== 0,
      );
    }
    return { kind: "matrix" as const, size, bits };
  }, [format, value]);

  if (graphic.kind === "linear") {
    let x = 0;
    const total = graphic.bars.reduce((a, b) => a + b, 0);
    return (
      <div className="mx-auto w-[78%] rounded-md bg-white px-3 py-3">
        <svg viewBox={`0 0 ${total} 40`} className="h-12 w-full">
          {graphic.bars.map((w, i) => {
            const rect = (
              <rect
                key={i}
                x={x}
                y="0"
                width={w}
                height="40"
                fill={i % 2 === 0 ? "#111" : "transparent"}
              />
            );
            x += w;
            return rect;
          })}
        </svg>
      </div>
    );
  }

  if (graphic.kind === "pdf417") {
    return (
      <div className="mx-auto w-[78%] rounded-md bg-white p-2">
        <svg
          viewBox={`0 0 ${graphic.cols} ${graphic.rows}`}
          className="h-14 w-full"
          preserveAspectRatio="none"
        >
          {graphic.bits.map((on, i) =>
            on ? (
              <rect
                key={i}
                x={i % graphic.cols}
                y={Math.floor(i / graphic.cols)}
                width="1"
                height="1"
                fill="#111"
              />
            ) : null,
          )}
        </svg>
      </div>
    );
  }

  return (
    <div className="mx-auto aspect-square w-[58%] rounded-md bg-white p-2">
      <svg viewBox={`0 0 ${graphic.size} ${graphic.size}`} className="h-full w-full">
        {graphic.bits.map((on, i) =>
          on ? (
            <rect
              key={i}
              x={i % graphic.size}
              y={Math.floor(i / graphic.size)}
              width="1"
              height="1"
              fill="#111"
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}

function barcodeCaption(
  barcodeAltText: string | null,
  platform: PreviewPlatform,
  fallbackValue: string,
): string | null {
  // Override on: show the custom text (empty = nothing).
  if (barcodeAltText !== null) {
    const trimmed = barcodeAltText.trim();
    return trimmed.length ? trimmed : null;
  }
  // Defaults: Google shows value, Apple shows nothing.
  if (platform === "google") return fallbackValue.slice(0, 12);
  return null;
}

type Props = {
  draft: WalletPassPreviewDraft;
  platform: PreviewPlatform;
};

export function WalletPassPreview({ draft, platform }: Props) {
  const { t } = useI18n();
  const actionLabel = (type: string) => {
    const key = `loyalty.walletAction.${type}`;
    const translated = t(key);
    return translated === key ? type : translated;
  };
  const bg =
    draft.color.trim() ||
    PRESET_COLORS[draft.colorPreset] ||
    PRESET_COLORS.dark;
  const logoText = draft.logoText.trim() || "Loyalty";
  const org = draft.organizationName.trim() || logoText;
  const barcodeValue = "guest-demo";
  const underBarcode = barcodeCaption(
    draft.barcodeAltText,
    platform,
    barcodeValue,
  );

  if (platform === "google") {
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-[280px] overflow-hidden rounded-[2rem] border-[10px] border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
          <div
            className="flex min-h-[520px] flex-col px-5 pb-6 pt-10"
            style={{
              background: draft.backgroundURL
                ? `linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.85)), url(${draft.backgroundURL}) center/cover`
                : bg,
            }}
          >
            <div className="flex flex-col items-center gap-2 pt-2">
              {draft.logoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.logoURL}
                  alt=""
                  className="size-14 rounded-full object-cover ring-2 ring-white/20"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white">
                  {logoText.slice(0, 1).toUpperCase()}
                </div>
              )}
              <p className="text-xs text-white/80">{logoText}</p>
            </div>

            <div className="mt-6 text-center">
              <p className="text-2xl font-semibold text-white">
                {substitutePreview(draft.primaryFields[0]?.value || "Loyalty Card")}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                {draft.primaryFields[0]?.label || "CARD"}
              </p>
            </div>

            <div className="mt-6">
              <BarcodePlaceholder
                value={barcodeValue}
                format={draft.barcodeFormat}
              />
              {underBarcode ? (
                <p className="mt-2 text-center text-xs text-white/70">
                  {underBarcode}
                </p>
              ) : null}
            </div>

            {draft.secondaryFields[0] ? (
              <div className="mt-6 text-center">
                <p className="text-[10px] uppercase tracking-wide text-white/50">
                  {draft.secondaryFields[0].label || "MEMBER"}
                </p>
                <p className="text-base font-semibold text-white">
                  {substitutePreview(draft.secondaryFields[0].value)}
                </p>
              </div>
            ) : null}

            <div className="mt-auto space-y-2 pt-8">
              {draft.featuredActions.map((action) => (
                <div
                  key={action.identifier}
                  className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white"
                >
                  <span className="text-base opacity-80">🌐</span>
                  <span className="truncate">{actionLabel(action.type)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 max-w-[280px] text-center text-xs text-foreground/50">
          {t("loyalty.walletPreviewGoogleHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[280px] overflow-hidden rounded-[2rem] border-[10px] border-zinc-200 bg-zinc-100 shadow-2xl">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-zinc-900" />
        <div className="flex min-h-[520px] flex-col bg-zinc-100 px-3 pb-4 pt-10">
          <div
            className="overflow-hidden rounded-2xl shadow-lg"
            style={{
              background: draft.stripURL
                ? `linear-gradient(180deg, rgba(0,0,0,.35), ${bg}), url(${draft.stripURL}) top/cover no-repeat`
                : bg,
            }}
          >
            <div className="flex items-center gap-2 px-3 pt-3">
              {draft.logoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.logoURL}
                  alt=""
                  className="size-7 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-md bg-white/15 text-[10px] font-bold text-white">
                  {logoText.slice(0, 1).toUpperCase()}
                </div>
              )}
              <p className="truncate text-xs font-medium text-white">{logoText}</p>
              {draft.headerFields[0] ? (
                <div className="ml-auto text-right">
                  <p className="text-[9px] uppercase text-white/55">
                    {draft.headerFields[0].label}
                  </p>
                  <p className="text-xs font-semibold text-white">
                    {substitutePreview(draft.headerFields[0].value)}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-3 px-4 pb-3 pt-5">
              {draft.primaryFields.slice(0, 2).map((field, i) => (
                <FieldBlock key={`p-${i}`} field={field} />
              ))}
              {draft.secondaryFields.slice(0, 2).map((field, i) => (
                <FieldBlock key={`s-${i}`} field={field} />
              ))}
            </div>

            <div className="px-4 pb-4 pt-1">
              <BarcodePlaceholder
                value={barcodeValue}
                format={draft.barcodeFormat}
              />
              {underBarcode ? (
                <p className="mt-2 text-center text-xs text-white/80">
                  {underBarcode}
                </p>
              ) : null}
              <p className="mt-2 text-center text-[10px] text-white/55">{org}</p>
            </div>
          </div>

          {draft.featuredActions.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {draft.featuredActions.map((action, index) => (
                <div
                  key={action.identifier}
                  className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
                >
                  <div
                    className={`mb-2 flex size-8 items-center justify-center rounded-xl text-sm ${
                      index === 0
                        ? "bg-orange-100 text-orange-600"
                        : "bg-violet-100 text-violet-600"
                    }`}
                  >
                    {index === 0 ? "🛒" : "★"}
                  </div>
                  <p className="text-[11px] font-semibold leading-snug text-zinc-900">
                    {actionLabel(action.type)}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {action.type === "place"
                      ? t("loyalty.walletOpenInMaps")
                      : action.type === "call"
                        ? t("loyalty.walletOpenCall")
                        : t("loyalty.walletOpenLink")}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-3 max-w-[280px] text-center text-xs text-foreground/50">
        {t("loyalty.walletPreviewAppleHint")}
      </p>
    </div>
  );
}
