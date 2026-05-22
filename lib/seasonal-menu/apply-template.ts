import { buildBackgroundLayer } from "@/lib/seasonal-menu/build-background-layer";
import {
  createMenuItemNode,
  createTextNode,
  editorNodesToStageJson,
  type EditorNode,
} from "@/lib/seasonal-menu/stage-json";
import { getTemplateTheme } from "@/lib/seasonal-menu/templates";
import type {
  BuildLayoutInput,
  BuildLayoutResult,
  EditorNodeStyle,
} from "@/lib/seasonal-menu/templates/types";
import { LAYOUT } from "@/lib/seasonal-menu/templates/types";

export function themeToNodeStyle(theme: EditorNodeStyle): EditorNodeStyle {
  return { ...theme };
}

export function buildLayoutFromTemplate(input: BuildLayoutInput): BuildLayoutResult {
  const theme = getTemplateTheme(input.templateId);
  const style = themeToNodeStyle(theme);
  const menuTitle = input.menuTitle.trim() || "Seasonal Menu";

  const titleNode = createTextNode(
    LAYOUT.marginX,
    LAYOUT.headerY,
    menuTitle.toUpperCase(),
    {
      fontSize: LAYOUT.titleFontSize,
      width: LAYOUT.titleWidth,
      style,
      align: theme.textAlign ?? "center",
      fontStyle: "bold",
    },
  );

  const itemNodes: EditorNode[] = input.items.map((item, index) => {
    const y = LAYOUT.itemsStartY + index * LAYOUT.itemRowHeight;
    return createMenuItemNode(item, LAYOUT.marginX, y, {
      width: LAYOUT.itemWidth,
      style,
    });
  });

  const nodes: EditorNode[] = [titleNode, ...itemNodes];
  const backgroundLayer = buildBackgroundLayer(theme);
  const stageJson = editorNodesToStageJson(nodes, backgroundLayer);

  return {
    templateId: input.templateId,
    theme,
    menuTitle,
    nodes,
    backgroundLayer,
    stageJson,
  };
}
