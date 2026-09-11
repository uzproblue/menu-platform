"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { useI18n } from "@/app/components/i18n-provider";
import type { GlobalMenuData, MenuItem, MenuSectionEntity } from "@/lib/data/global-menu-types";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";
import type { GlobalMenuResponse } from "@/lib/auth-api";
import { resolveVideoSource } from "@/lib/video-source";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

type FlatMenuItem = MenuItem & {
  categoryId: string;
  categoryName: string;
  menuSectionId: string;
};

type CategoryOption = {
  id: string;
  name: string;
  menuSectionId: string;
};

function flattenMenuItems(data: GlobalMenuData): FlatMenuItem[] {
  const out: FlatMenuItem[] = [];
  for (const cat of data.categories) {
    for (const item of cat.items) {
      out.push({
        ...item,
        categoryId: cat.id,
        categoryName: cat.name,
        menuSectionId: cat.menuSectionId,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function VideoListBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/15 p-0.5 text-emerald-700 dark:text-emerald-400"
      title={label}
      aria-hidden
    >
      <svg
        className="size-3"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.69L9.54 5.98A1 1 0 0 0 8 6.82z" />
      </svg>
    </span>
  );
}

function VideoPreview({
  videoId,
  bunnyLibraryId,
  title,
}: {
  videoId: string;
  bunnyLibraryId: string;
  title: string;
}) {
  const source = resolveVideoSource(videoId, { bunnyLibraryId });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (source?.type !== "hls") return;
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(source.masterUrl);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source.masterUrl;
    }
  }, [source]);

  if (!source) return null;

  if (source.type === "bunny") {
    return (
      <div className="overflow-hidden rounded-xl border border-foreground/10 bg-black/90">
        <iframe
          title={title}
          src={source.embedUrl}
          className="aspect-video w-full"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/10 bg-black">
      <video
        ref={videoRef}
        poster={source.posterUrl}
        controls
        playsInline
        className="aspect-video w-full object-contain"
      />
    </div>
  );
}

type R2UploadSessionResponse = {
  provider: "r2";
  videoId: string;
  restaurantId: string;
  uploadUrl: string;
  tempKey: string;
  publicUrl: string;
  expiresAt: string;
};

type MenuItemVideosClientProps = {
  /** From server env (Worker runtime); avoids relying on NEXT_PUBLIC at build time. */
  bunnyLibraryId: string;
  title: string;
  subtitle: string;
};

export function MenuItemVideosClient({ bunnyLibraryId, title, subtitle }: MenuItemVideosClientProps) {
  const { t } = useI18n();

  const [items, setItems] = useState<FlatMenuItem[]>([]);
  const [sections, setSections] = useState<MenuSectionEntity[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<"all" | string>("all");
  const [category, setCategory] = useState<"all" | string>("all");
  const [videoFilter, setVideoFilter] = useState<"all" | "has" | "none">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Mobile: "list" | "detail"
  const [mobileTab, setMobileTab] = useState<"list" | "detail">("list");

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stageDetail, setStageDetail] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch("/api/settings/global-menu", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { message?: string } | null;
          setMenuError(payload?.message ?? t("menuItemVideos.loadError"));
          setItems([]);
          setCategories([]);
          return;
        }
        const api = (await res.json()) as GlobalMenuResponse;
        if (cancelled) return;
        const data = mapGlobalMenuResponseToData(api);
        setItems(flattenMenuItems(data));
        setSections(
          (data.sections ?? [])
            .filter((s) => s.kind === "standard")
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        );
        setCategories(
          (data.categories ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            menuSectionId: c.menuSectionId,
          })),
        );
      } catch {
        if (!cancelled) {
          setMenuError(t("menuItemVideos.loadError"));
          setItems([]);
          setSections([]);
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMenu(false);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSelectSection = useCallback((nextSection: "all" | string) => {
    setSection(nextSection);
    setCategory("all");
  }, []);

  const availableCategories = useMemo(() => {
    if (section === "all") return categories;
    return categories.filter((c) => c.menuSectionId === section);
  }, [categories, section]);

  const totalMetrics = useMemo(() => {
    const total = items.length;
    const withVideo = items.filter((i) => Boolean(i.videoId?.trim())).length;
    const withoutVideo = total - withVideo;
    const coveragePercent = total > 0 ? Math.round((withVideo / total) * 100) : 0;
    return { total, withVideo, withoutVideo, coveragePercent };
  }, [items]);

  const sectionMetrics = useMemo(() => {
    const map = new Map<string, { total: number; withVideo: number; withoutVideo: number }>();
    for (const item of items) {
      const secId = item.menuSectionId;
      const current = map.get(secId) ?? { total: 0, withVideo: 0, withoutVideo: 0 };
      current.total += 1;
      if (Boolean(item.videoId?.trim())) {
        current.withVideo += 1;
      } else {
        current.withoutVideo += 1;
      }
      map.set(secId, current);
    }
    return map;
  }, [items]);

  const currentSectionMetrics = useMemo(() => {
    if (section === "all") {
      return {
        name: t("menuItemVideos.sectionAll"),
        total: totalMetrics.total,
        withVideo: totalMetrics.withVideo,
        withoutVideo: totalMetrics.withoutVideo,
        coveragePercent: totalMetrics.coveragePercent,
      };
    }
    const sObj = sections.find((s) => s.id === section);
    const sec = sectionMetrics.get(section) ?? { total: 0, withVideo: 0, withoutVideo: 0 };
    const coveragePercent = sec.total > 0 ? Math.round((sec.withVideo / sec.total) * 100) : 0;
    return {
      name: sObj?.name ?? section,
      total: sec.total,
      withVideo: sec.withVideo,
      withoutVideo: sec.withoutVideo,
      coveragePercent,
    };
  }, [section, sections, sectionMetrics, totalMetrics, t]);

  const categoryMetrics = useMemo(() => {
    const map = new Map<string, { total: number; withVideo: number; withoutVideo: number }>();
    for (const item of items) {
      const catId = item.categoryId;
      const current = map.get(catId) ?? { total: 0, withVideo: 0, withoutVideo: 0 };
      current.total += 1;
      if (Boolean(item.videoId?.trim())) {
        current.withVideo += 1;
      } else {
        current.withoutVideo += 1;
      }
      map.set(catId, current);
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (section !== "all" && item.menuSectionId !== section) return false;
      if (category !== "all" && item.categoryId !== category) return false;
      const hasVideo = Boolean(item.videoId?.trim());
      if (videoFilter === "has" && !hasVideo) return false;
      if (videoFilter === "none" && hasVideo) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q)
      );
    });
  }, [items, query, section, category, videoFilter]);

  const filteredWithVideoCount = useMemo(
    () => filtered.filter((i) => Boolean(i.videoId?.trim())).length,
    [filtered],
  );

  const selected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (section !== "all") count++;
    if (category !== "all") count++;
    if (videoFilter !== "all") count++;
    return count;
  }, [section, category, videoFilter]);

  const patchVideoId = useCallback(
    async (itemId: string, videoId: string | null) => {
      const res = await fetch(`/api/settings/menu-items/${encodeURIComponent(itemId)}/video`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? t("menuItemVideos.saveFailed"));
      }
      const data = (await res.json()) as { item?: { videoId?: string } };
      const savedId = data.item?.videoId?.trim() || null;
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, videoId: savedId ?? undefined } : i,
        ),
      );
    },
    [t],
  );

  const handleRemoveVideo = useCallback(async () => {
    if (!selected) return;
    setActionError(null);
    setSaving(true);
    try {
      await patchVideoId(selected.id, null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("menuItemVideos.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [patchVideoId, selected, t]);

  const handleUpload = useCallback(async () => {
    if (!selected || !file) return;
    setActionError(null);
    setUploading(true);
    setUploadProgress(0);
    setStageDetail("");

    try {
      // Step 1: Request presigned R2 upload session
      const sessionRes = await fetch("/api/settings/menu-videos/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "video/mp4",
        }),
      });

      if (!sessionRes.ok) {
        const payload = (await sessionRes.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message ?? t("menuItemVideos.uploadFailed"));
      }

      const session = (await sessionRes.json()) as R2UploadSessionResponse;

      // Step 2: Upload MP4 directly to R2 temp folder with live progress
      setStageDetail("Uploading to R2 temp folder...");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", session.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Direct R2 upload failed with HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error(t("menuItemVideos.uploadFailed")));
        xhr.send(file);
      });

      // Step 3: Trigger transcoding on VPS
      setStageDetail("Starting VPS transcoding (480p, 720p, 1080p)...");
      const transcodeRes = await fetch("/api/settings/menu-videos/transcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selected.id,
          videoId: session.videoId,
          tempKey: session.tempKey,
        }),
      });

      if (!transcodeRes.ok) {
        const payload = (await transcodeRes.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message ?? "Transcoding trigger failed");
      }

      const transcodeData = (await transcodeRes.json()) as { jobId: string };
      const jobId = transcodeData.jobId;

      // Step 4: Poll VPS job status until completed
      const pollStart = Date.now();
      let completedMasterKey: string | null = null;

      while (Date.now() - pollStart < 300000) {
        // max 5 min
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(
          `/api/settings/menu-videos/job-status?jobId=${encodeURIComponent(jobId)}`,
        );
        if (!statusRes.ok) continue;

        const statusData = (await statusRes.json()) as {
          status?: string;
          hlsMasterKey?: string;
          error?: string;
        };

        if (statusData.status === "completed") {
          completedMasterKey =
            statusData.hlsMasterKey ||
            `videos/${session.restaurantId}/${selected.id}/${session.videoId}/master.m3u8`;
          break;
        } else if (statusData.status === "failed") {
          throw new Error(statusData.error || "Transcoding failed on VPS");
        } else if (statusData.status) {
          setStageDetail(`VPS processing: ${statusData.status}...`);
        }
      }

      if (!completedMasterKey) {
        throw new Error("Transcoding timed out on VPS");
      }

      // Save master playlist on item
      await patchVideoId(selected.id, completedMasterKey);
      setFile(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("menuItemVideos.uploadFailed"),
      );
    } finally {
      setUploading(false);
      setStageDetail("");
    }
  }, [file, patchVideoId, selected, t]);

  const previewSource = selected?.videoId
    ? resolveVideoSource(selected.videoId, { bunnyLibraryId })
    : null;

  // Coverage bar width
  const coverageWidth = `${totalMetrics.coveragePercent}%`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-foreground/8 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-foreground/55">{subtitle}</p>
          </div>

          {/* Compact metrics pill row (desktop only) */}
          {!loadingMenu && !menuError && (
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <div className="flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background/60 px-3 py-1.5">
                <span className="text-xs text-foreground/50">{t("menuItemVideos.totalItems")}</span>
                <span className="text-sm font-semibold text-foreground">{totalMetrics.total}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  {totalMetrics.withVideo}/{totalMetrics.total}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {totalMetrics.coveragePercent}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Coverage progress bar */}
        {!loadingMenu && !menuError && totalMetrics.total > 0 && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/8">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: coverageWidth }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Toolbar: search + filter toggle ── */}
      <div className="shrink-0 border-b border-foreground/8 py-2.5">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-foreground/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder={t("menuItemVideos.searchItems")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-foreground/12 bg-background/60 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Video filter segment (desktop) */}
          <div className="hidden items-center gap-0.5 rounded-lg border border-foreground/10 bg-foreground/5 p-0.5 sm:flex">
            {(["all", "has", "none"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVideoFilter(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  videoFilter === v
                    ? v === "has"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-foreground text-background shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {v === "all"
                  ? t("menuItemVideos.videoFilterAll")
                  : v === "has"
                    ? t("menuItemVideos.videoFilterWithVideo")
                    : t("menuItemVideos.videoFilterWithoutVideo")}
              </button>
            ))}
          </div>

          {/* Filter toggle button */}
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              filtersOpen || activeFilterCount > 0
                ? "border-foreground/25 bg-foreground/10 text-foreground"
                : "border-foreground/12 bg-foreground/5 text-foreground/60 hover:text-foreground"
            }`}
          >
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expandable filter panel */}
        {filtersOpen && (
          <div className="mt-2.5 space-y-3 rounded-xl border border-foreground/10 bg-foreground/3 p-3">
            {/* Video filter (mobile only) */}
            <div className="sm:hidden">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                {t("menuItemVideos.videoFilterLabel")}
              </p>
              <div className="flex items-center gap-0.5 self-start rounded-lg border border-foreground/10 bg-foreground/5 p-0.5">
                {(["all", "has", "none"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVideoFilter(v)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      videoFilter === v
                        ? v === "has"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-foreground text-background shadow-sm"
                        : "text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {v === "all"
                      ? t("menuItemVideos.videoFilterAll")
                      : v === "has"
                        ? t("menuItemVideos.videoFilterWithVideo")
                        : t("menuItemVideos.videoFilterWithoutVideo")}
                  </button>
                ))}
              </div>
            </div>

            {/* Section filter */}
            {sections.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                  {t("menuItemVideos.sectionFilterLabel")}
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelectSection("all")}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      section === "all"
                        ? "bg-foreground text-background"
                        : "border border-foreground/12 bg-background/60 text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {t("menuItemVideos.sectionAll")}{" "}
                    <span className="opacity-60">
                      {totalMetrics.withVideo}/{totalMetrics.total}
                    </span>
                  </button>
                  {sections.map((s) => {
                    const sm = sectionMetrics.get(s.id) ?? { total: 0, withVideo: 0 };
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSection(s.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          section === s.id
                            ? "bg-foreground text-background"
                            : "border border-foreground/12 bg-background/60 text-foreground/60 hover:text-foreground"
                        }`}
                      >
                        {s.name}{" "}
                        <span className="opacity-60">
                          {sm.withVideo}/{sm.total}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category filter */}
            {availableCategories.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                  {t("menuItemVideos.categoryFilterLabel")}
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setCategory("all")}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      category === "all"
                        ? "bg-foreground text-background"
                        : "border border-foreground/12 bg-background/60 text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {t("menuItemVideos.allCategories")}{" "}
                    <span className="opacity-60">
                      {currentSectionMetrics.withVideo}/{currentSectionMetrics.total}
                    </span>
                  </button>
                  {availableCategories.map((cat) => {
                    const cm = categoryMetrics.get(cat.id) ?? { total: 0, withVideo: 0 };
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          category === cat.id
                            ? "bg-foreground text-background"
                            : "border border-foreground/12 bg-background/60 text-foreground/60 hover:text-foreground"
                        }`}
                      >
                        {cat.name}{" "}
                        <span className="opacity-60">
                          {cm.withVideo}/{cm.total}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSection("all");
                  setCategory("all");
                  setVideoFilter("all");
                }}
                className="text-xs text-foreground/50 underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile tab nav (only when an item is selected) ── */}
      {selected && (
        <div className="flex shrink-0 border-b border-foreground/8 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("list")}
            className={`flex-1 py-2 text-center text-sm font-medium transition ${
              mobileTab === "list"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/50 hover:text-foreground"
            }`}
          >
            Items
            <span className="ml-1.5 text-xs opacity-60">
              ({filtered.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("detail")}
            className={`flex-1 truncate py-2 text-center text-sm font-medium transition ${
              mobileTab === "detail"
                ? "border-b-2 border-foreground text-foreground"
                : "text-foreground/50 hover:text-foreground"
            }`}
          >
            <span className="truncate">{selected.name}</span>
          </button>
        </div>
      )}

      {/* ── Main content: list + detail ── */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">

        {/* Items list */}
        <aside
          className={`flex min-h-0 flex-col border-foreground/8 lg:border-r ${
            selected && mobileTab === "detail" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Result count */}
          <div className="shrink-0 px-3 py-1.5">
            <p className="text-[11px] text-foreground/45">
              {t("menuItemVideos.showingItems").replace("{count}", String(filtered.length))}
              {" · "}
              {filteredWithVideoCount} {t("menuItemVideos.hasVideo").toLowerCase()}
            </p>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {loadingMenu ? (
              <li className="px-3 py-6 text-sm text-foreground/50">
                {t("menuItemVideos.loadingMenu")}
              </li>
            ) : menuError ? (
              <li className="px-3 py-6 text-sm text-red-600 dark:text-red-400">{menuError}</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-10 text-center">
                <p className="text-sm text-foreground/45">{t("menuItemVideos.noItems")}</p>
              </li>
            ) : (
              filtered.map((item) => {
                const hasVideo = Boolean(item.videoId?.trim());
                const isSelected = selectedId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setActionError(null);
                        setFile(null);
                        setMobileTab("detail");
                      }}
                      aria-label={
                        hasVideo
                          ? `${item.name}, ${item.categoryName}, ${t("menuItemVideos.hasVideo")}`
                          : `${item.name}, ${item.categoryName}`
                      }
                      className={`flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition ${
                        hasVideo ? "border-emerald-500/60" : "border-transparent"
                      } ${
                        isSelected
                          ? "bg-foreground/8 font-medium text-foreground"
                          : "text-foreground/75 hover:bg-foreground/4"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{item.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-foreground/45">
                          {item.categoryName}
                        </span>
                      </span>
                      {hasVideo && <VideoListBadge label={t("menuItemVideos.hasVideo")} />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Detail panel */}
        <section
          className={`min-h-0 overflow-y-auto ${
            selected && mobileTab === "list" ? "hidden lg:block" : "block"
          }`}
        >
          {!selected ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <svg
                  className="mx-auto mb-3 size-10 text-foreground/20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="6" width="14" height="12" rx="2" />
                  <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11v2z" />
                </svg>
                <p className="text-sm text-foreground/45">{t("menuItemVideos.selectItem")}</p>
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <div className="space-y-5 sm:space-y-6">
                {/* Item header */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                  <p className="text-sm text-foreground/50">{selected.categoryName}</p>
                </div>

                {/* Current video ID */}
                <div className="rounded-xl border border-foreground/10 bg-foreground/3 p-4">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/45">
                    {t("menuItemVideos.currentVideo")}
                  </p>
                  {selected.videoId ? (
                    <p className="break-all font-mono text-xs text-foreground/70">
                      {selected.videoId}
                    </p>
                  ) : (
                    <p className="text-sm text-foreground/45">{t("menuItemVideos.noVideo")}</p>
                  )}
                </div>

                {/* Video preview */}
                {selected.videoId && previewSource ? (
                  <VideoPreview
                    videoId={selected.videoId}
                    bunnyLibraryId={bunnyLibraryId}
                    title={selected.name}
                  />
                ) : selected.videoId ? (
                  <p className="text-xs text-foreground/45">
                    {t("menuItemVideos.previewNoLibrary")}
                  </p>
                ) : null}

                {/* Upload section */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">
                    {t("menuItemVideos.uploadLabel")}
                  </label>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    disabled={uploading || saving}
                    className="block w-full text-sm text-foreground/75 file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
                    onChange={(e) => {
                      const next = e.target.files?.[0] ?? null;
                      setActionError(null);
                      if (next && next.size > MAX_VIDEO_BYTES) {
                        setFile(null);
                        setActionError(t("menuItemVideos.fileTooLarge"));
                        e.target.value = "";
                        return;
                      }
                      if (next && next.type && !next.type.startsWith("video/")) {
                        setFile(null);
                        setActionError(t("menuItemVideos.invalidFileType"));
                        e.target.value = "";
                        return;
                      }
                      setFile(next);
                    }}
                  />

                  {/* Upload progress */}
                  {uploading && (
                    <div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                        <div
                          className="h-full bg-foreground transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-foreground/50">
                        {stageDetail || `${t("menuItemVideos.uploading")} ${uploadProgress}%`}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!file || uploading || saving}
                      onClick={() => void handleUpload()}
                      className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-35"
                    >
                      {uploading ? t("menuItemVideos.uploading") : t("menuItemVideos.upload")}
                    </button>

                    {selected.videoId && (
                      <button
                        type="button"
                        disabled={uploading || saving}
                        onClick={() => void handleRemoveVideo()}
                        className="rounded-lg border border-red-500/35 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/8 disabled:opacity-35 dark:text-red-400"
                      >
                        {saving ? t("menuItemVideos.removing") : t("menuItemVideos.removeVideo")}
                      </button>
                    )}
                  </div>
                </div>

                {/* Error */}
                {actionError && (
                  <p
                    className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400"
                    role="alert"
                  >
                    {actionError}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
