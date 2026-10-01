"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import type { MenuV3PreviewResponse } from "@/lib/auth-api";

type MergeLocation = {
  id: string;
  name: string;
  posOrganizationId: string | null;
  externalMenuId: string | null;
  hasPos: boolean;
};

type MatchKind = "id" | "name";

type MatchedPair = {
  posCategoryId: string;
  posName: string;
  matchKind: MatchKind;
};

type CatalogCategoryCard = {
  id: string;
  name: string;
  description: string | null;
  coverPhoto: string | null;
  posCategoryId: string | null;
};

type PosCategoryCard = {
  posCategoryId: string;
  posName: string;
};

function seedMatchedPairs(
  preview: MenuV3PreviewResponse,
): Map<string, MatchedPair> {
  const pairs = new Map<string, MatchedPair>();
  const claimedPos = new Set<string>();
  const claimedCatalog = new Set<string>();

  // Already linked by POS id — definitive matches, no save needed.
  for (const row of preview.categories) {
    if (row.bucket !== "matchedById" || !row.suggestedCatalogCategoryId) continue;
    pairs.set(row.suggestedCatalogCategoryId, {
      posCategoryId: row.posCategoryId,
      posName: row.posName,
      matchKind: "id",
    });
    claimedPos.add(row.posCategoryId);
    claimedCatalog.add(row.suggestedCatalogCategoryId);
  }

  // Exact name suggestions with no id conflict — treat as matched in UI.
  for (const row of preview.categories) {
    if (row.bucket !== "suggested" || row.matchKind !== "name") continue;
    const catalogId = row.suggestedCatalogCategoryId;
    if (!catalogId) continue;
    if (claimedCatalog.has(catalogId) || claimedPos.has(row.posCategoryId)) {
      continue;
    }
    pairs.set(catalogId, {
      posCategoryId: row.posCategoryId,
      posName: row.posName,
      matchKind: "name",
    });
    claimedPos.add(row.posCategoryId);
    claimedCatalog.add(catalogId);
  }

  return pairs;
}

