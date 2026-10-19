"use client";

import Hls from "hls.js";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GlobalMenuResponse,
  Location,
  PromotionStory,
  PromotionStoryMediaType,
  PromotionStoryMutationBody,
  PromotionStoryPricingMode,
} from "@/lib/auth-api";
import { uploadAndTranscodeMenuVideo } from "@/lib/menu-video-upload";
import {
  computeComboPrice,
  parsePriceNumber,
} from "@/lib/promotion-combo-price";
import { DEFAULT_LOCATION_TIMEZONE } from "@/lib/location-timezones";
import { expandR2AssetToPublicUrl, looksLikeR2ObjectKey } from "@/lib/r2-object-key";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import { resolveVideoSource } from "@/lib/video-source";
import {
  endOfDayUtcIso,
  isoToYmdInZone,
  startOfDayUtcIso,
} from "@/lib/zoned-datetime";
import {
  CatalogImageField,
  type CatalogImageFieldValue,
} from "../global-menu/catalog-image-field";
import { useI18n } from "../i18n-provider";
import {
  PromotionStoryProductPickerModal,
  type StoryProductDraft,
} from "./promotion-story-product-picker-modal";

const LANGS = ["en", "ru", "uz"] as const;
type Lang = (typeof LANGS)[number];

const WEEKDAY_KEYS = [
  "stories.daySun",
  "stories.dayMon",
  "stories.dayTue",
  "stories.dayWed",
  "stories.dayThu",
  "stories.dayFri",
  "stories.daySat",
] as const;

type Props = {
  storyId?: string;
};

type TranslationDraft = {
  title: string;
  subtitle: string;
  badge: string;
  actionText: string;
};

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function emptyTranslations(): Record<Lang, TranslationDraft> {
  return {
    en: { title: "", subtitle: "", badge: "", actionText: "" },
    ru: { title: "", subtitle: "", badge: "", actionText: "" },
    uz: { title: "", subtitle: "", badge: "", actionText: "" },
  };
}

function readR2PublicBase(): string {
  return (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    ""
  ).replace(/\/+$/, "");
}

function expandMediaForDisplay(value: string): string {
  const t = value.trim();
  if (!t.length || t.startsWith("blob:") || t.startsWith("data:")) return t;
  if (t.includes("://")) return t;
  const base = readR2PublicBase();
  if (!base) return t;
  if (looksLikeR2ObjectKey(t)) {
    return expandR2AssetToPublicUrl(t, base) ?? t;
  }
  return `${base}/${t.replace(/^\/+/, "")}`;
}

function StoryHlsPreview({ mediaKey }: { mediaKey: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const source = resolveVideoSource(mediaKey);

  useEffect(() => {
    if (source?.type !== "hls") return;
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(source.masterUrl);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source.masterUrl;
    }
  }, [source]);

  if (!source || source.type !== "hls") return null;

  return (
    <video
      ref={videoRef}
      poster={source.posterUrl}
      className="h-full w-full object-cover"
      muted
      playsInline
      autoPlay
      loop
    />
  );
}

