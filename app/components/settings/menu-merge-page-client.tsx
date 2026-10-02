"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/components/i18n-provider";
import type { MenuV3PreviewResponse } from "@/lib/auth-api";
import { imageSrcIsNonOptimizable } from "@/lib/image-src-non-optimizable";
import { resolveMenuAssetToAbsoluteUrl } from "@/lib/menu-image-proxy";

type MergeLocation = {
  id: string;
  name: string;
  posOrganizationId: string | null;
  externalMenuId: string | null;
  hasPos: boolean;
};

type TabId = "categories" | "items";

type MatchedCategory = {
  posCategoryId: string;
  posName: string;
};

type MatchedItem = {
  posMenuItemId: string;
  posName: string;
  sku: string | null;
};

type CatalogCategoryCard = {
  id: string;
  name: string;
  description: string | null;
  coverPhoto: string | null;
  posCategoryId: string | null;
};

type CatalogItemCard = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  image: string | null;
  videoId: string | null;
  gramm: string | null;
  posMenuItemId: string | null;
  sku: string | null;
  deleted: boolean;
  locationPrice: string | null;
};

type DuplicateReason = "pos" | "sku" | "name";

type DuplicateGroup = {
  key: string;
  reason: DuplicateReason;
  label: string;
  items: CatalogItemCard[];
};

function normItemName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildMenuItemDuplicateGroups(
  items: CatalogItemCard[],
): DuplicateGroup[] {
  const active = items.filter((i) => !i.deleted);
  const groups: DuplicateGroup[] = [];

  const byPos = new Map<string, CatalogItemCard[]>();
  const bySku = new Map<string, CatalogItemCard[]>();
  const byName = new Map<string, CatalogItemCard[]>();

  for (const item of active) {
    if (item.posMenuItemId) {
      const list = byPos.get(item.posMenuItemId) ?? [];
      list.push(item);
      byPos.set(item.posMenuItemId, list);
    }
    if (item.sku) {
      const list = bySku.get(item.sku) ?? [];
      list.push(item);
      bySku.set(item.sku, list);
    }
    const n = normItemName(item.name);
    if (n) {
      const list = byName.get(n) ?? [];
      list.push(item);
      byName.set(n, list);
    }
  }

  for (const [posId, list] of byPos) {
    if (list.length < 2) continue;
    groups.push({
      key: `pos:${posId}`,
      reason: "pos",
      label: posId,
      items: list,
    });
  }
  for (const [sku, list] of bySku) {
    if (list.length < 2) continue;
    groups.push({
      key: `sku:${sku}`,
      reason: "sku",
      label: sku,
      items: list,
    });
  }
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    groups.push({
      key: `name:${name}`,
      reason: "name",
      label: list[0]?.name ?? name,
      items: list,
    });
  }

  return groups;
}

function normalizePriceAmount(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) return t;
  return String(n);
}

function resolveThumb(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (
    /^https?:\/\//i.test(t) ||
    t.startsWith("data:") ||
    t.startsWith("blob:")
  ) {
    return t;
  }
  return resolveMenuAssetToAbsoluteUrl(t);
}

function formatWeightAsGramm(weight: number | null | undefined): string | null {
  if (weight == null || !Number.isFinite(weight)) return null;
  const n = Math.round(weight * 1000) / 1000;
  return String(n);
}

