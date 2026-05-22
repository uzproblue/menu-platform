"use client";

import { useCallback, useMemo, useState } from "react";
import type { GlobalMenuData } from "@/lib/data/global-menu-types";
import { buildLayoutFromTemplate } from "@/lib/seasonal-menu/apply-template";
import { useTemplateFontsReady } from "@/lib/seasonal-menu/use-template-fonts-ready";
import type { SeasonalMenuTemplateId } from "@/lib/seasonal-menu/templates/types";
import type { SeasonalMenuTemplateTheme } from "@/lib/seasonal-menu/templates/types";
import type { EditorNode } from "@/lib/seasonal-menu/stage-json";
import { flattenMenuItems } from "@/lib/seasonal-menu/menu-item-format";
import { useI18n } from "@/app/components/i18n-provider";
import { TemplatePickerCards } from "@/app/components/seasonal-menu/template-picker-cards";

export type TemplateSetupResult = {
  templateId: SeasonalMenuTemplateId;
  theme: SeasonalMenuTemplateTheme;
  menuTitle: string;
  nodes: EditorNode[];
  backgroundLayer: Record<string, unknown>;
  stageJson: Record<string, unknown>;
};

type TemplateSetupWizardProps = {
  defaultTitle: string;
  initialTemplateId?: SeasonalMenuTemplateId | null;
  initialMenuTitle?: string;
  initialSelectedIds?: string[];
  startAtItemsStep?: boolean;
  menuData: GlobalMenuData;
  menuLoading: boolean;
  locations: Array<{ id: string; name: string }>;
  locationId: string | null;
  onLocationChange: (locationId: string | null) => void;
  onComplete: (result: TemplateSetupResult) => void;
  onCancel?: () => void;
};

export function TemplateSetupWizard({
  defaultTitle,
  initialTemplateId = null,
  initialMenuTitle,
  initialSelectedIds = [],
  startAtItemsStep = false,
  menuData,
  menuLoading,
  locations,
  locationId,
  onLocationChange,
  onComplete,
  onCancel,
}: TemplateSetupWizardProps) {
  const { t } = useI18n();
  const fontsReady = useTemplateFontsReady();
  const [step, setStep] = useState<1 | 2>(startAtItemsStep ? 2 : 1);
  const [templateId, setTemplateId] = useState<SeasonalMenuTemplateId | null>(
    initialTemplateId,
  );
  const [menuTitle, setMenuTitle] = useState(initialMenuTitle ?? defaultTitle);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedIds),
  );
  const [query, setQuery] = useState("");

  const items = useMemo(() => flattenMenuItems(menuData.categories), [menuData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBuild = useCallback(() => {
    if (!templateId || selectedIds.size === 0) return;
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    const result = buildLayoutFromTemplate({
      templateId,
      menuTitle: menuTitle.trim() || defaultTitle,
      items: selectedItems,
    });
    onComplete({
      templateId: result.templateId,
      theme: result.theme,
      menuTitle: result.menuTitle,
      nodes: result.nodes,
      backgroundLayer: result.backgroundLayer,
      stageJson: result.stageJson,
    });
  }, [templateId, selectedIds, items, menuTitle, defaultTitle, onComplete]);

  return (
    <div className="flex min-h-[32rem] flex-col rounded-2xl border border-foreground/10 bg-background/95 p-6 shadow-lg sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">
          {step === 1 ? t("seasonalMenu.wizardStep1") : t("seasonalMenu.wizardStep2")}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">
          {step === 1 ? t("seasonalMenu.wizardTitleTemplate") : t("seasonalMenu.wizardTitleItems")}
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          {step === 1 ? t("seasonalMenu.wizardSubtitleTemplate") : t("seasonalMenu.wizardSubtitleItems")}
        </p>
      </div>

      {step === 1 ? (
        <TemplatePickerCards
          selectedId={templateId}
          onSelect={setTemplateId}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-foreground">
              {t("seasonalMenu.menuTitleLabel")}
            </label>
            <input
              type="text"
              value={menuTitle}
              onChange={(e) => setMenuTitle(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className="text-xs font-medium text-foreground/70">
                {t("seasonalMenu.locationSource")}
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-2 text-sm"
                value={locationId ?? ""}
                onChange={(e) => onLocationChange(e.target.value ? e.target.value : null)}
              >
                <option value="">{t("seasonalMenu.catalogAllLocations")}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="search"
              placeholder={t("seasonalMenu.searchItems")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-[10rem] flex-1 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-sm font-medium text-foreground/70 hover:text-foreground"
              onClick={() => setSelectedIds(new Set(filtered.map((i) => i.id)))}
            >
              {t("seasonalMenu.selectAll")}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-foreground/70 hover:text-foreground"
              onClick={() => setSelectedIds(new Set())}
            >
              {t("seasonalMenu.clearSelection")}
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-foreground/10">
            {menuLoading ? (
              <li className="px-4 py-6 text-sm text-foreground/55">
                {t("seasonalMenu.loadingMenu")}
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-6 text-sm text-foreground/55">{t("seasonalMenu.noItems")}</li>
            ) : (
              filtered.map((item) => (
                <li key={item.id} className="border-b border-foreground/5 last:border-0">
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-foreground/5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-foreground">{item.name}</span>
                      {item.prices[0] ? (
                        <span className="mt-0.5 block text-xs text-foreground/55">
                          {item.prices[0].price} {item.prices[0].currency}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 pt-4">
        <div>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              {t("common.cancel")}
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/5"
            >
              {t("common.back")}
            </button>
          ) : null}
          {step === 1 ? (
            <button
              type="button"
              disabled={!templateId}
              onClick={() => setStep(2)}
              className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"
            >
              {t("seasonalMenu.wizardNext")}
            </button>
          ) : (
            <button
              type="button"
              disabled={!templateId || selectedIds.size === 0 || !fontsReady}
              onClick={handleBuild}
              className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"
            >
              {!fontsReady ? t("seasonalMenu.loadingFonts") : t("seasonalMenu.buildMenu")}
            </button>
          )}
        </div>
      </div>
      {step === 2 && selectedIds.size === 0 ? (
        <p className="mt-2 text-xs text-amber-700">{t("seasonalMenu.pickAtLeastOne")}</p>
      ) : null}
    </div>
  );
}
