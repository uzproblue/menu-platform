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
  categoryName: string;
  menuSectionId: string;
};

function flattenMenuItems(data: GlobalMenuData): FlatMenuItem[] {
  const out: FlatMenuItem[] = [];
  for (const cat of data.categories) {
    for (const item of cat.items) {
      out.push({
        ...item,
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
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400"
      title={label}
      aria-hidden
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
        <rect x="2" y="6" width="14" height="12" rx="2" />
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11v2z" />
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
      <div className="overflow-hidden rounded-lg border border-foreground/10 bg-black/90">
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
    <div className="overflow-hidden rounded-lg border border-foreground/10 bg-black">
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
};

export function MenuItemVideosClient({ bunnyLibraryId }: MenuItemVideosClientProps) {
  const { t } = useI18n();

  const [items, setItems] = useState<FlatMenuItem[]>([]);
  const [sections, setSections] = useState<MenuSectionEntity[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<"all" | string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stageDetail, setStageDetail] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadMenu = useCallback(async () => {
    setLoadingMenu(true);
    setMenuError(null);
    try {
      const res = await fetch("/api/settings/global-menu", { cache: "no-store" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        setMenuError(payload?.message ?? t("menuItemVideos.loadError"));
        setItems([]);
        return;
      }
      const api = (await res.json()) as GlobalMenuResponse;
      const data = mapGlobalMenuResponseToData(api);
      setItems(flattenMenuItems(data));
      setSections(
        (data.sections ?? [])
          .filter((s) => s.kind === "standard")
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      );
    } catch {
      setMenuError(t("menuItemVideos.loadError"));
      setItems([]);
      setSections([]);
    } finally {
      setLoadingMenu(false);
    }
  }, [t]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (section !== "all" && item.menuSectionId !== section) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q)
      );
    });
  }, [items, query, section]);

  const selected = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId],
  );

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

  return (
    <div className="mt-6 flex min-h-0 flex-1 flex-col sm:mt-8">
      <div className="grid h-full min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-stretch">
        <aside className="flex h-full min-h-0 max-h-[min(50vh,100%)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-background/40 lg:max-h-full">
          <div className="shrink-0 border-b border-foreground/10 p-3">
            <input
              type="search"
              placeholder={t("menuItemVideos.searchItems")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSection("all")}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  section === "all"
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 text-foreground/70"
                }`}
              >
                {t("menuItemVideos.sectionAll")}
              </button>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${
                    section === s.id
                      ? "bg-foreground text-background"
                      : "bg-foreground/10 text-foreground/70"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingMenu ? (
              <li className="px-2 py-4 text-sm text-foreground/55">
                {t("menuItemVideos.loadingMenu")}
              </li>
            ) : menuError ? (
              <li className="px-2 py-4 text-sm text-red-600 dark:text-red-400">
                {menuError}
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-2 py-4 text-sm text-foreground/55">
                {t("menuItemVideos.noItems")}
              </li>
            ) : (
              filtered.map((item) => {
                const hasVideo = Boolean(item.videoId?.trim());
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setActionError(null);
                        setFile(null);
                      }}
                      aria-label={
                        hasVideo
                          ? `${item.name}, ${item.categoryName}, ${t("menuItemVideos.hasVideo")}`
                          : `${item.name}, ${item.categoryName}`
                      }
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                        hasVideo
                          ? "border-l-2 border-emerald-500/50 pl-2.5"
                          : "border-l-2 border-transparent pl-2.5"
                      } ${
                        selectedId === item.id
                          ? "bg-foreground/10 font-medium text-foreground"
                          : "text-foreground/80 hover:bg-foreground/5"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-foreground/50">
                          {item.categoryName}
                        </span>
                      </span>
                      {hasVideo ? (
                        <VideoListBadge label={t("menuItemVideos.hasVideo")} />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="rounded-xl border border-foreground/10 bg-background/40 p-5 lg:min-h-0 lg:overflow-y-auto">
          {!selected ? (
            <p className="text-sm text-foreground/60">{t("menuItemVideos.selectItem")}</p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                <p className="text-sm text-foreground/55">{selected.categoryName}</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                  {t("menuItemVideos.currentVideo")}
                </p>
                {selected.videoId ? (
                  <p className="mt-1 break-all font-mono text-xs text-foreground/80">
                    {selected.videoId}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-foreground/55">{t("menuItemVideos.noVideo")}</p>
                )}
              </div>

              {selected.videoId && previewSource ? (
                <VideoPreview
                  videoId={selected.videoId}
                  bunnyLibraryId={bunnyLibraryId}
                  title={selected.name}
                />
              ) : selected.videoId ? (
                <p className="text-xs text-foreground/50">
                  {t("menuItemVideos.previewNoLibrary")}
                </p>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-foreground">
                  {t("menuItemVideos.uploadLabel")}
                </label>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  disabled={uploading || saving}
                  className="mt-2 block w-full text-sm text-foreground/80 file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-sm file:font-medium"
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
                {uploading ? (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full bg-foreground transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-foreground/55">
                      {stageDetail || `${t("menuItemVideos.uploading")} ${uploadProgress}%`}
                    </p>
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={!file || uploading || saving}
                  onClick={() => void handleUpload()}
                  className="mt-3 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
                >
                  {uploading ? t("menuItemVideos.uploading") : t("menuItemVideos.upload")}
                </button>
              </div>

              {selected.videoId ? (
                <button
                  type="button"
                  disabled={uploading || saving}
                  onClick={() => void handleRemoveVideo()}
                  className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-40 dark:text-red-400"
                >
                  {saving ? t("menuItemVideos.removing") : t("menuItemVideos.removeVideo")}
                </button>
              ) : null}

              {actionError ? (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
