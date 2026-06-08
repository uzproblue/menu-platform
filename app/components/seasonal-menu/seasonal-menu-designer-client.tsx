"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SeasonalMenuDesignApi } from "@/lib/auth-api";
import type { GlobalMenuData, MenuItem } from "@/lib/data/global-menu-types";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";
import type { SeasonalMenuDocument } from "@/lib/seasonal-menu/document-types";
import {
  createMenuItemNode,
  createTextNode,
  editorNodesToStageJson,
  parseBackgroundLayerFromStageJson,
  parseEditorNodesFromStageJson,
  type EditorNode,
} from "@/lib/seasonal-menu/stage-json";
import { themeToNodeStyle } from "@/lib/seasonal-menu/apply-template";
import { downloadStageAsA4Pdf } from "@/lib/seasonal-menu/export-stage-to-pdf";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "@/lib/seasonal-menu/a4-dimensions";
import { useTemplateFontsReady } from "@/lib/seasonal-menu/use-template-fonts-ready";
import type { SeasonalMenuTemplateId, SeasonalMenuTemplateTheme } from "@/lib/seasonal-menu/templates/types";
import { LAYOUT } from "@/lib/seasonal-menu/templates/types";
import { useI18n } from "@/app/components/i18n-provider";
import { PlatformEvent, trackClientEvent } from "@/lib/analytics";
import { MenuItemsPanel } from "@/app/components/seasonal-menu/menu-items-panel";
import { SeasonalMenuToolbar } from "@/app/components/seasonal-menu/seasonal-menu-toolbar";
import {
  TemplateSetupWizard,
  type TemplateSetupResult,
} from "@/app/components/seasonal-menu/template-setup-wizard";
import type { SeasonalMenuEditorHandle } from "@/app/components/seasonal-menu/seasonal-menu-editor";

const SeasonalMenuEditor = dynamic(
  () =>
    import("@/app/components/seasonal-menu/seasonal-menu-editor").then(
      (m) => m.SeasonalMenuEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] animate-pulse rounded-xl bg-foreground/10" />
    ),
  },
);

type SeasonalMenuDesignerClientProps = {
  design: SeasonalMenuDesignApi;
  initialDocument: SeasonalMenuDocument | null;
  initialMenuData: GlobalMenuData;
  locations: Array<{ id: string; name: string }>;
};

function parseInitialState(initialDocument: SeasonalMenuDocument | null) {
  const stageJson = initialDocument?.pages[0]?.stageJson;
  return {
    templateId: initialDocument?.templateId ?? null,
    theme: initialDocument?.theme,
    menuTitle: initialDocument?.menuTitle,
    nodes: stageJson ? parseEditorNodesFromStageJson(stageJson) : [],
    backgroundLayer: parseBackgroundLayerFromStageJson(stageJson),
  };
}

