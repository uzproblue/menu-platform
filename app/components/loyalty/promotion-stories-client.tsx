"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { PromotionStory } from "@/lib/auth-api";
import { useI18n } from "../i18n-provider";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function storyTitle(story: PromotionStory): string {
  return (
    story.translations.find((t) => t.lang === "en")?.title ||
    story.translations[0]?.title ||
    story.id.slice(0, 8)
  );
}

export function PromotionStoriesClient() {
  const { t } = useI18n();
  const [stories, setStories] = useState<PromotionStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/settings/promotion-stories", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, t("stories.errLoad")));
    }
    const data = (await res.json()) as { stories: PromotionStory[] };
    setStories(data.stories);
  }, [t]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("stories.errLoad"));
      } finally {
        setLoading(false);
      }
    })();
  }, [load, t]);

  async function handleDelete(id: string) {
    if (!window.confirm(t("stories.deleteConfirm"))) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/settings/promotion-stories/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(await readErrorMessage(res, t("stories.errDelete")));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("stories.errDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  async function moveStory(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= stories.length) return;
    const next = [...stories];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(nextIndex, 0, item);
    setStories(next);
    setReordering(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/promotion-stories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((s) => s.id) }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, t("stories.errReorder")));
      }
      const data = (await res.json()) as { stories: PromotionStory[] };
      setStories(data.stories);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("stories.errReorder"));
      await load();
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/loyalty/promotions/points"
          className="text-sm text-foreground/70 underline underline-offset-2"
        >
          {t("stories.pointsRulesLink")}
        </Link>
        <Link
          href="/loyalty/promotions/new"
          className="inline-flex rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {t("stories.newStory")}
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-foreground/60">{t("loyalty.loading")}</p>
      ) : stories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground/80">{t("stories.emptyTitle")}</p>
          <p className="mt-1 text-sm text-foreground/55">{t("stories.emptyHint")}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {stories.map((story, index) => (
            <li
              key={story.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-foreground/10 bg-background/40 p-3"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-foreground/15">
                {story.previewImageUrl ? (
                  <Image
                    src={story.previewImageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                    unoptimized
                  />
                ) : (
                  <div className="h-full w-full bg-foreground/10" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{storyTitle(story)}</p>
                <p className="mt-0.5 text-xs text-foreground/55">
                  {story.mediaType} · {story.pricingMode} ·{" "}
                  {story.active ? t("loyalty.active") : t("loyalty.inactive")} ·{" "}
                  {t("stories.locationsCount", { count: String(story.locationIds.length) })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={reordering || index === 0}
                  onClick={() => void moveStory(index, -1)}
                  className="rounded-lg border border-foreground/15 px-2 py-1 text-xs disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={reordering || index === stories.length - 1}
                  onClick={() => void moveStory(index, 1)}
                  className="rounded-lg border border-foreground/15 px-2 py-1 text-xs disabled:opacity-40"
                >
                  ↓
                </button>
                <Link
                  href={`/loyalty/promotions/${encodeURIComponent(story.id)}`}
                  className="text-sm underline"
                >
                  {t("common.edit")}
                </Link>
                <button
                  type="button"
                  disabled={deletingId === story.id}
                  onClick={() => void handleDelete(story.id)}
                  className="text-sm text-red-600 disabled:opacity-50"
                >
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