function Thumb({
  src,
  emptyLabel,
}: {
  src: string | null;
  emptyLabel: string;
}) {
  const resolved = resolveThumb(src);
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-foreground/5">
      {resolved ? (
        <Image
          src={resolved}
          alt=""
          fill
          className="object-cover"
          sizes="56px"
          unoptimized={imageSrcIsNonOptimizable(resolved)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-foreground/35">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function seedMatchedCategories(
  preview: MenuV3PreviewResponse,
): Map<string, MatchedCategory> {
  const pairs = new Map<string, MatchedCategory>();
  for (const row of preview.categories) {
    if (row.bucket !== "matchedById" || !row.suggestedCatalogCategoryId) continue;
    pairs.set(row.suggestedCatalogCategoryId, {
      posCategoryId: row.posCategoryId,
      posName: row.posName,
    });
  }
  return pairs;
}

function seedMatchedItems(
  preview: MenuV3PreviewResponse,
): Map<string, MatchedItem> {
  const pairs = new Map<string, MatchedItem>();
  for (const row of preview.items) {
    if (row.bucket !== "matchedById" || !row.suggestedCatalogItemId) continue;
    pairs.set(row.suggestedCatalogItemId, {
      posMenuItemId: row.posMenuItemId,
      posName: row.posName,
      sku: row.sku,
    });
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
  const [tab, setTab] = useState<TabId>("categories");
  const [search, setSearch] = useState("");

  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(
    null,
  );
  const [selectedPosCategoryId, setSelectedPosCategoryId] = useState<
    string | null
  >(null);
  const [matchedCategories, setMatchedCategories] = useState<
    Map<string, MatchedCategory>
  >(() => new Map());
  const [updateCategoryName, setUpdateCategoryName] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState<
    CatalogCategoryCard[]
  >([]);

  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<
    string | null
  >(null);
  const [selectedPosItemId, setSelectedPosItemId] = useState<string | null>(
    null,
  );
  const [createNewItem, setCreateNewItem] = useState(false);
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [matchedItems, setMatchedItems] = useState<Map<string, MatchedItem>>(
    () => new Map(),
  );
  const [updateItemName, setUpdateItemName] = useState(false);
  const [updateItemSku, setUpdateItemSku] = useState(true);
  const [updateItemGramm, setUpdateItemGramm] = useState(true);
  const [catalogItems, setCatalogItems] = useState<CatalogItemCard[]>([]);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [itemMatchFilter, setItemMatchFilter] = useState<
    "all" | "matched" | "unmatched"
  >("all");
  const [itemCategoryFilter, setItemCategoryFilter] = useState("");
  const [itemsStep, setItemsStep] = useState<1 | 2 | 3>(1);
  const [selectedPriceItemIds, setSelectedPriceItemIds] = useState<Set<string>>(
    () => new Set(),
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
          if (!cancelled) setError(data.message ?? t("menuMerge.loadError"));
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

  useEffect(() => {
    if (!locationId) return;
    const loc = locationsRef.current.find((l) => l.id === locationId);
    setExternalMenuId(loc?.externalMenuId ?? "");
    setPreview(null);
    setMatchedCategories(new Map());
    setMatchedItems(new Map());
    setCatalogCategories([]);
    setCatalogItems([]);
    setSelectedCatalogId(null);
    setSelectedPosCategoryId(null);
    setSelectedCatalogItemId(null);
    setSelectedPosItemId(null);
    setCreateNewItem(false);
    setSearch("");
    setSuccess(null);
    setError(null);
  }, [locationId]);

  const q = search.trim().toLowerCase();

  const matchedPosCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of matchedCategories.values()) ids.add(p.posCategoryId);
    return ids;
  }, [matchedCategories]);

  const matchedPosItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of matchedItems.values()) ids.add(p.posMenuItemId);
    return ids;
  }, [matchedItems]);

  const posCategoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of preview?.categories ?? []) {
      m.set(c.posCategoryId, c.posName);
    }
    return m;
  }, [preview]);

  const filteredCatalogCategories = useMemo(() => {
    if (!q) return catalogCategories;
    return catalogCategories.filter((c) =>
      `${c.name} ${c.id} ${c.posCategoryId ?? ""}`.toLowerCase().includes(q),
    );
  }, [catalogCategories, q]);

  const filteredPosCategories = useMemo(() => {
    const rows = (preview?.categories ?? []).filter(
      (c) => !matchedPosCategoryIds.has(c.posCategoryId),
    );
    if (!q) return rows;
    return rows.filter((c) =>
      `${c.posName} ${c.posCategoryId}`.toLowerCase().includes(q),
    );
  }, [preview, matchedPosCategoryIds, q]);

  const filteredCatalogItems = useMemo(() => {
    return catalogItems.filter((c) => {
      if (!showDeletedItems && c.deleted) return false;
      if (itemMatchFilter === "matched" && !matchedItems.has(c.id)) return false;
      if (itemMatchFilter === "unmatched" && matchedItems.has(c.id)) return false;
      if (itemCategoryFilter && c.categoryId !== itemCategoryFilter) return false;
      if (!q) return true;
      return `${c.name} ${c.id} ${c.sku ?? ""} ${c.posMenuItemId ?? ""} ${c.categoryName}`
        .toLowerCase()
        .includes(q);
    });
  }, [
    catalogItems,
    q,
    showDeletedItems,
    itemMatchFilter,
    itemCategoryFilter,
    matchedItems,
  ]);

  const filteredPosItems = useMemo(() => {
    const rows = (preview?.items ?? []).filter(
      (i) => !matchedPosItemIds.has(i.posMenuItemId),
    );
    if (!q) return rows;
    return rows.filter((i) =>
      `${i.posName} ${i.posMenuItemId} ${i.sku ?? ""} ${i.posCategoryId}`
        .toLowerCase()
        .includes(q),
    );
  }, [preview, matchedPosItemIds, q]);

  const selectedCatalogCat = catalogCategories.find(
    (c) => c.id === selectedCatalogId,
  );
  const selectedPosCat = preview?.categories.find(
    (c) => c.posCategoryId === selectedPosCategoryId,
  );
  const canMergeCategory =
    !!selectedCatalogId &&
    !!selectedPosCategoryId &&
    !matchedCategories.has(selectedCatalogId) &&
    !matchedPosCategoryIds.has(selectedPosCategoryId) &&
    !merging;

  const selectedCatalogItem = catalogItems.find(
    (c) => c.id === selectedCatalogItemId,
  );
  const selectedPosItem = preview?.items.find(
    (i) => i.posMenuItemId === selectedPosItemId,
  );

  const defaultCreateCategoryId = useMemo(() => {
    if (!selectedPosItem) return "";
    const linked = catalogCategories.find(
      (c) => c.posCategoryId === selectedPosItem.posCategoryId,
    );
    return linked?.id ?? catalogCategories[0]?.id ?? "";
  }, [selectedPosItem, catalogCategories]);

  useEffect(() => {
    if (createNewItem && !createCategoryId && defaultCreateCategoryId) {
      setCreateCategoryId(defaultCreateCategoryId);
    }
  }, [createNewItem, createCategoryId, defaultCreateCategoryId]);

  const canMergeItem =
    !!selectedPosItemId &&
    !matchedPosItemIds.has(selectedPosItemId) &&
    !merging &&
    (createNewItem
      ? !!createCategoryId
      : !!selectedCatalogItemId &&
        !matchedItems.has(selectedCatalogItemId) &&
        !selectedCatalogItem?.deleted);

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
      setCatalogCategories(
        (data.catalogCategories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? null,
          coverPhoto: c.coverPhoto ?? null,
          posCategoryId: c.posCategoryId ?? null,
        })),
      );
      setCatalogItems(
        (data.catalogItems ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          categoryId: c.categoryId,
          categoryName: c.categoryName ?? "",
          image: c.image ?? null,
          videoId: c.videoId ?? null,
          gramm: c.gramm ?? null,
          posMenuItemId: c.posMenuItemId ?? null,
          sku: c.sku ?? null,
          deleted: c.deleted === true,
          locationPrice: c.locationPrice ?? null,
        })),
      );
      setMatchedCategories(seedMatchedCategories(data));
      setMatchedItems(seedMatchedItems(data));
      setSelectedCatalogId(null);
      setSelectedPosCategoryId(null);
      setSelectedCatalogItemId(null);
      setSelectedPosItemId(null);
      setCreateNewItem(false);
      setSearch("");
      setItemMatchFilter("all");
      setItemCategoryFilter("");
      setShowDeletedItems(false);
      setItemsStep(1);
      setSelectedPriceItemIds(new Set());
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

  async function mergeCategory() {
    if (!canMergeCategory || !selectedCatalogId || !selectedPosCat) return;
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
                posCategoryId: selectedPosCat.posCategoryId,
                updateName: updateCategoryName,
                name: updateCategoryName ? selectedPosCat.posName : undefined,
              },
            ],
          }),
        },
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        errors?: Array<{ message: string }>;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? t("menuMerge.mergeError"));
        return;
      }
      if (data.errors?.length) {
        setError(data.errors.map((e) => e.message).join("; "));
        return;
      }
      const catalogId = selectedCatalogId;
      const posId = selectedPosCat.posCategoryId;
      const posName = selectedPosCat.posName;
      const rename = updateCategoryName;
      setMatchedCategories((prev) => {
        const next = new Map(prev);
        next.set(catalogId, { posCategoryId: posId, posName });
        return next;
      });
      setCatalogCategories((prev) =>
        prev.map((c) =>
          c.id === catalogId
            ? {
                ...c,
                posCategoryId: posId,
                name: rename ? posName : c.name,
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

  async function mergeItem() {
    if (!canMergeItem || !selectedPosItem) return;
    setMerging(true);
    setError(null);
    setSuccess(null);
    const grammValue = formatWeightAsGramm(selectedPosItem.weight);
    try {
      const actions = createNewItem
        ? [
            {
              type: "createItem" as const,
              posMenuItemId: selectedPosItem.posMenuItemId,
              posProductSizeId: selectedPosItem.posProductSizeId,
              posCategoryId: selectedPosItem.posCategoryId,
              name: selectedPosItem.posName,
              catalogCategoryId: createCategoryId,
              updateSku: updateItemSku,
              sku: updateItemSku ? selectedPosItem.sku : null,
              updateGramm: updateItemGramm,
              gramm: updateItemGramm ? grammValue : null,
              priceAmount: selectedPosItem.priceAmount,
            },
          ]
        : [
            {
              type: "linkItem" as const,
              menuItemId: selectedCatalogItemId!,
              posMenuItemId: selectedPosItem.posMenuItemId,
              posProductSizeId: selectedPosItem.posProductSizeId,
              updateName: updateItemName,
              name: updateItemName ? selectedPosItem.posName : undefined,
              updateSku: updateItemSku,
              sku: updateItemSku ? selectedPosItem.sku : null,
              updateGramm: updateItemGramm,
              gramm: updateItemGramm ? grammValue : null,
            },
          ];

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
        errors?: Array<{ message: string }>;
        createdItems?: number;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? t("menuMerge.mergeItemError"));
        return;
      }
      if (data.errors?.length) {
        setError(data.errors.map((e) => e.message).join("; "));
        return;
      }

      const posId = selectedPosItem.posMenuItemId;
      const posName = selectedPosItem.posName;
      const posSku = selectedPosItem.sku;

      if (createNewItem) {
        // Refresh local lists: hide POS, add a synthetic catalog card
        const newId = `created-${posId}`;
        const catName =
          catalogCategories.find((c) => c.id === createCategoryId)?.name ?? "";
        setCatalogItems((prev) => [
          {
            id: newId,
            name: selectedPosItem.posName,
            categoryId: createCategoryId,
            categoryName: catName,
            image: null,
            videoId: null,
            gramm: updateItemGramm ? grammValue : null,
            posMenuItemId: posId,
            sku: updateItemSku ? posSku : null,
            deleted: false,
            locationPrice: selectedPosItem.priceAmount,
          },
          ...prev,
        ]);
        setMatchedItems((prev) => {
          const next = new Map(prev);
          next.set(newId, {
            posMenuItemId: posId,
            posName,
            sku: posSku,
          });
          return next;
        });
      } else if (selectedCatalogItemId) {
        const catalogId = selectedCatalogItemId;
        setMatchedItems((prev) => {
          const next = new Map(prev);
          next.set(catalogId, {
            posMenuItemId: posId,
            posName,
            sku: posSku,
          });
          return next;
        });
        setCatalogItems((prev) =>
          prev.map((c) =>
            c.id === catalogId
              ? {
                  ...c,
                  posMenuItemId: posId,
                  name: updateItemName ? posName : c.name,
                  sku: updateItemSku ? posSku : c.sku,
                  gramm: updateItemGramm ? grammValue : c.gramm,
                }
              : c,
          ),
        );
      }

      setSelectedCatalogItemId(null);
      setSelectedPosItemId(null);
      setCreateNewItem(false);
      setSuccess(
        createNewItem
          ? t("menuMerge.createItemSuccess")
          : t("menuMerge.mergeItemSuccess"),
      );
    } catch {
      setError(t("menuMerge.mergeItemError"));
    } finally {
      setMerging(false);
    }
  }

  async function softDeleteCatalogItem(itemId: string) {
    if (!locationId || merging) return;
    if (!window.confirm(t("menuMerge.softDeleteConfirm"))) return;
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
            actions: [{ type: "softDeleteItem", menuItemId: itemId }],
          }),
        },
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        errors?: Array<{ message: string }>;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? t("menuMerge.softDeleteError"));
        return;
      }
      if (data.errors?.length) {
        setError(data.errors.map((e) => e.message).join("; "));
        return;
      }
      setMatchedItems((prev) => {
        if (!prev.has(itemId)) return prev;
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
      setCatalogItems((prev) =>
        prev.map((c) =>
          c.id === itemId
            ? { ...c, deleted: true, posMenuItemId: null }
            : c,
        ),
      );
      if (selectedCatalogItemId === itemId) setSelectedCatalogItemId(null);
      setSuccess(t("menuMerge.softDeleteSuccess"));
    } catch {
      setError(t("menuMerge.softDeleteError"));
    } finally {
      setMerging(false);
    }
  }

  async function restoreCatalogItem(itemId: string) {
    if (!locationId || merging) return;
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
            actions: [{ type: "restoreItem", menuItemId: itemId }],
          }),
        },
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        errors?: Array<{ message: string }>;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? t("menuMerge.restoreError"));
        return;
      }
      if (data.errors?.length) {
        setError(data.errors.map((e) => e.message).join("; "));
        return;
      }
      setCatalogItems((prev) =>
        prev.map((c) => (c.id === itemId ? { ...c, deleted: false } : c)),
      );
      setSuccess(t("menuMerge.restoreSuccess"));
    } catch {
      setError(t("menuMerge.restoreError"));
    } finally {
      setMerging(false);
    }
  }

  async function applySelectedLocationPrices(
    rows: Array<{ menuItemId: string; priceAmount: string }>,
  ) {
    if (!locationId || merging || rows.length === 0) return;
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
            actions: rows.map((r) => ({
              type: "updateLocationPrice" as const,
              menuItemId: r.menuItemId,
              priceAmount: r.priceAmount,
            })),
          }),
        },
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        errors?: Array<{ message: string }>;
      };
      if (!res.ok) {
        setError(
          data.message ?? data.error ?? t("menuMerge.applyPricesError"),
        );
        return;
      }
      if (data.errors?.length) {
        setError(data.errors.map((e) => e.message).join("; "));
        return;
      }
      const byId = new Map(rows.map((r) => [r.menuItemId, r.priceAmount]));
      setCatalogItems((prev) =>
        prev.map((c) =>
          byId.has(c.id)
            ? { ...c, locationPrice: byId.get(c.id) ?? c.locationPrice }
            : c,
        ),
      );
      setSelectedPriceItemIds(new Set());
      setSuccess(t("menuMerge.applyPricesSuccess"));
    } catch {
      setError(t("menuMerge.applyPricesError"));
    } finally {
      setMerging(false);
    }
  }

  const stickyCategory =
    tab === "categories" &&
    selectedCatalogCat &&
    selectedPosCat &&
    !matchedCategories.has(selectedCatalogCat.id);

  const stickyItem =
    tab === "items" &&
    itemsStep === 1 &&
    selectedPosItem &&
    !matchedPosItemIds.has(selectedPosItem.posMenuItemId) &&
    (createNewItem || (selectedCatalogItem && !selectedCatalogItem.deleted));

  const menuItemDuplicateGroups = useMemo(
    () => buildMenuItemDuplicateGroups(catalogItems),
    [catalogItems],
  );

  const priceCompareRows = useMemo(() => {
    if (!preview) return [];
    const posById = new Map(
      preview.items.map((i) => [i.posMenuItemId, i] as const),
    );
    const rows: Array<{
      menuItemId: string;
      menuItemName: string;
      posName: string;
      locationPrice: string | null;
      posPrice: string;
      differs: boolean;
    }> = [];
    for (const item of catalogItems) {
      if (item.deleted) continue;
      const posId =
        matchedItems.get(item.id)?.posMenuItemId ?? item.posMenuItemId;
      if (!posId) continue;
      const pos = posById.get(posId);
      if (!pos?.priceAmount?.trim()) continue;
      const locNorm = normalizePriceAmount(item.locationPrice);
      const posNorm = normalizePriceAmount(pos.priceAmount);
      rows.push({
        menuItemId: item.id,
        menuItemName: item.name,
        posName: pos.posName,
        locationPrice: item.locationPrice,
        posPrice: pos.priceAmount,
        differs: locNorm !== posNorm,
      });
    }
    return rows;
  }, [catalogItems, matchedItems, preview]);

  const differingPriceRows = useMemo(
    () => priceCompareRows.filter((r) => r.differs),
    [priceCompareRows],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-28">
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
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["categories", t("menuMerge.tabCategories")],
                ["items", t("menuMerge.tabItems")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`min-h-10 rounded-xl px-4 text-sm font-medium transition-colors ${
                  tab === id
                    ? "bg-foreground text-background"
                    : "border border-foreground/15 hover:bg-foreground/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

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
              {tab === "categories" ? (
                <span className="ml-0 block sm:ml-3 sm:inline">
                  {t("menuMerge.posTotalCount", {
                    count: String(preview.categories.length),
                  })}
                  {" · "}
                  {t("menuMerge.matchedCount", {
                    count: String(matchedCategories.size),
                  })}
                  {" · "}
                  {t("menuMerge.unmatchedPosCount", {
                    count: String(filteredPosCategories.length),
                  })}
                </span>
              ) : (
                <span className="ml-0 block sm:ml-3 sm:inline">
                  {t("menuMerge.posItemTotalCount", {
                    count: String(preview.items.length),
                  })}
                  {" · "}
                  {t("menuMerge.matchedItemCount", {
                    count: String(matchedItems.size),
                  })}
                  {" · "}
                  {t("menuMerge.unmatchedPosItemCount", {
                    count: String(filteredPosItems.length),
                  })}
                </span>
              )}
            </div>
            <div
              className={`flex w-full flex-col gap-2 ${
                tab === "items" && itemsStep === 1 ? "sm:max-w-xl" : "sm:max-w-xs"
              }`}
            >
              {tab === "categories" || itemsStep === 1 ? (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "categories"
                    ? t("menuMerge.searchCategories")
                    : t("menuMerge.searchItems")
                }
                className="min-h-10 w-full rounded-xl border border-foreground/15 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              />
              ) : null}
              {tab === "items" && itemsStep === 1 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={itemMatchFilter}
                    onChange={(e) =>
                      setItemMatchFilter(
                        e.target.value as "all" | "matched" | "unmatched",
                      )
                    }
                    className="min-h-10 rounded-xl border border-foreground/15 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                  >
                    <option value="all">{t("menuMerge.filterMatchAll")}</option>
                    <option value="matched">
                      {t("menuMerge.filterMatched")}
                    </option>
                    <option value="unmatched">
                      {t("menuMerge.filterUnmatched")}
                    </option>
                  </select>
                  <select
                    value={itemCategoryFilter}
                    onChange={(e) => setItemCategoryFilter(e.target.value)}
                    className="min-h-10 min-w-0 flex-1 rounded-xl border border-foreground/15 bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                  >
                    <option value="">
                      {t("menuMerge.filterCategoryAll")}
                    </option>
                    {catalogCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-foreground/70">
                    <input
                      type="checkbox"
                      checked={showDeletedItems}
                      onChange={(e) => setShowDeletedItems(e.target.checked)}
                      className="rounded border-foreground/30"
                    />
                    {t("menuMerge.showDeleted")}
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          {tab === "categories" && preview.categories.length === 0 ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              {t("menuMerge.posReturnedEmpty")}
            </p>
          ) : null}
          {tab === "items" && preview.items.length === 0 ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              {t("menuMerge.posItemsReturnedEmpty")}
            </p>
          ) : null}

          {tab === "categories" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("menuMerge.dbCategories")}
                </h2>
                {filteredCatalogCategories.length === 0 ? (
                  <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-sm text-foreground/50">
                    {t("menuMerge.noCategoryRows")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filteredCatalogCategories.map((cat) => {
                      const match = matchedCategories.get(cat.id);
                      const selected = selectedCatalogId === cat.id;
                      return (
                        <li key={cat.id}>
                          <button
                            type="button"
                            disabled={!!match}
                            onClick={() =>
                              setSelectedCatalogId((prev) =>
                                prev === cat.id ? null : cat.id,
                              )
                            }
                            className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition-colors ${
                              match
                                ? "cursor-default border-emerald-500/30 bg-emerald-500/5"
                                : selected
                                  ? "border-foreground/40 bg-foreground/5 ring-2 ring-foreground/20"
                                  : "border-foreground/10 bg-background/60 hover:border-foreground/25"
                            }`}
                          >
                            <Thumb
                              src={cat.coverPhoto}
                              emptyLabel={t("menuMerge.noPhoto")}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-medium text-foreground">
                                  {cat.name}
                                </p>
                                {match ? (
                                  <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
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
                {filteredPosCategories.length === 0 ? (
                  <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-sm text-foreground/50">
                    {preview.categories.length === 0
                      ? t("menuMerge.posReturnedEmpty")
                      : q
                        ? t("menuMerge.noPosCategoryRowsSearch")
                        : t("menuMerge.noPosCategoryRows")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filteredPosCategories.map((pos) => {
                      const selected =
                        selectedPosCategoryId === pos.posCategoryId;
                      return (
                        <li key={pos.posCategoryId}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPosCategoryId((prev) =>
                                prev === pos.posCategoryId
                                  ? null
                                  : pos.posCategoryId,
                              )
                            }
                            className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                              selected
                                ? "border-foreground/40 bg-foreground/5 ring-2 ring-foreground/20"
                                : "border-foreground/10 bg-background/60 hover:border-foreground/25"
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
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    [1, t("menuMerge.stepMatch")],
                    [2, t("menuMerge.stepDuplicates")],
                    [3, t("menuMerge.stepPrices")],
                  ] as const
                ).map(([step, label]) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setItemsStep(step)}
                    className={`min-h-9 rounded-xl px-3 text-xs font-medium transition-colors ${
                      itemsStep === step
                        ? "bg-foreground/10 text-foreground ring-1 ring-foreground/20"
                        : "text-foreground/50 hover:bg-foreground/5 hover:text-foreground"
                    }`}
                  >
                    {step}. {label}
                  </button>
                ))}
              </div>

              {itemsStep === 1 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("menuMerge.dbItems")}
                </h2>
                {filteredCatalogItems.length === 0 ? (
                  <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-sm text-foreground/50">
                    {t("menuMerge.noItemRows")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filteredCatalogItems.map((item) => {
                      const match = matchedItems.get(item.id);
                      const selected = selectedCatalogItemId === item.id;
                      const isDeleted = item.deleted;
                      return (
                        <li key={item.id}>
                          <div
                            className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition-colors ${
                              isDeleted
                                ? "border-foreground/10 bg-foreground/[0.03] opacity-70"
                                : match
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : selected
                                    ? "border-foreground/40 bg-foreground/5 ring-2 ring-foreground/20"
                                    : "border-foreground/10 bg-background/60 hover:border-foreground/25"
                            }`}
                          >
                            <button
                              type="button"
                              disabled={!!match || createNewItem || isDeleted}
                              onClick={() => {
                                setCreateNewItem(false);
                                setSelectedCatalogItemId((prev) =>
                                  prev === item.id ? null : item.id,
                                );
                              }}
                              className="flex min-w-0 flex-1 gap-3 text-left disabled:cursor-default disabled:opacity-80"
                            >
                              <Thumb
                                src={item.image}
                                emptyLabel={t("menuMerge.noPhoto")}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate font-medium text-foreground">
                                    {item.name}
                                  </p>
                                  {isDeleted ? (
                                    <span className="inline-flex rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground/60">
                                      {t("menuMerge.deletedBadge")}
                                    </span>
                                  ) : null}
                                  {match ? (
                                    <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                      {t("menuMerge.matchBadge")}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-xs text-foreground/55">
                                  {item.categoryName}
                                  {item.sku ? ` · SKU ${item.sku}` : ""}
                                  {item.gramm ? ` · ${item.gramm}` : ""}
                                </p>
                                <p className="mt-1 break-all text-[11px] text-foreground/40">
                                  {item.id}
                                </p>
                                {match ? (
                                  <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                                    {t("menuMerge.matchedItemTo", {
                                      name: match.posName,
                                      id: match.posMenuItemId,
                                    })}
                                  </p>
                                ) : item.posMenuItemId ? (
                                  <p className="mt-1 text-[11px] text-foreground/45">
                                    POS: {item.posMenuItemId}
                                  </p>
                                ) : null}
                              </div>
                            </button>
                            <div className="flex shrink-0 flex-col justify-center">
                              {isDeleted ? (
                                <button
                                  type="button"
                                  disabled={merging}
                                  onClick={() =>
                                    void restoreCatalogItem(item.id)
                                  }
                                  className="rounded-lg border border-foreground/15 px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-foreground/5 disabled:opacity-50"
                                >
                                  {t("menuMerge.restoreItem")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={merging}
                                  onClick={() =>
                                    void softDeleteCatalogItem(item.id)
                                  }
                                  className="rounded-lg border border-red-500/25 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                                >
                                  {t("menuMerge.deleteItem")}
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {t("menuMerge.posItems")}
                </h2>
                {filteredPosItems.length === 0 ? (
                  <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-sm text-foreground/50">
                    {preview.items.length === 0
                      ? t("menuMerge.posItemsReturnedEmpty")
                      : q
                        ? t("menuMerge.noPosItemRowsSearch")
                        : t("menuMerge.noPosItemRows")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filteredPosItems.map((pos) => {
                      const selected = selectedPosItemId === pos.posMenuItemId;
                      return (
                        <li key={pos.posMenuItemId}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPosItemId((prev) =>
                                prev === pos.posMenuItemId
                                  ? null
                                  : pos.posMenuItemId,
                              )
                            }
                            className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                              selected
                                ? "border-foreground/40 bg-foreground/5 ring-2 ring-foreground/20"
                                : "border-foreground/10 bg-background/60 hover:border-foreground/25"
                            }`}
                          >
                            <p className="font-medium text-foreground">
                              {pos.posName}
                            </p>
                            <p className="mt-0.5 text-xs text-foreground/55">
                              {posCategoryNameById.get(pos.posCategoryId) ??
                                pos.posCategoryId}
                              {pos.sku ? ` · SKU ${pos.sku}` : ""}
                              {pos.weight != null
                                ? ` · ${formatWeightAsGramm(pos.weight)}`
                                : ""}
                            </p>
                            <p className="mt-1 break-all text-[11px] text-foreground/40">
                              {pos.posMenuItemId}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
              ) : itemsStep === 2 ? (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      {t("menuMerge.duplicatesTitle")}
                    </h2>
                    <p className="mt-1 text-xs text-foreground/55">
                      {t("menuMerge.duplicatesHelp")}
                    </p>
                  </div>
                  {menuItemDuplicateGroups.length === 0 ? (
                    <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-sm text-foreground/50">
                      {t("menuMerge.duplicatesEmpty")}
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {menuItemDuplicateGroups.map((group) => (
                        <li
                          key={group.key}
                          className="rounded-2xl border border-foreground/10 bg-background/60 p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                              {group.reason === "pos"
                                ? t("menuMerge.dupReasonPos")
                                : group.reason === "sku"
                                  ? t("menuMerge.dupReasonSku")
                                  : t("menuMerge.dupReasonName")}
                            </span>
                            <span className="text-xs text-foreground/50">
                              {group.label}
                            </span>
                          </div>
                          <ul className="space-y-2">
                            {group.items.map((item) => (
                              <li
                                key={`${group.key}:${item.id}`}
                                className="flex gap-3 rounded-xl border border-foreground/10 p-3"
                              >
                                <Thumb
                                  src={item.image}
                                  emptyLabel={t("menuMerge.noPhoto")}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate font-medium text-foreground">
                                      {item.name}
                                    </p>
                                    {item.videoId ? (
                                      <span className="inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                                        {t("menuMerge.videoBadge")}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-0.5 text-xs text-foreground/55">
                                    {item.categoryName}
                                    {item.sku ? ` · SKU ${item.sku}` : ""}
                                  </p>
                                  <p className="mt-1 break-all text-[11px] text-foreground/40">
                                    {item.id}
                                    {item.posMenuItemId
                                      ? ` · POS ${item.posMenuItemId}`
                                      : ""}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={merging}
                                  onClick={() =>
                                    void softDeleteCatalogItem(item.id)
                                  }
                                  className="shrink-0 self-center rounded-lg border border-red-500/25 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                                >
                                  {t("menuMerge.deleteItem")}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        {t("menuMerge.pricesTitle")}
                      </h2>
                      <p className="mt-1 text-xs text-foreground/55">
                        {t("menuMerge.pricesHelp")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={
                        merging ||
                        selectedPriceItemIds.size === 0 ||
                        differingPriceRows.length === 0
                      }
                      onClick={() => {
                        const rows = differingPriceRows
                          .filter((r) => selectedPriceItemIds.has(r.menuItemId))
                          .map((r) => ({
                            menuItemId: r.menuItemId,
                            priceAmount: r.posPrice,
                          }));
                        void applySelectedLocationPrices(rows);
                      }}
                      className="min-h-10 rounded-xl bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                    >
                      {merging
                        ? t("menuMerge.merging")
                        : t("menuMerge.applySelectedPrices")}
                    </button>
                  </div>
                  {priceCompareRows.length === 0 ? (
                    <p className="rounded-xl border border-foreground/10 px-4 py-8 text-center text-sm text-foreground/50">
                      {t("menuMerge.pricesEmpty")}
                    </p>
                  ) : differingPriceRows.length === 0 ? (
                    <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-8 text-center text-sm text-emerald-700 dark:text-emerald-400">
                      {t("menuMerge.pricesNoDiffs")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {priceCompareRows.map((row) => {
                        const selected = selectedPriceItemIds.has(
                          row.menuItemId,
                        );
                        return (
                          <li
                            key={row.menuItemId}
                            className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${
                              row.differs
                                ? "border-amber-500/30 bg-amber-500/5"
                                : "border-foreground/10 bg-background/60"
                            }`}
                          >
                            {row.differs ? (
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(e) => {
                                  setSelectedPriceItemIds((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) {
                                      next.add(row.menuItemId);
                                    } else {
                                      next.delete(row.menuItemId);
                                    }
                                    return next;
                                  });
                                }}
                                className="rounded border-foreground/30"
                              />
                            ) : (
                              <span className="inline-block w-4" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground">
                                {row.menuItemName}
                              </p>
                              <p className="text-xs text-foreground/50">
                                POS: {row.posName}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-foreground/55">
                                {t("menuMerge.locationPrice")}:{" "}
                                <span className="font-medium text-foreground">
                                  {row.locationPrice ?? "—"}
                                </span>
                              </p>
                              <p className="text-foreground/55">
                                {t("menuMerge.posPrice")}:{" "}
                                <span className="font-medium text-foreground">
                                  {row.posPrice}
                                </span>
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <button
                  type="button"
                  disabled={itemsStep === 1}
                  onClick={() =>
                    setItemsStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))
                  }
                  className="min-h-10 rounded-xl border border-foreground/15 px-4 text-sm font-medium hover:bg-foreground/5 disabled:opacity-40"
                >
                  {t("menuMerge.stepBack")}
                </button>
                {itemsStep < 3 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setItemsStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)))
                    }
                    className="min-h-10 rounded-xl bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
                  >
                    {t("menuMerge.stepNext")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setItemsStep(1)}
                    className="min-h-10 rounded-xl border border-foreground/15 px-4 text-sm font-medium hover:bg-foreground/5"
                  >
                    {t("menuMerge.stepDone")}
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {stickyCategory ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">
                {t("menuMerge.mergePairTitle")}
              </p>
              <p className="truncate text-foreground/60">
                {selectedCatalogCat!.name} ← {selectedPosCat!.posName}
              </p>
              <label className="mt-2 flex items-center gap-2 text-xs text-foreground/70">
                <input
                  type="checkbox"
                  checked={updateCategoryName}
                  onChange={(e) => setUpdateCategoryName(e.target.checked)}
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
                disabled={!canMergeCategory}
                onClick={() => void mergeCategory()}
                className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {merging ? t("menuMerge.merging") : t("menuMerge.merge")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stickyItem ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2 text-sm">
              <p className="font-medium text-foreground">
                {createNewItem
                  ? t("menuMerge.createItemTitle")
                  : t("menuMerge.mergeItemTitle")}
              </p>
              <p className="truncate text-foreground/60">
                {createNewItem
                  ? selectedPosItem!.posName
                  : `${selectedCatalogItem!.name} ← ${selectedPosItem!.posName}`}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground/70">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createNewItem}
                    onChange={(e) => {
                      setCreateNewItem(e.target.checked);
                      if (e.target.checked) {
                        setSelectedCatalogItemId(null);
                        setCreateCategoryId(defaultCreateCategoryId);
                      }
                    }}
                    className="rounded border-foreground/30"
                  />
                  {t("menuMerge.createNewItem")}
                </label>
                {!createNewItem ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={updateItemName}
                      onChange={(e) => setUpdateItemName(e.target.checked)}
                      className="rounded border-foreground/30"
                    />
                    {t("menuMerge.updateItemName")}
                  </label>
                ) : null}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateItemSku}
                    onChange={(e) => setUpdateItemSku(e.target.checked)}
                    className="rounded border-foreground/30"
                  />
                  {t("menuMerge.updateItemSku")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateItemGramm}
                    onChange={(e) => setUpdateItemGramm(e.target.checked)}
                    className="rounded border-foreground/30"
                  />
                  {t("menuMerge.updateItemGramm")}
                </label>
              </div>
              {createNewItem ? (
                <label className="block space-y-1 text-xs text-foreground/70">
                  <span>{t("menuMerge.createIntoCategory")}</span>
                  <select
                    value={createCategoryId}
                    onChange={(e) => setCreateCategoryId(e.target.value)}
                    className="min-h-9 w-full max-w-sm rounded-lg border border-foreground/15 bg-background px-2 text-sm"
                  >
                    {catalogCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={merging}
                onClick={() => {
                  setSelectedCatalogItemId(null);
                  setSelectedPosItemId(null);
                  setCreateNewItem(false);
                }}
                className="min-h-11 rounded-xl border border-foreground/15 px-4 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
              >
                {t("menuMerge.cancelSelection")}
              </button>
              <button
                type="button"
                disabled={!canMergeItem}
                onClick={() => void mergeItem()}
                className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {merging
                  ? t("menuMerge.merging")
                  : createNewItem
                    ? t("menuMerge.createItem")
                    : t("menuMerge.merge")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