export function SeasonalMenuDesignerClient({
  design: initialDesign,
  initialDocument,
  initialMenuData,
  locations,
}: SeasonalMenuDesignerClientProps) {
  const { t } = useI18n();
  const fontsReady = useTemplateFontsReady();
  const editorRef = useRef<SeasonalMenuEditorHandle | null>(null);
  const parsed = parseInitialState(initialDocument);

  const [design, setDesign] = useState(initialDesign);
  const [setupComplete, setSetupComplete] = useState(Boolean(parsed.templateId));
  const [showWizard, setShowWizard] = useState(!parsed.templateId);
  const [wizardItemsOnly, setWizardItemsOnly] = useState(false);

  const [title, setTitle] = useState(parsed.menuTitle ?? initialDesign.title);
  const [templateId, setTemplateId] = useState<SeasonalMenuTemplateId | null>(
    parsed.templateId,
  );
  const [theme, setTheme] = useState<SeasonalMenuTemplateTheme | undefined>(
    parsed.theme,
  );
  const [nodes, setNodes] = useState<EditorNode[]>(parsed.nodes);
  const [backgroundLayer, setBackgroundLayer] = useState<
    Record<string, unknown> | undefined
  >(parsed.backgroundLayer);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(initialDesign.locationId);
  const [menuData, setMenuData] = useState<GlobalMenuData>(initialMenuData);
  const [menuLoading, setMenuLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nodeStyle = useMemo(
    () => (theme ? themeToNodeStyle(theme) : undefined),
    [theme],
  );

  const selectedMenuItemIds = useMemo(
    () =>
      nodes
        .filter((n): n is Extract<EditorNode, { kind: "menuItem" }> => n.kind === "menuItem")
        .map((n) => n.menuItemId)
        .filter((id): id is string => Boolean(id)),
    [nodes],
  );

  const loadMenu = useCallback(async (locId: string | null) => {
    setMenuLoading(true);
    try {
      const url = locId
        ? `/api/settings/locations/${encodeURIComponent(locId)}/menu`
        : "/api/settings/global-menu";
      const res = await fetch(url);
      if (!res.ok) {
        setMenuData({ categories: [] });
        return;
      }
      const data = (await res.json()) as Parameters<typeof mapGlobalMenuResponseToData>[0];
      setMenuData(mapGlobalMenuResponseToData(data));
    } catch {
      setMenuData({ categories: [] });
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const buildDocument = useCallback((): SeasonalMenuDocument => {
    const stageJson = editorNodesToStageJson(nodes, backgroundLayer);
    return {
      version: 1,
      pageSize: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
      ...(templateId ? { templateId } : {}),
      ...(title.trim() ? { menuTitle: title.trim() } : {}),
      ...(theme ? { theme } : {}),
      pages: [{ stageJson }],
    };
  }, [nodes, backgroundLayer, templateId, title, theme]);

  const persist = useCallback(async () => {
    if (!setupComplete) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (title.trim() !== design.title) {
        await fetch(`/api/settings/seasonal-menu-designs/${design.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), locationId }),
        });
        setDesign((d) => ({ ...d, title: title.trim(), locationId }));
      }

      const docRes = await fetch(
        `/api/settings/seasonal-menu-designs/${design.id}/document`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document: buildDocument() }),
        },
      );
      if (!docRes.ok) {
        setSaveError(t("seasonalMenu.saveFailed"));
      }
    } catch {
      setSaveError(t("seasonalMenu.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [buildDocument, design.id, design.title, locationId, setupComplete, title, t]);

  useEffect(() => {
    if (!setupComplete) return;
    const timer = window.setTimeout(() => {
      void persist();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [nodes, title, locationId, templateId, theme, setupComplete, persist]);

  const applySetupResult = useCallback(
    async (result: TemplateSetupResult) => {
      setTemplateId(result.templateId);
      setTheme(result.theme);
      setTitle(result.menuTitle);
      setNodes(result.nodes);
      setBackgroundLayer(result.backgroundLayer);
      setSetupComplete(true);
      setShowWizard(false);
      setWizardItemsOnly(false);
      setSelectedId(null);

      setSaving(true);
      const doc: SeasonalMenuDocument = {
        version: 1,
        pageSize: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
        templateId: result.templateId,
        menuTitle: result.menuTitle,
        theme: result.theme,
        pages: [{ stageJson: result.stageJson }],
      };
      await fetch(`/api/settings/seasonal-menu-designs/${design.id}/document`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
      await fetch(`/api/settings/seasonal-menu-designs/${design.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: result.menuTitle, locationId }),
      });
      setDesign((d) => ({ ...d, title: result.menuTitle }));
      setSaving(false);
    },
    [design.id, locationId],
  );

  const handleInsertItem = useCallback(
    (item: MenuItem) => {
      if (!nodeStyle) return;
      const menuItemNodes = nodes.filter((n) => n.kind === "menuItem");
      const maxY = menuItemNodes.reduce((m, n) => Math.max(m, n.y), LAYOUT.itemsStartY - LAYOUT.itemRowHeight);
      const y = maxY + LAYOUT.itemRowHeight;
      setNodes((prev) => [
        ...prev,
        createMenuItemNode(item, LAYOUT.marginX, y, {
          width: LAYOUT.itemWidth,
          style: nodeStyle,
        }),
      ]);
    },
    [nodeStyle, nodes],
  );

  const handleAddText = useCallback(() => {
    const text = window.prompt(t("seasonalMenu.addText"), title);
    if (!text?.trim()) return;
    setNodes((prev) => [
      ...prev,
      createTextNode(48, 40, text.trim(), {
        style: nodeStyle,
        fontSize: 22,
        width: 400,
      }),
    ]);
  }, [nodeStyle, t, title]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const handleEditSelection = useCallback(() => {
    if (!window.confirm(t("seasonalMenu.rebuildConfirm"))) return;
    setWizardItemsOnly(true);
    setShowWizard(true);
  }, [t]);

  const handleExportPdf = useCallback(async () => {
    if (!fontsReady) return;
    setSelectedId(null);
    await new Promise((r) => requestAnimationFrame(r));
    await persist();
    const stage = editorRef.current?.getStage();
    if (!stage) {
      setSaveError(t("seasonalMenu.exportFailed"));
      return;
    }
    try {
      downloadStageAsA4Pdf(stage, title.trim() || "seasonal-menu");
      trackClientEvent(PlatformEvent.SEASONAL_PDF_EXPORTED, { designId: design.id });
    } catch {
      setSaveError(t("seasonalMenu.exportFailed"));
    }
  }, [fontsReady, persist, title, t, design.id]);

  const handleWizardComplete = useCallback(
    (result: TemplateSetupResult) => {
      void applySetupResult(result);
    },
    [applySetupResult],
  );

  if (showWizard) {
    return (
      <div className="mx-auto max-w-3xl">
        <TemplateSetupWizard
          defaultTitle={design.title}
          initialTemplateId={templateId}
          initialMenuTitle={title}
          initialSelectedIds={selectedMenuItemIds}
          startAtItemsStep={wizardItemsOnly}
          menuData={menuData}
          menuLoading={menuLoading}
          locations={locations}
          locationId={locationId}
          onLocationChange={(id) => {
            setLocationId(id);
            void loadMenu(id);
          }}
          onComplete={handleWizardComplete}
          onCancel={
            wizardItemsOnly
              ? () => {
                  setShowWizard(false);
                  setWizardItemsOnly(false);
                }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[32rem] flex-col rounded-2xl border border-foreground/10 bg-background/60 shadow-lg ring-1 ring-foreground/5">
      <div className="flex items-center gap-2 border-b border-foreground/10 px-3 py-2 text-sm">
        <Link
          href="/seasonal-menus"
          className="text-foreground/70 hover:text-foreground"
        >
          {t("seasonalMenu.backToList")}
        </Link>
      </div>
      <SeasonalMenuToolbar
        title={title}
        onTitleChange={setTitle}
        saving={saving}
        saveError={saveError}
        onSave={() => void persist()}
        onEditSelection={handleEditSelection}
        onAddText={handleAddText}
        onDeleteSelected={handleDeleteSelected}
        onExportPdf={() => void handleExportPdf()}
        hasSelection={Boolean(selectedId)}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {fontsReady ? (
            <SeasonalMenuEditor
              ref={editorRef}
              nodes={nodes}
              backgroundLayer={backgroundLayer}
              selectedId={selectedId}
              onNodesChange={setNodes}
              onSelect={setSelectedId}
            />
          ) : (
            <div className="flex h-[600px] items-center justify-center text-sm text-foreground/55">
              {t("seasonalMenu.loadingFonts")}
            </div>
          )}
        </div>
        <MenuItemsPanel
          items={menuData.categories.flatMap((c) => c.items).filter((i) => i.active !== false)}
          loading={menuLoading}
          locationLabel={
            locationId ? (locations.find((l) => l.id === locationId)?.name ?? "") : ""
          }
          locations={locations}
          locationId={locationId}
          onLocationChange={(id) => {
            setLocationId(id);
            void loadMenu(id);
          }}
          onInsertItem={handleInsertItem}
        />
      </div>
    </div>
  );
}
