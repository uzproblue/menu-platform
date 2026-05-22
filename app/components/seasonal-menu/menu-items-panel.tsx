"use client";

import { useMemo, useState } from "react";
import type { MenuItem } from "@/lib/data/global-menu-types";
import { useI18n } from "@/app/components/i18n-provider";

type MenuItemsPanelProps = {
  items: MenuItem[];
  loading?: boolean;
  locationLabel: string;
  locations: Array<{ id: string; name: string }>;
  locationId: string | null;
  onLocationChange: (locationId: string | null) => void;
  onInsertItem: (item: MenuItem) => void;
};

export function MenuItemsPanel({
  items,
  loading,
  locationLabel,
  locations,
  locationId,
  onLocationChange,
  onInsertItem,
}: MenuItemsPanelProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<"all" | "dishes" | "beverages">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-foreground/10 bg-background/80 lg:w-72 lg:shrink-0">
      <div className="border-b border-foreground/10 p-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("seasonalMenu.menuItems")}
        </h2>
        <label className="mt-3 block text-xs font-medium text-foreground/70">
          {t("seasonalMenu.locationSource")}
        </label>
        <select
          className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-2 text-sm"
          value={locationId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onLocationChange(v.length ? v : null);
          }}
        >
          <option value="">{t("seasonalMenu.catalogAllLocations")}</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        {locationId ? (
          <p className="mt-1 text-xs text-foreground/55">{locationLabel}</p>
        ) : null}
        <input
          type="search"
          placeholder={t("seasonalMenu.searchItems")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-3 w-full rounded-lg border border-foreground/15 bg-background px-2 py-2 text-sm"
        />
        <div className="mt-2 flex gap-1">
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
                ? t("seasonalMenu.sectionAll")
                : s === "dishes"
                  ? t("nav.globalMenuDishes")
                  : t("nav.globalMenuBeverages")}
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <li className="px-2 py-4 text-sm text-foreground/55">{t("seasonalMenu.loadingMenu")}</li>
        ) : filtered.length === 0 ? (
          <li className="px-2 py-4 text-sm text-foreground/55">{t("seasonalMenu.noItems")}</li>
        ) : (
          filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onInsertItem(item)}
                className="mb-1 w-full rounded-lg border border-foreground/10 px-3 py-2 text-left text-sm transition hover:bg-foreground/5"
              >
                <span className="font-medium text-foreground">{item.name}</span>
                {item.prices[0] ? (
                  <span className="mt-0.5 block text-xs text-foreground/60">
                    {item.prices[0].price} {item.prices[0].currency}
                  </span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
