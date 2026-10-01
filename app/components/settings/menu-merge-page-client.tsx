"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import type {
  MenuV3CategoryPreview,
  MenuV3ItemPreview,
  MenuV3MergeAction,
  MenuV3MissingInPos,
  MenuV3PreviewResponse,
} from "@/lib/auth-api";

type MergeLocation = {
  id: string;
  name: string;
  posOrganizationId: string | null;
  externalMenuId: string | null;
  hasPos: boolean;
};

type CategoryDecision =
  | { kind: "pending" }
  | { kind: "link"; catalogCategoryId: string }
  | { kind: "create" }
  | { kind: "skip" };

type ItemDecision =
  | { kind: "pending" }
  | { kind: "link"; menuItemId: string }
  | { kind: "create" }
  | { kind: "skip" };

type TabId = "items" | "categories" | "missing";
type FilterId = "all" | "needsReview" | "ready" | "skipped";

export function MenuMergePageClient() {
  const { t } = useI18n();
  const [locations, setLocations] = useState<MergeLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [externalMenuId, setExternalMenuId] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<MenuV3PreviewResponse | null>(null);
  const [tab, setTab] = useState<TabId>("items");
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [categoryDecisions, setCategoryDecisions] = useState<
    Record<string, CategoryDecision>
  >({});
  const [itemDecisions, setItemDecisions] = useState<Record<string, ItemDecision>>(
    {},
  );
  const locationsRef = useRef(locations);
  locationsRef.current = locations;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const res = await fetch("/api/settings/menu-v3-merge");
        const data = (await res.json()) as {
          ok?: boolean;
          locations?: MergeLocation[];
          message?: string;
        };
        if (!res.ok) {
          if (!cancelled) {
            setError(data.message ?? t("menuMerge.loadError"));
          }
          return;
        }
        const locs = data.locations ?? [];
        if (!cancelled) {
          setLocations(locs);
          const first = locs[0];
          if (first) {
            setLocationId(first.id);
            setExternalMenuId(first.externalMenuId ?? "");
          }
        }
      } catch {
        if (!cancelled) setError(t("menuMerge.loadError"));
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Reset draft state only when switching locations — not when locations list
  // is patched after Save ID / Fetch (that was wiping a successful preview).
  useEffect(() => {
    if (!locationId) return;
    const loc = locationsRef.current.find((l) => l.id === locationId);
    setExternalMenuId(loc?.externalMenuId ?? "");
    setPreview(null);
    setCategoryDecisions({});
    setItemDecisions({});
    setSuccess(null);
    setError(null);
  }, [locationId]);

  const pendingCount = useMemo(() => {
    let n = 0;
    for (const d of Object.values(categoryDecisions)) {
      if (d.kind === "link" || d.kind === "create") n += 1;
    }
    for (const d of Object.values(itemDecisions)) {
      if (d.kind === "link" || d.kind === "create") n += 1;
    }
    return n;
  }, [categoryDecisions, itemDecisions]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingCount]);

  async function saveExternalMenuId() {
    if (!locationId) return;
    setSavingId(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/settings/locations/${encodeURIComponent(locationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalMenuId: externalMenuId.trim() || null,
          }),
        },
      );
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.message ?? data.error ?? t("menuMerge.saveIdError"));
        return;
      }
      setLocations((prev) =>
        prev.map((l) =>
          l.id === locationId
            ? { ...l, externalMenuId: externalMenuId.trim() || null }
            : l,
        ),
      );
      setSuccess(t("menuMerge.saveIdSuccess"));
    } catch {
      setError(t("menuMerge.saveIdError"));
    } finally {
      setSavingId(false);
    }
  }

  async function fetchPreview() {
    if (!locationId) return;
    if (!externalMenuId.trim()) {
      setError(t("menuMerge.externalMenuIdRequired"));
      return;
    }
    setFetching(true);
    setError(null);
    setSuccess(null);
    try {
      // Persist id first so later apply uses it
      await fetch(`/api/settings/locations/${encodeURIComponent(locationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalMenuId: externalMenuId.trim() }),
      });

      const res = await fetch(
        `/api/settings/menu-v3-merge/${encodeURIComponent(locationId)}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalMenuId: externalMenuId.trim() }),
        },
      );
      const data = (await res.json()) as MenuV3PreviewResponse & {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? t("menuMerge.fetchError"));
        return;
      }
      setPreview(data);
      const nextCat: Record<string, CategoryDecision> = {};
      for (const row of data.categories) {
        nextCat[row.posCategoryId] = { kind: "pending" };
      }
      const nextItem: Record<string, ItemDecision> = {};
      for (const row of data.items) {
        nextItem[row.posMenuItemId] = { kind: "pending" };
      }
      setCategoryDecisions(nextCat);
      setItemDecisions(nextItem);
      setLocations((prev) =>
        prev.map((l) =>
          l.id === locationId
            ? { ...l, externalMenuId: externalMenuId.trim() }
            : l,
        ),
      );
    } catch {
      setError(t("menuMerge.fetchError"));
    } finally {
      setFetching(false);
    }
  }

  function selectAllIdMatches() {
    if (!preview) return;
    setCategoryDecisions((prev) => {
      const next = { ...prev };
      for (const row of preview.categories) {
        if (row.bucket === "matchedById" && row.suggestedCatalogCategoryId) {
          next[row.posCategoryId] = {
            kind: "link",
            catalogCategoryId: row.suggestedCatalogCategoryId,
          };
        }
      }
      return next;
    });
    setItemDecisions((prev) => {
      const next = { ...prev };
      for (const row of preview.items) {
        if (row.bucket === "matchedById" && row.suggestedCatalogItemId) {
          next[row.posMenuItemId] = {
            kind: "link",
            menuItemId: row.suggestedCatalogItemId,
          };
        }
      }
      return next;
    });
  }

  function discardAll() {
    if (!preview) return;
    const nextCat: Record<string, CategoryDecision> = {};
    for (const row of preview.categories) nextCat[row.posCategoryId] = { kind: "pending" };
    const nextItem: Record<string, ItemDecision> = {};
    for (const row of preview.items) nextItem[row.posMenuItemId] = { kind: "pending" };
    setCategoryDecisions(nextCat);
    setItemDecisions(nextItem);
    setSuccess(null);
  }

  async function saveMerges() {
    if (!preview || !locationId || pendingCount === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const actions: MenuV3MergeAction[] = [];
    for (const row of preview.categories) {
      const d = categoryDecisions[row.posCategoryId];
      if (!d) continue;
      if (d.kind === "link") {
        actions.push({
          type: "linkCategory",
          catalogCategoryId: d.catalogCategoryId,
          posCategoryId: row.posCategoryId,
        });
      } else if (d.kind === "create") {
        actions.push({
          type: "createCategory",
          posCategoryId: row.posCategoryId,
          name: row.posName,
        });
      }
    }
    for (const row of preview.items) {
      const d = itemDecisions[row.posMenuItemId];
      if (!d) continue;
      if (d.kind === "link") {
        actions.push({
          type: "linkItem",
          menuItemId: d.menuItemId,
          posMenuItemId: row.posMenuItemId,
          posProductSizeId: row.posProductSizeId,
          sku: row.sku,
          priceAmount: row.priceAmount,
        });
      } else if (d.kind === "create") {
        if (!row.priceAmount) continue;
        actions.push({
          type: "createItem",
          posMenuItemId: row.posMenuItemId,
          posProductSizeId: row.posProductSizeId,
          posCategoryId: row.posCategoryId,
          name: row.posName,
          sku: row.sku,
          priceAmount: row.priceAmount,
        });
      }
    }

    try {
      const res = await fetch(
        `/api/settings/menu-v3-merge/${encodeURIComponent(locationId)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actions }),
        },
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        linkedItems?: number;
        createdItems?: number;
        linkedCategories?: number;
        createdCategories?: number;
        pricesUpdated?: number;
        errors?: Array<{ message: string }>;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? t("menuMerge.saveError"));
        return;
      }
      const errNote =
        data.errors && data.errors.length
          ? ` (${data.errors.length} ${t("menuMerge.partialErrors")})`
          : "";
      const successMsg = `${t("menuMerge.saveSuccess")}: +${data.linkedItems ?? 0} link / +${data.createdItems ?? 0} new items, ${data.pricesUpdated ?? 0} prices${errNote}`;
      // Refresh preview after save (fetchPreview clears success — restore after)
      await fetchPreview();
      setSuccess(successMsg);
    } catch {
      setError(t("menuMerge.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const q = search.trim().toLowerCase();

  function matchesFilter(
    decision: CategoryDecision | ItemDecision | undefined,
  ): boolean {
    const kind = decision?.kind ?? "pending";
    if (filter === "all") return true;
    if (filter === "needsReview") return kind === "pending";
    if (filter === "ready") return kind === "link" || kind === "create";
    if (filter === "skipped") return kind === "skip";
    return true;
  }

  const filteredItems = useMemo(() => {
    if (!preview) return [] as MenuV3ItemPreview[];
    return preview.items.filter((row) => {
      if (!matchesFilter(itemDecisions[row.posMenuItemId])) return false;
      if (!q) return true;
      return (
        row.posName.toLowerCase().includes(q) ||
        (row.sku ?? "").toLowerCase().includes(q) ||
        row.posMenuItemId.toLowerCase().includes(q) ||
        (row.suggestedCatalogName ?? "").toLowerCase().includes(q)
      );
    });
  }, [preview, itemDecisions, filter, q]);

  const filteredCategories = useMemo(() => {
    if (!preview) return [] as MenuV3CategoryPreview[];
    return preview.categories.filter((row) => {
      if (!matchesFilter(categoryDecisions[row.posCategoryId])) return false;
      if (!q) return true;
      return (
        row.posName.toLowerCase().includes(q) ||
        row.posCategoryId.toLowerCase().includes(q) ||
        (row.suggestedCatalogName ?? "").toLowerCase().includes(q)
      );
    });
  }, [preview, categoryDecisions, filter, q]);

  const missingRows = preview?.missingInPos ?? ([] as MenuV3MissingInPos[]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-28">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/settings"
            className="text-sm text-foreground/60 transition-colors hover:text-foreground"
          >
            ← {t("menuMerge.backToSettings")}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {t("menuMerge.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-foreground/60">
            {t("menuMerge.help")}
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Owner
        </span>
      </div>

      <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto]">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-foreground/60">
              {t("menuMerge.location")}
            </span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              disabled={loadingMeta || fetching || saving}
              className="min-h-11 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
            >
              {locations.length === 0 ? (
                <option value="">{t("menuMerge.noLocations")}</option>
              ) : (
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                    {!loc.hasPos ? ` (${t("menuMerge.noPos")})` : ""}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-foreground/60">
              {t("menuMerge.externalMenuId")}
            </span>
            <input
              value={externalMenuId}
              onChange={(e) => setExternalMenuId(e.target.value)}
              placeholder="93374"
              disabled={fetching || saving}
              className="min-h-11 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
            />
          </label>

          <button
            type="button"
            onClick={saveExternalMenuId}
            disabled={!locationId || savingId || fetching || saving}
            className="min-h-11 self-end rounded-xl border border-foreground/15 px-4 text-sm font-medium text-foreground transition-opacity hover:bg-foreground/5 disabled:opacity-50"
          >
            {savingId ? t("menuMerge.savingId") : t("menuMerge.saveId")}
          </button>

          <button
            type="button"
            onClick={fetchPreview}
            disabled={!locationId || fetching || saving || loadingMeta}
            className="min-h-11 self-end rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {fetching ? t("menuMerge.fetching") : t("menuMerge.fetch")}
          </button>
        </div>
        <p className="mt-3 text-xs text-foreground/50">{t("menuMerge.fetchSafeNote")}</p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          {success}
        </p>
      ) : null}

      {!preview ? (
        <section className="rounded-2xl border border-dashed border-foreground/15 bg-background/40 px-6 py-16 text-center">
          <h2 className="text-lg font-medium text-foreground">
            {t("menuMerge.emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground/60">
            {t("menuMerge.emptyHelp")}
          </p>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Chip
              label={`${t("menuMerge.matchedById")}: ${preview.summary.matchedById}`}
            />
            <Chip
              label={`${t("menuMerge.suggested")}: ${preview.summary.suggested}`}
            />
            <Chip
              label={`${t("menuMerge.unmatched")}: ${preview.summary.unmatchedPos}`}
            />
            <Chip
              label={`${t("menuMerge.missingInPos")}: ${preview.summary.missingInPos}`}
            />
            {preview.menuName ? (
              <Chip label={`${t("menuMerge.menuName")}: ${preview.menuName}`} />
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["items", t("menuMerge.tabItems")],
                  ["categories", t("menuMerge.tabCategories")],
                  ["missing", t("menuMerge.tabMissing")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`min-h-10 rounded-xl px-3 text-sm font-medium transition-colors ${
                    tab === id
                      ? "bg-foreground text-background"
                      : "border border-foreground/15 text-foreground/70 hover:bg-foreground/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("menuMerge.search")}
                className="min-h-10 rounded-xl border border-foreground/15 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterId)}
                className="min-h-10 rounded-xl border border-foreground/15 bg-background/80 px-3 text-sm"
              >
                <option value="all">{t("menuMerge.filterAll")}</option>
                <option value="needsReview">{t("menuMerge.filterNeedsReview")}</option>
                <option value="ready">{t("menuMerge.filterReady")}</option>
                <option value="skipped">{t("menuMerge.filterSkipped")}</option>
              </select>
              <button
                type="button"
                onClick={selectAllIdMatches}
                className="min-h-10 rounded-xl border border-foreground/15 px-3 text-sm font-medium hover:bg-foreground/5"
              >
                {t("menuMerge.selectIdMatches")}
              </button>
            </div>
          </div>

          {tab === "items" ? (
            <div className="space-y-3">
              {filteredItems.map((row) => {
                const decision = itemDecisions[row.posMenuItemId] ?? {
                  kind: "pending" as const,
                };
                return (
                  <article
                    key={row.posMenuItemId}
                    className="rounded-2xl border border-foreground/10 bg-background/60 p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-foreground/45">
                          POS
                        </p>
                        <p className="mt-1 font-medium text-foreground">{row.posName}</p>
                        <p className="mt-1 text-xs text-foreground/55">
                          SKU {row.sku ?? "—"} · {row.priceAmount ?? "—"}{" "}
                          {preview.currency}
                        </p>
                        <p className="mt-0.5 break-all text-[11px] text-foreground/40">
                          {row.posMenuItemId}
                        </p>
                        <StatusPill bucket={row.bucket} matchKind={row.matchKind} />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-foreground/45">
                          {t("menuMerge.catalog")}
                        </p>
                        <select
                          value={
                            decision.kind === "link"
                              ? decision.menuItemId
                              : decision.kind === "create"
                                ? "__create__"
                                : decision.kind === "skip"
                                  ? "__skip__"
                                  : row.suggestedCatalogItemId
                                    ? `__suggest__:${row.suggestedCatalogItemId}`
                                    : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__create__") {
                              setItemDecisions((p) => ({
                                ...p,
                                [row.posMenuItemId]: { kind: "create" },
                              }));
                            } else if (v === "__skip__") {
                              setItemDecisions((p) => ({
                                ...p,
                                [row.posMenuItemId]: { kind: "skip" },
                              }));
                            } else if (v.startsWith("__suggest__:")) {
                              const id = v.slice("__suggest__:".length);
                              setItemDecisions((p) => ({
                                ...p,
                                [row.posMenuItemId]: {
                                  kind: "link",
                                  menuItemId: id,
                                },
                              }));
                            } else if (v) {
                              setItemDecisions((p) => ({
                                ...p,
                                [row.posMenuItemId]: {
                                  kind: "link",
                                  menuItemId: v,
                                },
                              }));
                            } else {
                              setItemDecisions((p) => ({
                                ...p,
                                [row.posMenuItemId]: { kind: "pending" },
                              }));
                            }
                          }}
                          className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 text-sm"
                        >
                          <option value="">{t("menuMerge.chooseAction")}</option>
                          {row.suggestedCatalogItemId ? (
                            <option value={`__suggest__:${row.suggestedCatalogItemId}`}>
                              {t("menuMerge.acceptSuggestion")}:{" "}
                              {row.suggestedCatalogName}
                            </option>
                          ) : null}
                          {(preview.catalogItems ?? []).map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                              {item.sku ? ` (${item.sku})` : ""}
                            </option>
                          ))}
                          <option value="__create__">{t("menuMerge.createNew")}</option>
                          <option value="__skip__">{t("menuMerge.skip")}</option>
                        </select>
                        {row.suggestedCatalogName ? (
                          <p className="mt-1 text-xs text-foreground/50">
                            {t("menuMerge.currentPrice")}:{" "}
                            {row.currentLocationPrice ??
                              row.currentCatalogPrice ??
                              "—"}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
              {filteredItems.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("menuMerge.noRows")}</p>
              ) : null}
            </div>
          ) : null}

          {tab === "categories" ? (
            <div className="space-y-3">
              {filteredCategories.map((row) => {
                const decision = categoryDecisions[row.posCategoryId] ?? {
                  kind: "pending" as const,
                };
                return (
                  <article
                    key={row.posCategoryId}
                    className="rounded-2xl border border-foreground/10 bg-background/60 p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-foreground/45">
                          POS
                        </p>
                        <p className="mt-1 font-medium text-foreground">{row.posName}</p>
                        <p className="mt-0.5 break-all text-[11px] text-foreground/40">
                          {row.posCategoryId}
                        </p>
                        <StatusPill bucket={row.bucket} matchKind={row.matchKind} />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-foreground/45">
                          {t("menuMerge.catalog")}
                        </p>
                        <select
                          value={
                            decision.kind === "link"
                              ? decision.catalogCategoryId
                              : decision.kind === "create"
                                ? "__create__"
                                : decision.kind === "skip"
                                  ? "__skip__"
                                  : row.suggestedCatalogCategoryId
                                    ? `__suggest__:${row.suggestedCatalogCategoryId}`
                                    : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__create__") {
                              setCategoryDecisions((p) => ({
                                ...p,
                                [row.posCategoryId]: { kind: "create" },
                              }));
                            } else if (v === "__skip__") {
                              setCategoryDecisions((p) => ({
                                ...p,
                                [row.posCategoryId]: { kind: "skip" },
                              }));
                            } else if (v.startsWith("__suggest__:")) {
                              const id = v.slice("__suggest__:".length);
                              setCategoryDecisions((p) => ({
                                ...p,
                                [row.posCategoryId]: {
                                  kind: "link",
                                  catalogCategoryId: id,
                                },
                              }));
                            } else if (v) {
                              setCategoryDecisions((p) => ({
                                ...p,
                                [row.posCategoryId]: {
                                  kind: "link",
                                  catalogCategoryId: v,
                                },
                              }));
                            } else {
                              setCategoryDecisions((p) => ({
                                ...p,
                                [row.posCategoryId]: { kind: "pending" },
                              }));
                            }
                          }}
                          className="mt-1 min-h-11 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 text-sm"
                        >
                          <option value="">{t("menuMerge.chooseAction")}</option>
                          {row.suggestedCatalogCategoryId ? (
                            <option
                              value={`__suggest__:${row.suggestedCatalogCategoryId}`}
                            >
                              {t("menuMerge.acceptSuggestion")}:{" "}
                              {row.suggestedCatalogName}
                            </option>
                          ) : null}
                          {(preview.catalogCategories ?? []).map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                          <option value="__create__">{t("menuMerge.createNew")}</option>
                          <option value="__skip__">{t("menuMerge.skip")}</option>
                        </select>
                      </div>
                    </div>
                  </article>
                );
              })}
              {filteredCategories.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("menuMerge.noRows")}</p>
              ) : null}
            </div>
          ) : null}

          {tab === "missing" ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground/60">{t("menuMerge.missingHelp")}</p>
              {missingRows.map((row) => (
                <div
                  key={`${row.kind}-${row.id}`}
                  className="rounded-xl border border-foreground/10 bg-background/50 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{row.name}</span>
                  <span className="ml-2 text-foreground/45">
                    {row.kind} · {row.posMenuItemId ?? row.posCategoryId ?? "—"}
                  </span>
                </div>
              ))}
              {missingRows.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("menuMerge.noMissing")}</p>
              ) : null}
            </div>
          ) : null}

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 px-4 py-3 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-foreground/70">
                {pendingCount} {t("menuMerge.pendingChanges")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={discardAll}
                  disabled={saving || pendingCount === 0}
                  className="min-h-11 rounded-xl border border-foreground/15 px-4 text-sm font-medium disabled:opacity-50"
                >
                  {t("menuMerge.discard")}
                </button>
                <button
                  type="button"
                  onClick={saveMerges}
                  disabled={saving || pendingCount === 0}
                  className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
                >
                  {saving ? t("menuMerge.saving") : t("menuMerge.saveMerges")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/75">
      {label}
    </span>
  );
}

function StatusPill({
  bucket,
  matchKind,
}: {
  bucket: string;
  matchKind: string | null;
}) {
  const color =
    bucket === "matchedById"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : bucket === "suggested"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-foreground/10 text-foreground/60";
  return (
    <span
      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}
    >
      {bucket}
      {matchKind ? ` · ${matchKind}` : ""}
    </span>
  );
}