export function MenuMergePageClient() {
  const { t } = useI18n();
  const [locations, setLocations] = useState<MergeLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [externalMenuId, setExternalMenuId] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [merging, setMerging] = useState(false);
  const [savingId, setSavingId] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<MenuV3PreviewResponse | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(
    null,
  );
  const [selectedPosCategoryId, setSelectedPosCategoryId] = useState<
    string | null
  >(null);
  const [matchedPairs, setMatchedPairs] = useState<Map<string, MatchedPair>>(
    () => new Map(),
  );
  const [updateNameOnMerge, setUpdateNameOnMerge] = useState(false);
  const [catalogCards, setCatalogCards] = useState<CatalogCategoryCard[]>([]);
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
    setMatchedPairs(new Map());
    setCatalogCards([]);
    setSelectedCatalogId(null);
    setSelectedPosCategoryId(null);
    setUpdateNameOnMerge(false);
    setSearch("");
    setSuccess(null);
    setError(null);
  }, [locationId]);

  const posCards: PosCategoryCard[] = useMemo(() => {
    if (!preview) return [];
    return preview.categories.map((c) => ({
      posCategoryId: c.posCategoryId,
      posName: c.posName,
    }));
  }, [preview]);

  const matchedPosIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pair of matchedPairs.values()) {
      ids.add(pair.posCategoryId);
    }
    return ids;
  }, [matchedPairs]);

  const q = search.trim().toLowerCase();

  const filteredCatalog = useMemo(() => {
    if (!q) return catalogCards;
    return catalogCards.filter((c) => {
      const hay = `${c.name} ${c.id} ${c.posCategoryId ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [catalogCards, q]);

  const filteredPos = useMemo(() => {
    const available = posCards.filter((p) => !matchedPosIds.has(p.posCategoryId));
    if (!q) return available;
    return available.filter((p) => {
      const hay = `${p.posName} ${p.posCategoryId}`.toLowerCase();
      return hay.includes(q);
    });
  }, [posCards, matchedPosIds, q]);

  const selectedCatalog = catalogCards.find((c) => c.id === selectedCatalogId);
  const selectedPos = posCards.find(
    (p) => p.posCategoryId === selectedPosCategoryId,
  );
  const leftAlreadyMatched = selectedCatalogId
    ? matchedPairs.has(selectedCatalogId)
    : false;
  const rightAlreadyTaken = selectedPosCategoryId
    ? matchedPosIds.has(selectedPosCategoryId)
    : false;
  const canMerge =
    !!selectedCatalogId &&
    !!selectedPosCategoryId &&
    !leftAlreadyMatched &&
    !rightAlreadyTaken &&
    !merging;

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
    const menuId = externalMenuId.trim();
    if (!menuId) {
      setError(t("menuMerge.externalMenuIdRequired"));
      return;
    }
    setFetching(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/settings/menu-v3-merge/${encodeURIComponent(locationId)}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalMenuId: menuId }),
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
      setCatalogCards(
        (data.catalogCategories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? null,
          coverPhoto: c.coverPhoto ?? null,
          posCategoryId: c.posCategoryId ?? null,
        })),
      );
      setMatchedPairs(seedMatchedPairs(data));
      setSelectedCatalogId(null);
      setSelectedPosCategoryId(null);
      setUpdateNameOnMerge(false);
      setSearch("");
      setLocations((prev) =>
        prev.map((l) =>
          l.id === locationId ? { ...l, externalMenuId: menuId } : l,
        ),
      );
    } catch {
      setError(t("menuMerge.fetchError"));
    } finally {
      setFetching(false);
    }
  }

  async function mergeSelected() {
    if (!canMerge || !selectedCatalogId || !selectedPosCategoryId || !selectedPos) {
      return;
    }
    setMerging(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/settings/menu-v3-merge/${encodeURIComponent(locationId)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actions: [
              {
                type: "linkCategory",
                catalogCategoryId: selectedCatalogId,
                posCategoryId: selectedPosCategoryId,
                updateName: updateNameOnMerge,
                name: updateNameOnMerge ? selectedPos.posName : undefined,
              },
            ],
          }),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        errors?: Array<{ action: string; message: string }>;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? t("menuMerge.mergeError"));
        return;
      }
      if (data.errors && data.errors.length > 0) {
        setError(data.errors.map((e) => e.message).join("; "));
        return;
      }

      const posName = selectedPos.posName;
      const posId = selectedPosCategoryId;
      const catalogId = selectedCatalogId;
      const shouldUpdateName = updateNameOnMerge;

      setMatchedPairs((prev) => {
        const next = new Map(prev);
        next.set(catalogId, {
          posCategoryId: posId,
          posName,
          matchKind: "id",
        });
        return next;
      });
      setCatalogCards((prev) =>
        prev.map((c) =>
          c.id === catalogId
            ? {
                ...c,
                posCategoryId: posId,
                name: shouldUpdateName ? posName : c.name,
              }
            : c,
        ),
      );
      setSelectedCatalogId(null);
      setSelectedPosCategoryId(null);
      setSuccess(t("menuMerge.mergeSuccess"));
    } catch {
      setError(t("menuMerge.mergeError"));
    } finally {
      setMerging(false);
    }
  }

  function toggleCatalog(id: string) {
    if (matchedPairs.has(id)) return;
    setSelectedCatalogId((prev) => (prev === id ? null : id));
  }

  function togglePos(id: string) {
    if (matchedPosIds.has(id)) return;
    setSelectedPosCategoryId((prev) => (prev === id ? null : id));
  }

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
            {t("menuMerge.helpCategories")}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-foreground/10 bg-background/60 p-5 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 backdrop-blur-md sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto]">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-foreground/60">
              {t("menuMerge.location")}
            </span>
            <select
              value={locationId}
              disabled={loadingMeta || fetching || merging}
              onChange={(e) => setLocationId(e.target.value)}
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
              disabled={loadingMeta || fetching || merging || !locationId}
              onChange={(e) => setExternalMenuId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 py-2 text-sm outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/20 disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            disabled={savingId || fetching || merging || !locationId}
            onClick={() => void saveExternalMenuId()}
            className="min-h-11 self-end rounded-xl border border-foreground/15 px-4 text-sm font-medium text-foreground transition-opacity hover:bg-foreground/5 disabled:opacity-50"
          >
            {savingId ? t("menuMerge.savingId") : t("menuMerge.saveId")}
          </button>
          <button
            type="button"
            disabled={fetching || merging || !locationId}
            onClick={() => void fetchPreview()}
            className="min-h-11 self-end rounded-xl bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {fetching ? t("menuMerge.fetching") : t("menuMerge.fetch")}
          </button>
        </div>
        <p className="mt-3 text-xs text-foreground/50">
          {t("menuMerge.fetchSafeNoteCategories")}
        </p>
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
            {t("menuMerge.emptyHelpCategories")}
          </p>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-foreground/60">
              {preview.menuName ? (
                <span>
                  {t("menuMerge.menuName")}:{" "}
                  <span className="font-medium text-foreground">
                    {preview.menuName}
                  </span>
                </span>
              ) : null}
              <span className="ml-0 block sm:ml-3 sm:inline">
                {t("menuMerge.matchedCount", {
                  count: String(matchedPairs.size),
                })}
                {" · "}
                {t("menuMerge.unmatchedPosCount", {
                  count: String(filteredPos.length),
                })}
              </span>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("menuMerge.searchCategories")}
              className="min-h-10 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20 sm:max-w-xs"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("menuMerge.dbCategories")}
              </h2>
              {filteredCatalog.length === 0 ? (
                <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-sm text-foreground/50">
                  {t("menuMerge.noCategoryRows")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredCatalog.map((cat) => {
                    const match = matchedPairs.get(cat.id);
                    const selected = selectedCatalogId === cat.id;
                    return (
                      <li key={cat.id}>
                        <button
                          type="button"
                          disabled={!!match}
                          onClick={() => toggleCatalog(cat.id)}
                          className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition-colors ${
                            match
                              ? "cursor-default border-emerald-500/30 bg-emerald-500/5"
                              : selected
                                ? "border-foreground/40 bg-foreground/5 ring-2 ring-foreground/20"
                                : "border-foreground/10 bg-background/60 hover:border-foreground/25 hover:bg-foreground/[0.03]"
                          }`}
                        >
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-foreground/5">
                            {cat.coverPhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cat.coverPhoto}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-foreground/35">
                                {t("menuMerge.noPhoto")}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium text-foreground">
                                {cat.name}
                              </p>
                              {match ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                  {t("menuMerge.matchBadge")}
                                </span>
                              ) : null}
                            </div>
                            {cat.description ? (
                              <p className="mt-0.5 line-clamp-2 text-xs text-foreground/55">
                                {cat.description}
                              </p>
                            ) : null}
                            <p className="mt-1 break-all text-[11px] text-foreground/40">
                              {cat.id}
                            </p>
                            {match ? (
                              <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                                {t("menuMerge.matchedTo", {
                                  name: match.posName,
                                  id: match.posCategoryId,
                                })}
                              </p>
                            ) : cat.posCategoryId ? (
                              <p className="mt-1 text-[11px] text-foreground/45">
                                POS: {cat.posCategoryId}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("menuMerge.posCategories")}
              </h2>
              {filteredPos.length === 0 ? (
                <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-sm text-foreground/50">
                  {t("menuMerge.noPosCategoryRows")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredPos.map((pos) => {
                    const selected = selectedPosCategoryId === pos.posCategoryId;
                    return (
                      <li key={pos.posCategoryId}>
                        <button
                          type="button"
                          onClick={() => togglePos(pos.posCategoryId)}
                          className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                            selected
                              ? "border-foreground/40 bg-foreground/5 ring-2 ring-foreground/20"
                              : "border-foreground/10 bg-background/60 hover:border-foreground/25 hover:bg-foreground/[0.03]"
                          }`}
                        >
                          <p className="font-medium text-foreground">
                            {pos.posName}
                          </p>
                          <p className="mt-1 break-all text-[11px] text-foreground/40">
                            {pos.posCategoryId}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <p className="text-center text-xs text-foreground/45">
            {t("menuMerge.itemsComingSoon")}
          </p>
        </>
      )}

      {selectedCatalog && selectedPos && !leftAlreadyMatched ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">
                {t("menuMerge.mergePairTitle")}
              </p>
              <p className="truncate text-foreground/60">
                {selectedCatalog.name} ← {selectedPos.posName}
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs text-foreground/70">
                <input
                  type="checkbox"
                  checked={updateNameOnMerge}
                  onChange={(e) => setUpdateNameOnMerge(e.target.checked)}
                  className="rounded border-foreground/30"
                />
                {t("menuMerge.updateNameToo")}
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={merging}
                onClick={() => {
                  setSelectedCatalogId(null);
                  setSelectedPosCategoryId(null);
                }}
                className="min-h-11 rounded-xl border border-foreground/15 px-4 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
              >
                {t("menuMerge.cancelSelection")}
              </button>
              <button
                type="button"
                disabled={!canMerge}
                onClick={() => void mergeSelected()}
                className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {merging ? t("menuMerge.merging") : t("menuMerge.merge")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
