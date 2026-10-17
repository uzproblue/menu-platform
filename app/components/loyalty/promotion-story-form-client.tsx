"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  GlobalMenuResponse,
  Location,
  PromotionStory,
  PromotionStoryMediaType,
  PromotionStoryMutationBody,
  PromotionStoryPricingMode,
} from "@/lib/auth-api";
import {
  computeComboPrice,
  parsePriceNumber,
} from "@/lib/promotion-combo-price";
import { uploadFileToR2 } from "@/lib/r2-upload-client";
import {
  CatalogImageField,
  type CatalogImageFieldValue,
} from "../global-menu/catalog-image-field";
import { useI18n } from "../i18n-provider";

const LANGS = ["en", "ru", "uz"] as const;
type Lang = (typeof LANGS)[number];

type Props = {
  storyId?: string;
};

type TranslationDraft = {
  title: string;
  subtitle: string;
  badge: string;
  actionText: string;
};

type ProductDraft = {
  menuItemId: string;
  quantity: number;
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

export function PromotionStoryFormClient({ storyId }: Props) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const isEdit = Boolean(storyId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyLang, setCopyLang] = useState<Lang>("en");

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
  const [products, setProducts] = useState<ProductDraft[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [menu, setMenu] = useState<GlobalMenuResponse | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

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
        setStartsAt(s.startsAt ? s.startsAt.slice(0, 16) : "");
        setEndsAt(s.endsAt ? s.endsAt.slice(0, 16) : "");
        setLocationIds(s.locationIds);
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

  function toggleProduct(menuItemId: string) {
    setProducts((prev) => {
      const exists = prev.find((p) => p.menuItemId === menuItemId);
      if (exists) return prev.filter((p) => p.menuItemId !== menuItemId);
      return [...prev, { menuItemId, quantity: 1 }];
    });
  }

  function setProductQty(menuItemId: string, quantity: number) {
    setProducts((prev) =>
      prev.map((p) =>
        p.menuItemId === menuItemId
          ? { ...p, quantity: Math.max(1, Math.round(quantity) || 1) }
          : p,
      ),
    );
  }

  function toggleLocation(id: string) {
    setLocationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
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
      } else {
        mediaUrl = videoUrl.trim();
        if (videoFile) {
          mediaUrl = await uploadFileToR2(videoFile, "promotion-story-media");
        }
      }
      if (!mediaUrl) {
        throw new Error(t("stories.mediaRequired"));
      }

      const body: PromotionStoryMutationBody = {
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
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
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
  const previewMediaSrc =
    mediaType === "photo"
      ? photoMedia.file
        ? URL.createObjectURL(photoMedia.file)
        : photoMedia.url
      : videoFile
        ? URL.createObjectURL(videoFile)
        : videoUrl;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
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
              </label>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
              {t("stories.sectionCopy")}
            </h2>
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
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-foreground/10 p-3">
              {!menu ? (
                <p className="text-sm text-foreground/50">{t("loyalty.loading")}</p>
              ) : (
                menu.categories.map((cat) => (
                  <div key={cat.id}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground/45">
                      {cat.name}
                    </p>
                    <ul className="space-y-1">
                      {cat.items.map((item) => {
                        const selected = products.find((p) => p.menuItemId === item.id);
                        return (
                          <li
                            key={item.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/5"
                          >
                            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(selected)}
                                onChange={() => toggleProduct(item.id)}
                                disabled={saving}
                              />
                              <span className="truncate">{item.name}</span>
                            </label>
                            {selected ? (
                              <input
                                type="number"
                                min={1}
                                value={selected.quantity}
                                onChange={(e) =>
                                  setProductQty(item.id, Number(e.target.value))
                                }
                                disabled={saving}
                                className="w-16 rounded border border-foreground/15 bg-transparent px-2 py-1 text-sm"
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">
              {t("stories.sectionAudience")}
            </h2>
            <div className="flex flex-wrap gap-3">
              {locations.map((loc) => (
                <label
                  key={loc.id}
                  className="flex items-center gap-2 rounded-lg border border-foreground/10 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={locationIds.includes(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                    disabled={saving}
                  />
                  {loc.name}
                </label>
              ))}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-foreground/70">{t("stories.startsAt")}</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-foreground/70">{t("stories.endsAt")}</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2"
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground/45">
            {t("stories.phonePreview")}
          </p>
          <div className="mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[1.75rem] border border-foreground/20 bg-black shadow-xl">
            <div className="relative h-full w-full">
              {previewMediaSrc ? (
                mediaType === "video" ? (
                  <video
                    src={previewMediaSrc}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    autoPlay
                    loop
                  />
                ) : (
                  <Image
                    src={previewMediaSrc}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="260px"
                  />
                )
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
    </form>
  );
}