export function PromotionStoryFormClient({ storyId }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const isEdit = Boolean(storyId);

  const [clientStoryId] = useState(() => storyId ?? crypto.randomUUID());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyLang, setCopyLang] = useState<Lang>("en");
  const [uploadStage, setUploadStage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [mediaType, setMediaType] = useState<PromotionStoryMediaType>("photo");
  const [preview, setPreview] = useState<CatalogImageFieldValue>({ url: "", file: null });
  const [photoMedia, setPhotoMedia] = useState<CatalogImageFieldValue>({ url: "", file: null });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [durationMs, setDurationMs] = useState("5000");
  const [badgeColor, setBadgeColor] = useState("#f59e0b");
  const [translations, setTranslations] = useState(emptyTranslations);
  const [pricingMode, setPricingMode] = useState<PromotionStoryPricingMode>("percent_off");
  const [pricingValue, setPricingValue] = useState("20");
  const [products, setProducts] = useState<StoryProductDraft[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [scheduleLimited, setScheduleLimited] = useState(false);
  const [activeTimeStart, setActiveTimeStart] = useState("08:00");
  const [activeTimeEnd, setActiveTimeEnd] = useState("13:00");
  const [activeDaysOfWeek, setActiveDaysOfWeek] = useState<number[]>([]);

  const [menu, setMenu] = useState<GlobalMenuResponse | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  const scheduleTimezone = useMemo(() => {
    const first = locations.find((l) => locationIds.includes(l.id));
    return first?.timezone?.trim() || DEFAULT_LOCATION_TIMEZONE;
  }, [locations, locationIds]);

  useEffect(() => {
    void (async () => {
      try {
        const [menuRes, locRes] = await Promise.all([
          fetch("/api/settings/global-menu", { cache: "no-store" }),
          fetch("/api/settings/locations", { cache: "no-store" }),
        ]);
        if (menuRes.ok) {
          setMenu((await menuRes.json()) as GlobalMenuResponse);
        }
        if (locRes.ok) {
          const data = (await locRes.json()) as { locations?: Location[] } | Location[];
          setLocations(Array.isArray(data) ? data : (data.locations ?? []));
        }
      } catch {
        /* picker empty until retry */
      }
    })();
  }, []);

  useEffect(() => {
    if (!storyId) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/settings/promotion-stories/${encodeURIComponent(storyId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(await readErrorMessage(res, t("stories.errLoadOne")));
        }
        const data = (await res.json()) as { story: PromotionStory };
        const s = data.story;
        setMediaType(s.mediaType);
        setPreview({ url: s.previewImageUrl, file: null });
        if (s.mediaType === "photo") {
          setPhotoMedia({ url: s.mediaUrl, file: null });
        } else {
          setVideoUrl(s.mediaUrl);
        }
        setDurationMs(s.durationMs != null ? String(s.durationMs) : "5000");
        setBadgeColor(s.badgeColor ?? "#f59e0b");
        setPricingMode(s.pricingMode);
        setPricingValue(s.pricingValue);
        setActive(s.active);
        setLocationIds(s.locationIds);
        setStartsAt(
          s.startsAt ? isoToYmdInZone(s.startsAt, DEFAULT_LOCATION_TIMEZONE) : "",
        );
        setEndsAt(s.endsAt ? isoToYmdInZone(s.endsAt, DEFAULT_LOCATION_TIMEZONE) : "");
        const hasRecurring =
          Boolean(s.activeTimeStart && s.activeTimeEnd) ||
          (Array.isArray(s.activeDaysOfWeek) && s.activeDaysOfWeek.length > 0);
        setScheduleLimited(hasRecurring);
        setActiveTimeStart(s.activeTimeStart ?? "08:00");
        setActiveTimeEnd(s.activeTimeEnd ?? "13:00");
        setActiveDaysOfWeek(
          Array.isArray(s.activeDaysOfWeek) ? [...s.activeDaysOfWeek] : [],
        );
        setProducts(
          s.products.map((p) => ({ menuItemId: p.menuItemId, quantity: p.quantity })),
        );
        const next = emptyTranslations();
        for (const tr of s.translations) {
          const lang = tr.lang as Lang;
          if (LANGS.includes(lang)) {
            next[lang] = {
              title: tr.title,
              subtitle: tr.subtitle,
              badge: tr.badge ?? "",
              actionText: tr.actionText ?? "",
            };
          }
        }
        setTranslations(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("stories.errLoadOne"));
      } finally {
        setLoading(false);
      }
    })();
  }, [storyId, t]);

  const itemPriceById = useMemo(() => {
    const map = new Map<string, { name: string; price: number; categoryName: string }>();
    if (!menu) return map;
    for (const cat of menu.categories) {
      for (const item of cat.items) {
        const price = parsePriceNumber(item.prices?.[0]?.price ?? 0);
        map.set(item.id, { name: item.name, price, categoryName: cat.name });
      }
    }
    return map;
  }, [menu]);

  const listTotal = useMemo(() => {
    return products.reduce((sum, p) => {
      const info = itemPriceById.get(p.menuItemId);
      return sum + (info?.price ?? 0) * p.quantity;
    }, 0);
  }, [products, itemPriceById]);

  const comboPrice = useMemo(
    () => computeComboPrice(listTotal, pricingMode, parsePriceNumber(pricingValue)),
    [listTotal, pricingMode, pricingValue],
  );

  function toggleLocation(id: string) {
    setLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setUploadStage("");
    setUploadProgress(0);
    try {
      let previewImageUrl = preview.url.trim();
      if (preview.file) {
        previewImageUrl = await uploadFileToR2(preview.file, "promotion-preview");
      }
      if (!previewImageUrl) {
        throw new Error(t("stories.previewRequired"));
      }

      let mediaUrl = "";
      if (mediaType === "photo") {
        mediaUrl = photoMedia.url.trim();
        if (photoMedia.file) {
          mediaUrl = await uploadFileToR2(photoMedia.file, "promotion-story-media");
        }
      } else if (videoFile) {
        mediaUrl = await uploadAndTranscodeMenuVideo({
          file: videoFile,
          itemId: clientStoryId,
          onProgress: setUploadProgress,
          onStage: setUploadStage,
        });
        setVideoUrl(mediaUrl);
        setVideoFile(null);
      } else {
        mediaUrl = videoUrl.trim();
      }
      if (!mediaUrl) {
        throw new Error(t("stories.mediaRequired"));
      }

      const body: PromotionStoryMutationBody = {
        ...(isEdit ? {} : { id: clientStoryId }),
        mediaType,
        mediaUrl,
        previewImageUrl,
        durationMs:
          mediaType === "photo" && durationMs.trim()
            ? Number(durationMs)
            : null,
        badgeColor: badgeColor.trim() || null,
        pricingMode,
        pricingValue:
          pricingMode === "percent_off"
            ? Number(pricingValue)
            : pricingValue,
        active,
        startsAt: startsAt ? startOfDayUtcIso(startsAt, scheduleTimezone) : null,
        endsAt: endsAt ? endOfDayUtcIso(endsAt, scheduleTimezone) : null,
        activeTimeStart: scheduleLimited
          ? (activeTimeStart.match(/^(\d{2}):(\d{2})/)?.[0] ?? null)
          : null,
        activeTimeEnd: scheduleLimited
          ? (activeTimeEnd.match(/^(\d{2}):(\d{2})/)?.[0] ?? null)
          : null,
        activeDaysOfWeek:
          scheduleLimited && activeDaysOfWeek.length > 0
            ? [...activeDaysOfWeek].sort((a, b) => a - b)
            : null,
        translations: LANGS.map((lang) => ({
          lang,
          title: translations[lang].title.trim(),
          subtitle: translations[lang].subtitle.trim(),
          badge: translations[lang].badge.trim() || null,
          actionText: translations[lang].actionText.trim() || null,
        })).filter((tr) => tr.title.length > 0),
        products: products.map((p, i) => ({
          menuItemId: p.menuItemId,
          quantity: p.quantity,
          sortOrder: i,
        })),
        locationIds,
      };

      if (!body.translations.length) {
        throw new Error(t("stories.titleRequired"));
      }
      if (!body.products.length) {
        throw new Error(t("stories.productsRequired"));
      }
      if (!body.locationIds.length) {
        throw new Error(t("stories.locationsRequired"));
      }

      const url = isEdit
        ? `/api/settings/promotion-stories/${encodeURIComponent(storyId!)}`
        : "/api/settings/promotion-stories";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("stories.errSave")));
      }
      router.push("/loyalty/promotions");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("stories.errSave"));
    } finally {
      setSaving(false);
      setUploadStage("");
      setUploadProgress(0);
    }
  }

  if (loading) {
    return <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>;
  }

  const previewTitle =
    translations[copyLang].title ||
    translations.en.title ||
    t("stories.previewPlaceholderTitle");
  const previewSubtitle =
    translations[copyLang].subtitle || translations.en.subtitle || "";
  const previewBadge = translations[copyLang].badge || translations.en.badge;

  const photoSrc = photoMedia.file
    ? URL.createObjectURL(photoMedia.file)
    : photoMedia.url
      ? expandMediaForDisplay(photoMedia.url)
      : "";
  const videoBlobSrc = videoFile ? URL.createObjectURL(videoFile) : "";
  const videoIsHls =
    !videoFile &&
    Boolean(
      videoUrl &&
        (videoUrl.endsWith(".m3u8") ||
          videoUrl.startsWith("videos/") ||
          videoUrl.includes("/videos/")),
    );
  const videoProgressiveSrc =
    !videoFile && videoUrl && !videoIsHls ? expandMediaForDisplay(videoUrl) : "";

  const previewImageSrc = preview.file
    ? URL.createObjectURL(preview.file)
    : preview.url
      ? expandMediaForDisplay(preview.url)
      : "";

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
              {t("stories.sectionMedia")}
            </h2>
            <CatalogImageField
              label={t("stories.previewImage")}
              value={preview}
              onChange={setPreview}
              uploadTarget="promotion-preview"
              disabled={saving}
            />
            <div className="flex gap-3">
              {(["photo", "video"] as const).map((kind) => (
                <label key={kind} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mediaType"
                    checked={mediaType === kind}
                    onChange={() => setMediaType(kind)}
                    disabled={saving}
                  />
                  {kind === "photo" ? t("stories.mediaPhoto") : t("stories.mediaVideo")}
                </label>
              ))}
            </div>
            {mediaType === "photo" ? (
              <>
                <CatalogImageField
                  label={t("stories.storyMedia")}
                  value={photoMedia}
                  onChange={setPhotoMedia}
                  uploadTarget="promotion-story-media"
                  disabled={saving}
                />
                <label className="block text-sm">
                  <span className="text-foreground/70">{t("stories.durationMs")}</span>
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    value={durationMs}
                    onChange={(e) => setDurationMs(e.target.value)}
                    disabled={saving}
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
                  />
                </label>
              </>
            ) : (
              <label className="block text-sm">
                <span className="text-foreground/70">{t("stories.storyVideo")}</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  disabled={saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setVideoFile(file);
                  }}
                  className="mt-1 block w-full text-sm"
                />
                {videoUrl && !videoFile ? (
                  <p className="mt-1 truncate text-xs text-foreground/50">{videoUrl}</p>
                ) : null}
                <p className="mt-1 text-xs text-foreground/45">{t("stories.videoHint")}</p>
                {saving && uploadStage ? (
                  <p className="mt-2 text-xs text-foreground/60">
                    {uploadStage}
                    {uploadProgress > 0 ? ` ${uploadProgress}%` : ""}
                  </p>
                ) : null}
              </label>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
              {t("stories.sectionCopy")}
            </h2>
            <p className="text-xs text-foreground/50">{t("stories.copyHint")}</p>
            <div className="flex gap-2">
              {LANGS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setCopyLang(lang)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    copyLang === lang
                      ? "bg-foreground text-background"
                      : "border border-foreground/15 text-foreground/70"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            {(
              [
                ["title", t("stories.fieldTitle")],
                ["subtitle", t("stories.fieldSubtitle")],
                ["badge", t("stories.fieldBadge")],
                ["actionText", t("stories.fieldCta")],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="text-foreground/70">{label}</span>
                <input
                  value={translations[copyLang][key]}
                  onChange={(e) =>
                    setTranslations((prev) => ({
                      ...prev,
                      [copyLang]: { ...prev[copyLang], [key]: e.target.value },
                    }))
                  }
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="text-foreground/70">{t("stories.badgeColor")}</span>
              <input
                type="color"
                value={badgeColor}
                onChange={(e) => setBadgeColor(e.target.value)}
                disabled={saving}
                className="mt-1 h-10 w-16 cursor-pointer rounded border border-foreground/15 bg-transparent"
              />
            </label>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
              {t("stories.sectionCombo")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-foreground/70">{t("stories.pricingMode")}</span>
                <select
                  value={pricingMode}
                  onChange={(e) =>
                    setPricingMode(e.target.value as PromotionStoryPricingMode)
                  }
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
                >
                  <option value="fixed">{t("stories.pricingFixed")}</option>
                  <option value="percent_off">{t("stories.pricingPercent")}</option>
                  <option value="amount_off">{t("stories.pricingAmount")}</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-foreground/70">{t("stories.pricingValue")}</span>
                <input
                  type="number"
                  min={0}
                  step={pricingMode === "percent_off" ? 1 : 0.01}
                  value={pricingValue}
                  onChange={(e) => setPricingValue(e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
                />
              </label>
            </div>
            <p className="text-sm text-foreground/60">
              {t("stories.priceSummary", {
                list: listTotal.toFixed(0),
                combo: comboPrice.toFixed(0),
              })}
            </p>
            <div className="space-y-2 rounded-xl border border-foreground/10 p-3">
              {products.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("stories.noProductsSelected")}</p>
              ) : (
                <ul className="space-y-1">
                  {products.map((p) => {
                    const info = itemPriceById.get(p.menuItemId);
                    return (
                      <li
                        key={p.menuItemId}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">
                          {info?.name ?? p.menuItemId.slice(0, 8)} ×{p.quantity}
                        </span>
                        <span className="shrink-0 text-foreground/50">
                          {((info?.price ?? 0) * p.quantity).toFixed(0)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                disabled={saving || !menu}
                onClick={() => setPickerOpen(true)}
                className="rounded-lg border border-foreground/15 px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {products.length
                  ? t("stories.editCombo")
                  : t("stories.chooseProducts")}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
              {t("stories.sectionAudience")}
            </h2>
            <div className="flex flex-wrap gap-3">
              {locations.map((loc) => {
                const isDelivery = loc.type === "delivery";
                return (
                  <label
                    key={loc.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      isDelivery
                        ? "border-sky-500/25 bg-sky-500/5"
                        : "border-foreground/10 bg-background/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={locationIds.includes(loc.id)}
                      onChange={() => toggleLocation(loc.id)}
                      disabled={saving}
                    />
                    <span className="min-w-0 font-medium">{loc.name}</span>
                    <span
                      className={
                        isDelivery
                          ? "inline-flex shrink-0 items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300"
                          : "inline-flex shrink-0 items-center rounded-full border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/65"
                      }
                    >
                      {isDelivery
                        ? t("restaurants.deliveryBadge")
                        : t("restaurants.dineInBadge")}
                    </span>
                  </label>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={saving}
              />
              {t("loyalty.active")}
            </label>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                {t("stories.sectionSchedule")}
              </h3>
              <p className="mt-1 text-xs text-foreground/50">
                {t("stories.scheduleTimezoneHint", { timezone: scheduleTimezone })}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-foreground/70">{t("stories.startsAt")}</span>
                <input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-foreground"
                />
              </label>
              <label className="block text-sm">
                <span className="text-foreground/70">{t("stories.endsAt")}</span>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-foreground"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scheduleLimited}
                onChange={(e) => setScheduleLimited(e.target.checked)}
                disabled={saving}
              />
              {t("stories.limitByTimeOrDays")}
            </label>
            {scheduleLimited ? (
              <div className="space-y-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-foreground/70">{t("stories.activeTimeStart")}</span>
                    <input
                      type="time"
                      value={activeTimeStart}
                      onChange={(e) => setActiveTimeStart(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-foreground"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-foreground/70">{t("stories.activeTimeEnd")}</span>
                    <input
                      type="time"
                      value={activeTimeEnd}
                      onChange={(e) => setActiveTimeEnd(e.target.value)}
                      disabled={saving}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-foreground"
                    />
                  </label>
                </div>
                <p className="text-xs text-foreground/45">{t("stories.overnightHint")}</p>
                <div>
                  <p className="text-xs font-medium text-foreground/70">
                    {t("stories.activeDays")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAY_KEYS.map((key, day) => {
                      const selected = activeDaysOfWeek.includes(day);
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            setActiveDaysOfWeek((prev) =>
                              prev.includes(day)
                                ? prev.filter((d) => d !== day)
                                : [...prev, day],
                            )
                          }
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                            selected
                              ? "bg-foreground text-background"
                              : "border border-foreground/15 text-foreground/70"
                          }`}
                        >
                          {t(key)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-foreground/45">
                    {t("stories.activeDaysHint")}
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/45">
              {t("stories.homeCardPreview")}
            </p>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-foreground/15 bg-black shadow-lg">
              {previewImageSrc ? (
                <Image
                  src={previewImageSrc}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="380px"
                  unoptimized={previewImageSrc.startsWith("blob:")}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-white/40">
                  {t("stories.previewNoMedia")}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                  {t("stories.homeCardEyebrow")}
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-snug">
                  {previewTitle}
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/45">
              {t("stories.phonePreview")}
            </p>
            <div className="mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[1.75rem] border border-foreground/20 bg-black shadow-xl">
              <div className="relative h-full w-full">
                {mediaType === "video" ? (
                  videoBlobSrc ? (
                    <video
                      src={videoBlobSrc}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      autoPlay
                      loop
                    />
                  ) : videoIsHls ? (
                    <StoryHlsPreview mediaKey={videoUrl} />
                  ) : videoProgressiveSrc ? (
                    <video
                      src={videoProgressiveSrc}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      autoPlay
                      loop
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-white/40">
                      {t("stories.previewNoMedia")}
                    </div>
                  )
                ) : photoSrc ? (
                  <Image
                    src={photoSrc}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized={photoSrc.startsWith("blob:")}
                    sizes="260px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/40">
                    {t("stories.previewNoMedia")}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16 text-white">
                  {previewBadge ? (
                    <span
                      className="mb-2 inline-block rounded px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: badgeColor }}
                    >
                      {previewBadge}
                    </span>
                  ) : null}
                  <p className="text-sm font-semibold leading-snug">{previewTitle}</p>
                  {previewSubtitle ? (
                    <p className="mt-1 text-xs text-white/80">{previewSubtitle}</p>
                  ) : null}
                  <div className="mt-3 rounded-full bg-white px-3 py-2 text-center text-xs font-semibold text-black">
                    {translations[copyLang].actionText ||
                      translations.en.actionText ||
                      t("stories.tryIt")}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-foreground/45">
              {locale}
            </p>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-foreground/10 bg-background/90 py-4 backdrop-blur">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? t("loyalty.saving") : t("common.save")}
        </button>
        <Link
          href="/loyalty/promotions"
          className="rounded-xl border border-foreground/15 px-5 py-2.5 text-sm"
        >
          {t("common.cancel")}
        </Link>
      </div>

      <PromotionStoryProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        menu={menu}
        products={products}
        onConfirm={setProducts}
        pricingMode={pricingMode}
        pricingValue={pricingValue}
        disabled={saving}
      />
    </form>
  );
}
