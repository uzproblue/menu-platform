"use client";

import { useEffect, useMemo, useState } from "react";
import type { GlobalMenuResponse, PromotionStoryPricingMode } from "@/lib/auth-api";
import {
  computeComboPrice,
  parsePriceNumber,
} from "@/lib/promotion-combo-price";
import { useI18n } from "../i18n-provider";

export type StoryProductDraft = {
  menuItemId: string;
  quantity: number;
};

type SortMode = "name_asc" | "name_desc" | "price_asc" | "price_desc";

type FlatItem = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName: string;
  sectionId: string;
  sectionName: string;
  active: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  menu: GlobalMenuResponse | null;
  products: StoryProductDraft[];
  onConfirm: (products: StoryProductDraft[]) => void;
  pricingMode: PromotionStoryPricingMode;
  pricingValue: string;
  disabled?: boolean;
};

export function PromotionStoryProductPickerModal({
  open,
  onClose,
  menu,
  products,
  onConfirm,
  pricingMode,
  pricingValue,
  disabled,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [sectionId, setSectionId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [sort, setSort] = useState<SortMode>("name_asc");
  const [draft, setDraft] = useState<StoryProductDraft[]>(products);

  useEffect(() => {
    if (!open) return;
    setDraft(products);
    setQuery("");
    setSectionId("all");
    setCategoryId("all");
    setActiveOnly(true);
    setSort("name_asc");
  }, [open, products]);

  const flatItems = useMemo(() => {
    if (!menu) return [] as FlatItem[];
    const sectionNameById = new Map(menu.sections.map((s) => [s.id, s.name]));
    const out: FlatItem[] = [];
    for (const cat of menu.categories) {
      for (const item of cat.items) {
        out.push({
          id: item.id,
          name: item.name,
          price: parsePriceNumber(item.prices?.[0]?.price ?? 0),
          categoryId: cat.id,
          categoryName: cat.name,
          sectionId: cat.menuSectionId,
          sectionName: sectionNameById.get(cat.menuSectionId) ?? cat.name,
          active: item.active !== false,
        });
      }
    }
    return out;
  }, [menu]);

  const categoriesForFilter = useMemo(() => {
    if (!menu) return [];
    if (sectionId === "all") return menu.categories;
    return menu.categories.filter((c) => c.menuSectionId === sectionId);
  }, [menu, sectionId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = flatItems.filter((item) => {
      if (activeOnly && !item.active) return false;
      if (sectionId !== "all" && item.sectionId !== sectionId) return false;
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "name_asc":
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return rows;
  }, [flatItems, query, sectionId, categoryId, activeOnly, sort]);

  const selectedMap = useMemo(() => {
    return new Map(draft.map((p) => [p.menuItemId, p]));
  }, [draft]);

  const draftListTotal = useMemo(() => {
    return draft.reduce((sum, p) => {
      const item = flatItems.find((i) => i.id === p.menuItemId);
      return sum + (item?.price ?? 0) * p.quantity;
    }, 0);
  }, [draft, flatItems]);

  const draftComboPrice = useMemo(
    () =>
      computeComboPrice(
        draftListTotal,
        pricingMode,
        parsePriceNumber(pricingValue),
      ),
    [draftListTotal, pricingMode, pricingValue],
  );

  function toggle(menuItemId: string) {
    setDraft((prev) => {
      const exists = prev.find((p) => p.menuItemId === menuItemId);
      if (exists) return prev.filter((p) => p.menuItemId !== menuItemId);
      return [...prev, { menuItemId, quantity: 1 }];
    });
  }

  function setQty(menuItemId: string, quantity: number) {
    setDraft((prev) =>
      prev.map((p) =>
        p.menuItemId === menuItemId
          ? { ...p, quantity: Math.max(1, Math.round(quantity) || 1) }
          : p,
      ),
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("common.cancel")}
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-foreground/15 bg-background shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
          <h2 className="text-sm font-semibold">{t("stories.chooseProducts")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-foreground/60 hover:bg-foreground/5"
          >
            {t("common.cancel")}
          </button>
        </div>

        <div className="space-y-2 border-b border-foreground/10 px-4 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("stories.searchProducts")}
            className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setCategoryId("all");
              }}
              className="rounded-lg border border-foreground/15 bg-transparent px-2 py-1.5 text-xs"
            >
              <option value="all">{t("stories.filterAllSections")}</option>
              {menu?.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-lg border border-foreground/15 bg-transparent px-2 py-1.5 text-xs"
            >
              <option value="all">{t("stories.filterAllCategories")}</option>
              {categoriesForFilter.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="rounded-lg border border-foreground/15 bg-transparent px-2 py-1.5 text-xs"
            >
              <option value="name_asc">{t("stories.sortNameAsc")}</option>
              <option value="name_desc">{t("stories.sortNameDesc")}</option>
              <option value="price_asc">{t("stories.sortPriceAsc")}</option>
              <option value="price_desc">{t("stories.sortPriceDesc")}</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-foreground/70">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              {t("stories.activeOnly")}
            </label>
          </div>
          {draft.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {draft.map((p) => {
                const item = flatItems.find((i) => i.id === p.menuItemId);
                return (
                  <button
                    key={p.menuItemId}
                    type="button"
                    onClick={() => toggle(p.menuItemId)}
                    className="rounded-full border border-foreground/15 px-2 py-0.5 text-[11px] text-foreground/80 hover:bg-foreground/5"
                  >
                    {item?.name ?? p.menuItemId.slice(0, 6)} ×{p.quantity}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {!menu ? (
            <li className="px-2 py-6 text-center text-sm text-foreground/50">
              {t("loyalty.loading")}
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-foreground/50">
              {t("stories.noProductsMatch")}
            </li>
          ) : (
            filtered.map((item) => {
              const selected = selectedMap.get(item.id);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 hover:bg-foreground/5"
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={() => toggle(item.id)}
                      disabled={disabled}
                    />
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{item.name}</span>
                      <span className="ml-1.5 text-xs text-foreground/45">
                        {item.categoryName} · {item.price.toFixed(0)}
                      </span>
                    </span>
                  </label>
                  {selected ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setQty(item.id, selected.quantity - 1)}
                        className="h-7 w-7 rounded border border-foreground/15 text-sm disabled:opacity-40"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={selected.quantity}
                        onChange={(e) => setQty(item.id, Number(e.target.value))}
                        disabled={disabled}
                        className="w-14 rounded border border-foreground/15 bg-transparent px-2 py-1 text-center text-sm"
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setQty(item.id, selected.quantity + 1)}
                        className="h-7 w-7 rounded border border-foreground/15 text-sm disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 px-4 py-3">
          <p className="text-xs text-foreground/60">
            {t("stories.priceSummary", {
              list: draftListTotal.toFixed(0),
              combo: draftComboPrice.toFixed(0),
            })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-foreground/15 px-4 py-2 text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={disabled || draft.length === 0}
              onClick={() => {
                onConfirm(draft);
                onClose();
              }}
              className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {t("stories.confirmProducts", { count: String(draft.length) })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
