"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import { makeTwoGisExportPublicUrl } from "@/lib/2gis-export-url";

type CategoryRow = {
  id: string;
  name: string;
  menuSectionId: string;
  sortOrder: number;
};

type SectionRow = {
  id: string;
  name: string;
  sortOrder: number;
  kind?: string;
};

type Props = {
  locationId: string | null;
  enabledCategoryIds: string[];
  twoGisExportCategoryIds: string[];
  setTwoGisExportCategoryIds: (ids: string[]) => void;
  disabled?: boolean;
};

export function LocationTwoGisExportPanel({
  locationId,
  enabledCategoryIds,
  twoGisExportCategoryIds,
  setTwoGisExportCategoryIds,
  disabled = false,
}: Props) {
  const { t } = useI18n();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenMessage, setRegenMessage] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const feedUrl = locationId ? makeTwoGisExportPublicUrl(locationId) : "";
  const enabledSet = useMemo(
    () => new Set(enabledCategoryIds.map((id) => id.trim()).filter(Boolean)),
    [enabledCategoryIds],
  );
  const selectedSet = useMemo(
    () => new Set(twoGisExportCategoryIds),
    [twoGisExportCategoryIds],
  );

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [secRes, catRes] = await Promise.all([
          fetch("/api/settings/menu-sections", { cache: "no-store" }),
          fetch("/api/settings/categories", { cache: "no-store" }),
        ]);
        if (!secRes.ok || !catRes.ok) {
          if (!cancelled) {
            setLoadError(t("restaurants.newWizard.twoGisExportLoadError"));
          }
          return;
        }
        const secData = (await secRes.json()) as { sections?: SectionRow[] };
        const catData = (await catRes.json()) as { categories?: CategoryRow[] };
        if (cancelled) return;
        setSections(
          (secData.sections ?? [])
            .filter((s) => s.kind !== "unassigned")
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        );
        setCategories(
          (catData.categories ?? [])
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        );
      } catch {
        if (!cancelled) {
          setLoadError(t("restaurants.newWizard.twoGisExportLoadError"));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId, t]);

  const enabledCategoriesBySection = useMemo(() => {
    const map = new Map<string, CategoryRow[]>();
    for (const cat of categories) {
      if (!enabledSet.has(cat.id)) continue;
      const list = map.get(cat.menuSectionId) ?? [];
      list.push(cat);
      map.set(cat.menuSectionId, list);
    }
    return map;
  }, [categories, enabledSet]);

  const visibleSections = useMemo(
    () => sections.filter((s) => (enabledCategoriesBySection.get(s.id) ?? []).length > 0),
    [sections, enabledCategoriesBySection],
  );

  const toggleCategory = useCallback(
    (categoryId: string, checked: boolean) => {
      if (disabled) return;
      const next = new Set(selectedSet);
      if (checked) next.add(categoryId);
      else next.delete(categoryId);
      setTwoGisExportCategoryIds(Array.from(next));
    },
    [disabled, selectedSet, setTwoGisExportCategoryIds],
  );

  const toggleSection = useCallback(
    (sectionId: string, checked: boolean) => {
      if (disabled) return;
      const cats = enabledCategoriesBySection.get(sectionId) ?? [];
      const next = new Set(selectedSet);
      for (const cat of cats) {
        if (checked) next.add(cat.id);
        else next.delete(cat.id);
      }
      setTwoGisExportCategoryIds(Array.from(next));
    },
    [disabled, enabledCategoriesBySection, selectedSet, setTwoGisExportCategoryIds],
  );

  const copyFeedUrl = useCallback(async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  }, [feedUrl]);

  const regenerate = useCallback(async () => {
    if (!locationId || disabled) return;
    if (twoGisExportCategoryIds.length === 0) {
      setRegenError(t("restaurants.newWizard.twoGisExportNoCategories"));
      return;
    }
    setIsRegenerating(true);
    setRegenError(null);
    setRegenMessage(null);
    try {
      // Persist checkbox selection before the worker reads D1.
      const saveRes = await fetch(
        `/api/settings/locations/${encodeURIComponent(locationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twoGisExportCategoryIds }),
        },
      );
      if (!saveRes.ok) {
        setRegenError(t("restaurants.newWizard.errUpdateLocation"));
        return;
      }

      const res = await fetch(
        `/api/settings/locations/${encodeURIComponent(locationId)}/2gis-export`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        reason?: string;
        offerCount?: number;
        publicUrl?: string;
        purge?: { ok?: boolean; skipped?: boolean; message?: string };
      };
      if (!res.ok) {
        setRegenError(
          data.reason === "no_categories_selected"
            ? t("restaurants.newWizard.twoGisExportNoCategories")
            : data.message || t("restaurants.newWizard.twoGisExportRegenFailed"),
        );
        return;
      }
      let okMsg = t("restaurants.newWizard.twoGisExportRegenOk", {
        count: String(data.offerCount ?? 0),
      });
      if (data.purge && data.purge.ok === false && !data.purge.skipped) {
        okMsg = `${okMsg} ${t("restaurants.newWizard.twoGisExportPurgeFailed")}`;
      }
      setRegenMessage(okMsg);
    } catch {
      setRegenError(t("restaurants.newWizard.twoGisExportRegenFailed"));
    } finally {
      setIsRegenerating(false);
    }
  }, [disabled, locationId, t, twoGisExportCategoryIds]);

  if (!locationId) {
    return (
      <div className="sm:col-span-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <p className="text-sm font-medium text-foreground">
          {t("restaurants.newWizard.twoGisExportTitle")}
        </p>
        <p className="mt-1 text-xs text-foreground/55">
          {t("restaurants.newWizard.twoGisExportSaveFirst")}
        </p>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <div>
        <p className="text-sm font-medium text-foreground">
          {t("restaurants.newWizard.twoGisExportTitle")}
        </p>
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground/80">
          {t("restaurants.newWizard.twoGisExportWarning")}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-foreground/70">
          {t("restaurants.newWizard.twoGisExportFeedUrl")}
        </p>
        <button
          type="button"
          onClick={() => void copyFeedUrl()}
          disabled={!feedUrl}
          className="mt-1 w-full break-all rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-left text-xs text-foreground outline-none ring-foreground/20 hover:bg-foreground/[0.04] focus:ring-2 disabled:opacity-60"
          title={t("restaurants.newWizard.twoGisExportCopyHint")}
        >
          {feedUrl}
        </button>
        <p className="mt-1 text-xs text-foreground/50">
          {linkCopied
            ? t("restaurants.qrLinkCopied")
            : t("restaurants.newWizard.twoGisExportCopyHint")}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-foreground/70">
          {t("restaurants.newWizard.twoGisExportCategories")}
        </p>
        {isLoading && (
          <p className="mt-2 text-xs text-foreground/55">
            {t("restaurants.newWizard.twoGisExportLoading")}
          </p>
        )}
        {loadError && <p className="mt-2 text-xs text-red-600">{loadError}</p>}
        {!isLoading && !loadError && visibleSections.length === 0 && (
          <p className="mt-2 text-xs text-foreground/55">
            {t("restaurants.newWizard.twoGisExportNoEnabledCategories")}
          </p>
        )}
        <div className="mt-2 max-h-64 space-y-3 overflow-y-auto pr-1">
          {visibleSections.map((section) => {
            const cats = enabledCategoriesBySection.get(section.id) ?? [];
            const selectedCount = cats.filter((c) => selectedSet.has(c.id)).length;
            const allSelected = selectedCount === cats.length && cats.length > 0;
            const someSelected = selectedCount > 0 && !allSelected;
            return (
              <div key={section.id} className="rounded-lg border border-foreground/10 p-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    disabled={disabled}
                    onChange={(e) => toggleSection(section.id, e.target.checked)}
                  />
                  <span>{section.name}</span>
                </label>
                <div className="mt-2 space-y-1 pl-6">
                  {cats.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2 text-sm text-foreground/85"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(cat.id)}
                        disabled={disabled}
                        onChange={(e) => toggleCategory(cat.id, e.target.checked)}
                      />
                      <span>{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={disabled || isRegenerating || twoGisExportCategoryIds.length === 0}
          className="rounded-xl border border-foreground/20 bg-foreground px-3 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRegenerating
            ? t("restaurants.newWizard.twoGisExportRegenerating")
            : t("restaurants.newWizard.twoGisExportRegenerate")}
        </button>
        {regenMessage && (
          <p className="text-xs text-emerald-700">{regenMessage}</p>
        )}
        {regenError && <p className="text-xs text-red-600">{regenError}</p>}
      </div>
    </div>
  );
}
