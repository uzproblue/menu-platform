"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { useI18n } from "@/app/components/i18n-provider";
import type { GlobalMenuData, MenuItem, MenuSection } from "@/lib/data/global-menu-types";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";
import type { GlobalMenuResponse } from "@/lib/auth-api";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

type FlatMenuItem = MenuItem & {
  categoryName: string;
  menuSection: MenuSection;
};

function flattenMenuItems(data: GlobalMenuData): FlatMenuItem[] {
  const out: FlatMenuItem[] = [];
  for (const cat of data.categories) {
    const section: MenuSection = cat.menuSection === "beverages" ? "beverages" : "dishes";
    for (const item of cat.items) {
      out.push({
        ...item,
        categoryName: cat.name,
        menuSection: section,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function bunnyEmbedUrl(libraryId: string, videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}`;
}

type UploadSessionResponse = {
  videoId: string;
  libraryId: string;
  tusEndpoint: string;
  authorizationSignature: string;
  authorizationExpire: number;
};

export function MenuItemVideosClient() {
  const { t } = useI18n();
  const bunnyLibraryId = process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID?.trim() ?? "";

  const [items, setItems] = useState<FlatMenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<"all" | MenuSection>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const uploadRef = useRef<tus.Upload | null>(null);

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
      setItems(flattenMenuItems(mapGlobalMenuResponseToData(api)));
    } catch {
      setMenuError(t("menuItemVideos.loadError"));
      setItems([]);
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
      if (section !== "all" && item.menuSection !== section) return false;
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

    uploadRef.current?.abort(true);
    uploadRef.current = null;

    try {
      const sessionRes = await fetch("/api/settings/menu-videos/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${selected.name} — video` }),
      });
      if (!sessionRes.ok) {
        const payload = (await sessionRes.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message ?? t("menuItemVideos.uploadFailed"));
      }
      const session = (await sessionRes.json()) as UploadSessionResponse;

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: session.tusEndpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
          headers: {
            AuthorizationSignature: session.authorizationSignature,
            AuthorizationExpire: String(session.authorizationExpire),
            VideoId: session.videoId,
            LibraryId: session.libraryId,
          },
          metadata: {
            filetype: file.type || "video/mp4",
            title: file.name,
          },
          onError: (error) => reject(error),
          onProgress: (bytesUploaded, bytesTotal) => {
            if (bytesTotal > 0) {
              setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
            }
          },
          onSuccess: () => resolve(),
        });
        uploadRef.current = upload;
        upload.start();
      });

      await patchVideoId(selected.id, session.videoId);
      setFile(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("menuItemVideos.uploadFailed"),
      );
    } finally {
      setUploading(false);
      uploadRef.current = null;
    }
  }, [file, patchVideoId, selected, t]);

  const previewUrl =
    selected?.videoId && bunnyLibraryId
      ? bunnyEmbedUrl(bunnyLibraryId, selected.videoId)
      : null;

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <aside className="flex min-h-[320px] flex-col rounded-xl border border-foreground/10 bg-background/40">
        <div className="border-b border-foreground/10 p-3">
          <input
            type="search"
            placeholder={t("menuItemVideos.searchItems")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {(["all", "dishes", "beverages"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  section === s
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 text-foreground/70"
                }`}
              >
                {s === "all"
                  ? t("menuItemVideos.sectionAll")
                  : s === "dishes"
                    ? t("nav.globalMenuDishes")
                    : t("nav.globalMenuBeverages")}
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
            <li className="px-2 py-4 text-sm text-red-600 dark:text-red-400">{menuError}</li>
          ) : filtered.length === 0 ? (
            <li className="px-2 py-4 text-sm text-foreground/55">
              {t("menuItemVideos.noItems")}
            </li>
          ) : (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setActionError(null);
                    setFile(null);
                  }}
                  className={`w-full rounded-lg px-2 py-2 text-left text-sm transition ${
                    selectedId === item.id
                      ? "bg-foreground/10 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-foreground/5"
                  }`}
                >
                  <span className="block truncate">{item.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-foreground/50">
                    {item.categoryName}
                    {item.videoId ? ` · ${t("menuItemVideos.hasVideo")}` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="rounded-xl border border-foreground/10 bg-background/40 p-5">
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

            {previewUrl ? (
              <div className="overflow-hidden rounded-lg border border-foreground/10 bg-black/90">
                <iframe
                  title={t("menuItemVideos.preview")}
                  src={previewUrl}
                  className="aspect-video w-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : selected.videoId && !bunnyLibraryId ? (
              <p className="text-xs text-foreground/50">{t("menuItemVideos.previewNoLibrary")}</p>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-foreground">
                {t("menuItemVideos.uploadLabel")}
              </label>
              <input
                type="file"
                accept="video/*"
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
                    {t("menuItemVideos.uploading")} {uploadProgress}%
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
  );
}
