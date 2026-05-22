"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SeasonalMenuDesignApi } from "@/lib/auth-api";
import type { GlobalMenuData, MenuItem } from "@/lib/data/global-menu-types";
import { mapGlobalMenuResponseToData } from "@/lib/menu/map-global-menu-response";
import type { SeasonalMenuDocument } from "@/lib/seasonal-menu/document-types";
import { editorNodesToStageJson, parseEditorNodesFromStageJson } from "@/lib/seasonal-menu/stage-json";
import {
  createMenuItemNode,
  createTextNode,
  type EditorNode,
} from "@/lib/seasonal-menu/stage-json";
import { flattenMenuItems } from "@/lib/seasonal-menu/menu-item-format";
import { downloadStageAsA4Pdf } from "@/lib/seasonal-menu/export-stage-to-pdf";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "@/lib/seasonal-menu/a4-dimensions";
import { useI18n } from "@/app/components/i18n-provider";
import { MenuItemsPanel } from "@/app/components/seasonal-menu/menu-items-panel";
import { SeasonalMenuToolbar } from "@/app/components/seasonal-menu/seasonal-menu-toolbar";
import type { SeasonalMenuEditorHandle } from "@/app/components/seasonal-menu/seasonal-menu-editor";

const SeasonalMenuEditor = dynamic(
  () =>
    import("@/app/components/seasonal-menu/seasonal-menu-editor").then(
      (m) => m.SeasonalMenuEditor,
    ),
  { ssr: false, loading: () => <div className="h-[600px] animate-pulse rounded-xl bg-foreground/10" /> },
);

type SeasonalMenuDesignerClientProps = {
  design: SeasonalMenuDesignApi;
  initialDocument: SeasonalMenuDocument | null;
  initialMenuData: GlobalMenuData;
  locations: Array<{ id: string; name: string }>;
};

export function SeasonalMenuDesignerClient({
  design: initialDesign,
  initialDocument,
  initialMenuData,
  locations,
}: SeasonalMenuDesignerClientProps) {
  const { t } = useI18n();
  const editorRef = useRef<SeasonalMenuEditorHandle | null>(null);

  const [design, setDesign] = useState(initialDesign);
  const [title, setTitle] = useState(initialDesign.title);
  const [nodes, setNodes] = useState<EditorNode[]>(() =>
    initialDocument
      ? parseEditorNodesFromStageJson(initialDocument.pages[0]?.stageJson)
      : [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(initialDesign.locationId);
  const [menuData, setMenuData] = useState<GlobalMenuData>(initialMenuData);
  const [menuLoading, setMenuLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [insertOffset, setInsertOffset] = useState(0);

  const menuItems = useMemo(
    () => flattenMenuItems(menuData?.categories ?? []),
    [menuData],
  );

  const locationLabel = useMemo(() => {
    if (!locationId) return "";
    return locations.find((l) => l.id === locationId)?.name ?? "";
  }, [locationId, locations]);

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
    return {
      version: 1,
      pageSize: { width: A4_WIDTH_PX, height: A4_HEIGHT_PX },
      pages: [{ stageJson: editorNodesToStageJson(nodes) }],
    };
  }, [nodes]);

  const persist = useCallback(async () => {
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
  }, [buildDocument, design.id, design.title, locationId, title, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (nodes.length >= 0) {
        void persist();
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [nodes, title, locationId, persist]);

  const handleInsertItem = useCallback(
    (item: MenuItem) => {
      const col = insertOffset % 2;
      const row = Math.floor(insertOffset / 2);
      const x = 48 + col * 360;
      const y = 80 + row * 140;
      setNodes((prev) => [...prev, createMenuItemNode(item, x, y)]);
      setInsertOffset((o) => o + 1);
    },
    [insertOffset],
  );

  const handleAddText = useCallback(() => {
    const text = window.prompt(t("seasonalMenu.addText"), "Seasonal menu");
    if (!text?.trim()) return;
    setNodes((prev) => [...prev, createTextNode(48, 40, text.trim())]);
  }, [t]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const handleExportPdf = useCallback(async () => {
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
    } catch {
      setSaveError(t("seasonalMenu.exportFailed"));
    }
  }, [persist, title, t]);

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
        onAddText={handleAddText}
        onDeleteSelected={handleDeleteSelected}
        onExportPdf={() => void handleExportPdf()}
        hasSelection={Boolean(selectedId)}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <SeasonalMenuEditor
            ref={editorRef}
            nodes={nodes}
            selectedId={selectedId}
            onNodesChange={setNodes}
            onSelect={setSelectedId}
          />
        </div>
        <MenuItemsPanel
          items={menuItems}
          loading={menuLoading}
          locationLabel={locationLabel}
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
